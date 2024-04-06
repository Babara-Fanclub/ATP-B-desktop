// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod comm_proto;
mod data;
mod path;

use tauri::{Manager, State, WindowEvent};
use tauri_plugin_log::LogTarget;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            path::read_path,
            path::save_path,
            path::import_path,
            path::export_path,
            data::read_data,
            data::save_data,
            data::import_data,
            data::export_data,
            data::import_data_csv,
            data::export_data_csv,
            comm_proto::find_ports,
            comm_proto::send_path,
        ])
        .plugin(
            tauri_plugin_log::Builder::default()
                .targets([LogTarget::LogDir, LogTarget::Stdout, LogTarget::Webview])
                .build(),
        )
        .manage(comm_proto::ConnectedBoats::default())
        .on_window_event(|event| {
            if let WindowEvent::Destroyed = event.event() {
                // Dropping all connected ports when exiting
                let boats: State<'_, comm_proto::ConnectedBoats> = event.window().state();
                boats.boats.lock().unwrap().clear();
            }
        })
        .setup(|app| {
            // Dropping all connected ports when exiting
            let app_handle = app.app_handle();
            ctrlc::set_handler(move || {
                let boats: State<'_, comm_proto::ConnectedBoats> = app_handle.state();
                boats.boats.lock().unwrap().clear();
                std::process::exit(0);
            })?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
