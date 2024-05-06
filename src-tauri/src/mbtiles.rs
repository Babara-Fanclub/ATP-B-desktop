//! Maplibre JS implementation of the MBTiles protocol.
use std::{collections::HashMap, io::Read, str::FromStr};

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

fn parse_bounds(bounds: String) -> Result<serde_json::Value, String> {
    let bounds = bounds.split(',');

    if bounds.clone().count() != 4 {
        Err(String::from("Invalid Bounds"))
    } else {
        let bounds: Vec<serde_json::Value> = bounds
            .map(|bound| {
                Ok(serde_json::Value::Number(
                    serde_json::value::Number::from_str(bound)?,
                ))
            })
            .collect::<Result<Vec<_>, serde_json::Error>>()
            .map_err(error_to_string)?;
        Ok(serde_json::Value::Array(bounds))
    }
}

fn parse_center(center: String) -> Result<serde_json::Value, String> {
    let center = center.split(',');

    if center.clone().count() != 3 {
        Err(String::from("Invalid Bounds"))
    } else {
        let center: Vec<serde_json::Value> = center
            .map(|bound| {
                Ok(serde_json::Value::Number(
                    serde_json::value::Number::from_str(bound)?,
                ))
            })
            .collect::<Result<Vec<_>, serde_json::Error>>()
            .map_err(error_to_string)?;
        Ok(serde_json::Value::Array(center))
    }
}

fn parse_metadata(key: &str, value: String) -> Result<serde_json::Value, String> {
    Ok(match key {
        "name" => serde_json::Value::String(value),
        "format" => serde_json::Value::String(value),
        "bounds" => parse_bounds(value)?,
        "center" => parse_center(value)?,
        "minzoom" => serde_json::Value::Number(value.parse().map_err(error_to_string)?),
        "maxzoom" => serde_json::Value::Number(value.parse().map_err(error_to_string)?),
        "attribution" => serde_json::Value::String(value),
        "description" => serde_json::Value::String(value),
        "type" => serde_json::Value::String(value),
        "version" => serde_json::Value::String(value),
        "json" => serde_json::from_str(&value).map_err(error_to_string)?,
        _ => serde_json::Value::String(value),
    })
}

#[tauri::command]
pub async fn mbtiles_metadata(db: String) -> Result<HashMap<String, serde_json::Value>, String> {
    let mut con = sqlx::SqliteConnection::connect(&db)
        .await
        .map_err(error_to_string)?;
    log::error!("{}", db);

    let metadata: Vec<(String, String)> = sqlx::query_as("SELECT * FROM metadata")
        .fetch_all(&mut con)
        .await
        .map_err(error_to_string)?;
    let mut metadata: HashMap<String, serde_json::Value> = metadata
        .into_iter()
        .map(|(k, v)| {
            let value = parse_metadata(&k, v)?;
            Ok((k, value))
        })
        .collect::<Result<HashMap<_, _>, String>>()?;

    // Flattening JSON value
    if let Some(serde_json::Value::Object(json_value)) = metadata.remove("json") {
        metadata.extend(json_value);
    }
    Ok(metadata)
}
