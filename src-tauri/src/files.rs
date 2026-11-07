// The Rust core of «Пульт главспеца»: the files. data.json (atomic writes, a copy before the first change
// of the day, protection against another program writing the same file), settings.json and journal.jsonl.
// What is written is decided by the shared JavaScript rules (src/core); this layer only keeps the files safe.
use serde_json::{json, ser::PrettyFormatter, Serializer, Value};
use std::{
    fs,
    io::{ErrorKind, Write},
    path::{Path, PathBuf},
    sync::Mutex,
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

const BACKUPS_TO_KEEP: usize = 30;
const JOURNAL_MAX_BYTES: u64 = 8 * 1024 * 1024; // when exceeded, the older half is dropped
const CONFLICT: &str = "conflict";

// What the file looked like after our last read or write: if it differs, someone else wrote it.
#[derive(Clone, Copy, PartialEq, Debug)]
struct Stamp {
    len: u64,
    modified: Option<SystemTime>,
}

pub struct Files {
    pub dir: PathBuf,
    stamp: Mutex<Option<Stamp>>,
}

fn stamp_of(path: &Path) -> Option<Stamp> {
    fs::metadata(path).ok().map(|m| Stamp { len: m.len(), modified: m.modified().ok() })
}

fn err(path: &Path, e: impl std::fmt::Display) -> String {
    format!("{}: {e}", path.display())
}

// Same layout as JSON.stringify(value, null, 1) in the Electron version.
fn to_json_text(value: &Value) -> Result<Vec<u8>, String> {
    let mut out = Vec::new();
    let mut ser = Serializer::with_formatter(&mut out, PrettyFormatter::with_indent(b" "));
    serde::Serialize::serialize(value, &mut ser).map_err(|e| e.to_string())?;
    Ok(out)
}

// Antivirus or the indexer can briefly lock the target file on Windows; retry a few times.
fn rename_with_retry(from: &Path, to: &Path) -> std::io::Result<()> {
    let mut attempt: u64 = 0;
    loop {
        match fs::rename(from, to) {
            Ok(()) => return Ok(()),
            // 32: the file is in use by another process (sharing violation)
            Err(e) if attempt < 4 && (e.kind() == ErrorKind::PermissionDenied || e.raw_os_error() == Some(32)) => {
                attempt += 1;
                thread::sleep(Duration::from_millis(50 * attempt));
            }
            Err(e) => return Err(e),
        }
    }
}

fn write_atomic(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let tmp = path.with_extension("json.tmp");
    {
        let mut f = fs::File::create(&tmp).map_err(|e| err(&tmp, e))?;
        f.write_all(bytes).map_err(|e| err(&tmp, e))?;
        f.sync_all().map_err(|e| err(&tmp, e))?;
    }
    rename_with_retry(&tmp, path).map_err(|e| err(path, e))
}

fn read_text(path: &Path) -> Result<Option<String>, String> {
    match fs::read_to_string(path) {
        Ok(t) => Ok(Some(t)),
        Err(e) if e.kind() == ErrorKind::NotFound => Ok(None),
        Err(e) => Err(err(path, e)),
    }
}

fn now_ms() -> u128 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0)
}

impl Files {
    // 4.0 works in the same folder as 3.x (Electron): %APPDATA%\GlavspecWidget — data, settings, journal,
    // backups, attachments and the built-in cabinet server's data stay where they were.
    pub fn open() -> Result<Files, String> {
        let base = std::env::var_os("APPDATA")
            .or_else(|| std::env::var_os("XDG_CONFIG_HOME"))
            .map(PathBuf::from)
            .ok_or_else(|| "Не найдена папка APPDATA.".to_string())?;
        let dir = base.join("GlavspecWidget");
        fs::create_dir_all(dir.join("backups")).map_err(|e| err(&dir, e))?;
        Ok(Files { dir, stamp: Mutex::new(None) })
    }

