'use strict';
// The Пульт icon «Т из Ганта» (4.10, item 69): five colour variants the user picked (1, 3, 4, 6, 8; №1 is the base).
// Renders every file the app needs from one SVG: the installer / exe / shortcut icon (icon.ico, №1), the window
// and tray icons of each variant (switched in «Окно → Значок»), the web version's icons. Run: node tools/make-icons.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const O = '#F26A1F', W = '#FFFFFF', G = '#2F3033';
// [tile, cap, stem] — numbers as on the sheet the user chose from.
const VARIANTS = { 1: [O, W, W], 3: [O, W, G], 4: [W, O, O], 6: [W, O, G], 8: [G, W, W] };
const tile = f => (f === W ? `<rect x="1" y="1" width="62" height="62" rx="13" fill="${W}" stroke="#E2D6CC" stroke-width="2"/>` : `<rect width="64" height="64" rx="14" fill="${f}"/>`);
const T = (cap, stem) => `<rect x="12" y="14" width="40" height="9" rx="2" fill="${cap}"/><rect x="25" y="27" width="12" height="7" rx="2" fill="${stem}"/><rect x="29" y="38" width="12" height="7" rx="2" fill="${stem}" opacity=".85"/><rect x="25" y="49" width="12" height="5" rx="2" fill="${stem}" opacity=".7"/>`;
// The tray icon is 16–32 px: a bolder T (thicker bars, no fading) so it reads next to the clock.
const Tsmall = (cap, stem) => `<rect x="9" y="11" width="46" height="12" rx="2.5" fill="${cap}"/><rect x="24" y="27" width="16" height="9" rx="2" fill="${stem}"/><rect x="27" y="40" width="16" height="9" rx="2" fill="${stem}"/><rect x="24" y="53" width="16" height="6" rx="2" fill="${stem}"/>`;
const svg = (n, small = false) => { const [t, c, s] = VARIANTS[n]; return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">${tile(t)}${small ? Tsmall(c, s) : T(c, s)}</svg>`; };

// An .ico of PNG images (Windows Vista and later read PNG entries).
function ico(pngs) { // [{ size, data }]
  const head = Buffer.alloc(6 + 16 * pngs.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  let off = head.length;
  pngs.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i;
    head.writeUInt8(size >= 256 ? 0 : size, e); head.writeUInt8(size >= 256 ? 0 : size, e + 1);
    head.writeUInt8(0, e + 2); head.writeUInt8(0, e + 3); head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(data.length, e + 8); head.writeUInt32LE(off, e + 12);
    off += data.length;
  });
  return Buffer.concat([head, ...pngs.map(p => p.data)]);
}

if (require.main === module) (async () => {
  const root = path.resolve(__dirname, '..');
  const icons = path.join(root, 'src-tauri', 'icons'), web = path.join(root, 'server', 'web');
  fs.mkdirSync(path.join(icons, 'variants'), { recursive: true });
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 512, height: 512 } });
  const png = async (markup, size) => {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<html><body style="margin:0;background:transparent">${markup.replace('width="64" height="64"', `width="${size}" height="${size}"`)}</body></html>`);
    return page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  };
  for (const n of Object.keys(VARIANTS)) {
    fs.writeFileSync(path.join(icons, 'variants', `app-${n}.png`), await png(svg(n), 256));
    fs.writeFileSync(path.join(icons, 'variants', `tray-${n}.png`), await png(svg(n, true), 32));
  }
  // №1 — the base: installer, exe, shortcuts, «Приложения», the default window and tray icon.
  const sizes = [16, 20, 24, 32, 40, 48, 64, 128, 256];
  const ent = [];
  for (const s of sizes) ent.push({ size: s, data: await png(svg(1, s <= 24), s) });
  fs.writeFileSync(path.join(icons, 'icon.ico'), ico(ent));
  fs.writeFileSync(path.join(icons, 'icon.png'), await png(svg(1), 512));
  fs.writeFileSync(path.join(icons, 'tray.png'), await png(svg(1, true), 32));
  // Web version and cabinet: SVG + PNG for the home screen.
  fs.writeFileSync(path.join(web, 'icon.svg'), svg(1));
  fs.writeFileSync(path.join(web, 'icon-192.png'), await png(svg(1), 192));
  fs.writeFileSync(path.join(web, 'icon-512.png'), await png(svg(1), 512));
  await b.close();
  console.log('icons:', Object.keys(VARIANTS).join(', '), '→ src-tauri/icons, server/web');
})();

module.exports = { VARIANTS, svg };
