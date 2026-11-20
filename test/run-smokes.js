'use strict';
// Runs every test/smoke-*.js against the Tauri window in Chromium (test/smoke-host.js), each with its own empty
// profile, and fails if any check fails. Needs build/tauri-ui (node src-tauri/ui/prepare-ui.js) and playwright.
// Usage: node test/run-smokes.js [filter]
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const filter = process.argv[2] || '';
const testDir = __dirname;
const smokes = fs.readdirSync(testDir).filter(f => /^smoke-.*\.js$/.test(f) && f !== 'smoke-host.js' && f.includes(filter)).sort();
const outRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'glavspec-smokes-'));
let failed = 0;

for (const file of smokes) {
  const name = file.replace(/\.js$/, '');
  const profile = path.join(outRoot, name, 'profile');
  const out = path.join(outRoot, name, 'out');
  fs.mkdirSync(profile, { recursive: true });
  fs.mkdirSync(out, { recursive: true });
  const env = { ...process.env, GLAVSPEC_TEST_APPDATA: profile };
  const started = Date.now();
  const r = spawnSync(process.execPath, [path.join(testDir, 'smoke-host.js'), path.join(testDir, file), out], { env, encoding: 'utf8', timeout: 5 * 60 * 1000 });
  const logFile = path.join(out, 'log.txt');
  const log = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8') : '';
  const lines = log.split('\n').filter(Boolean);
  const ok = lines.filter(l => l.startsWith('OK')).length;
  const bad = lines.filter(l => /^FAIL|^\[smoke error\]|^\[console [3-9]\]/.test(l));
  const secs = ((Date.now() - started) / 1000).toFixed(0);
  if (!log || bad.length || ok === 0) {
    failed++;
    console.log(`FAIL ${name}: ${ok} ok, ${bad.length} failed (${secs}s)${r.error ? ' — ' + r.error.message : ''}`);
    for (const l of bad) console.log('     ' + l);
    if (!log) console.log((r.stdout || '') + (r.stderr || '').slice(-3000));
  } else {
    console.log(`ok   ${name}: ${ok} checks (${secs}s)`);
  }
}
console.log(`\n${smokes.length - failed}/${smokes.length} smokes passed. Screenshots and logs: ${outRoot}`);
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `out=${outRoot}\n`);
process.exit(failed ? 1 : 0);
