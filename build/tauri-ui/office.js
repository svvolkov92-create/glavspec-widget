// «Живой офис»: staff as little people at their desks (what they do = state of their work),
// projects as buildings on a site (floor = card, colour = status). Pure SVG strings, no DOM, no dependencies.
// Interaction is wired by app.js through data-act attributes on the groups.
(function (root) {
  'use strict';

  const C = {
    ink: '#1E2528', pencil: '#5A6468', line: '#C9CEC8', sheet: '#FBFBF8',
    blue: '#1D4E9E', red: '#B42318', redSoft: '#F7E3E0', amber: '#7A5000', amberSoft: '#F5EBD3',
    green: '#1F6B45', greenSoft: '#DDEFE3', violet: '#5A3FA0', violetSoft: '#EDE8F7',
  };
  const KIND_COLOR = { el: '#E8820C', ss: '#2E8B57', water: '#1D6FD1', sewer: '#8B5A2B', ov: '#D23C2C', '': '#5A6468' };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const f1 = v => (Math.round(v * 10) / 10).toString();

  const TW = 64, TH = 32; // tile size in screen px at scale 1
  function iso(ox, oy, s = 1) {
    const P = (x, y, z = 0) => [ox + ((x - y) * TW) / 2 * s, oy + ((x + y) * TH) / 2 * s - z * s];
    const pts = a => a.map(p => f1(p[0]) + ',' + f1(p[1])).join(' ');
    const shade = (hex, k) => {
      const n = parseInt(hex.slice(1), 16), c = v => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, '0');
      return '#' + c(n >> 16) + c((n >> 8) & 255) + c(n & 255);
    };
    function box(x, y, z, w, d, h, col, o = {}) {
      const top = [P(x, y, z + h), P(x + w, y, z + h), P(x + w, y + d, z + h), P(x, y + d, z + h)];
      const left = [P(x, y + d, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x, y + d, z + h)];
      const right = [P(x + w, y, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x + w, y, z + h)];
      const st = o.stroke || shade(col, 0.6), fo = o.fillOpacity ?? 1, dash = o.dash ? ` stroke-dasharray="${o.dash}"` : '';
      return `<polygon points="${pts(left)}" fill="${o.left || shade(col, 0.84)}" fill-opacity="${fo}" stroke="${st}"${dash}/>`
        + `<polygon points="${pts(right)}" fill="${o.right || shade(col, 0.7)}" fill-opacity="${fo}" stroke="${st}"${dash}/>`
        + `<polygon points="${pts(top)}" fill="${col}" fill-opacity="${fo}" stroke="${st}"${dash}/>`;
    }
    function floor(x, y, w, d, col, line) {
      let out = `<polygon points="${pts([P(x, y), P(x + w, y), P(x + w, y + d), P(x, y + d)])}" fill="${col}" stroke="${line}" stroke-width="1.5"/>`;
      for (let i = 1; i < w; i++) out += `<line x1="${f1(P(x + i, y)[0])}" y1="${f1(P(x + i, y)[1])}" x2="${f1(P(x + i, y + d)[0])}" y2="${f1(P(x + i, y + d)[1])}" stroke="${line}" stroke-width=".7" opacity=".55"/>`;
      for (let j = 1; j < d; j++) out += `<line x1="${f1(P(x, y + j)[0])}" y1="${f1(P(x, y + j)[1])}" x2="${f1(P(x + w, y + j)[0])}" y2="${f1(P(x + w, y + j)[1])}" stroke="${line}" stroke-width=".7" opacity=".55"/>`;
      return out;
    }
    function walls(x, y, w, d, h, col) {
      const a = [P(x, y), P(x + w, y), P(x + w, y, h), P(x, y, h)], b = [P(x, y), P(x, y + d), P(x, y + d, h), P(x, y, h)];
      return `<polygon points="${pts(a)}" fill="${shade(col, 0.96)}" stroke="${shade(col, 0.72)}"/><polygon points="${pts(b)}" fill="${shade(col, 0.86)}" stroke="${shade(col, 0.72)}"/>`;
    }
    return { P, pts, box, floor, walls, shade, s };
  }

  /* ---------- office ---------- */
  function person(I, x, y, o) {
    const [px, py] = I.P(x, y, o.z || 0), k = I.s;
    let g = `<ellipse cx="${f1(px)}" cy="${f1(py)}" rx="${f1(11 * k)}" ry="${f1(5 * k)}" fill="#000" opacity=".13"/>`;
    if (!o.sit) g += `<rect x="${f1(px - 6 * k)}" y="${f1(py - 16 * k)}" width="${f1(5 * k)}" height="${f1(16 * k)}" rx="${f1(2 * k)}" fill="${C.ink}"/><rect x="${f1(px + 1 * k)}" y="${f1(py - 16 * k)}" width="${f1(5 * k)}" height="${f1(16 * k)}" rx="${f1(2 * k)}" fill="${C.ink}"/>`;
    g += '<g class="o-figure">';
    const by = py - (o.sit ? 30 : 40) * k;
    g += `<rect x="${f1(px - 10 * k)}" y="${f1(by)}" width="${f1(20 * k)}" height="${f1(26 * k)}" rx="${f1(8 * k)}" fill="${o.color}"/>`;
    g += `<rect x="${f1(px + 2 * k)}" y="${f1(by + 6 * k)}" width="${f1(6 * k)}" height="${f1(8 * k)}" rx="${f1(1 * k)}" fill="#fff" stroke="${C.blue}" stroke-width="1.2"/>`; // staff badge
    g += `<circle cx="${f1(px)}" cy="${f1(by - 9 * k)}" r="${f1(10 * k)}" fill="#F1C9A5"/>`;
    g += `<path d="M${f1(px - 10 * k)},${f1(by - 10 * k)} a${f1(10 * k)},${f1(10 * k)} 0 0 1 ${f1(20 * k)},0 q${f1(-10 * k)},${f1(-5 * k)} ${f1(-20 * k)},0z" fill="${o.hair || '#3B2B20'}"/>`;
    if (o.folder) g += `<rect x="${f1(px + 8 * k)}" y="${f1(by + 6 * k)}" width="${f1(14 * k)}" height="${f1(11 * k)}" rx="${f1(2 * k)}" fill="${o.folder}" stroke="${C.ink}"/>`;
    if (o.cup) g += `<rect x="${f1(px + 8 * k)}" y="${f1(by + 8 * k)}" width="${f1(7 * k)}" height="${f1(9 * k)}" rx="${f1(2 * k)}" fill="#fff" stroke="${C.ink}"/>`;
    const top = by - 19 * k; // top of the head
    if (o.cap) g += `<g class="o-cap"><path d="M${f1(px - 8 * k)},${f1(top + 3 * k)} L${f1(px + 1 * k)},${f1(top - 20 * k)} L${f1(px + 9 * k)},${f1(top + 4 * k)}z" fill="#E8417A" stroke="${C.ink}" stroke-width="1"/>`
      + `<path d="M${f1(px - 5 * k)},${f1(top - 4 * k)} l${f1(11 * k)},${f1(2 * k)} M${f1(px - 2.5 * k)},${f1(top - 11 * k)} l${f1(7 * k)},${f1(1.5 * k)}" stroke="#FFD34D" stroke-width="${f1(2.2 * k)}"/><circle cx="${f1(px + 1 * k)}" cy="${f1(top - 21 * k)}" r="${f1(3.4 * k)}" fill="#FFD34D" stroke="${C.ink}" stroke-width=".8"/></g>`;
    else if (o.crown) g += `<path class="o-crown" d="M${f1(px - 9 * k)},${f1(top + 2 * k)} l${f1(-1 * k)},${f1(-12 * k)} l${f1(5 * k)},${f1(6 * k)} l${f1(5 * k)},${f1(-10 * k)} l${f1(5 * k)},${f1(10 * k)} l${f1(5 * k)},${f1(-6 * k)} l${f1(-1 * k)},${f1(12 * k)}z" fill="#F2B705" stroke="#8A6400" stroke-width="1.1"/>`;
    g += '</g>';
    if (o.bubble) {
      const [t, bg, fg] = o.bubble, bw = (t.length * 7.4 + 16) * k, bx = px - bw / 2, bt = by - (o.cap || o.crown ? 68 : 50) * k; // above a cap or crown
      g += `<g class="o-bubble"><rect x="${f1(bx)}" y="${f1(bt)}" width="${f1(bw)}" height="${f1(21 * k)}" rx="${f1(10 * k)}" fill="${bg}" stroke="${fg}" stroke-width="1.3"/>`
        + `<path d="M${f1(px - 4 * k)},${f1(bt + 21 * k)} l${f1(4 * k)},${f1(7 * k)} l${f1(4 * k)},${f1(-7 * k)}z" fill="${bg}" stroke="${fg}" stroke-width="1.3"/><rect x="${f1(px - 5 * k)}" y="${f1(bt + 19 * k)}" width="${f1(10 * k)}" height="${f1(3 * k)}" fill="${bg}"/>`
        + `<text x="${f1(px)}" y="${f1(bt + 15 * k)}" text-anchor="middle" font-size="${f1(12 * k)}" font-weight="700" fill="${fg}">${esc(t)}</text></g>`;
    }
    if (o.name) g += `<text class="o-name" x="${f1(px)}" y="${f1(py + 18 * k)}" text-anchor="middle" font-size="${f1(12 * k)}" font-weight="600" fill="${C.ink}" stroke="${C.sheet}" stroke-width="${f1(4 * k)}" paint-order="stroke">${esc(o.name)}</text>`;
    return g;
  }
  function desk(I, x, y, o = {}) {
    let s = I.box(x, y, 0, 1.4, 0.8, 22, '#D9C7A8', { stroke: '#8B7A5E' });
    const [mx, my] = I.P(x + 0.7, y + 0.15, 22);
    s += `<rect x="${f1(mx - 14 * I.s)}" y="${f1(my - 26 * I.s)}" width="${f1(28 * I.s)}" height="${f1(20 * I.s)}" rx="2" fill="${o.screen || '#2C3E66'}" stroke="${C.ink}" stroke-width="1.1"/><rect x="${f1(mx - 2 * I.s)}" y="${f1(my - 6 * I.s)}" width="${f1(4 * I.s)}" height="${f1(6 * I.s)}" fill="${C.ink}"/>`;
    if (o.sign) {
      const [sx, sy] = I.P(x + 1.1, y + 0.6, 22), w = (o.sign.length * 6.4 + 14) * I.s;
      s += `<rect x="${f1(sx - w / 2)}" y="${f1(sy - 19 * I.s)}" width="${f1(w)}" height="${f1(18 * I.s)}" rx="4" fill="${C.amberSoft}" stroke="${C.amber}"/><text x="${f1(sx)}" y="${f1(sy - 6 * I.s)}" text-anchor="middle" font-size="${f1(10.5 * I.s)}" font-weight="600" fill="#5C3D00">${esc(o.sign)}</text>`;
    }
    return s;
  }
  function plant(I, x, y) {
    const [px, py] = I.P(x, y), k = I.s;
    return I.box(x - 0.2, y - 0.2, 0, 0.4, 0.4, 18, '#B9875A') + `<circle cx="${f1(px)}" cy="${f1(py - 34 * k)}" r="${f1(14 * k)}" fill="#3E8E5A"/><circle cx="${f1(px - 9 * k)}" cy="${f1(py - 26 * k)}" r="${f1(10 * k)}" fill="#2F7A49"/><circle cx="${f1(px + 9 * k)}" cy="${f1(py - 27 * k)}" r="${f1(10 * k)}" fill="#4FA06A"/>`;
  }
  function cooler(I, x, y) {
    const [px, py] = I.P(x, y), k = I.s;
    return I.box(x - 0.25, y - 0.25, 0, 0.5, 0.5, 38, '#E8ECEF') + `<rect x="${f1(px - 9 * k)}" y="${f1(py - 70 * k)}" width="${f1(18 * k)}" height="${f1(22 * k)}" rx="${f1(7 * k)}" fill="#9CC9EE" stroke="#4E7FA8"/>`;
  }

  // What a person looks like for a given state of their work.
  const LOOK = {
    late: { bubble: ['! срок', C.redSoft, C.red], sit: true },
    checking: { bubble: null, sit: true },
    revision: { bubble: ['доработка', C.amberSoft, '#5C3D00'], sit: true },
    carry: { bubble: ['на проверке', C.violetSoft, C.violet], folder: '#B7A6E0' },
    work: { sit: true },
    idle: { sit: true, screen: '#6B7780' },
    free: { bubble: ['свободен', C.greenSoft, C.green], cup: true },
    away: {},
  };

  // One room: a grid of desks, `cols` across. Returns { svg, w, h } in screen px.
  function room(r, opts) {
    const s = opts.scale, cols = Math.max(2, Math.min(opts.cols, r.people.length || 2)), rows = Math.max(1, Math.ceil(r.people.length / cols));
    const gw = cols * 2.6 + 1.6, gd = rows * 2.6 + 2.2; // room size in tiles
    const ox = (gd * TW) / 2 * s + 10, oy = 96 * s + 44;
    const I = iso(ox, oy, s);
    let g = I.walls(0, 0, gw, gd, 96, '#E4E7E1') + I.floor(0, 0, gw, gd, '#F4F1EA', '#D8D2C4');
    const win = [I.P(gw * 0.35, 0, 36), I.P(gw * 0.65, 0, 36), I.P(gw * 0.65, 0, 84), I.P(gw * 0.35, 0, 84)];
    g += `<polygon points="${I.pts(win)}" fill="#CFE3F3" stroke="#8FB2CF" stroke-width="2"/>`;
    g += `<text x="12" y="${f1(22 * s)}" font-size="${f1(14 * s)}" font-weight="700" fill="${C.ink}">${esc(r.title)}</text>`;
    const items = [];
    const add = (d, svg) => items.push({ d, svg });
    add(gd + 0.4, plant(I, 0.6, gd - 0.6));
    const coolX = gw - 0.6, coolY = gd - 0.8;
    add(coolX + coolY, cooler(I, coolX, coolY));
    let freeN = 0;
    r.people.forEach((p, i) => {
      const cx = 0.9 + (i % cols) * 2.6, cy = 0.9 + Math.floor(i / cols) * 2.6;
      const look = LOOK[p.state] || LOOK.work;
      const free = p.state === 'free', away = p.state === 'away';
      add(cx + cy + 1.2, desk(I, cx, cy, { screen: away ? '#555' : look.screen, sign: away ? p.awayText : '' }));
      if (away) return;
      let x = cx + 0.7, y = cy + 1.25;
      if (free) { x = coolX - 0.9 - (freeN % 3) * 0.75; y = coolY - 0.2 - Math.floor(freeN / 3) * 0.7; freeN++; }
      else if (p.state === 'carry') { x = cx + 1.75; y = cy + 0.9; }
      const bubble = p.bubble || look.bubble;
      const svg = person(I, x, y, { color: KIND_COLOR[p.kind] || KIND_COLOR[''], hair: p.hair, sit: look.sit && !free, folder: look.folder, cup: look.cup, bubble: p.birthday ? ['С днём рождения!', '#FCE4EE', '#A3124A'] : bubble, name: opts.labels ? p.short : '', cap: p.birthday, crown: p.crown });
      add(x + y + 0.5, `<g class="o-person st-${esc(p.state)}${p.me ? ' me' : ''}${p.birthday ? ' bday' : ''}" data-act="office-person" data-id="${esc(p.id)}" data-person="${esc(p.id)}" tabindex="0" role="button" aria-label="${esc(p.name)}"><title>${esc(p.tip)}</title>${svg}</g>`);
    });
    items.sort((a, b) => a.d - b.d);
    g += items.map(x => x.svg).join('');
    const w = ((gw + gd) * TW) / 2 * s + 24, h = ((gw + gd) * TH) / 2 * s + 96 * s + 70;
    return { svg: g, w, h };
  }

  /* ---------- construction site ---------- */
  const FLOOR = {
    done: { col: '#DDEFE3', stroke: '#4E8F68', left: '#BFDFCB', right: '#A3CFB4', win: '#3E7F57' },
    review: { col: '#EDE8F7', stroke: '#7A5FC0', fo: 0.75, scaffold: '#8B7A5E' },
    revision: { col: '#F5EBD3', stroke: '#B07A00', fo: 0.75, scaffold: '#8B7A5E' },
    work: { col: '#E1E8F4', stroke: '#1D4E9E', fo: 0.55, scaffold: '#8B7A5E' },
    late: { col: '#F7E3E0', stroke: '#B42318', fo: 0.75, scaffold: '#B42318' },
    todo: { col: '#FFFFFF', stroke: '#9AA5AA', fo: 0.15, dash: '4 3' },
  };
  function building(b, opts) {
    const s = opts.scale, FH = 22;
    const floors = b.floors.slice(0, 14);
    const height = 4 + floors.length * FH + 70;
    const ox = 2.4 * TW / 2 * s + 20, oy = height * s + 30;
    const I = iso(ox, oy, s);
    let g = I.box(-0.3, -0.3, 0, 2.6, 2.6, 4, '#CFC8B8', { stroke: '#9E9682' });
    floors.forEach((f, i) => {
      const z = 4 + i * FH, st = FLOOR[f.state] || FLOOR.todo;
      let fl = I.box(0, 0, z, 2, 2, FH, st.col, { stroke: st.stroke, left: st.left, right: st.right, fillOpacity: st.fo, dash: st.dash });
      if (st.win) for (const tt of [0.3, 1.1]) {
        fl += `<polygon points="${I.pts([I.P(tt, 2, z + 6), I.P(tt + 0.55, 2, z + 6), I.P(tt + 0.55, 2, z + 16), I.P(tt, 2, z + 16)])}" fill="${st.win}" opacity=".5"/>`;
        fl += `<polygon points="${I.pts([I.P(2, tt, z + 6), I.P(2, tt + 0.55, z + 6), I.P(2, tt + 0.55, z + 16), I.P(2, tt, z + 16)])}" fill="${st.win}" opacity=".38"/>`;
      }
      if (st.scaffold) for (const tt of [0, 0.66, 1.33, 2]) { const a = I.P(tt, 2.15, z), c = I.P(tt, 2.15, z + FH); fl += `<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(c[0])}" y2="${f1(c[1])}" stroke="${st.scaffold}" stroke-width="1.4"/>`; }
      // Mark on the floor's front face, readable at normal zoom.
      // The front-left face runs along x: a skewY(26.57°) matrix lays horizontal text onto it.
      const [lx, ly] = I.P(1, 2, z + 7);
      const lbl = f.label.length > 11 ? f.label.slice(0, 10) + '…' : f.label;
      fl += `<text transform="matrix(1 0.5 0 1 ${f1(lx)} ${f1(ly)})" text-anchor="middle" font-size="${f1((lbl.length > 8 ? 7.5 : 8.5) * s)}" font-style="italic" font-weight="700" fill="${C.ink}" opacity=".85">${esc(lbl)}</text>`;
      g += `<g class="o-floor" data-act="open-task" data-id="${esc(f.taskId)}"><title>${esc(f.tip)}</title>${fl}</g>`;
    });
    const topZ = 4 + floors.length * FH;
    if (b.crane) {
      const [bx, by] = I.P(-0.6, 2.4), [cx, cy] = I.P(-0.6, 2.4, topZ + 46), [jx, jy] = I.P(1.8, -0.6, topZ + 46);
      g += `<line x1="${f1(bx)}" y1="${f1(by)}" x2="${f1(cx)}" y2="${f1(cy)}" stroke="#D99A1E" stroke-width="${f1(4 * s)}"/><g class="o-jib" style="transform-origin:${f1(cx)}px ${f1(cy)}px"><line x1="${f1(cx)}" y1="${f1(cy)}" x2="${f1(jx)}" y2="${f1(jy)}" stroke="#D99A1E" stroke-width="${f1(3.4 * s)}"/><line class="o-hook" x1="${f1(jx)}" y1="${f1(jy)}" x2="${f1(jx)}" y2="${f1(jy + 26 * s)}" stroke="${C.ink}" stroke-width="1.2"/></g>`;
    }
    if (b.complete) { const [fx, fy] = I.P(1, 1, topZ); g += `<line x1="${f1(fx)}" y1="${f1(fy)}" x2="${f1(fx)}" y2="${f1(fy - 36 * s)}" stroke="${C.ink}" stroke-width="2"/><path d="M${f1(fx)},${f1(fy - 36 * s)} l${f1(24 * s)},${f1(6 * s)} l${f1(-24 * s)},${f1(6 * s)}z" fill="${C.green}"/>`; }
    if (b.late) { const [cx, cy] = I.P(2.55, 2.35); g += `<path d="M${f1(cx - 7 * s)},${f1(cy)} l${f1(7 * s)},${f1(-20 * s)} l${f1(7 * s)},${f1(20 * s)}z" fill="#E8742A" stroke="#8A3F10"/><rect x="${f1(cx - 5 * s)}" y="${f1(cy - 10 * s)}" width="${f1(10 * s)}" height="${f1(3 * s)}" fill="#fff"/>`; }
    if (b.more) { const [mx, my] = I.P(1, 1, topZ + 6); g += `<text x="${f1(mx)}" y="${f1(my)}" text-anchor="middle" font-size="${f1(11 * s)}" fill="${C.pencil}">+${b.more}</text>`; }
    const [lx, ly] = I.P(1, 1, topZ + (b.complete ? 52 : 26));
    const w = Math.max(b.name.length, (b.sub || '').length) * 7 * s + 24;
    g += `<g class="o-label"><rect x="${f1(lx - w / 2)}" y="${f1(ly - 40 * s)}" width="${f1(w)}" height="${f1(36 * s)}" rx="6" fill="${C.sheet}" stroke="${C.line}"/>`
      + `<text x="${f1(lx)}" y="${f1(ly - 24 * s)}" text-anchor="middle" font-size="${f1(12.5 * s)}" font-weight="700" fill="${C.ink}">${esc(b.name)}</text>`
      + `<text x="${f1(lx)}" y="${f1(ly - 10 * s)}" text-anchor="middle" font-size="${f1(11 * s)}" fill="${b.subTone === 'bad' ? C.red : b.subTone === 'ok' ? C.green : C.pencil}">${esc(b.sub || '')}</text></g>`;
    const groundW = 2.6 * TW * s + 40;
    return { svg: `<g class="o-building" data-act="goto-project" data-id="${esc(b.id)}"><title>${esc(b.tip || b.name)}</title>${g}</g>`, w: groundW, h: oy + 3 * TH * s + 10 };
  }

  // Lays rooms (left) and buildings (right, in rows) into one SVG.
  function render(model, opts = {}) {
    const o = { scale: 1, cols: 4, labels: true, siteCols: 3, ...opts };
    const parts = [];
    let y = 0, officeW = 0;
    for (const r of model.rooms) {
      const rm = room(r, o);
      parts.push(`<g transform="translate(0 ${f1(y)})">${rm.svg}</g>`);
      y += rm.h; officeW = Math.max(officeW, rm.w);
    }
    const officeH = y;
    const siteX = officeW + 30;
    const blds = model.buildings.map(b => building(b, o));
    let sx = 0, sy = 0, rowH = 0, siteW = 0;
    const siteParts = [];
    blds.forEach((b, i) => {
      if (i && i % o.siteCols === 0) { sy += rowH; sx = 0; rowH = 0; }
      siteParts.push(`<g transform="translate(${f1(siteX + sx)} ${f1(sy + 20)})">${b.svg}</g>`);
      sx += b.w; rowH = Math.max(rowH, b.h); siteW = Math.max(siteW, sx);
    });
    const siteH = sy + rowH + 20;
    const W = Math.max(400, siteX + siteW + 20), H = Math.max(officeH, siteH, 300);
    // Ground of the site: a plain sand rectangle under the buildings.
    const ground = blds.length ? `<rect x="${f1(siteX - 10)}" y="10" width="${f1(siteW + 20)}" height="${f1(siteH)}" rx="16" fill="#ECE6D6" opacity=".7"/>` : '';
    const siteTitle = `<text x="${f1(siteX + 6)}" y="34" font-size="${f1(15 * o.scale)}" font-weight="700" fill="${C.ink}">Стройплощадка</text>`;
    return `<svg class="office-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f1(W)} ${f1(H)}" width="${f1(W * (o.zoom || 1))}" height="${f1(H * (o.zoom || 1))}" font-family="Golos Text, Segoe UI, sans-serif">${ground}${siteTitle}${parts.join('')}${siteParts.join('')}${blds.length ? '' : `<text x="${f1(siteX + 6)}" y="70" font-size="13" fill="${C.pencil}">Активных проектов нет</text>`}</svg>`;
  }

  root.Office = { render, KIND_COLOR, LOOK };
})(typeof self !== 'undefined' ? self : this);
