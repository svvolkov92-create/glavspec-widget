// 4.4: what only Windows itself can do for the window — Snap Layouts on the own maximize button (33),
// notifications with buttons (36). (The side of the screen, 37 and 4.10, was taken out in 4.18 at the user's request.)
// Everything is decided in the window (tauri-api.js); these commands only talk to Windows.
use serde::Deserialize;
use tauri::{AppHandle, WebviewWindow};
#[cfg(windows)]
use tauri::Emitter;

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
