'use strict';
const test = require('node:test');
const assert = require('node:assert');
const A = require('../src/renderer/access.js');

test('chats: project chat for the GIP and participants, personal and group chats for their members only', () => {
  const users = [{ id: 'g', role: 'gip', name: 'ГИП' }, { id: 'c', role: 'chief', name: 'Главспец', directions: ['el'] }, { id: 's', role: 'specialist', name: 'Спец', chiefId: 'c', directions: ['el'] }];
  const p = { id: 'p', name: 'П', members: ['s'] };
  const chats = [{ id: 'p_p', kind: 'project', projectId: 'p', messages: [] }, { id: 'd_c_s', kind: 'direct', members: ['c', 's'], messages: [] }, { id: 'g1', kind: 'group', members: ['g', 'c'], messages: [] }];
  assert.ok(A.canChat(users[0], p) && A.canChat(users[2], p) && !A.canChat(users[1], p));
  const ids = u => A.viewFor(u, { users, projects: [p], tasks: [], contractors: [], chats }).chats.map(c => c.id).join();
  assert.equal(ids(users[0]), 'p_p,g1', 'the GIP: project chats and own chats, not personal chats of others');
  assert.equal(ids(users[1]), 'd_c_s,g1');
  assert.equal(ids(users[2]), 'p_p,d_c_s');
  assert.equal(A.viewFor(users[2], { users, projects: [{ ...p, deletedAt: 'x' }], tasks: [], contractors: [], chats }).chats.map(c => c.id).join(), 'd_c_s', 'deleted project — no chat');
});

test('customer page: a requested row of source data has «Передать» in the cabinet, kinds are labelled', () => {
  const { pageModel, renderPage } = require('../src/report/customer.js');
  const project = { id: 'p', name: 'П', phases: [], requests: [{ id: 'r1', title: 'ТУ на электроснабжение', due: '2026-11-20', irdId: 'i1' }],
    ird: [{ id: 'i1', title: 'ТУ на электроснабжение', kind: 'tu', who: 'Заказчик', status: 'wait' }, { id: 'i2', title: 'ГПЗУ', kind: 'doc', who: 'Заказчик', status: 'accepted' }] };
  const m = pageModel({ project, tasks: [], contact: null, today: '2026-11-07' });
  const cabHtml = renderPage(m, { today: '2026-11-07', cabinet: { csrf: 'x', base: '', sent: {} } });
  assert.match(cabHtml, /<tr class="asked">.*?Передать/s);
  assert.match(cabHtml, /class="kind">ТУ</);
  assert.equal((cabHtml.match(/name="request" value="r1"/g) || []).length >= 2, true, 'answer from «Нужно от вас» and from the row');
  const file = renderPage(m, { today: '2026-11-07' });
  assert.doesNotMatch(file, /Передать/, 'no forms in the saved file');
});
