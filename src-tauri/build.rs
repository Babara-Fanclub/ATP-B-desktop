fn main() {
    prost_build::compile_protos(
        &[
            "communication-protocol/connection.proto",
            "communication-protocol/data.proto",
            "communication-protocol/latlng.proto",
        ],
        &["communication-protocol"],
    )
    .unwrap();
    tauri_build::build()
}
