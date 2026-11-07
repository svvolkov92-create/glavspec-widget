// Files and dialogs for the shared files code (src/core/files.js → its `io`): save / open / confirm dialogs,
// reading and writing the files the user picked, opening folders, files and links, «print to PDF» via the browser.
// Bytes travel as base64 in both directions.
use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
use tauri_plugin_opener::OpenerExt;

use crate::files::Files;

type Res<T> = Result<T, String>;
fn err(path: &str, e: impl std::fmt::Display) -> String {
    format!("{path}: {e}")
}

#[derive(Deserialize)]
pub struct Filter {
    name: String,
    extensions: Vec<String>,
}

fn file_dialog(app: &AppHandle, title: &str, default_path: Option<String>, filters: &[Filter]) -> tauri_plugin_dialog::FileDialogBuilder<tauri::Wry> {
    let mut b = app.dialog().file().set_title(title);
    if let Some(p) = default_path.filter(|p| !p.is_empty()) {
        let pb = PathBuf::from(p);
        if pb.is_dir() {
            b = b.set_directory(&pb);
        } else {
            if let Some(dir) = pb.parent().filter(|d| d.is_dir()) {
                b = b.set_directory(dir);
            }
            if let Some(name) = pb.file_name() {
                b = b.set_file_name(name.to_string_lossy());
            }
        }
    }
    for f in filters {
        let exts: Vec<&str> = f.extensions.iter().map(|s| s.as_str()).collect();
        b = b.add_filter(f.name.as_str(), &exts);
    }
    b
}

fn path_string(p: Option<tauri_plugin_dialog::FilePath>) -> Option<String> {
    p.and_then(|fp| fp.into_path().ok()).map(|p| p.to_string_lossy().into_owned())
}

#[tauri::command]
pub async fn dialog_save(app: AppHandle, title: String, default_path: Option<String>, filters: Vec<Filter>) -> Option<String> {
    path_string(file_dialog(&app, &title, default_path, &filters).blocking_save_file())
}

#[tauri::command]
pub async fn dialog_open(app: AppHandle, title: String, default_path: Option<String>, filters: Vec<Filter>, directory: bool) -> Option<String> {
    let none: Vec<Filter> = Vec::new();
    let b = file_dialog(&app, &title, default_path, if directory { &none } else { &filters });
    path_string(if directory { b.blocking_pick_folder() } else { b.blocking_pick_file() })
}

#[tauri::command]
pub async fn dialog_confirm(app: AppHandle, title: String, message: String, detail: String, ok: String) -> bool {
    let text = if detail.is_empty() { message } else { format!("{message}\n\n{detail}") };
    app.dialog()
        .message(text)
        .title(title)
        .kind(MessageDialogKind::Warning)
        .buttons(MessageDialogButtons::OkCancelCustom(ok, "Отмена".into()))
        .blocking_show()
}

// Writes text or base64 bytes; antivirus may hold a fresh file for a moment, so one retry.
#[tauri::command]
pub fn fs_write(path: String, text: Option<String>, base64: Option<String>) -> Res<()> {
    let bytes = match (text, base64) {
        (Some(t), _) => t.into_bytes(),
        (None, Some(b)) => STANDARD.decode(b).map_err(|e| err(&path, e))?,
        _ => return Err("Нечего записывать.".into()),
    };
    fs::write(&path, &bytes).or_else(|_| {
        std::thread::sleep(std::time::Duration::from_millis(150));
        fs::write(&path, &bytes)
    }).map_err(|e| err(&path, e))
}

#[tauri::command]
pub fn fs_read(path: String) -> Res<String> {
    fs::read(&path).map(|b| STANDARD.encode(b)).map_err(|e| err(&path, e))
}

#[tauri::command]
pub fn fs_exists(path: String) -> bool {
    !path.is_empty() && PathBuf::from(path).exists()
}

#[tauri::command]
pub fn fs_mkdir(path: String) -> Res<()> {
    fs::create_dir_all(&path).map_err(|e| err(&path, e))
}

#[tauri::command]
pub fn fs_list(path: String) -> Res<Vec<String>> {
    let rd = fs::read_dir(&path).map_err(|e| err(&path, e))?;
    Ok(rd.filter_map(|e| e.ok().map(|e| e.file_name().to_string_lossy().into_owned())).collect())
}

#[tauri::command]
pub fn fs_remove(path: String) -> Res<()> {
    fs::remove_file(&path).map_err(|e| err(&path, e))
}

// A folder or a file the shared code points to (a saved report, a project folder): '' when opened.
#[tauri::command]
pub fn open_path(app: AppHandle, path: String) -> String {
    match app.opener().open_path(path, None::<&str>) {
        Ok(()) => String::new(),
        Err(e) => e.to_string(),
    }
}

// Only links to mail, messengers and the web (built by the contact rules, not typed by the page).
#[tauri::command]
pub fn open_url(app: AppHandle, url: String) -> Res<()> {
    let ok = ["https://", "http://", "mailto:", "tg://", "whatsapp://"].iter().any(|p| url.starts_with(p));
    if !ok {
        return Err("Ссылка не поддерживается.".into());
    }
    app.opener().open_url(url, None::<&str>).map_err(|e| e.to_string())
}

#[derive(Serialize)]
pub struct Dirs {
    documents: String,
    #[serde(rename = "userData")]
    user_data: String,
}

#[tauri::command]
pub fn known_dirs(app: AppHandle, files: State<Files>) -> Dirs {
    let documents = app.path().document_dir().or_else(|_| app.path().home_dir()).map(|p| p.to_string_lossy().into_owned()).unwrap_or_default();
    Dirs { documents, user_data: files.dir.to_string_lossy().into_owned() }
}

// PDF without a print engine of our own: the page opens in the browser with its print dialog,
// where «Сохранить как PDF» makes the file. The copy lives in the data folder (print/).
#[tauri::command]
pub fn print_html(app: AppHandle, files: State<Files>, html: String) -> Res<()> {
    let dir = files.dir.join("print");
    fs::create_dir_all(&dir).map_err(|e| err(&dir.to_string_lossy(), e))?;
    let stamp = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0);
    let file = dir.join(format!("страница-{stamp}.html"));
    let page = html.replacen("</body>", "<script>addEventListener('load', () => setTimeout(() => print(), 300))</script></body>", 1);
    fs::write(&file, page).map_err(|e| err(&file.to_string_lossy(), e))?;
    // Old copies are of no use once printed.
    if let Ok(rd) = fs::read_dir(&dir) {
        let mut names: Vec<PathBuf> = rd.filter_map(|e| e.ok().map(|e| e.path())).collect();
        names.sort();
        let extra = names.len().saturating_sub(10);
        for p in &names[..extra] {
            let _ = fs::remove_file(p);
        }
    }
    app.opener().open_path(file.to_string_lossy(), None::<&str>).map_err(|e| e.to_string())
}
