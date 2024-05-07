//! Implementations of communication protocol between the boat and desktop application.

use std::{
    collections::HashMap,
    fmt::Debug,
    io::{ErrorKind, Read, Write},
    sync::Mutex,
    time::Duration,
};

use prost::Message;
use rayon::iter::{IntoParallelIterator, ParallelIterator};
use serde::Serialize;
use serialport::{SerialPort, SerialPortInfo};
use tauri::Manager;

use self::babara_project::{
    connection::{self, packet::PacketType, Connect, Received},
    data::{BoatData, PathData},
};

/// Googles protobuf package
pub mod google {
    /// Googles common types protobuf package
    pub mod r#type {
        include!(concat!(env!("OUT_DIR"), "/google.r#type.rs"));

        impl From<&geo_types::Point> for LatLng {
            fn from(value: &geo_types::Point) -> Self {
                Self {
                    latitude: value.y(),
                    longitude: value.x(),
                }
            }
        }

        impl From<geo_types::Point> for LatLng {
            fn from(value: geo_types::Point) -> Self {
                Self::from(&value)
            }
        }

        impl From<&mut geo_types::Point> for LatLng {
            fn from(value: &mut geo_types::Point) -> Self {
                Self::from(&*value)
            }
        }
    }
}

/// Babara Group Project protobuf types.
pub mod babara_project {
    /// Modules for connection related protobuf types.
    pub mod connection {
        include!(concat!(env!("OUT_DIR"), "/babara_project.connection.rs"));
    }

    /// Modules for data related protobuf types.
    pub mod data {
        include!(concat!(env!("OUT_DIR"), "/babara_project.data.rs"));

        impl From<&crate::data::BoatData> for BoatData {
            fn from(value: &crate::data::BoatData) -> Self {
                Self {
                    version: value.version().to_string(),
                    features: value
                        .features()
                        .iter()
                        .map(boat_data::BoatDataFeature::from)
                        .collect(),
                }
            }
        }

        impl From<crate::data::BoatData> for BoatData {
            fn from(value: crate::data::BoatData) -> Self {
                Self::from(&value)
            }
        }

        impl From<&mut crate::data::BoatData> for BoatData {
            fn from(value: &mut crate::data::BoatData) -> Self {
                Self::from(&*value)
            }
        }

        impl From<&crate::data::BoatDataFeature> for boat_data::BoatDataFeature {
            fn from(value: &crate::data::BoatDataFeature) -> Self {
                Self {
                    temperature: value.temperature(),
                    depth: value.depth(),
                    layer: boat_data::Layer::from(value.layer()).into(),
                    time: Some(prost_types::Timestamp {
                        seconds: value.time().timestamp(),
                        // Do we need that much precision?
                        nanos: 0,
                    }),
                    geometry: Some(value.geometry().into()),
                }
            }
        }

        impl From<crate::data::BoatDataFeature> for boat_data::BoatDataFeature {
            fn from(value: crate::data::BoatDataFeature) -> Self {
                Self::from(&value)
            }
        }

        impl From<&mut crate::data::BoatDataFeature> for boat_data::BoatDataFeature {
            fn from(value: &mut crate::data::BoatDataFeature) -> Self {
                Self::from(&*value)
            }
        }

        impl From<&crate::data::Layer> for boat_data::Layer {
            fn from(value: &crate::data::Layer) -> Self {
                use crate::data::Layer;
                match value {
                    Layer::Surface => Self::Surface,
                    Layer::Middle => Self::Middle,
                    Layer::SeaBed => Self::SeaBed,
                }
            }
        }

        impl From<&mut crate::data::Layer> for boat_data::Layer {
            fn from(value: &mut crate::data::Layer) -> Self {
                Self::from(&*value)
            }
        }

        impl From<crate::data::Layer> for boat_data::Layer {
            fn from(value: crate::data::Layer) -> Self {
                Self::from(&value)
            }
        }

        impl From<&crate::path::PathData> for PathData {
            fn from(value: &crate::path::PathData) -> Self {
                Self {
                    version: value.version().to_string(),
                    points: value
                        .collection_points()
                        .iter()
                        .map(super::super::google::r#type::LatLng::from)
                        .collect(),
                }
            }
        }

        impl From<crate::path::PathData> for PathData {
            fn from(value: crate::path::PathData) -> Self {
                Self::from(&value)
            }
        }

