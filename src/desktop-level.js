'use strict';

// Keeps a window at the bottom of the window stack on Windows ("desktop widget" mode).
// Electron has no API for this, so a small long-lived PowerShell process calls
// user32!SetWindowPos(hwnd, HWND_BOTTOM, …, SWP_NOSIZE | SWP_NOMOVE | SWP_NOACTIVATE).
// If PowerShell is unavailable the helper reports it and the window simply stays a normal window.
const { spawn } = require('node:child_process');

const HELPER_SCRIPT = [
  "$ErrorActionPreference = 'Stop'",
  "Add-Type -Namespace GlavspecWin -Name User32 -MemberDefinition '[DllImport(\"user32.dll\")] public static extern bool SetWindowPos(System.IntPtr hWnd, System.IntPtr after, int x, int y, int cx, int cy, uint flags);'",
  "[Console]::Out.WriteLine('ready')",
  'while ($true) {',
  '  $line = [Console]::In.ReadLine()',
  '  if ($line -eq $null) { break }',
  '  if ($line -match "^[0-9]+$") {',
  '    try { [void][GlavspecWin.User32]::SetWindowPos([System.IntPtr][Int64]$line, [System.IntPtr]1, 0, 0, 0, 0, 0x13) }',
  '    catch { [Console]::Error.WriteLine($_.Exception.Message) }',
  '  }',
  '}',
].join('\n');

const encodeCommand = script => Buffer.from(script, 'utf16le').toString('base64');

// HWND from BrowserWindow.getNativeWindowHandle(): a 4- or 8-byte little-endian buffer.
function hwndString(buf) {
  if (!Buffer.isBuffer(buf)) return null;
  if (buf.length >= 8) return buf.readBigUInt64LE(0).toString();
  if (buf.length >= 4) return String(buf.readUInt32LE(0));
  return null;
}

class DesktopLevel {
  constructor({ spawnFn = spawn, platform = process.platform, log = console } = {}) {
    this.spawnFn = spawnFn;
    this.platform = platform;
    this.log = log;
    this.proc = null;
    this.failed = false;
  }

  get supported() { return this.platform === 'win32' && !this.failed; }

  start() {
    if (!this.supported || this.proc) return !!this.proc;
    try {
      // -EncodedCommand (UTF-16LE base64) avoids any quoting issues on the Windows command line.
      this.proc = this.spawnFn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encodeCommand(HELPER_SCRIPT)], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
      this.proc.on('error', e => this.fail(e));
      this.proc.on('exit', code => { if (this.proc) this.fail(new Error(`помощник завершился с кодом ${code}`)); });
      this.proc.stderr?.on('data', d => this.log.warn?.('Режим «на рабочем столе»:', String(d).trim()));
      return true;
    } catch (e) {
      this.fail(e);
      return false;
    }
  }

  fail(e) {
    this.failed = true;
    this.proc = null;
    this.log.warn?.('Режим «на рабочем столе» недоступен:', e?.message || e);
  }

  // Sends the window to the bottom; safe to call often (on blur, on show).
  sendToBottom(win) {
    if (!win || win.isDestroyed?.() || !this.start() || !this.proc?.stdin?.writable) return false;
    const h = hwndString(win.getNativeWindowHandle());
    if (!h) return false;
    this.proc.stdin.write(h + '\n');
    return true;
  }

  stop() {
    const p = this.proc;
    this.proc = null;
    if (p) { try { p.stdin.end(); p.kill(); } catch { /* already gone */ } }
  }
}

module.exports = { DesktopLevel, hwndString, HELPER_SCRIPT, encodeCommand };
