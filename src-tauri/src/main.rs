// Tauri probe of «Пульт главспеца»: the unchanged Electron interface, read-only data.
// Reads the same files the Electron version keeps in %APPDATA%\GlavspecWidget and never writes them.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde_json::{json, Value};
use std::{fs, io::ErrorKind, path::PathBuf};

fn data_dir() -> Result<PathBuf, String> {
    std::env::var_os("APPDATA")
        .or_else(|| std::env::var_os("XDG_CONFIG_HOME"))
        .map(|base| PathBuf::from(base).join("GlavspecWidget"))
        .ok_or_else(|| "Не найдена папка APPDATA.".to_string())
}

fn read_json(path: &PathBuf) -> Result<Option<Value>, String> {
    match fs::read_to_string(path) {
        Ok(text) => serde_json::from_str(&text)
            .map(Some)
            .map_err(|e| format!("{}: файл повреждён ({e})", path.display())),
        Err(e) if e.kind() == ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("{}: {e}", path.display())),
    }
}

#[tauri::command]
fn probe_load() -> Result<Value, String> {
    let dir = data_dir()?;
    let data = read_json(&dir.join("data.json"))?;
    let settings = read_json(&dir.join("settings.json"))?.unwrap_or_else(|| json!({}));
    Ok(json!({
        "dir": dir.to_string_lossy(),
        "found": data.is_some(),
        "data": data.unwrap_or_else(|| json!({})),
        "settings": settings,
    }))
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![probe_load])
        .run(tauri::generate_context!())
        .expect("Пульт (проба Tauri) не запустился");
}