        impl From<&mut crate::path::PathData> for PathData {
            fn from(value: &mut crate::path::PathData) -> Self {
                Self::from(&*value)
            }
        }
    }
}

#[derive(Debug, Default)]
pub struct ConnectedBoats {
    pub boats: Mutex<HashMap<String, BoatPort>>,
}

/// Event payload when the port received BoatData.
///
/// This is mainly used by `BoatPort::handle_boat_data` private method.
#[derive(Debug, Serialize, Clone)]
struct ReceivedDataPayload {
    /// The data received from the port.
    data: crate::data::BoatData,
    /// The port name that received the data.
    port: String,
}

impl ReceivedDataPayload {
    /// Creates a new payload.
    fn new(data: crate::data::BoatData, port: String) -> Self {
        Self { data, port }
    }
}

/// Wrapper struct for a serial port specfically used for communicating with the boat.
pub struct BoatPort {
    /// The serial port connected to the boat.
    port: Box<dyn SerialPort>,
    /// The serial port name.
    name: String,
    /// Tauri AppHandle used internally to emit events.
    app_handle: tauri::AppHandle,
    /// The connection status of the port.
    connected: bool,
    /// Current Data Buffer of the Serial Port.
    buf: Vec<u8>,
}

impl Debug for BoatPort {
    /// Debug formatting to only print the port name and the connection status.
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("BoatPort")
            .field("name", &self.name)
            .field("connected", &self.connected)
            .finish()
    }
}

impl BoatPort {
    /// Creates a new connection port to the boat.
    pub fn new(port_name: String, app_handle: tauri::AppHandle) -> Result<Self, String> {
        log::info!("Opening Port: {}", port_name);
        let port = serialport::new(&port_name, 9600)
            .timeout(Duration::from_millis(100))
            .open()
            .map_err(|e| e.to_string())?;
        let mut port = Self {
            name: port_name,
            port,
            app_handle,
            connected: true,
            buf: vec![],
        };

        if port.check_connection() {
            Ok(port)
        } else {
            Err(String::from("Not a valid port to communicate with"))
        }
    }

    /// Check if the port is connected
    pub fn check_connection(&mut self) -> bool {
        // Try to connect 10 times
        for _ in 0..10 {
            log::info!("Sending Connection Message");
            if self
                .send_packet(
                    1,
                    &connection::Connect {
                        version: String::from("0.1.0"),
                    },
                )
                .is_err()
            {
                let _ = self.disconnect();
                return false;
            };

            // Wait for boat to reply
            std::thread::sleep(Duration::from_millis(200));
            return match self.receive_packet() {
                Ok(PacketType::Connect) => true,
                Ok(_) => continue,
                // Continuing if we are still connected
                Err(_) if self.connected() => continue,
                Err(_) => {
                    let _ = self.disconnect();
                    return false;
                }
            };
        }
        let _ = self.disconnect();
        false
    }

    /// Creates a new connection port to the boat.
    pub fn from_port_info(
        port: SerialPortInfo,
        app_handle: tauri::AppHandle,
    ) -> Result<Self, String> {
        Self::new(port.port_name, app_handle)
    }

    /// Handle a recived packet from a serial port.
    fn handle_packet(&mut self, buf: &[u8], packet_type: PacketType) -> Result<PacketType, String> {
        match packet_type {
            PacketType::BoatData => self.handle_boat_data(buf),
            PacketType::Connect => Connect::decode(buf)
                .map_err(|e| e.to_string())
                .map(|_| packet_type),
            PacketType::Received => Received::decode(buf)
                .map_err(|e| e.to_string())
                .map(|_| packet_type),
            PacketType::PathData => Err(String::from("Invalid Packet")),
            PacketType::Undefined => Err(String::from("Invalid Packet")),
        }
    }

    /// Handles a BoatData from the boat.
    fn handle_boat_data(&mut self, buf: &[u8]) -> Result<PacketType, String> {
        let data = BoatData::decode(buf).map_err(|e| e.to_string())?;
        self.app_handle
            .emit_all(
                "received-data",
                ReceivedDataPayload::new(
                    crate::data::BoatData::try_from(data)?,
                    self.name().to_string(),
                ),
            )
            .map_err(|e| e.to_string())?;
        Ok(PacketType::BoatData)
    }

