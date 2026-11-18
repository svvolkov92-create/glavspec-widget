// 4.4: what only Windows itself can do for the window — Snap Layouts on the own maximize button (33),
// keeping a side of the screen like the taskbar does (37), notifications with buttons (36).
// Everything is decided in the window (tauri-api.js); these commands only talk to Windows.
use serde::Deserialize;
use tauri::{AppHandle, WebviewWindow};
#[cfg(windows)]
use tauri::{Emitter, PhysicalPosition, PhysicalSize};

/* ---------- 33: Snap Layouts ---------- */
// The title bar is the page's own, so Windows does not know where «maximize» is. Hovering it asks Windows for the
// layouts the same way the keyboard does: Win+Z on the focused window (Windows 11).
#[tauri::command]
pub fn snap_layouts(window: WebviewWindow) -> bool {
    let _ = window.set_focus();
    send_win_z()
}

#[cfg(windows)]
fn send_win_z() -> bool {
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP, VK_LWIN};
    let key = |vk: u16, up: bool| INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 { ki: KEYBDINPUT { wVk: vk, wScan: 0, dwFlags: if up { KEYEVENTF_KEYUP } else { 0 }, time: 0, dwExtraInfo: 0 } },
    };
    const VK_Z: u16 = 0x5A;
    let seq = [key(VK_LWIN, false), key(VK_Z, false), key(VK_Z, true), key(VK_LWIN, true)];
    unsafe { SendInput(seq.len() as u32, seq.as_ptr(), std::mem::size_of::<INPUT>() as i32) == seq.len() as u32 }
}

#[cfg(not(windows))]
fn send_win_z() -> bool {
    false
}

/* ---------- 37: a side of the screen (application desktop toolbar) ---------- */
// «left» / «right»: Windows reserves a strip of the given width on the window's monitor, maximized windows of other
// programs no longer go under Пульт, and the window is put into that strip. «off» gives the strip back.
#[cfg(windows)]
static APPBAR: std::sync::Mutex<Option<isize>> = std::sync::Mutex::new(None);

#[cfg(windows)]
const APPBAR_CALLBACK: u32 = 0x0400 + 0x77; // WM_USER + 0x77: Windows' notices are not needed, the window re-applies itself

#[tauri::command]
pub fn appbar_set(window: WebviewWindow, edge: String, width: f64) -> Result<bool, String> {
    appbar(&window, &edge, width)
}

#[cfg(windows)]
fn appbar(window: &WebviewWindow, edge: &str, width: f64) -> Result<bool, String> {
    use raw_window_handle::{HasWindowHandle, RawWindowHandle};
    use windows_sys::Win32::Foundation::RECT;
    use windows_sys::Win32::UI::Shell::{SHAppBarMessage, ABE_LEFT, ABE_RIGHT, ABM_NEW, ABM_QUERYPOS, ABM_REMOVE, ABM_SETPOS, APPBARDATA};

    let handle = window.window_handle().map_err(|e| e.to_string())?;
    let RawWindowHandle::Win32(h) = handle.as_raw() else { return Err("Окно без дескриптора Windows.".into()) };
    let hwnd = h.hwnd.get();
    let mut abd: APPBARDATA = unsafe { std::mem::zeroed() };
    abd.cbSize = std::mem::size_of::<APPBARDATA>() as u32;
    abd.hWnd = hwnd as _;
    abd.uCallbackMessage = APPBAR_CALLBACK;
    let mut reg = APPBAR.lock().map_err(|e| e.to_string())?;

    if edge != "left" && edge != "right" {
        if reg.take().is_some() {
            unsafe { SHAppBarMessage(ABM_REMOVE, &mut abd) };
        }
        return Ok(false);
    }
    let right = edge == "right";
    let mon = window.current_monitor().map_err(|e| e.to_string())?.ok_or("Монитор окна не найден.")?;
    let (mx, my) = (mon.position().x, mon.position().y);
    let (mw, mh) = (mon.size().width as i32, mon.size().height as i32);
    let w = ((width.max(280.0) * mon.scale_factor()).round() as i32).min(mw / 2);

    if reg.is_none() {
        if unsafe { SHAppBarMessage(ABM_NEW, &mut abd) } == 0 {
            return Err("Windows не дал закрепить окно у края.".into());
        }
        *reg = Some(hwnd);
    }
    abd.uEdge = if right { ABE_RIGHT } else { ABE_LEFT };
    abd.rc = RECT { left: if right { mx + mw - w } else { mx }, right: if right { mx + mw } else { mx + w }, top: my, bottom: my + mh };
    unsafe { SHAppBarMessage(ABM_QUERYPOS, &mut abd) };
    // Windows may move the strip off the taskbar or another bar: keep the width from the side it gave.
    if right { abd.rc.left = abd.rc.right - w } else { abd.rc.right = abd.rc.left + w }
    unsafe { SHAppBarMessage(ABM_SETPOS, &mut abd) };
    let _ = window.unmaximize();
    window.set_position(PhysicalPosition::new(abd.rc.left, abd.rc.top)).map_err(|e| e.to_string())?;
    window.set_size(PhysicalSize::new((abd.rc.right - abd.rc.left) as u32, (abd.rc.bottom - abd.rc.top) as u32)).map_err(|e| e.to_string())?;
    Ok(true)
}

#[cfg(not(windows))]
fn appbar(_window: &WebviewWindow, _edge: &str, _width: f64) -> Result<bool, String> {
    Ok(false)
}

// On exit the strip is given back, so the desktop does not keep an empty band.
pub fn appbar_release() {
    #[cfg(windows)]
    {
        use windows_sys::Win32::UI::Shell::{SHAppBarMessage, ABM_REMOVE, APPBARDATA};
        if let Ok(mut reg) = APPBAR.lock() {
            if let Some(hwnd) = reg.take() {
                let mut abd: APPBARDATA = unsafe { std::mem::zeroed() };
                abd.cbSize = std::mem::size_of::<APPBARDATA>() as u32;
                abd.hWnd = hwnd as _;
                unsafe { SHAppBarMessage(ABM_REMOVE, &mut abd) };
            }
        }
    }
}

/* ---------- 36: a notification with buttons ---------- */
#[derive(Deserialize)]
pub struct ToastButton {
    label: String,
    action: String,
}

// Buttons come back to the window as the «toast:action» event (a click on the text itself: «open» with the first
// button's target). Without Windows toasts (another system, or an error) — the plain notification.
#[tauri::command]
pub fn notify_actions(app: AppHandle, body: String, open: String, buttons: Vec<ToastButton>) -> bool {
    #[cfg(windows)]
    {
        use tauri_winrt_notification::{Duration, Toast};
        let id = app.config().identifier.clone();
        let handle = app.clone();
        let default = format!("open|{open}");
        let mut toast = Toast::new(&id).title("Пульт главспеца").text1(&body).duration(Duration::Short);
        for b in &buttons {
            toast = toast.add_button(&b.label, &b.action);
        }
        let toast = toast.on_activated(move |action| {
            let _ = handle.emit("toast:action", action.unwrap_or_else(|| default.clone()));
            Ok(())
        });
        if toast.show().is_ok() {
            return true;
        }
    }
    let _ = (&open, &buttons);
    crate::system::notify(app, body)
}
