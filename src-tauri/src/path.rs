//! States and function for working with robot paths.

use std::{
    fmt::Display,
    io::{ErrorKind, Write},
    path::PathBuf,
    str::FromStr,
};

use geo_types::{LineString, MultiPoint};
use geojson::{FeatureCollection, GeoJson, Geometry, Value};
use serde::{de, Deserialize, Serialize};
use serde_json::{json, Map};
use tauri::{
    api::{self, file},
    AppHandle,
};

#[derive(Debug)]
pub struct PathData {
    version: String,
    path: LineString<f64>,
    collection_points: MultiPoint<f64>,
}

impl Default for PathData {
    fn default() -> Self {
        Self {
            path: LineString(vec![]),
            collection_points: MultiPoint(vec![]),
            version: String::from("0.1.0"),
        }
    }
}

impl FromStr for PathData {
    type Err = String;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        let geojson: GeoJson = value.parse().map_err(|e| format!("{e}"))?;
        Self::try_from(geojson)
    }
}

impl Display for PathData {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", GeoJson::from(self))
    }
}

impl TryFrom<GeoJson> for PathData {
    type Error = String;

    fn try_from(value: GeoJson) -> Result<Self, Self::Error> {
        log::info!("Parsing Feature Collection");
        let features =
            FeatureCollection::try_from(value).map_err(|_| String::from("Invalid Spec"))?;
        log::debug!("Feature Collection: {}", features);

        // Checking for version
        log::info!("Checking Version");
        let foreign_members = features
            .foreign_members
            .ok_or(String::from("Invalid Path GeoJSON: Missing Version"))?;
        let version = foreign_members
            .get("version")
            .ok_or(String::from("Invalid Path GeoJSON: Missing Version"))?
            .as_str()
            .ok_or(String::from("Invalid Path GeoJSON: Invalid Version"))?;
        log::debug!("Version: {}", version);

        log::info!("Extracting Features");
        let features = features.features;
        if features.len() != 2 {
            return Err(String::from("Invalid Path GeoJSON: Path GeoJSON requires two features (Multi Point and Line String)."));
        }
        log::debug!("Features: {:?}", features);

        // Extracting Geometries
        log::info!("Extracting Geometries");
        let mut geometries = features
            .into_iter()
            .map(|f| f.geometry)
            .collect::<Option<Vec<Geometry>>>()
            .ok_or(String::from("Invalid Path GeoJSON: Path GeoJSON requires two features (Multi Point and Line String)."))?;
        log::debug!("Geometries: {:?}", geometries);

        // Extracting Path and Points
        log::info!("Extracting Path and Points");
        let (path, points) = match (geometries.remove(0).value, geometries.remove(0).value) {
            (p @ Value::MultiPoint(_), l @ Value::LineString(_)) => (l, p),
            (l @ Value::LineString(_), p @ Value::MultiPoint(_)) => (l, p),
            _ => return Err(String::from("Invalid Path GeoJSON: Path GeoJSON requires two features (Multi Point and Line String).")),
        };
        log::debug!("Path: {}", path);
        log::debug!("Points: {}", points);

        Ok(Self {
            // We can safely unwrap as we know the values will work
            path: LineString::try_from(path).unwrap(),
            collection_points: MultiPoint::try_from(points).unwrap(),
            version: String::from(version),
        })
    }
}

impl From<PathData> for GeoJson {
    fn from(value: PathData) -> Self {
        GeoJson::from(&value)
    }
}

impl From<&mut PathData> for GeoJson {
    fn from(value: &mut PathData) -> Self {
        GeoJson::from(&*value)
    }
}

impl From<&PathData> for GeoJson {
    fn from(value: &PathData) -> Self {
        let points = geojson::Value::from(&value.collection_points);
        let path = geojson::Value::from(&value.path);
        let mut foreign_members = Map::new();
        foreign_members.insert(String::from("version"), json!(&value.version));

        let collection = FeatureCollection {
            bbox: None,
            features: vec![points.into(), path.into()],
            foreign_members: Some(foreign_members),
        };
        GeoJson::from(collection)
    }
}

impl Serialize for PathData {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        GeoJson::from(self).serialize(serializer)
    }
}

impl<'de> Deserialize<'de> for PathData {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        GeoJson::deserialize(deserializer)?
            .try_into()
            .map_err(de::Error::custom)
    }
}

#[tauri::command]
/// Read data from application storage.
pub fn read_path(app_handle: AppHandle) -> Result<PathData, String> {
    log::debug!("Reading Path");
    let mut data_dir = app_handle
        .path_resolver()
        .app_data_dir()
        .ok_or(String::from("Unable to Get App Data Directory"))?;
    data_dir.push("path.geojson");
    log::debug!("Application GeoJSON Path: {}", data_dir.display());

    import_path(data_dir)
}

#[tauri::command]
/// Import path data from the file system.
pub fn import_path(import_path: PathBuf) -> Result<PathData, String> {
    log::debug!("Importing from: {}", import_path.display());
    Ok(match file::read_string(&import_path) {
        Ok(v) => PathData::from_str(&v)?,
        Err(api::Error::Io(e)) => match e.kind() {
            ErrorKind::NotFound => {
                log::warn!(
                    "Unable to find Path: {}, using default PathData",
                    import_path.display()
                );
                PathData::default()
            }
            _ => return Err(e.to_string()),
        },
        Err(e) => return Err(e.to_string()),
    })
}

#[tauri::command]
/// Export path data to the file system.
pub fn export_path(export_path: PathBuf, path: PathData) -> Result<(), String> {
    log::debug!("Exporting to: {}", export_path.display());
    let mut file = std::fs::File::create(export_path).map_err(|e| e.to_string())?;
    write!(file, "{}", path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
/// Save data to application storage.
pub fn save_path(app_handle: AppHandle, path: PathData) -> Result<(), String> {
    log::debug!("Saving Path");
    let mut data_dir = app_handle
        .path_resolver()
        .app_data_dir()
        .ok_or(String::from("Unable to Get App Data Directory"))?;
    data_dir.push("path.geojson");
    log::debug!("Application GeoJSON Path: {}", data_dir.display());

    export_path(data_dir, path)
}
