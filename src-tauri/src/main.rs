// Tauri probe of «Пульт главспеца»: the unchanged Electron interface, read-only data.
// Reads the same files the Electron version keeps in %APPDATA%\GlavspecWidget and never writes them.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde_json::{json, Value};
use std::{fs, io::ErrorKind, path::PathBuf};
use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

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
    // Ctrl+Alt+G toggles click-through, as in the Electron version: the way back when the window ignores the mouse.
    let hotkey = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyG);
    let to_register = hotkey.clone();
    tauri::Builder::default()
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, shortcut, event| {
                    if shortcut == &hotkey && event.state() == ShortcutState::Pressed {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.emit("probe:ghost-toggle", ());
                        }
                    }
                })
                .build(),
        )
        .setup(move |app| {
            if let Err(e) = app.global_shortcut().register(to_register) {
                eprintln!("Горячая клавиша Ctrl+Alt+G занята другой программой: {e}");
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![probe_load])
        .run(tauri::generate_context!())
        .expect("Пульт (проба Tauri) не запустился");
}