    fn data_file(&self) -> PathBuf {
        self.dir.join("data.json")
    }

    // { data: object | null, warning: string | null }. A broken file is put aside for manual recovery.
    pub fn load(&self) -> Result<Value, String> {
        let file = self.data_file();
        let text = read_text(&file)?;
        let mut warning = Value::Null;
        let data = match text {
            None => Value::Null,
            Some(t) => match serde_json::from_str::<Value>(&t) {
                Ok(v) if v.is_object() => v,
                _ => {
                    let aside = self.dir.join(format!("data.corrupt-{}.json", now_ms()));
                    fs::rename(&file, &aside).map_err(|e| err(&file, e))?;
                    warning = json!(format!(
                        "Файл данных был повреждён и отложен как {}. Последние копии лежат в папке backups.",
                        aside.file_name().unwrap_or_default().to_string_lossy()
                    ));
                    Value::Null
                }
            },
        };
        *self.stamp.lock().unwrap() = stamp_of(&file);
        Ok(json!({ "data": data, "warning": warning }))
    }

    // `day` is the local date (YYYY-MM-DD) from the window: the copy before the first change of that day.
    pub fn save(&self, data: &Value, day: &str) -> Result<(), String> {
        if !data.is_object() {
            return Err("Некорректные данные.".into());
        }
        let file = self.data_file();
        let mut stamp = self.stamp.lock().unwrap();
        if stamp_of(&file) != *stamp {
            return Err(CONFLICT.into());
        }
        self.backup_once_per_day(&file, day)?;
        write_atomic(&file, &to_json_text(data)?)?;
        *stamp = stamp_of(&file);
        Ok(())
    }

    fn backup_once_per_day(&self, file: &Path, day: &str) -> Result<(), String> {
        let valid_day = day.len() == 10 && day.chars().enumerate().all(|(i, c)| if i == 4 || i == 7 { c == '-' } else { c.is_ascii_digit() });
        if !valid_day || !file.exists() {
            return Ok(());
        }
        let dir = self.dir.join("backups");
        let target = dir.join(format!("data-{day}.json"));
        if target.exists() {
            return Ok(());
        }
        fs::copy(file, &target).map_err(|e| err(&target, e))?;
        let mut old: Vec<String> = fs::read_dir(&dir)
            .map_err(|e| err(&dir, e))?
            .filter_map(|e| e.ok().map(|e| e.file_name().to_string_lossy().into_owned()))
            .filter(|n| n.len() == 20 && n.starts_with("data-") && n.ends_with(".json"))
            .collect();
        old.sort();
        let extra = old.len().saturating_sub(BACKUPS_TO_KEEP);
        for name in &old[..extra] {
            let _ = fs::remove_file(dir.join(name));
        }
        Ok(())
    }

    pub fn settings_load(&self) -> Value {
        let file = self.dir.join("settings.json");
        read_text(&file).ok().flatten().and_then(|t| serde_json::from_str::<Value>(&t).ok()).filter(Value::is_object).unwrap_or_else(|| json!({}))
    }

    pub fn settings_save(&self, values: &Value) -> Result<(), String> {
        if !values.is_object() {
            return Err("Некорректные настройки.".into());
        }
        write_atomic(&self.dir.join("settings.json"), &to_json_text(values)?)
    }

    pub fn journal_append(&self, lines: &[Value]) -> Result<(), String> {
        if lines.is_empty() {
            return Ok(());
        }
        let file = self.dir.join("journal.jsonl");
        let mut text = String::new();
        for l in lines {
            text.push_str(&serde_json::to_string(l).map_err(|e| e.to_string())?);
            text.push('\n');
        }
        let mut f = fs::OpenOptions::new().create(true).append(true).open(&file).map_err(|e| err(&file, e))?;
        f.write_all(text.as_bytes()).map_err(|e| err(&file, e))?;
        drop(f);
        if fs::metadata(&file).map(|m| m.len()).unwrap_or(0) > JOURNAL_MAX_BYTES {
            let all = fs::read_to_string(&file).map_err(|e| err(&file, e))?;
            let kept: Vec<&str> = all.lines().filter(|l| !l.is_empty()).collect();
            let half = &kept[kept.len() / 2..];
            write_atomic(&file, (half.join("\n") + "\n").as_bytes())?;
        }
        Ok(())
    }

