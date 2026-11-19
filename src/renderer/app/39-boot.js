/* ---------- boot ---------- */
// What the testing aid (feedback-ui.js) may use; remove together with that file.
window.AppBridge = { state, toast, esc, TABS, setFileMenu: open => setFileMenu(open), quickEntry, openTarget };
try { const m = sessionStorage.getItem('glavspec.toast'); if (m) { sessionStorage.removeItem('glavspec.toast'); setTimeout(() => toast(m), 600); } } catch { /* optional */ }
applyNav();
applyDense();
applyAnim();
state.kanban.lanes = loadLocal('kbLanes', '') || '';
state.gantt.crit = !!loadLocal('ganttCrit', false);
state.showAssign = { ...state.showAssign, ...loadLocal('showAssign', {}) };
state.kbShow = { ...state.kbShow, ...loadLocal('kbShow', {}) };
$('#app').addEventListener('scroll', rememberScroll, { passive: true });
if (SOLO) {
  document.body.classList.add('solo', 'solo-' + SOLO.kind);
  if (SOLO.kind === 'project') { state.tab = 'projects'; state.openProjectId = SOLO.id; }
  else if (SOLO.kind === 'chat') { msg.mode = 'solo'; msg.chatId = SOLO.id; }
}
// A separate window hands a project or a chat back (or asks to open another one here).
api.onWindowMain?.(spec => {
  if (spec?.kind === 'project' && state.projects.has(spec.id)) { if (state.tab !== 'projects') { state.tab = 'projects'; saveLocal('tab', 'projects'); } openProjectPage(spec.id); }
  else if (spec?.kind === 'chat' && spec.id) { if (msg.mode === 'pill') { msg.mode = 'full'; msg.enter = true; } msgOpen(spec.id); }
  else if (spec?.kind === 'task' && state.tasks.has(spec.id)) openTask(spec.id); // from the tray panel
  else if (spec?.kind === 'main' && spec.id === 'day') { state.tab = 'day'; saveLocal('tab', 'day'); renderNow(); }
});
api.onData(view => { setData(view); remoteStatus(); });
api.onCabinet?.(setCab);
api.onWindowState(applyWinState);
api.onOpenTask?.(id => { if (state.tasks.has(id)) openTask(id); });
(async () => {
  try {
    applyWinState(await api.getWindowState());
    const { data, warning, remote } = await api.getData();
    state.remote = remote || null;
    setData(data);
    renderRemote();
    if (warning) toast(warning, true);
    api.cabinetGet?.().then(setCab).catch(() => {});
  } catch (e) {
    $('#app').innerHTML = `<section class="empty"><h2>Не удалось загрузить данные</h2><p class="hint">${esc(e?.message || e)}</p></section>`;
  }
})();