    /// Send a packet to a serial port.
    fn send_packet<P: Message>(&mut self, packet_type: i32, packet: &P) -> Result<(), String> {
        let packet_type =
            connection::packet::PacketType::try_from(packet_type).map_err(|e| e.to_string())?;
        let data = connection::Packet {
            version: String::from("0.1.0"),
            r#type: packet_type.into(),
            data: packet.encode_to_vec(),
        };
        self.port
            .write(&data.encode_length_delimited_to_vec())
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    /// Sends PathData to the port.
    pub fn send_path(&mut self, data: PathData) -> Result<(), String> {
        for _ in 0..10 {
            self.send_packet(PacketType::PathData.into(), &data)?;
            // Wait for boat to reply
            std::thread::sleep(Duration::from_millis(200));
            match self.receive_packet() {
                Ok(PacketType::Received) => {
                    log::info!("Successfully Sent Path to Boat");
                    return Ok(());
                }
                // Continuing if we are still connected
                Ok(_) => continue,
                // Continuing if we are still connected
                Err(_) if self.connected() => continue,
                Err(e) => return Err(e),
            }
        }
        Err(String::from("No Response from the Port"))
    }

    /// Receive a packet from the serial port.
    ///
    /// This function will return `Err` if the port is not connected.
    pub fn receive_packet(&mut self) -> Result<connection::packet::PacketType, String> {
        macro_rules! handle_error {
            ($result:expr, $log_msg:expr) => {
                match $result {
                    Ok(v) => v,
                    Err(e) => {
                        log::info!($log_msg);
                        return Err(e.to_string());
                    }
                }
            };
        }

        if !self.connected() {
            return Err(String::from("Port not Connected"));
        }

        match self.port.read_to_end(&mut self.buf) {
            Ok(_) => (),
            // Retry if we get a timeout
            Err(e) if e.kind() == ErrorKind::TimedOut => {
                if self.buf.is_empty() {
                    return Err(String::from("Nothing is Received"));
                }
            }
            Err(e) => {
                self.disconnect()?;
                log::info!("Disconnected, Reason: {}", e);
                return Err(e.to_string());
            }
        };

        if let Ok(length) = prost::decode_length_delimiter(&*self.buf) {
            let size = length + prost::length_delimiter_len(length);
            if self.buf.len() < size {
                return Err(String::from("Nothing is Received"));
            };

            let data: Vec<u8> = self.buf.drain(..size).collect();
            log::info!("Received Data");
            log::debug!("Data Received: {:?}", data);
            let message = handle_error!(
                connection::Packet::decode_length_delimited(&*data),
                "Received and Invalid Packet"
            );
            let packet_type = handle_error!(
                PacketType::try_from(message.r#type),
                "Received an Invalid PacketType"
            );

            self.buf.clear();
            Ok(handle_error!(
                self.handle_packet(&message.data, packet_type),
                "Received an Invalid Packet Data"
            ))
        } else {
            Err(String::from("Nothing is Received"))
        }
    }

    /// Gets the name of the port.
    pub fn name(&self) -> &str {
        &self.name
    }

    /// Gets the connection status of the port.
    pub fn connected(&self) -> bool {
        self.connected
    }

    /// Disconnects the port
    fn disconnect(&mut self) -> Result<(), String> {
        self.connected = false;
        self.app_handle
            .emit_all("disconnected", self.name.as_str())
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}

/// Search for available serial ports for communication.
#[tauri::command]
pub async fn find_ports(
    state: tauri::State<'_, ConnectedBoats>,
    app_handle: tauri::AppHandle,
) -> Result<Vec<String>, String> {
    let mut boats = state.boats.lock().unwrap();

    // Clearing all disconnected ports
    // Maybe we can do it in a better way?
    let statuses: Vec<_> = boats
        .iter()
        .map(|v| (v.1.connected(), v.0.to_string()))
        .collect();
    for status in statuses {
        if !status.0 {
            boats.remove(&status.1);
        }
    }

    log::info!("Finding Available Ports");
    let ports = serialport::available_ports().map_err(|e| e.to_string())?;
    let ports: Vec<SerialPortInfo> = ports
        .into_iter()
        .filter(|v| !boats.contains_key(&v.port_name))
        .collect();
    log::debug!("Found Ports: {:?}", &ports);

    log::info!("Connecting to Ports");
    let checked_ports: Vec<Result<BoatPort, String>> = ports
        .into_par_iter()
        .map(|v| BoatPort::from_port_info(v, app_handle.clone()))
        .collect();
    log::debug!("Ports Status: {:?}", &checked_ports);
    let available_ports: Vec<BoatPort> = checked_ports.into_iter().filter_map(|v| v.ok()).collect();
    log::debug!("New Valid Ports: {:?}", &available_ports);

    for port in available_ports {
        let port_name = port.name().to_string();
        let app_handle = app_handle.clone();
        std::thread::spawn(move || {
            let state: tauri::State<'_, ConnectedBoats> = app_handle.state();
            let mut timeout_count: u8 = 0;
            loop {
                let mut boats = state.boats.lock().unwrap();
                let port = match boats.get_mut(&port_name) {
                    Some(v) => v,
                    None => return,
                };

                match port.receive_packet() {
                    Ok(_) => (),
                    // Continuing if we are still connected
                    Err(_) if port.connected() => timeout_count += 1,
                    Err(_) => return,
                };
                if timeout_count > 10 {
                    log::info!("Checking Connection to: {}", port_name);
                    if !port.check_connection() {
                        log::info!("Connection Disconnected with: {}", port_name);
                        return;
                    } else {
                        timeout_count = 0;
                    }
                }
                drop(boats);
                std::thread::sleep(Duration::from_millis(200));
            }
        });
        boats.insert(port.name().to_string(), port);
    }
    Ok(boats.keys().cloned().collect())
}

/// Send PathData to the connected port.
#[tauri::command]
pub fn send_path(
    state: tauri::State<ConnectedBoats>,
    port: String,
    data: crate::path::PathData,
) -> Result<(), String> {
    log::info!("Sending Path Data to {port}");
    let mut ports = state.boats.lock().unwrap();
    let port = ports
        .get_mut(&port)
        .ok_or(format!("Unable to find port: {port}"))?;
    port.send_path(data.into())
}