    // Newest first, down to `since` (ISO time); a torn last line after a crash is skipped.
    pub fn journal_read(&self, since: &str, limit: usize) -> Vec<Value> {
        let file = self.dir.join("journal.jsonl");
        let Ok(Some(text)) = read_text(&file) else { return Vec::new() };
        let mut out = Vec::new();
        for line in text.lines().rev() {
            if out.len() >= limit {
                break;
            }
            if line.is_empty() {
                continue;
            }
            let Ok(entry) = serde_json::from_str::<Value>(line) else { continue };
            if !since.is_empty() && entry.get("ts").and_then(Value::as_str).is_some_and(|ts| ts < since) {
                break;
            }
            out.push(entry);
        }
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_files() -> Files {
        let dir = std::env::temp_dir().join(format!("glavspec-files-{}-{:?}", now_ms(), thread::current().id()));
        fs::create_dir_all(dir.join("backups")).unwrap();
        Files { dir, stamp: Mutex::new(None) }
    }

    #[test]
    fn save_load_backup_and_conflict() {
        let f = temp_files();
        assert_eq!(f.load().unwrap()["data"], Value::Null);
        let data = json!({ "version": 1, "tasks": { "t1": { "b": 1, "a": 2 } } });
        f.save(&data, "2026-11-07").unwrap();
        let text = fs::read_to_string(f.data_file()).unwrap();
        assert!(text.contains("\"b\": 1"), "field order kept and 1-space indent: {text}");
        assert!(text.find("\"b\"").unwrap() < text.find("\"a\"").unwrap());
        f.save(&data, "2026-11-08").unwrap();
        assert!(f.dir.join("backups/data-2026-11-08.json").exists());
        // Another program writes the file: our next save must refuse.
        thread::sleep(Duration::from_millis(20));
        fs::write(f.data_file(), "{\"version\":1,\"tasks\":{},\"x\":\"other program\"}").unwrap();
        assert_eq!(f.save(&data, "2026-11-08").unwrap_err(), CONFLICT);
        assert_eq!(f.load().unwrap()["data"]["x"], "other program");
        f.save(&data, "2026-11-08").unwrap();
    }

    #[test]
    fn broken_file_is_put_aside() {
        let f = temp_files();
        fs::write(f.data_file(), "{ not json").unwrap();
        let r = f.load().unwrap();
        assert_eq!(r["data"], Value::Null);
        assert!(r["warning"].as_str().unwrap().contains("data.corrupt-"));
    }

    #[test]
    fn journal_append_and_read() {
        let f = temp_files();
        f.journal_append(&[json!({ "ts": "2026-11-01T00:00:00Z", "n": 1 }), json!({ "ts": "2026-11-05T00:00:00Z", "n": 2 })]).unwrap();
        fs::OpenOptions::new().append(true).open(f.dir.join("journal.jsonl")).unwrap().write_all(b"{\"torn").unwrap();
        let all = f.journal_read("", 100);
        assert_eq!(all.len(), 2);
        assert_eq!(all[0]["n"], 2);
        assert_eq!(f.journal_read("2026-11-03", 100).len(), 1);
    }

    #[test]
    fn settings_round_trip() {
        let f = temp_files();
        assert_eq!(f.settings_load(), json!({}));
        f.settings_save(&json!({ "theme": "tandem", "zoom": 1.1 })).unwrap();
        assert_eq!(f.settings_load()["theme"], "tandem");
    }
}
