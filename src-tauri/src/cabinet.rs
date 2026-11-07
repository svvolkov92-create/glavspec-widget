// The customer cabinet from the window's side: HTTP to the cabinet server (the window itself cannot reach
// another site), the team key kept with Windows DPAPI, and «кабинет на этом компьютере» — the same server
// script (server/cabinet-server.js, bundled with the app) run by Node.js, when Node.js is installed.
use serde::Serialize;
use std::{
    collections::HashMap,
    io::{BufRead, BufReader},
    net::{TcpListener, UdpSocket},
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::{mpsc, Mutex},
    time::Duration,
};
use tauri::{path::BaseDirectory, AppHandle, Manager, State};

use crate::files::Files;

type Res<T> = Result<T, String>;

#[derive(Serialize)]
pub struct HttpAnswer {
    status: u16,
    body: String,
}

// One request to the cabinet server; any HTTP status is an answer (the client reads its JSON), only network
// trouble is an error.
#[tauri::command]
pub async fn http_request(method: String, url: String, headers: HashMap<String, String>, body: Option<String>, timeout_ms: Option<u64>) -> Res<HttpAnswer> {
    if !(url.starts_with("http://") || url.starts_with("https://")) {
        return Err("Адрес должен начинаться с http:// или https://".into());
    }
    let agent = ureq::AgentBuilder::new().timeout(Duration::from_millis(timeout_ms.unwrap_or(15_000).clamp(1_000, 300_000))).build();
    let mut req = agent.request(&method, &url);
    for (k, v) in &headers {
        req = req.set(k, v);
    }
    let res = match body {
        Some(b) => req.send_string(&b),
        None => req.call(),
    };
    let (status, r) = match res {
        Ok(r) => (r.status(), r),
        Err(ureq::Error::Status(code, r)) => (code, r),
        Err(e) => return Err(e.to_string()),
    };
    Ok(HttpAnswer { status, body: r.into_string().unwrap_or_default() })
}

/* ---------- the team key: Windows DPAPI (current user) ---------- */
#[cfg(windows)]
fn dpapi(data: &[u8], protect: bool) -> Res<Vec<u8>> {
    use windows_sys::Win32::Foundation::LocalFree;
    use windows_sys::Win32::Security::Cryptography::{CryptProtectData, CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB};
    let input = CRYPT_INTEGER_BLOB { cbData: data.len() as u32, pbData: data.as_ptr() as *mut u8 };
    let mut out = CRYPT_INTEGER_BLOB { cbData: 0, pbData: std::ptr::null_mut() };
    let ok = unsafe {
        if protect {
            CryptProtectData(&input, std::ptr::null(), std::ptr::null(), std::ptr::null(), std::ptr::null(), CRYPTPROTECT_UI_FORBIDDEN, &mut out)
        } else {
            CryptUnprotectData(&input, std::ptr::null_mut(), std::ptr::null(), std::ptr::null(), std::ptr::null(), CRYPTPROTECT_UI_FORBIDDEN, &mut out)
        }
    };
    if ok == 0 || out.pbData.is_null() {
        return Err("Windows не смог расшифровать ключ (другая учётная запись или компьютер).".into());
    }
    let v = unsafe { std::slice::from_raw_parts(out.pbData, out.cbData as usize).to_vec() };
    unsafe { LocalFree(out.pbData as _) };
    Ok(v)
}
#[cfg(not(windows))]
fn dpapi(_data: &[u8], _protect: bool) -> Res<Vec<u8>> {
    Err("Шифрование ключа есть только в Windows.".into())
}

#[tauri::command]
pub fn secret_protect(text: String) -> Res<String> {
    use base64::{engine::general_purpose::STANDARD, Engine};
    dpapi(text.as_bytes(), true).map(|b| STANDARD.encode(b))
}

#[tauri::command]
pub fn secret_unprotect(data: String) -> Res<String> {
    use base64::{engine::general_purpose::STANDARD, Engine};
    let raw = STANDARD.decode(data).map_err(|e| e.to_string())?;
    String::from_utf8(dpapi(&raw, false)?).map_err(|e| e.to_string())
}

/* ---------- «кабинет на этом компьютере» ---------- */
pub struct LocalServer(pub Mutex<Option<(Child, u16)>>);

#[derive(Serialize)]
pub struct Started {
    port: u16,
    lan: Vec<String>,
    #[serde(rename = "teamKey")]
    team_key: String,
}

// The address other computers of the office reach this one by (the route to the internet picks the interface;
// nothing is sent).
fn lan_urls(port: u16) -> Vec<String> {
    UdpSocket::bind("0.0.0.0:0")
        .and_then(|s| s.connect("8.8.8.8:80").map(|_| s))
        .and_then(|s| s.local_addr())
        .map(|a| a.ip())
        .ok()
        .filter(|ip| !ip.is_loopback() && !ip.is_unspecified())
        .map(|ip| vec![format!("http://{ip}:{port}")])
        .unwrap_or_default()
}

