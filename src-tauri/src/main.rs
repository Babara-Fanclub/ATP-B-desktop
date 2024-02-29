// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod data;
mod path;

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
        ])
        .plugin(
            tauri_plugin_log::Builder::default()
                .targets([LogTarget::LogDir, LogTarget::Stdout, LogTarget::Webview])
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
