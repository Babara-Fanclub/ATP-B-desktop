//! Implementations of communication protocol between the boat and desktop application.

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
