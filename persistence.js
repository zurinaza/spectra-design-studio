/* SPECTRA safe saving
   · Every save is guarded: if browser storage is full, a banner says so and offers a file download.
   · Undo / redo (buttons and Ctrl/Cmd+Z outside text fields), grouping rapid edits together.
   · Version history: automatic snapshots in IndexedDB at every stage change, every 5 minutes of work
     and before risky actions (open file, reset, apply brief, restore). The newest 30 are kept.
   · A gentle reminder to save a project file when none has been saved for three days.
   Loaded before app.js; app.js calls persistState() from save() and initPersistence() at start-up. */

const STORE_KEY = 'uds-project';
const Persist = { committed: null, undo: [], redo: [], timer: null, lastSnap: 0, lastPhase: null, full: false, db: null, nudged: false };

function persistState() {
  const json = JSON.stringify(state);
  try { localStorage.setItem(STORE_KEY, json); if (Persist.full) { Persist.full = false; storageBanner(false); } }
  catch { Persist.full = true; storageBanner(true); }
  clearTimeout(Persist.timer); Persist.timer = setTimeout(() => settle(json), 900);
}
function settle(json) {
  if (Persist.committed === null) { Persist.committed = json; return; }
  if (json === Persist.committed) return;
  Persist.undo.push(Persist.committed); if (Persist.undo.length > 40) Persist.undo.shift();
  Persist.redo = []; Persist.committed = json; updateUndoButtons(); maybeSnapshot(json);
}
function restoreJSON(json) {
  clearTimeout(Persist.timer);
  state = hydrateState(JSON.parse(json)); Persist.committed = JSON.stringify(state);
  try { localStorage.setItem(STORE_KEY, Persist.committed); } catch { Persist.full = true; storageBanner(true); }
  if (!document.getElementById('moduleApp').hidden) render(); else { renderNotebook?.(); }
  updateUndoButtons();
}
function undoChange() { if (!Persist.undo.length) return; Persist.redo.push(JSON.stringify(state)); restoreJSON(Persist.undo.pop()); toast('Undone. Use Redo to bring it back.'); }
function redoChange() { if (!Persist.redo.length) return; Persist.undo.push(JSON.stringify(state)); restoreJSON(Persist.redo.pop()); toast('Redone.'); }
function updateUndoButtons() { const u = document.getElementById('undoBtn'), r = document.getElementById('redoBtn'); if (u) u.disabled = !Persist.undo.length; if (r) r.disabled = !Persist.redo.length; }

