// «Пульт главспеца» 4.0 on Tauri: the unchanged interface, the shared JavaScript rules (src/core) and this Rust
// core for the files, the tray and the system. The data folder is the one of 3.x: %APPDATA%\GlavspecWidget.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde_json::{json, Value};
use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

mod cabinet;
mod files;
mod io;
mod native;
mod system;
use files::Files;
use tauri::State;

type Res<T> = Result<T, String>;

#[tauri::command]
fn store_load(files: State<Files>) -> Res<Value> {
    let mut r = files.load()?;
    r["dir"] = json!(files.dir.to_string_lossy());
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
    // 4.4 (41): Ctrl+Alt+N from any program — quick entry of a card; the window comes up with the input line.
    let quick = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyN);
    let quick_register = quick.clone();
    let files = match Files::open() {
        Ok(f) => f,
        Err(e) => {
            eprintln!("Папка данных недоступна: {e}");
            std::process::exit(1);
        }
    };
    tauri::Builder::default()
        // A second start brings the running window forward instead of opening another copy.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| system::show_main(app)))
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, None))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(files)
        .manage(cabinet::LocalServer(std::sync::Mutex::new(None)))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, shortcut, event| {
                    if shortcut == &hotkey && event.state() == ShortcutState::Pressed {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.emit("probe:ghost-toggle", ());
                        }
                    }
                    if shortcut == &quick && event.state() == ShortcutState::Pressed {
                        if let Some(window) = app.get_webview_window("main") {
                            // Whether it was in front decides if it goes away again after Enter.
                            let was = window.is_visible().unwrap_or(false) && window.is_focused().unwrap_or(false) && !window.is_minimized().unwrap_or(false);
                            let _ = window.unminimize();
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = window.emit("quick:open", serde_json::json!({ "wasInFront": was }));
                        }
                    }
                })
                .build(),
        )
        .setup(move |app| {
            if let Err(e) = app.global_shortcut().register(to_register) {
                eprintln!("Горячая клавиша Ctrl+Alt+G занята другой программой: {e}");
            }
            if let Err(e) = app.global_shortcut().register(quick_register) {
                eprintln!("Горячая клавиша Ctrl+Alt+N занята другой программой: {e}");
            }
            system::create_tray(app.handle())?;
            // The window starts hidden and shows itself once its saved size and place are applied.
            // If the page fails to do that, show it anyway.
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_secs(5));
                if let Some(w) = handle.get_webview_window("main") {
                    if !w.is_visible().unwrap_or(true) {
                        let _ = w.show();
                    }
                }
            });
            Ok(())
        })
        // The close button and Alt+F4 hide the main window to the tray; quitting is in the tray menu.
        // Separate windows (a project, a chat) simply close.
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            store_load, store_save, settings_load, settings_save, journal_append, journal_read,
            system::tray_set, system::notify, system::autostart_get, system::autostart_set,
            system::window_to_bottom, system::desktop_supported, system::open_data_folder, system::app_quit, system::update_run, system::app_icon,
            io::dialog_save, io::dialog_open, io::dialog_confirm, io::fs_write, io::fs_read, io::fs_exists, io::fs_mkdir,
            io::fs_list, io::fs_remove, io::open_path, io::open_url, io::known_dirs, io::print_html,
            cabinet::http_request, cabinet::secret_protect, cabinet::secret_unprotect,
            cabinet::cabinet_local_start, cabinet::cabinet_local_stop, cabinet::cabinet_local_running,
            native::snap_layouts, native::notify_actions
        ])
        .build(tauri::generate_context!())
        .expect("Пульт главспеца не запустился")
        // The built-in cabinet server is a child process: it stops with the app.
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                cabinet::stop(&app.state::<cabinet::LocalServer>());
            }
        });
}
