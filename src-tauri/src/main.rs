// «Пульт главспеца» on Tauri (probe, stage 2): the unchanged interface, the shared JavaScript rules (src/core)
// and this Rust core for the files. The probe works on its own copy of the data: %APPDATA%\GlavspecWidget-tauri.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde_json::{json, Value};
use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

mod files;
use files::Files;
use tauri::State;

type Res<T> = Result<T, String>;

#[tauri::command]
fn store_load(files: State<Files>) -> Res<Value> {
    let mut r = files.load()?;
    r["dir"] = json!(files.dir.to_string_lossy());
    r["copiedFrom"] = json!(files.copied_from.as_ref().map(|p| p.to_string_lossy().into_owned()));
    Ok(r)
}

#[tauri::command]
fn store_save(files: State<Files>, data: Value, day: String) -> Res<()> {
    files.save(&data, &day)
}

#[tauri::command]
fn settings_load(files: State<Files>) -> Value {
    files.settings_load()
}

#[tauri::command]
fn settings_save(files: State<Files>, values: Value) -> Res<()> {
    files.settings_save(&values)
}

#[tauri::command]
fn journal_append(files: State<Files>, lines: Vec<Value>) -> Res<()> {
    files.journal_append(&lines)
}

#[tauri::command]
fn journal_read(files: State<Files>, since: String, limit: Option<usize>) -> Vec<Value> {
    files.journal_read(&since, limit.unwrap_or(3000))
}

fn main() {
    // Ctrl+Alt+G toggles click-through, as in the Electron version: the way back when the window ignores the mouse.
    let hotkey = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyG);
    let to_register = hotkey.clone();
    let files = match Files::open() {
        Ok(f) => f,
        Err(e) => {
            eprintln!("Папка данных недоступна: {e}");
            std::process::exit(1);
        }
    };
    tauri::Builder::default()
        .manage(files)
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
        .invoke_handler(tauri::generate_handler![store_load, store_save, settings_load, settings_save, journal_append, journal_read])
        .run(tauri::generate_context!())
        .expect("Пульт (проба Tauri) не запустился");
}