/* ---------- Version history (IndexedDB) ---------- */
function idb() {
  if (Persist.db) return Promise.resolve(Persist.db);
  return new Promise((res, rej) => { if (!window.indexedDB) return rej(new Error('no indexedDB')); const r = indexedDB.open('spectra', 1); r.onupgradeneeded = () => r.result.createObjectStore('snapshots', { keyPath: 'at' }); r.onsuccess = () => { Persist.db = r.result; res(r.result); }; r.onerror = () => rej(r.error); });
}
async function snapshot(json, reason) {
  try {
    const db = await idb(), s = JSON.parse(json);
    await new Promise((res, rej) => { const tx = db.transaction('snapshots', 'readwrite'), st = tx.objectStore('snapshots'); st.put({ at: Date.now(), reason, phase: s.phase, title: s.projectTitle || '', group: s.group?.name || '', json }); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    const keys = await new Promise(res => { const q = db.transaction('snapshots').objectStore('snapshots').getAllKeys(); q.onsuccess = () => res(q.result); q.onerror = () => res([]); });
    if (keys.length > 30) { const tx = db.transaction('snapshots', 'readwrite'); keys.sort((a, b) => a - b).slice(0, keys.length - 30).forEach(k => tx.objectStore('snapshots').delete(k)); }
  } catch { /* history is a convenience; never block saving */ }
}
function maybeSnapshot(json) {
  const phase = JSON.parse(json).phase, stageChange = Persist.lastPhase !== null && phase !== Persist.lastPhase;
  if (stageChange || Date.now() - Persist.lastSnap > 5 * 60e3) { Persist.lastSnap = Date.now(); snapshot(json, stageChange ? `moved to ${phases[phase]?.name || 'a new stage'}` : 'autosave'); }
  Persist.lastPhase = phase;
}
function beforeRisky(reason) { snapshot(JSON.stringify(state), `before ${reason}`); }
async function listSnapshots() { try { const db = await idb(); return await new Promise(res => { const q = db.transaction('snapshots').objectStore('snapshots').getAll(); q.onsuccess = () => res(q.result.sort((a, b) => b.at - a.at)); q.onerror = () => res([]); }); } catch { return null; } }
async function openHistory() {
  const host = document.getElementById('historyContent'); host.innerHTML = '<p class="help">Loading…</p>'; document.getElementById('historyDialog').showModal();
  const snaps = await listSnapshots();
  if (snaps === null) { host.innerHTML = '<p class="empty-note">This browser does not allow version history. Save project files regularly instead.</p>'; return; }
  if (!snaps.length) { host.innerHTML = '<p class="empty-note">No versions yet. SPECTRA saves one at every stage change and every five minutes of work.</p>'; return; }
  host.innerHTML = `<div class="history-list">${snaps.map(s => `<div class="history-item"><div><strong>${new Date(s.at).toLocaleString('en-MY', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</strong><span>${esc(s.reason)} · stage ${esc(phases[s.phase]?.name || '')}${s.group ? ` · ${esc(s.group)}` : ''}</span><small>${esc(s.title)}</small></div><div class="table-actions"><button class="mini-btn" data-hist-dl="${s.at}">Download</button><button class="mini-btn add" data-hist-restore="${s.at}">Restore</button></div></div>`).join('')}</div>`;
  host.querySelectorAll('[data-hist-restore]').forEach(b => b.onclick = () => { const s = snaps.find(x => String(x.at) === b.dataset.histRestore); if (!confirm('Restore this version? Your current work is kept in the history and can be restored again.')) return; beforeRisky('restoring an older version'); Persist.undo.push(JSON.stringify(state)); restoreJSON(s.json); document.getElementById('historyDialog').close(); toast('Older version restored.'); });
  host.querySelectorAll('[data-hist-dl]').forEach(b => b.onclick = () => { const s = snaps.find(x => String(x.at) === b.dataset.histDl); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([s.json], { type: 'application/json' })); a.download = `spectra-version-${new Date(s.at).toISOString().slice(0, 16).replace(':', '')}.json`; a.click(); });
}

/* ---------- Banners and toasts ---------- */
function storageBanner(on) {
  let el = document.getElementById('storageBanner');
  if (!on) { el?.remove(); return; }
  if (el) return;
  el = document.createElement('div'); el.id = 'storageBanner'; el.className = 'storage-banner'; el.setAttribute('role', 'alert');
  el.innerHTML = '<strong>Browser storage is full.</strong> Your latest changes are not being kept in this browser. Save a project file now, then clear large pasted Aspen results. <button class="primary small" id="storageSave">Save file</button>';
  document.body.appendChild(el); document.getElementById('storageSave').onclick = () => saveProjectFile();
}
function toast(msg, actions = '') {
  let el = document.getElementById('spectraToast'); if (!el) { el = document.createElement('div'); el.id = 'spectraToast'; el.className = 'spectra-toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.innerHTML = `<span>${msg}</span>${actions}`; el.classList.add('show'); clearTimeout(el._t); if (!actions) el._t = setTimeout(() => el.classList.remove('show'), 3200);
  return el;
}
function backupNudge() {
  if (Persist.nudged || (state.phase || 0) < 2) return;
  const last = state.lastFileSave ? new Date(state.lastFileSave) : null;
  if (last && Date.now() - last.getTime() < 3 * 86400e3) return;
  Persist.nudged = true;
  const el = toast(`Keep a copy of your work: save a project file (last saved ${last ? last.toLocaleDateString('en-MY') : 'never'}).`, '<button class="primary small" id="nudgeSave">Save file</button><button class="ghost small" id="nudgeLater">Later</button>');
  document.getElementById('nudgeSave').onclick = () => { saveProjectFile(); el.classList.remove('show'); };
  document.getElementById('nudgeLater').onclick = () => el.classList.remove('show');
}
function initPersistence() {
  Persist.committed = JSON.stringify(state); Persist.lastPhase = state.phase;
  document.addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return;
    const t = e.target; if (t.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    if (document.getElementById('moduleApp').hidden) return;
    e.preventDefault(); e.shiftKey ? redoChange() : undoChange();
  });
  document.getElementById('undoBtn').onclick = undoChange; document.getElementById('redoBtn').onclick = redoChange; document.getElementById('historyBtn').onclick = openHistory;
  updateUndoButtons();
}
