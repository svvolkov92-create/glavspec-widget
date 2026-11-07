# Installs "Пульт главспеца" for the current user (no admin rights needed).
# Downloads the official Electron runtime from GitHub, verifies its SHA-256 and adds the app on top.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'   # Invoke-WebRequest is many times slower with the progress bar
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$ElectronVersion = '33.4.11'
$ElectronSha256  = 'f64c8a5a81d9b420b636fdba13e180f49d69f2198e1d86a8b01f858b17a9483c'
$ElectronUrl     = "https://github.com/electron/electron/releases/download/v$ElectronVersion/electron-v$ElectronVersion-win32-x64.zip"

$RceditSha256 = '3E7801DB1A5EDBEC91B49A24A094AAD776CB4515488EA5A4CA2289C400EADE2A'
$RceditUrl    = 'https://github.com/electron/rcedit/releases/download/v2.0.0/rcedit-x64.exe'
$RceditCache  = Join-Path $env:TEMP 'rcedit-v2.0.0-x64.exe'

$AppName  = 'Пульт главспеца'
$ExeName  = 'PultGlavspeca.exe'
$Dest     = Join-Path $env:LOCALAPPDATA 'Programs\PultGlavspeca'
$Here     = Split-Path -Parent $MyInvocation.MyCommand.Path
$AppSrc   = Join-Path $Here 'app'
$Cache    = Join-Path $env:TEMP "electron-v$ElectronVersion-win32-x64.zip"

function Step($text) { Write-Host "→ $text" -ForegroundColor Cyan }

try {
    if (-not (Test-Path (Join-Path $AppSrc 'package.json'))) {
        throw "Рядом с установщиком нет папки app. Распакуйте архив целиком и запустите «Установить.cmd» из распакованной папки."
    }

    # 1. Runtime: reuse a previously downloaded copy if its checksum matches.
    $haveRuntime = (Test-Path $Cache) -and ((Get-FileHash $Cache -Algorithm SHA256).Hash -eq $ElectronSha256)
    if (-not $haveRuntime) {
        Step "Скачиваю движок Electron $ElectronVersion (~110 МБ) с github.com…"
        try { Invoke-WebRequest -Uri $ElectronUrl -OutFile $Cache -UseBasicParsing }
        catch {
            throw ("Не удалось скачать движок с github.com ($($_.Exception.Message)).`n" +
                   "Скачайте файл вручную по ссылке:`n  $ElectronUrl`n" +
                   "положите его сюда:`n  $Cache`nи запустите установку снова.")
        }
        $hash = (Get-FileHash $Cache -Algorithm SHA256).Hash
        if ($hash -ne $ElectronSha256) {
            Remove-Item $Cache -Force
            throw "Контрольная сумма скачанного файла не совпала ($hash). Файл удалён, попробуйте ещё раз."
        }
    }

    # 2. Stop a running copy so its files can be replaced. Data is saved on every change, so nothing is lost.
    $running = Get-Process -Name ([IO.Path]::GetFileNameWithoutExtension($ExeName)) -ErrorAction SilentlyContinue
    if ($running) {
        Step 'Закрываю запущенный Пульт главспеца…'
        $running | Stop-Process -Force
        Start-Sleep -Seconds 1
    }

    # 3. Program files only. User data lives separately in %APPDATA%\GlavspecWidget and is not touched.
    Step "Устанавливаю в $Dest…"
    if (Test-Path $Dest) { Remove-Item $Dest -Recurse -Force }
    New-Item -ItemType Directory -Path $Dest | Out-Null
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [IO.Compression.ZipFile]::ExtractToDirectory($Cache, $Dest)
    Rename-Item (Join-Path $Dest 'electron.exe') $ExeName
    Remove-Item (Join-Path $Dest 'resources\default_app.asar') -Force -ErrorAction SilentlyContinue
    Copy-Item $AppSrc (Join-Path $Dest 'resources\app') -Recurse

    # 3b. Own icon and name on the .exe (taskbar, Task Manager) via Electron's official rcedit tool.
    # Optional: if it cannot be downloaded the app still works, only with the default Electron icon.
    try {
        Step 'Ставлю значок программы…'
        $haveRcedit = (Test-Path $RceditCache) -and ((Get-FileHash $RceditCache -Algorithm SHA256).Hash -eq $RceditSha256)
        if (-not $haveRcedit) {
            Invoke-WebRequest -Uri $RceditUrl -OutFile $RceditCache -UseBasicParsing
            if ((Get-FileHash $RceditCache -Algorithm SHA256).Hash -ne $RceditSha256) { Remove-Item $RceditCache -Force; throw 'контрольная сумма не совпала' }
        }
        $exePath = Join-Path $Dest $ExeName
        $ico = Join-Path $Dest 'resources\app\assets\icon.ico'
        & $RceditCache $exePath --set-icon $ico --set-version-string FileDescription $AppName --set-version-string ProductName $AppName --set-version-string CompanyName '' --set-version-string OriginalFilename $ExeName
        if ($LASTEXITCODE -ne 0) { throw "rcedit завершился с кодом $LASTEXITCODE" }
    }
    catch {
        Write-Host "  Значок не установлен ($($_.Exception.Message)) — программа работает и без него." -ForegroundColor Yellow
    }

    # 4. Shortcuts with the app icon.
    Step 'Создаю ярлыки на рабочем столе и в меню «Пуск»…'
    $exe  = Join-Path $Dest $ExeName
    $icon = Join-Path $Dest 'resources\app\assets\icon.ico'
    $shell = New-Object -ComObject WScript.Shell
    foreach ($dir in @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Programs'))) {
        $lnk = $shell.CreateShortcut((Join-Path $dir "$AppName.lnk"))
        $lnk.TargetPath = $exe
        $lnk.WorkingDirectory = $Dest
        $lnk.IconLocation = "$icon,0"
        $lnk.Description = 'Проекты, разделы, исполнители, сроки и оплата'
        $lnk.Save()
    }

    Step 'Готово. Запускаю…'
    Start-Process $exe
    Write-Host ''
    Write-Host 'Пульт главспеца установлен. Ярлык — на рабочем столе и в меню «Пуск».' -ForegroundColor Green
}
catch {
    Write-Host ''
    Write-Host "Установка не удалась: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
