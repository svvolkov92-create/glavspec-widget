// System side of the window: the tray icon and its menu, notifications, start with Windows,
// «on the desktop» (the window kept under the others), the data folder, quitting.
// The menu content and every decision come from the window (tauri-api.js); this file only talks to Windows.
use serde::Deserialize;
use tauri::{
    image::Image,
    menu::{CheckMenuItem, IsMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, State, WebviewWindow, Wry,
};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_notification::NotificationExt;

use crate::files::Files;

const TRAY_ID: &str = "main";

pub fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
        let _ = w.emit("probe:shown", ());
    }
}

pub fn create_tray(app: &AppHandle) -> tauri::Result<()> {
    let icon = Image::from_bytes(include_bytes!("../icons/tray.png"))?;
    TrayIconBuilder::with_id(TRAY_ID)
        .icon(icon)
        .tooltip("Пульт главспеца")
        .show_menu_on_left_click(false)
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                show_main(tray.app_handle());
            }
        })
        .on_menu_event(|app, event| {
            let id = event.id().as_ref().to_string();
            if id == "show" {
                show_main(app);
            }
            let _ = app.emit("tray:action", id);
        })
        .build(app)?;
    Ok(())
}

#[derive(Deserialize)]
pub struct TrayItem {
    #[serde(default)]
    id: String,
    #[serde(default)]
    label: String,
    #[serde(default)]
    kind: String, // "item" (default), "check", "sep", "sub"
    #[serde(default)]
    checked: bool,
    enabled: Option<bool>,
    #[serde(default)]
    items: Vec<TrayItem>,
}

fn menu_items(app: &AppHandle, items: &[TrayItem]) -> tauri::Result<Vec<Box<dyn IsMenuItem<Wry>>>> {
    let mut out: Vec<Box<dyn IsMenuItem<Wry>>> = Vec::new();
    for it in items {
        let enabled = it.enabled.unwrap_or(true);
        match it.kind.as_str() {
            "sep" => out.push(Box::new(PredefinedMenuItem::separator(app)?)),
            "check" => out.push(Box::new(CheckMenuItem::with_id(app, it.id.as_str(), it.label.as_str(), enabled, it.checked, None::<&str>)?)),
            "sub" => {
                let kids = menu_items(app, &it.items)?;
                let refs: Vec<&dyn IsMenuItem<Wry>> = kids.iter().map(|b| b.as_ref()).collect();
                out.push(Box::new(Submenu::with_id_and_items(app, it.id.as_str(), it.label.as_str(), enabled, &refs)?));
            }
            _ => out.push(Box::new(MenuItem::with_id(app, it.id.as_str(), it.label.as_str(), enabled, None::<&str>)?)),
        }
    }
    Ok(out)
}

// The window sends the whole menu with the current marks, and the tooltip (what needs attention).
#[tauri::command]
pub fn tray_set(app: AppHandle, items: Vec<TrayItem>, tooltip: String) -> Result<(), String> {
    let tray = app.tray_by_id(TRAY_ID).ok_or("Значок у часов не создан.")?;
    let kids = menu_items(&app, &items).map_err(|e| e.to_string())?;
    let refs: Vec<&dyn IsMenuItem<Wry>> = kids.iter().map(|b| b.as_ref()).collect();
    let menu = Menu::with_items(&app, &refs).map_err(|e| e.to_string())?;
    tray.set_menu(Some(menu)).map_err(|e| e.to_string())?;
    let tip: String = tooltip.chars().take(120).collect();
    tray.set_tooltip(Some(tip)).map_err(|e| e.to_string())?;
    Ok(())
}

// A Windows notification; false when Windows does not show it (notifications switched off).
#[tauri::command]
pub fn notify(app: AppHandle, body: String) -> bool {
    app.notification().builder().title("Пульт главспеца").body(body).show().is_ok()
}

#[tauri::command]
pub fn autostart_get(app: AppHandle) -> bool {
    app.autolaunch().is_enabled().unwrap_or(false)
}

#[tauri::command]
pub fn autostart_set(app: AppHandle, on: bool) -> Result<bool, String> {
    let a = app.autolaunch();
    let r = if on { a.enable() } else { a.disable() };
    r.map_err(|e| format!("Не удалось изменить автозапуск: {e}"))?;
    Ok(a.is_enabled().unwrap_or(on))
}

// «On the desktop»: the window goes under all other windows (SetWindowPos with HWND_BOTTOM).
#[tauri::command]
pub fn window_to_bottom(window: WebviewWindow) -> bool {
    to_bottom(&window)
}

#[cfg(windows)]
fn to_bottom(window: &WebviewWindow) -> bool {
    use raw_window_handle::{HasWindowHandle, RawWindowHandle};
    use windows_sys::Win32::UI::WindowsAndMessaging::{SetWindowPos, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE};
    let Ok(handle) = window.window_handle() else { return false };
    let RawWindowHandle::Win32(h) = handle.as_raw() else { return false };
    // HWND_BOTTOM is the handle value 1.
    unsafe { SetWindowPos(h.hwnd.get() as _, 1 as _, 0, 0, 0, 0, SWP_NOSIZE | SWP_NOMOVE | SWP_NOACTIVATE) != 0 }
}

#[cfg(not(windows))]
fn to_bottom(_window: &WebviewWindow) -> bool {
    false
}

#[tauri::command]
pub fn desktop_supported() -> bool {
    cfg!(windows)
}

#[tauri::command]
pub fn open_data_folder(files: State<Files>) -> Result<(), String> {
    #[cfg(windows)]
    let opener = "explorer";
    #[cfg(not(windows))]
    let opener = "xdg-open";
    std::process::Command::new(opener).arg(&files.dir).spawn().map(|_| ()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn app_quit(app: AppHandle) {
    app.exit(0);
}
