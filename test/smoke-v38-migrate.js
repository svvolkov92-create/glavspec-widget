'use strict';
// 3.8: a 3.6 project chat (project.chat) becomes a record of the chats collection at start.
const electron = require('electron');
const { app } = electron;
const fs = require('node:fs');
const path = require('node:path');
const outDir = process.argv.at(-1);
const log = [];
const check = (name, ok, extra = '') => log.push(`${ok ? 'OK  ' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
const dataDir = path.join(app.getPath('appData'), 'GlavspecWidget');
fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(path.join(dataDir, 'settings.json'), JSON.stringify({ notifyHour: 23 }));
fs.writeFileSync(path.join(dataDir, 'data.json'), JSON.stringify({ version: 1, contractors: {}, tasks: {},
  users: { g: { name: 'ГИП', role: 'gip' }, s: { name: 'Белова Н.А.', role: 'specialist' } },
  projects: { p1: { name: 'Склад', members: ['s'], chat: [{ id: 'm1', ts: '2026-11-01T01:00:00Z', userId: 'g', user: 'ГИП', text: 'Привет', to: ['s'] }], chatSeen: { g: '2026-11-01T01:00:00Z' } } } }));
let started = false;
app.on('browser-window-created', (_e, win) => {
  if (started) return;
  started = true;
  win.webContents.once('did-finish-load', async () => {
    try {
      await new Promise(r => setTimeout(r, 900));
      const d = JSON.parse(fs.readFileSync(path.join(dataDir, 'data.json'), 'utf8'));
      const c = d.chats?.p_p1;
      check('chat moved to the chats collection', c && c.kind === 'project' && c.projectId === 'p1' && c.messages[0].text === 'Привет' && c.messages[0].mentions.join() === 's' && c.seen.g, JSON.stringify(c));
      check('project without chat fields', !('chat' in d.projects.p1) && !('chatSeen' in d.projects.p1) && d.projects.p1.name === 'Склад');
    } catch (e) { log.push('[smoke error] ' + (e.stack || e)); }
    fs.writeFileSync(path.join(outDir, 'log.txt'), log.join('\n'));
    app.exit(0);
  });
});
require('../src/main.js');
