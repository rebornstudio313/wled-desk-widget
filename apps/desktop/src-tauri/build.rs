fn main() {
    let file = std::path::PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap())
        .join("../src/build-info.json");
    println!("cargo:rerun-if-changed={}", file.display());
    let data: serde_json::Value = serde_json::from_slice(
        &std::fs::read(&file).expect("Run scripts/prepare-build.mjs before building"),
    )
    .unwrap();
    assert_eq!(
        data["version"].as_str().unwrap(),
        std::env::var("CARGO_PKG_VERSION").unwrap(),
        "Build metadata and package versions must agree"
    );
    for (field, key) in [
        ("buildId", "WLED_DESK_BUILD_ID"),
        ("builtAt", "WLED_DESK_BUILT_AT"),
        ("sourceHash", "WLED_DESK_SOURCE_HASH"),
    ] {
        println!("cargo:rustc-env={key}={}", data[field].as_str().unwrap());
    }
    tauri_build::build();
}