fn find_node() -> Option<PathBuf> {
    let mut cands = vec![PathBuf::from("node")];
    for var in ["ProgramFiles", "ProgramFiles(x86)", "LOCALAPPDATA"] {
        if let Some(base) = std::env::var_os(var) {
            cands.push(PathBuf::from(&base).join("nodejs").join("node.exe"));
            cands.push(PathBuf::from(&base).join("Programs").join("nodejs").join("node.exe"));
        }
    }
    cands.into_iter().find(|c| {
        let mut cmd = Command::new(c);
        cmd.arg("--version").stdout(Stdio::null()).stderr(Stdio::null());
        hide_window(&mut cmd);
        cmd.status().map(|s| s.success()).unwrap_or(false)
    })
}

#[cfg(windows)]
fn hide_window(cmd: &mut Command) {
    use std::os::windows::process::CommandExt;
    cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
}
#[cfg(not(windows))]
fn hide_window(_cmd: &mut Command) {}

#[tauri::command]
pub fn cabinet_local_running(local: State<LocalServer>) -> Option<serde_json::Value> {
    let mut guard = local.0.lock().unwrap();
    if let Some((child, port)) = guard.as_mut() {
        if matches!(child.try_wait(), Ok(None)) {
            return Some(serde_json::json!({ "port": *port, "lan": lan_urls(*port) }));
        }
        *guard = None;
    }
    None
}

#[tauri::command]
pub async fn cabinet_local_start(app: AppHandle, port: Option<u16>) -> Res<Started> {
    let local = app.state::<LocalServer>();
    let files = app.state::<Files>();
    if let Some((child, p)) = local.0.lock().unwrap().as_mut() {
        if matches!(child.try_wait(), Ok(None)) {
            let p = *p;
            let key = team_key_from_file(&files.dir.join("cabinet-server").join("cabinet.json")).unwrap_or_default();
            return Ok(Started { port: p, lan: lan_urls(p), team_key: key });
        }
    }
    let node = find_node().ok_or(
        "Для кабинета на этом компьютере нужен Node.js 20 или новее (бесплатно, nodejs.org, версия LTS). \
         Установите его и нажмите снова — или подключите отдельный сервер кабинета.",
    )?;
    let script = app.path().resolve("cabinet/cabinet-server.js", BaseDirectory::Resource).map_err(|e| e.to_string())?;
    let data = files.dir.join("cabinet-server");
    std::fs::create_dir_all(&data).map_err(|e| e.to_string())?;
    let first = port.unwrap_or(8080);
    let free = (first..first.saturating_add(10)).find(|p| TcpListener::bind(("0.0.0.0", *p)).is_ok()).ok_or(format!("Порты {first}–{} заняты другими программами.", first + 9))?;
    let mut cmd = Command::new(node);
    cmd.arg(&script)
        .env("CABINET_PORT", free.to_string())
        .env("CABINET_HOST", "0.0.0.0")
        .env("CABINET_DATA", &data)
        .env("CABINET_CONFIG", data.join("config.json"))
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    hide_window(&mut cmd);
    let mut child = cmd.spawn().map_err(|e| format!("Не удалось запустить сервер кабинета: {e}"))?;
    // The server prints its address and the team key on start; an error ends it early.
    let out = child.stdout.take().ok_or("нет вывода сервера")?;
    let err = child.stderr.take();
    let (tx, rx) = mpsc::channel::<Result<String, String>>();
    let tx2 = tx.clone();
    std::thread::spawn(move || {
        for line in BufReader::new(out).lines().map_while(Result::ok) {
            if let Some(i) = line.find("Ключ команды") {
                let key = line[i..].rsplit(": ").next().unwrap_or("").trim().to_string();
                let _ = tx.send(Ok(key));
            }
        }
    });
    if let Some(err) = err {
        std::thread::spawn(move || {
            let text: Vec<String> = BufReader::new(err).lines().map_while(Result::ok).take(20).collect();
            if !text.is_empty() {
                let _ = tx2.send(Err(text.join("\n")));
            }
        });
    }
    match rx.recv_timeout(Duration::from_secs(15)) {
        Ok(Ok(key)) => {
            *local.0.lock().unwrap() = Some((child, free));
            Ok(Started { port: free, lan: lan_urls(free), team_key: key })
        }
        Ok(Err(text)) => {
            let _ = child.kill();
            Err(format!("Сервер кабинета не запустился: {}", text.lines().last().unwrap_or("")))
        }
        Err(_) => {
            let _ = child.kill();
            Err("Сервер кабинета не ответил за 15 секунд.".into())
        }
    }
}

fn team_key_from_file(file: &PathBuf) -> Option<String> {
    let v: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(file).ok()?).ok()?;
    v.get("secrets")?.get("teamKey")?.as_str().map(str::to_string)
}

#[tauri::command]
pub fn cabinet_local_stop(local: State<LocalServer>) {
    stop(&local);
}

pub fn stop(local: &LocalServer) {
    if let Some((mut child, _)) = local.0.lock().unwrap().take() {
        let _ = child.kill();
        let _ = child.wait();
    }
}
