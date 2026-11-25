#!/usr/bin/env node
'use strict';
// The window's code is kept in parts by area (src/renderer/app/NN-name.js) and put together into
// src/renderer/app.js — the one file every window loads (Tauri, the web version, Electron).
// The parts share one scope, exactly as before the split: a part may use what another part declares.
// Order matters only for code that runs at load (top-level `const x = …`, listeners): parts go by their number.
// 4.20: the styles the same way — src/renderer/styles/NN-name.css → src/renderer/styles.css, in the order of the numbers
// (the cascade: later rules win, so the parts must not be reordered).
//   node tools/build-app.js          — writes src/renderer/app.js and src/renderer/styles.css
//   node tools/build-app.js --check  — fails if app.js is not built from the parts (edited by hand, or not rebuilt)
//   node tools/build-app.js --deps   — writes src/renderer/app/DEPS.md: which parts each part uses (by top-level names)
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const PARTS = path.join(ROOT, 'src', 'renderer', 'app');
const OUT = path.join(ROOT, 'src', 'renderer', 'app.js');
const CSS_PARTS = path.join(ROOT, 'src', 'renderer', 'styles');
const CSS_OUT = path.join(ROOT, 'src', 'renderer', 'styles.css');

function buildCss() {
  const names = fs.readdirSync(CSS_PARTS).filter(n => /^\d{2}-[a-z0-9-]+\.css$/.test(n)).sort();
  if (!names.length) throw new Error(`no parts in ${CSS_PARTS}`);
  return names.map(n => fs.readFileSync(path.join(CSS_PARTS, n), 'utf8').replace(/\r\n/g, '\n')).join('');
}

function build() {
  const names = fs.readdirSync(PARTS).filter(n => /^\d{2}-[a-z0-9-]+\.js$/.test(n)).sort();
  if (!names.length) throw new Error(`no parts in ${PARTS}`);
  const body = names.map(n => {
    // Windows checkouts may turn line ends into CRLF: the parts are joined with LF all the same.
    const text = fs.readFileSync(path.join(PARTS, n), 'utf8').replace(/\r\n/g, '\n');
    return text.endsWith('\n') ? text : text + '\n';
  }).join('');
  return `(() => {\n'use strict';\n// Built by tools/build-app.js from src/renderer/app/*.js — edit the parts, then run: node tools/build-app.js\n${body}})();\n`;
}

// What each part declares at its top level (functions, const/let/var, including simple destructuring).
function declared(text) {
  const out = new Set();
  for (const m of text.matchAll(/^(?:async\s+)?function\*?\s+([A-Za-z_$][\w$]*)|^(?:const|let|var)\s+([A-Za-z_$][\w$]*)/gm)) out.add(m[1] || m[2]);
  // `const a = …, b = …` on one line: the names after commas outside brackets.
  for (const m of text.matchAll(/^(?:const|let|var)\s+(.*)$/gm)) {
    let depth = 0, quote = '';
    const line = m[1];
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (quote) { if (c === '\\') i++; else if (c === quote) quote = ''; continue; }
      if (c === "'" || c === '"' || c === '`') quote = c;
      else if ('([{'.includes(c)) depth++;
      else if (')]}'.includes(c)) depth--;
      else if (c === ',' && depth === 0) { const n = /^\s*([A-Za-z_$][\w$]*)\s*=(?!=)/.exec(line.slice(i + 1)); if (n) out.add(n[1]); }
    }
  }
  for (const m of text.matchAll(/^(?:const|let|var)\s*\{([^}]*)\}\s*=/gm)) for (const n of m[1].split(',')) { const k = n.split(':').pop().trim(); if (/^[A-Za-z_$][\w$]*$/.test(k)) out.add(k); }
  return out;
}
// Part → the parts whose top-level names it mentions (comments stripped; a name in a string counts — templates call functions).
function deps() {
  const names = fs.readdirSync(PARTS).filter(n => /^\d{2}-[a-z0-9-]+\.js$/.test(n)).sort();
  const text = Object.fromEntries(names.map(n => [n, fs.readFileSync(path.join(PARTS, n), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1')]));
  const owner = new Map();
  for (const n of names) for (const d of declared(text[n])) if (!owner.has(d)) owner.set(d, n);
  const rows = names.map(n => {
    const used = new Map();
    for (const w of new Set(text[n].match(/[A-Za-z_$][\w$]*/g) || [])) { const o = owner.get(w); if (o && o !== n) { if (!used.has(o)) used.set(o, []); used.get(o).push(w); } }
    const list = [...used.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    return `| ${n.replace(/\.js$/, '')} | ${list.map(([o, ws]) => `${o.replace(/\.js$/, '')} (${ws.length})`).join(', ') || '—'} |`;
  });
  return `# Зависимости частей окна\n\nСоздаётся командой \`node tools/build-app.js --deps\` — не правьте вручную. Для каждой части: какие части она использует\n(по именам верхнего уровня, приблизительно: одноимённая локальная переменная тоже засчитывается; в скобках — сколько разных имён). Части делят одну область видимости, порядок важен только\nдля кода, который выполняется при загрузке.\n\n| Часть | Использует |\n|---|---|\n${rows.join('\n')}\n`;
}

if (require.main === module) {
  const text = build();
  if (process.argv.includes('--deps')) {
    fs.writeFileSync(path.join(PARTS, 'DEPS.md'), deps());
    console.log('DEPS.md written');
  } else if (process.argv.includes('--check')) {
    if (!isBuilt(fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '')) { console.error('src/renderer/app.js is not built from src/renderer/app/*.js — run: node tools/build-app.js'); process.exit(1); }
    if (!isCssBuilt(fs.existsSync(CSS_OUT) ? fs.readFileSync(CSS_OUT, 'utf8') : '')) { console.error('src/renderer/styles.css is not built from src/renderer/styles/*.css — run: node tools/build-app.js'); process.exit(1); }
    console.log('app.js and styles.css are up to date');
  } else {
    fs.writeFileSync(OUT, text);
    fs.writeFileSync(CSS_OUT, buildCss());
    console.log(`app.js: ${text.split('\n').length - 1} lines; styles.css from ${fs.readdirSync(CSS_PARTS).filter(n => n.endsWith('.css')).length} parts`);
  }
}
// The same text up to line ends (a Windows checkout has CRLF in app.js and in the parts).
function isBuilt(appJs) { return appJs.replace(/\r\n/g, '\n') === build(); }
function isCssBuilt(css) { return css.replace(/\r\n/g, '\n') === buildCss(); }
module.exports = { build, isBuilt, buildCss, isCssBuilt, deps };
