//! Maplibre JS implementation of the MBTiles protocol.
use std::io::Read;

use flate2::read::GzDecoder;
use sqlx::Connection;

use crate::error_to_string;

#[tauri::command]
pub async fn fetch_mbtiles(
    db: String,
    zoom: i32,
    column: i32,
    row: i32,
) -> Result<Vec<u8>, String> {
    let mut con = sqlx::SqliteConnection::connect(&db)
        .await
        .map_err(error_to_string)?;

    let selection: (Vec<u8>,) = sqlx::query_as(
        "SELECT tile_data FROM tiles WHERE zoom_level = $1 AND tile_column = $2 AND tile_row = $3 LIMIT 1") 
        .bind(zoom)
        .bind(column)
        .bind(row)
        .fetch_one(&mut con)
        .await
        .map_err(error_to_string)?;
    let selection = selection.0;

    let decoder = GzDecoder::new(&*selection);
    decoder
        .bytes()
        .collect::<Result<_, _>>()
        .map_err(error_to_string)
}
