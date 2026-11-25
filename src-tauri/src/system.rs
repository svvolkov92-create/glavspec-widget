// System side of the window: the tray icon and its menu, notifications, start with Windows,
// «on the desktop» (the window kept under the others), the data folder, quitting.
// The menu content and every decision come from the window (tauri-api.js); this file only talks to Windows.
use serde::Deserialize;
use std::sync::atomic::{AtomicU8, Ordering};
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

/* ---------- 4.10 (item 69): the icon variant picked in «Окно → Значок» ---------- */
// №1 is built into the installer, the exe and shortcuts; the others change the window and tray icons while running.
static APP_ICON: AtomicU8 = AtomicU8::new(1);
fn icon_bytes(n: u8) -> (&'static [u8], &'static [u8]) {
    match n {
        3 => (include_bytes!("../icons/variants/app-3.png"), include_bytes!("../icons/variants/tray-3.png")),
        4 => (include_bytes!("../icons/variants/app-4.png"), include_bytes!("../icons/variants/tray-4.png")),
        6 => (include_bytes!("../icons/variants/app-6.png"), include_bytes!("../icons/variants/tray-6.png")),
        8 => (include_bytes!("../icons/variants/app-8.png"), include_bytes!("../icons/variants/tray-8.png")),
        _ => (include_bytes!("../icons/variants/app-1.png"), include_bytes!("../icons/variants/tray-1.png")),
    }
}
/// variant given: remember it and set it on every window and the tray; none: a new window takes the remembered one.
#[tauri::command]
pub fn app_icon(app: AppHandle, window: WebviewWindow, variant: Option<u8>) -> Result<u8, String> {
    if let Some(v) = variant {
        if ![1u8, 3, 4, 6, 8].contains(&v) {
            return Err(format!("Нет значка №{v}"));
        }
        APP_ICON.store(v, Ordering::Relaxed);
    }
    let n = APP_ICON.load(Ordering::Relaxed);
    let (app_png, tray_png) = icon_bytes(n);
    let img = Image::from_bytes(app_png).map_err(|e| e.to_string())?;
    if variant.is_some() {
        for (_, w) in app.webview_windows() {
            let _ = w.set_icon(img.clone());
        }
        if let Some(tray) = app.tray_by_id(TRAY_ID) {
            let t = Image::from_bytes(tray_png).map_err(|e| e.to_string())?;
            let _ = tray.set_icon(Some(t));
        }
    } else {
        let _ = window.set_icon(img);
    }
    Ok(n)
}

pub fn create_tray(app: &AppHandle) -> tauri::Result<()> {
    let icon = Image::from_bytes(include_bytes!("../icons/tray.png"))?;
    TrayIconBuilder::with_id(TRAY_ID)
        .icon(icon)
        .tooltip("Пульт главспеца")
        .show_menu_on_left_click(false)
        .on_tray_icon_event(|tray, event| match event {
            // 4.1.1 (item 35): a left click opens the «Сегодня» mini panel next to the clock; the window places it.
            // The position is physical pixels of the click.
            TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, position, .. } => {
                let _ = tray.app_handle().emit("tray:click", serde_json::json!({ "x": position.x, "y": position.y }));
            }
            // A double click (Windows) opens the whole Пульт, as before.
            TrayIconEvent::DoubleClick { button: MouseButton::Left, .. } => show_main(tray.app_handle()),
            _ => {}
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

// 65 «Обновить»: the installer downloaded from the Сервер Пульта (the window has checked its SHA-256) goes to the
// data folder (updates\) and starts; the program quits so the installer can replace its files.
#[tauri::command]
pub fn update_run(app: AppHandle, files: State<Files>, version: String, base64: String) -> Result<(), String> {
    use base64::{engine::general_purpose::STANDARD, Engine};
    if version.is_empty() || version.len() > 20 || !version.chars().all(|c| c.is_ascii_digit() || c == '.') {
        return Err("Неверный номер версии.".into());
    }
    let bytes = STANDARD.decode(base64).map_err(|e| e.to_string())?;
    // A Windows program starts with «MZ»: anything else is not started.
    if bytes.len() < 1024 || &bytes[..2] != b"MZ" {
        return Err("Это не установщик Windows.".into());
    }
    let dir = files.dir.join("updates");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(format!("PultGlavspeca_{version}_x64-setup.exe"));
    std::fs::write(&path, &bytes).map_err(|e| format!("Не удалось сохранить установщик: {e}"))?;
    std::process::Command::new(&path).spawn().map_err(|e| format!("Установщик не запустился: {e}"))?;
    app.exit(0);
    Ok(())
}
