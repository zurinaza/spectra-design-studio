/* SPECTRA course tools
   A. Composition basis (mass / mole)      B. Design group and project files
   C. Lecturer briefs (issue, apply, verify) D. Cost correlations linked to economics
   E. HAZOP-lite on the PFD
   Loaded before app.js; uses its globals (state, esc, save, render, balance, energy …) at call time. */

/* ================= A. Composition basis ================= */
const MOLE_DEFAULT_OPS = ['distillation', 'absorption'];
function basis() { return state.basis === 'mole' ? 'mole' : 'mass'; }
function defaultBasis(op = state.operation) { return MOLE_DEFAULT_OPS.includes(op) ? 'mole' : 'mass'; }
function flowUnitsFor(b = basis()) { return b === 'mole' ? ['kmol/h', 'kmol/batch'] : ['kg/h', 'kg/batch']; }
function basisUnits() {
  const m = basis() === 'mole', batch = /batch/.test(state.flowUnit || '');
  return { flow: m ? (batch ? 'kmol/batch' : 'kmol/h') : (batch ? 'kg/batch' : 'kg/h'), frac: m ? 'mole fraction' : 'mass fraction', pct: m ? 'mol%' : 'wt%', cp: m ? 'kJ kmol⁻¹ K⁻¹' : 'kJ kg⁻¹ K⁻¹', latent: m ? 'kJ kmol⁻¹' : 'kJ kg⁻¹' };
}
function setBasis(b) { state.basis = b; const batch = /batch/.test(state.flowUnit || ''); state.flowUnit = flowUnitsFor(b)[batch ? 1 : 0]; }
function mwOK() { return Number(state.mw?.key) > 0 && Number(state.mw?.other) > 0; }
function toMoleFrac(w) { const k = Number(state.mw.key), o = Number(state.mw.other); return (w / k) / (w / k + (1 - w) / o); }
function toMassFrac(x) { const k = Number(state.mw.key), o = Number(state.mw.other); return x * k / (x * k + (1 - x) * o); }
function bothBases(flow, frac) {
  if (!mwOK() || !Number.isFinite(flow) || !Number.isFinite(frac)) return null;
  const k = Number(state.mw.key), o = Number(state.mw.other);
  if (basis() === 'mass') return { kg: flow, w: frac, kmol: flow * (frac / k + (1 - frac) / o), x: toMoleFrac(frac) };
  return { kg: flow * (frac * k + (1 - frac) * o), w: toMassFrac(frac), kmol: flow, x: frac };
}
function massBalance() {
  const b = balance(); if (!b?.valid) return null;
  if (basis() === 'mass') return { F: state.F, P: b.P, R: b.R, z: state.z, x: state.x, y: state.y };
  if (!mwOK()) return null;
  const f = bothBases(state.F, state.z), p = bothBases(b.P, state.x), r = bothBases(b.R, state.y);
  return { F: f.kg, P: p.kg, R: r.kg, z: f.w, x: p.w, y: r.w };
}
const round = (v, d = 4) => Number(Number(v).toFixed(d));
function switchBasis(to) {
  if (to === basis()) return true;
  if (state.brief?.p?.b) { alert('Your lecturer brief fixes the composition basis.'); return false; }
  if (mwOK()) {
    const f = bothBases(state.F, state.z), conv = v => to === 'mole' ? toMoleFrac(v) : toMassFrac(v);
    const flow = to === 'mole' ? f.kmol : f.kg;
    state.z = round(conv(state.z), 6); state.x = round(conv(state.x), 6); state.y = round(conv(state.y), 6); state.throughput = state.F = round(flow, 4);
  } else if (!confirm('Molar masses are not entered, so your flow and fractions cannot be converted. Switch the basis anyway and re-enter them?')) return false;
  setBasis(to); state.sizing = state.sizing || {}; state.simulation = null; return true;
}
function renderBasisTable() {
  const b = balance();
  if (!b?.valid) return '';
  if (!mwOK()) return `<p class="formula-note">Enter both molar masses to see every stream on both a mass and a mole basis.</p>`;
  const rows = [['Feed, F', state.F, state.z], ['Product, P', b.P, state.x], ['Separated stream, R', b.R, state.y]].map(([n, fl, fr]) => { const v = bothBases(fl, fr); return `<tr><td>${n}</td><td class="num">${v.kg.toFixed(2)}</td><td class="num">${v.kmol.toFixed(3)}</td><td class="num">${(v.w * 100).toFixed(2)}</td><td class="num">${(v.x * 100).toFixed(2)}</td></tr>`; }).join('');
  const batch = /batch/.test(state.flowUnit) ? 'batch' : 'h';
  return `<div class="data-table-wrap basis-table"><table class="data-table"><thead><tr><th>STREAM</th><th>kg/${batch}</th><th>kmol/${batch}</th><th>${esc(state.targetComponent || 'Key component')} wt%</th><th>mol%</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

/* ================= B. Group and project files ================= */
const GROUP_ROLES = ['Project lead', 'Process engineer', 'Data and evidence', 'Safety and sustainability', 'Economics', 'Report editor'];
function renderGroupCard() {
  const g = state.group || { name: '', members: [] };
  const rows = g.members.map((m, i) => `<div class="member-row"><input data-member="${i}" data-mk="name" value="${esc(m.name)}" placeholder="Full name" aria-label="Member ${i + 1} name"><input data-member="${i}" data-mk="id" value="${esc(m.id)}" placeholder="Matric no." aria-label="Member ${i + 1} matric number"><select data-member="${i}" data-mk="role" aria-label="Member ${i + 1} role">${GROUP_ROLES.map(r => `<option ${r === m.role ? 'selected' : ''}>${r}</option>`).join('')}</select><button class="mini-btn danger" data-member-remove="${i}" aria-label="Remove member ${i + 1}">Remove</button></div>`).join('');
  return `<section class="task-card"><div class="task-head"><div class="task-number">00</div><div><h2>Design group</h2><p>Name your group and give each member a role. Roles appear in the portfolio and in the HAZOP record.</p></div></div><div class="field-grid"><div class="field full"><label for="groupName">Group name or number</label><input id="groupName" value="${esc(g.name)}" placeholder="e.g. Group 3"></div></div><div class="members">${rows || '<p class="empty-note">No members added yet.</p>'}</div><button class="ghost" id="addMember">+ Add member</button><div class="info-strip"><div>◆</div><div><strong>Working as a group:</strong> each member can work in their own browser, then use <em>Save file</em> and share it. The data register, references and HAZOP rows from a teammate's file can be merged in the Establish stage.</div></div></section>`;
}
function bindGroup() {
  const name = document.getElementById('groupName'); if (!name) return;
  state.group ||= { name: '', members: [] };
  name.oninput = () => { state.group.name = name.value; save(); };
  document.querySelectorAll('[data-member]').forEach(el => el[el.tagName === 'SELECT' ? 'onchange' : 'oninput'] = () => { state.group.members[Number(el.dataset.member)][el.dataset.mk] = el.value; save(); });
  document.querySelectorAll('[data-member-remove]').forEach(b => b.onclick = () => { state.group.members.splice(Number(b.dataset.memberRemove), 1); save(); render(); });
  document.getElementById('addMember').onclick = () => { state.group.members.push({ name: '', id: '', role: GROUP_ROLES[state.group.members.length % GROUP_ROLES.length] }); save(); render(); };
}
function groupIssues() { const g = state.group || {}; const named = (g.members || []).filter(m => m.name?.trim()); const out = []; if (!g.name?.trim()) out.push('Name your design group.'); if (named.length < 2) out.push('Add at least two group members.'); return out; }
function fileSlug() { return String(state.group?.name || state.projectTitle || 'project').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'project'; }
function saveProjectFile() {
  const blob = new Blob([JSON.stringify({ ...state, savedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `spectra-${fileSlug()}-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
async function readJSONFile(file) { const data = JSON.parse(await file.text()); if (!data || typeof data !== 'object' || !data.operation || !operations[data.operation]) throw new Error('not a SPECTRA file'); return data; }
async function openProjectFile(file) {
  if (!file) return;
  try {
    const data = await readJSONFile(file);
    const who = data.group?.name ? `${data.group.name}: ` : '';
    if (!confirm(`Open “${who}${data.projectTitle || 'Untitled project'}”${data.savedAt ? ` saved ${new Date(data.savedAt).toLocaleString()}` : ''}? This replaces the project in this browser.`)) return;
    delete data.savedAt; state = hydrateState(data); save(); showModule();
  } catch { alert(`${file.name} is not a SPECTRA project file.`); }
}
async function mergeTeammateFile(file) {
  if (!file) return;
  try {
    const data = await readJSONFile(file), key = e => `${norm(e.name)}|${norm(e.conditions)}`;
    const have = new Set(state.dataEntries.map(key)), newEntries = (data.dataEntries || []).filter(e => !have.has(key(e)));
    const hkey = h => `${h.node}|${h.dev}|${norm(h.cause)}`, haveH = new Set((state.hazop || []).map(hkey)), newHaz = (data.hazop || []).filter(h => !haveH.has(hkey(h)));
    const refs = (data.references || []).filter(r => !(state.references || []).some(x => refKey(x.text) === refKey(r.text)));
    if (!newEntries.length && !newHaz.length && !refs.length) { alert('Nothing new to merge: every item in that file is already in your project.'); return; }
    const from = data.group?.members?.find(m => m.name)?.name ? ` (${data.group.name || 'teammate'})` : '';
    if (!confirm(`Merge from ${file.name}${from}?\n\n• ${newEntries.length} data item(s)\n• ${refs.length} reference(s)\n• ${newHaz.length} HAZOP row(s)\n\nDuplicates are skipped. Your own work is not changed.`)) return;
    state.dataEntries.push(...newEntries.map(e => ({ ...e, checklistKey: state.dataEntries.some(x => x.checklistKey && x.checklistKey === e.checklistKey) ? '' : (e.checklistKey || '') })));
    state.references = [...(state.references || []), ...refs]; state.hazop = [...(state.hazop || []), ...newHaz];
    state.showDataQuality = true; save(); render();
  } catch { alert(`${file.name} is not a SPECTRA project file.`); }
}

/* ================= C. Lecturer briefs ================= */
const b64u = { enc: s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''), dec: s => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/')))) };
function fnv(str) { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); }
async function signTag(pass, text) {
  try { const enc = new TextEncoder(), key = await crypto.subtle.importKey('raw', enc.encode(pass), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(text))); return [...sig.slice(0, 5)].map(b => b.toString(16).padStart(2, '0')).join(''); }
  catch { return fnv(pass + '|' + text) + fnv(text + '|' + pass).slice(0, 2); }
}
async function makeBriefCode(payload, pass) { const body = b64u.enc(JSON.stringify(payload)), tag = await signTag(pass, body), head = `SPX1.${body}.${tag}`; return `${head}.${fnv(head).slice(0, 4)}`; }
function parseBriefCode(code) {
  const c = String(code || '').trim().replace(/\s+/g, ''), parts = c.split('.');
  if (parts.length !== 4 || parts[0] !== 'SPX1') return { error: 'This is not a SPECTRA brief code. Codes start with “SPX1.”' };
  if (fnv(parts.slice(0, 3).join('.')).slice(0, 4) !== parts[3]) return { error: 'The code looks incomplete or mistyped. Copy it again from your lecturer.' };
  try { return { code: c, body: parts[1], tag: parts[2], p: JSON.parse(b64u.dec(parts[1])) }; } catch { return { error: 'The code could not be read.' }; }
}
const BRIEF_LOCKS = { projectTitle: 't', feedDescription: 'fd', targetComponent: 'k', productTarget: 'pt', constraints: 'c', throughput: 'q', F: 'q', z: 'z', x: 'x', y: 'y', flowUnit: 'u' };
function briefLocked(field) { const p = state.brief?.p; if (!p) return false; const k = BRIEF_LOCKS[field]; return Boolean(k && p[k] !== undefined && p[k] !== ''); }
function applyBrief(parsed) {
  const p = parsed.p;
  if (p.o && operations[p.o] && p.o !== state.operation) { state.operation = p.o; syncSelection(true); }
  if (p.b) setBasis(p.b);
  const set = (field, key) => { if (p[key] !== undefined && p[key] !== '') state[field] = p[key]; };
  set('projectTitle', 't'); set('feedDescription', 'fd'); set('targetComponent', 'k'); set('productTarget', 'pt'); set('constraints', 'c'); set('z', 'z'); set('x', 'x'); set('y', 'y');
  if (p.q !== undefined) state.throughput = state.F = Number(p.q);
  if (p.u) state.flowUnit = p.u;
  if (Number(p.tg) > 0) { const key = { absorption: 'targetRemoval', extraction: 'targetExtraction', leaching: 'targetRecovery' }[state.operation]; if (key) state.simValues[key] = Number(p.tg); }
  if (p.gn || p.m) { state.group ||= { name: '', members: [] }; if (!state.group.name) state.group.name = p.gn || ''; if (Array.isArray(p.m) && !state.group.members.some(x => x.name?.trim())) state.group.members = p.m.map((name, i) => ({ name, id: '', role: GROUP_ROLES[i % GROUP_ROLES.length] })); }
  state.brief = { code: parsed.code, tag: parsed.tag, p }; state.sizing = {}; state.simulation = null;
}
function renderBriefCard() {
  const b = state.brief;
  if (b) {
    const p = b.p, u = p.u || basisUnits().flow;
    return `<section class="task-card brief-card locked"><div class="task-head"><div class="task-number">🔒</div><div><h2>Lecturer brief ${esc(p.g || '')} applied</h2><p>These values come from your lecturer and are locked. Everything else is your group's design.</p></div></div><div class="brief-values">${p.o ? `<div><span>Operation</span><strong>${esc(operations[p.o]?.name || p.o)}</strong></div>` : ''}<div><span>Throughput</span><strong>${esc(p.q)} ${esc(u)}</strong></div><div><span>Feed fraction z</span><strong>${esc(p.z)}</strong></div><div><span>Product fraction x</span><strong>${esc(p.x)}</strong></div>${p.y !== undefined ? `<div><span>Separated fraction y</span><strong>${esc(p.y)}</strong></div>` : ''}${p.b ? `<div><span>Basis</span><strong>${p.b === 'mole' ? 'Mole' : 'Mass'}</strong></div>` : ''}${p.tg ? `<div><span>Target</span><strong>${esc(p.tg)}%</strong></div>` : ''}</div><button class="ghost" id="removeBrief">Remove brief</button></section>`;
  }
  return `<section class="task-card brief-card"><div class="task-head"><div class="task-number">B</div><div><h2>Lecturer brief code</h2><p>If your lecturer issued your group a brief code, paste it here. It fills in and locks your feed, targets and throughput.</p></div></div><div class="brief-entry"><input id="briefCode" placeholder="SPX1.…" aria-label="Brief code"><button class="primary small" id="applyBrief">Apply brief</button></div><p class="status-note warn" id="briefError" role="status"></p></section>`;
}
function bindBrief() {
  const apply = document.getElementById('applyBrief');
  if (apply) apply.onclick = () => { const parsed = parseBriefCode(document.getElementById('briefCode').value); if (parsed.error) { document.getElementById('briefError').textContent = parsed.error; return; } if (!confirm('Apply this brief? It replaces your project title, feed, targets and throughput.')) return; applyBrief(parsed); save(); render(); };
  const remove = document.getElementById('removeBrief');
  if (remove) remove.onclick = () => { if (!confirm('Remove the lecturer brief? Your portfolio will then show that no brief was applied.')) return; state.brief = null; save(); render(); };
}
function briefValuesMatch() { const p = state.brief?.p; if (!p) return null; return ['z', 'x', 'y'].every(k => p[k] === undefined || Number(state[k]) === Number(p[k])) && (p.q === undefined || Number(state.throughput) === Number(p.q)) && (!p.o || p.o === state.operation); }

/* Lecturer tools */
let lecturerRows = [];
function lecturerDefaults() { return { op: 'evaporation', title: 'Concentrate a heat-sensitive aqueous feed', fd: 'Aqueous solution containing a non-volatile solute', k: 'Non-volatile solute', c: 'Use saturated steam; minimise thermal exposure', pt: 'Increase {k} from {z}% to {x}% ({basis} basis)', basis: 'mass', unit: 'kg/h', q: [800, 2000, 100], z: [0.05, 0.15, 0.01], x: [0.35, 0.5, 0.05], y: [0, 0, 0.01], n: 8, prefix: 'G' }; }
function renderLecturer() {
  const d = JSON.parse(sessionStorage.getItem('spectra-lecturer') || 'null') || lecturerDefaults();
  const range = (id, label, [a, b, s]) => `<div class="field"><label>${label}</label><div class="range-inputs"><input id="${id}Min" type="number" step="any" value="${a}" aria-label="${label} minimum"><span>to</span><input id="${id}Max" type="number" step="any" value="${b}" aria-label="${label} maximum"><span>step</span><input id="${id}Step" type="number" step="any" value="${s}" aria-label="${label} step"></div></div>`;
  document.getElementById('lecturerContent').innerHTML = `<div class="lect-body">${renderAssignmentSection()}${lectMulti ? renderMultiPanel() : ''}<div ${lectMulti ? 'hidden' : ''}><section class="lect-section"><h3>1. Check the case details</h3><div class="field-grid"><div class="field"><label for="lOp">Unit operation</label><select id="lOp">${Object.entries(operations).map(([k, o]) => `<option value="${k}" ${k === d.op ? 'selected' : ''}>${o.name}</option>`).join('')}</select></div><div class="field"><label for="lBasis">Composition basis</label><select id="lBasis"><option value="mass" ${d.basis === 'mass' ? 'selected' : ''}>Mass (kg/h, mass fractions)</option><option value="mole" ${d.basis === 'mole' ? 'selected' : ''}>Mole (kmol/h, mole fractions)</option></select></div><div class="field full"><label for="lTitle">Project title</label><input id="lTitle" value="${esc(d.title)}"></div><div class="field full"><label for="lFd">Feed description</label><input id="lFd" value="${esc(d.fd)}"></div><div class="field"><label for="lK">Key component</label><input id="lK" value="${esc(d.k)}"></div><div class="field"><label for="lC">Constraints</label><input id="lC" value="${esc(d.c)}"></div><div class="field full"><label for="lPt">Product target wording</label><input id="lPt" value="${esc(d.pt)}"><span class="help">{k}, {z}, {x}, {y}, {t} and {basis} are replaced for each group.</span></div><div class="field"><label for="lTg">Removal or recovery target (%)</label><input id="lTg" type="number" step="any" value="${esc(d.tg ?? '')}" placeholder="absorption, extraction, leaching"><span class="help">Sets the target in the students' simulator. For absorption it also fixes the treated-gas fraction x.</span></div></div></section><section class="lect-section"><h3>2. Set the ranges for each group</h3><div class="field-grid">${range('lQ', `Throughput (${d.basis === 'mole' ? 'kmol/h' : 'kg/h'})`, d.q)}${range('lZ', 'Feed fraction z', d.z)}${range('lX', 'Product fraction x', d.x)}${range('lY', 'Separated-stream fraction y', d.y)}<div class="field"><label for="lTa">Aspen agreement: green within (%)</label><input id="lTa" type="number" step="any" value="${d.ta ?? 5}"></div><div class="field"><label for="lTr">Amber up to (%), red beyond</label><input id="lTr" type="number" step="any" value="${d.tr ?? 15}"></div><div class="field"><label for="lN">Number of groups</label><input id="lN" type="number" min="1" max="60" value="${d.n}"></div><div class="field"><label for="lPrefix">Group label prefix</label><input id="lPrefix" value="${esc(d.prefix)}"></div><div class="field full"><label for="lPass">Marking passphrase</label><input id="lPass" type="password" autocomplete="off" placeholder="Keep this private; you need it to verify codes later"><span class="help">The passphrase signs each code so you can later check that a group's code is genuine. It is never stored.</span></div></div><button class="primary" id="lGenerate">Generate brief codes</button><p class="status-note warn" id="lError"></p></section><div id="lResults"></div></div><section class="lect-section"><h3>Verify a group's code</h3><p class="help">Paste the code shown in a group's portfolio and enter your passphrase.</p><div class="field-grid"><div class="field full"><input id="vCode" placeholder="SPX1.…" aria-label="Code to verify"></div><div class="field"><input id="vPass" type="password" autocomplete="off" placeholder="Marking passphrase" aria-label="Marking passphrase"></div><div class="field"><button class="ghost" id="vCheck">Verify code</button></div></div><div id="vResult"></div></section></div>`;
  document.getElementById('lGenerate').onclick = generateBriefs; bindAssignment(); bindMulti();
  document.getElementById('lBasis').onchange = e => { const lab = document.querySelector('label[for="lQMin"]') || document.getElementById('lQMin').closest('.field').querySelector('label'); lab.textContent = `Throughput (${e.target.value === 'mole' ? 'kmol/h' : 'kg/h'})`; };
  document.getElementById('vCheck').onclick = verifyBrief;
}
function readRange(id) { return ['Min', 'Max', 'Step'].map(s => Number(document.getElementById(id + s).value)); }
function pickInRange([a, b, s]) { if (!(s > 0) || b <= a) return a; const n = Math.floor((b - a) / s + 1e-9); const v = a + Math.floor(Math.random() * (n + 1)) * s; const dp = Math.max(0, (String(s).split('.')[1] || '').length); return Number(v.toFixed(dp)); }
async function generateBriefs() {
  const val = id => document.getElementById(id).value, err = document.getElementById('lError'); err.textContent = '';
  const d = { op: val('lOp'), basis: val('lBasis'), title: val('lTitle').trim(), fd: val('lFd').trim(), k: val('lK').trim(), c: val('lC').trim(), pt: val('lPt').trim(), q: readRange('lQ'), z: readRange('lZ'), x: readRange('lX'), y: readRange('lY'), n: Math.min(60, Math.max(1, Number(val('lN')) || 1)), prefix: val('lPrefix').trim() || 'G', tg: val('lTg') === '' ? undefined : Number(val('lTg')), ta: Number(val('lTa')) || 5, tr: Number(val('lTr')) || 15 };
  const pass = val('lPass');
  if (pass.length < 6) { err.textContent = 'Enter a marking passphrase of at least 6 characters.'; return; }
  if ([d.z, d.x, d.y].some(r => r.some(v => v < 0 || v > 1))) { err.textContent = 'Fractions must lie between 0 and 1.'; return; }
  sessionStorage.setItem('spectra-lecturer', JSON.stringify(d));
  const unit = d.basis === 'mole' ? 'kmol/h' : 'kg/h'; lecturerRows = [];
  for (let i = 0; i < d.n; i++) {
    let z, x, y, tries = 0;
    const absT = d.op === 'absorption' && d.tg > 0 && d.tg < 100 ? d.tg / 100 : null;
    do { z = pickInRange(d.z); x = absT ? Number((z * (1 - absT) / (1 - z * absT)).toFixed(5)) : pickInRange(d.x); y = absT ? 1 : pickInRange(d.y); tries++; } while (!((x > z && z > y) || (x < z && z < y)) && tries < 200);
    if (!((x > z && z > y) || (x < z && z < y))) { err.textContent = 'These ranges cannot give a valid balance (z must lie between x and y). Adjust the ranges.'; return; }
    const q = pickInRange(d.q), g = `${d.prefix}${String(i + 1).padStart(2, '0')}`, pct = v => round(v * 100, 2);
    const pt = d.pt.replace(/\{k\}/g, d.k).replace(/\{z\}/g, pct(z)).replace(/\{x\}/g, pct(x)).replace(/\{y\}/g, pct(y)).replace(/\{basis\}/g, d.basis).replace(/\{t\}/g, d.tg ?? '');
    const payload = { g, o: d.op, t: d.title, fd: d.fd, k: d.k, pt, c: d.c, q, u: unit, b: d.basis, z, x, y, ta: d.ta, tr: d.tr, ...(d.tg !== undefined ? { tg: d.tg } : {}) };
    const P = q * (z - y) / (x - y), R = q - P;
    lecturerRows.push({ g, q, z, x, y, P, R, code: await makeBriefCode(payload, pass) });
  }
  const tsv = ['Group\tThroughput (' + unit + ')\tz\tx\ty\tExpected P\tExpected R\tBrief code', ...lecturerRows.map(r => [r.g, r.q, r.z, r.x, r.y, r.P.toFixed(2), r.R.toFixed(2), r.code].join('\t'))].join('\n');
  document.getElementById('lResults').innerHTML = `<section class="lect-section"><h3>3. Give each group its code</h3><div class="data-table-wrap"><table class="data-table"><thead><tr><th>GROUP</th><th>THROUGHPUT</th><th>z</th><th>x</th><th>y</th><th>EXPECTED P</th><th>EXPECTED R</th><th>CODE</th></tr></thead><tbody>${lecturerRows.map((r, i) => `<tr><td><strong>${r.g}</strong></td><td class="num">${r.q} ${unit}</td><td class="num">${r.z}</td><td class="num">${r.x}</td><td class="num">${r.y}</td><td class="num">${r.P.toFixed(2)}</td><td class="num">${r.R.toFixed(2)}</td><td><button class="mini-btn" data-copy-code="${i}">Copy code</button></td></tr>`).join('')}</tbody></table></div><p class="help">Expected P and R are your marking key. Copy everything below into Excel and keep it with your passphrase.</p><textarea class="lect-tsv" readonly rows="6">${esc(tsv)}</textarea><div class="import-buttons"><button class="ghost" id="lCopyAll">Copy all for Excel</button></div></section>`;
  const copy = (text, btn) => { const done = () => { const t = btn.textContent; btn.textContent = 'Copied'; setTimeout(() => btn.textContent = t, 1200); }; navigator.clipboard?.writeText(text).then(done, () => { prompt('Copy this:', text); }); };
  document.querySelectorAll('[data-copy-code]').forEach(b => b.onclick = () => copy(lecturerRows[Number(b.dataset.copyCode)].code, b));
  document.getElementById('lCopyAll').onclick = e => copy(tsv, e.target);
}
async function verifyBrief() {
  const out = document.getElementById('vResult'), parsed = parseBriefCode(document.getElementById('vCode').value), pass = document.getElementById('vPass').value;
  if (parsed.error) { out.innerHTML = `<div class="diagnostic fail"><b>×</b><div><strong>Not readable</strong><span>${esc(parsed.error)}</span></div></div>`; return; }
  const ok = (await signTag(pass, parsed.body)) === parsed.tag, p = parsed.p;
  out.innerHTML = `<div class="diagnostic ${ok ? 'pass' : 'fail'}"><b>${ok ? '✓' : '×'}</b><div><strong>${ok ? `Genuine code for ${esc(p.g)}` : 'Signature does not match'}</strong><span>${ok ? `${esc(operations[p.o]?.name || '')}: throughput ${p.q} ${esc(p.u)}, z = ${p.z}, x = ${p.x}, y = ${p.y}. Compare these with the values in the group's portfolio.` : 'Either the passphrase is different from the one used to generate the codes, or the code was altered.'}</span></div></div>`;
}
function openLecturer() { renderLecturer(); document.getElementById('lecturerDialog').showModal(); }

/* ================= D. Cost correlations ================= */
function ensureCosting() {
  state.costing ||= {};
  const c = state.costing;
  c.rows ||= []; if (!c.rows.some(r => r.id === 'main')) c.rows.unshift({ id: 'main', linkSize: true, sUnit: '', a: '', b: '', n: '', sMin: '', sMax: '', fm: 1 });
  ['baseIndex', 'currentIndex', 'fx'].forEach(k => c[k] ??= ''); c.location ??= 1; c.linkPurchase ??= true; c.linkThermal ??= true; c.linkCW ??= true;
  return c;
}
function adjustedSize() { const r = state.sizing?.result; return r ? r.value * state.sensitivity / 100 : undefined; }
function costRowLabel(r) { if (r.id === 'main') return { tag: state.diagram.unitTag, item: selectedEquipment().label }; return { tag: r.tag || '', item: r.item || '' }; }
function rowCost(r, c = ensureCosting()) {
  const S = r.id === 'main' && r.linkSize ? adjustedSize() : Number(r.S);
  const a = Number(r.a), b = Number(r.b), n = Number(r.n), bi = Number(c.baseIndex), ci = Number(c.currentIndex), fx = Number(c.fx), loc = Number(c.location) || 1, fm = Number(r.fm) || 1;
  if (!(S > 0) || r.a === '' || r.b === '' || r.n === '' || ![a, b, n].every(Number.isFinite)) return { S, ok: false };
  const base = a + b * Math.pow(S, n), ready = bi > 0 && ci > 0 && fx > 0;
  const outside = (r.sMin !== '' && S < Number(r.sMin)) || (r.sMax !== '' && S > Number(r.sMax));
  return { S, base, ok: ready, rm: ready ? base * fm * (ci / bi) * loc * fx : undefined, outside };
}
function costTotal() { const c = ensureCosting(), costs = c.rows.map(r => rowCost(r, c)); return { costs, total: costs.every(x => x.ok) ? costs.reduce((s, x) => s + x.rm, 0) : undefined, complete: costs.every(x => x.ok) }; }
function pfdEnvSafe() { try { return pfdModel(); } catch { return null; } }
function linkedEconomics() {
  const c = ensureCosting(), v = state.economics.values, info = {};
  const t = costTotal(); if (c.linkPurchase && t.complete) { v.purchaseCost = Math.round(t.total); info.purchase = true; }
  const m = pfdEnvSafe(), env = m?.env;
  if (c.linkThermal && m?.ctx.op === 'evaporation' && Number.isFinite(env?.steam)) { v.thermalUse = round(env.steam, 1); info.thermal = `${env.steam.toFixed(1)} kg/h steam from the PFD stream table`; }
  if (c.linkCW && m?.ctx.op === 'evaporation' && m.ctx.aux('condenser') && Number.isFinite(env?.cw)) { v.cwUse = round(env.cw / 995, 2); info.cw = `${(env.cw / 995).toFixed(1)} m³/h cooling water from the PFD stream table`; }
  return info;
}
function renderCosting() {
  const c = ensureCosting(), t = costTotal(), res = state.sizing?.result;
  const m = pfdEnvSafe(), used = new Set(c.rows.map(r => r.tag)), pfdOpts = m ? m.nodes.filter(n => n.kind !== 'terminal' && !n.main && !used.has(n.tag)).map(n => `<option value="${esc(n.tag)}|${esc(n.name)}">${esc(n.tag)} ${esc(n.name)}</option>`).join('') : '';
  const num = (r, k, w = '') => `<input class="cost-input ${w}" data-cost="${r.id}" data-ck="${k}" type="number" step="any" value="${esc(r[k] ?? '')}" aria-label="${k}">`;
  const rows = c.rows.map((r, i) => {
    const l = costRowLabel(r), x = t.costs[i], main = r.id === 'main';
    const sCell = main && r.linkSize ? `<td class="num linked">${res ? adjustedSize().toFixed(2) : '—'}<small>from sizing</small></td>` : `<td>${num(r, 'S')}</td>`;
    const uCell = main && r.linkSize ? `<td>${esc(res?.unit || '')}</td>` : `<td><input class="cost-input narrow" data-cost="${r.id}" data-ck="sUnit" value="${esc(r.sUnit || '')}" placeholder="unit" aria-label="Size unit"></td>`;
    return `<tr><td>${main ? `<strong>${esc(l.tag)}</strong>` : `<input class="cost-input narrow" data-cost="${r.id}" data-ck="tag" value="${esc(l.tag)}" aria-label="Tag">`}</td><td>${main ? esc(l.item) + `<label class="inline-check"><input type="checkbox" data-cost-link ${r.linkSize ? 'checked' : ''}> use sizing result</label>` : `<input class="cost-input wide" data-cost="${r.id}" data-ck="item" value="${esc(l.item)}" aria-label="Equipment">`}</td>${sCell}${uCell}<td>${num(r, 'a')}</td><td>${num(r, 'b')}</td><td>${num(r, 'n', 'narrow')}</td><td class="range-cell">${num(r, 'sMin', 'narrow')}<span>–</span>${num(r, 'sMax', 'narrow')}</td><td>${num(r, 'fm', 'narrow')}</td><td class="num ${x.outside ? 'warn-cell' : ''}">${x.ok ? `RM ${Math.round(x.rm).toLocaleString('en-MY')}` : x.base ? 'Set indices' : '—'}${x.outside ? '<small>outside range</small>' : ''}</td><td>${main ? '' : `<button class="mini-btn danger" data-cost-remove="${r.id}">Remove</button>`}</td></tr>`;
  }).join('');
  const anyOutside = t.costs.some(x => x.outside);
  return `<section class="task-card"><div class="task-head"><div class="task-number">12a</div><div><h2>Purchased equipment cost from correlations</h2><p>Use the purchased-cost correlation table in your design textbook (e.g. Sinnott & Towler). Record every a, b, n and cost-index value in the Data Register with its source.</p></div></div><div class="equation"><strong>Cₑ</strong> = (a + b·Sⁿ) × f<sub>M</sub> × (index<sub>now</sub> / index<sub>base</sub>) × f<sub>L</sub> × exchange rate</div><div class="field-grid cost-globals"><div class="field"><label for="costBase">Cost index of the correlation's base year</label><input id="costBase" data-cglob="baseIndex" type="number" step="any" value="${esc(c.baseIndex)}" placeholder="from your textbook"></div><div class="field"><label for="costNow">Current cost index</label><input id="costNow" data-cglob="currentIndex" type="number" step="any" value="${esc(c.currentIndex)}" placeholder="e.g. latest CEPCI"></div><div class="field"><label for="costFx">Exchange rate (RM per currency unit of the correlation)</label><input id="costFx" data-cglob="fx" type="number" step="any" value="${esc(c.fx)}"></div><div class="field"><label for="costLoc">Location factor, f<sub>L</sub></label><input id="costLoc" data-cglob="location" type="number" step="any" value="${esc(c.location)}"></div></div><div class="data-table-wrap"><table class="data-table cost-table"><thead><tr><th>TAG</th><th>EQUIPMENT</th><th>SIZE, S</th><th>UNIT</th><th>a</th><th>b</th><th>n</th><th>VALID S RANGE</th><th>f<sub>M</sub></th><th>COST (RM)</th><th></th></tr></thead><tbody>${rows}</tbody></table></div><div class="cost-foot"><div class="add-equip"><select id="costAdd"><option value="">+ Add equipment…</option>${pfdOpts}<option value="other|">Other equipment</option></select></div><div class="cost-total"><span>Total purchased equipment cost</span><strong>${t.complete ? `RM ${Math.round(t.total).toLocaleString('en-MY')}` : 'Complete every row'}</strong></div></div>${anyOutside ? '<div class="error-item">At least one size lies outside the correlation’s valid range. Extrapolated costs are unreliable: split the equipment, choose another correlation, or state this as a limitation.</div>' : ''}<p class="formula-note">f<sub>M</sub> is the materials factor (1.0 for carbon steel). Check whether your textbook's correlation needs the size per unit or in total, and whether the index basis matches.</p></section>`;
}
function bindCosting() {
  if (!document.getElementById('costAdd')) return;
  const c = ensureCosting();
  document.querySelectorAll('[data-cglob]').forEach(el => el.onchange = () => { c[el.dataset.cglob] = el.value; state.economics.result = null; save(); render(); });
  document.querySelectorAll('[data-cost]').forEach(el => el.onchange = () => { const r = c.rows.find(x => x.id === el.dataset.cost); r[el.dataset.ck] = el.value; state.economics.result = null; save(); render(); });
  document.querySelectorAll('[data-cost-link]').forEach(el => el.onchange = () => { c.rows.find(r => r.id === 'main').linkSize = el.checked; state.economics.result = null; save(); render(); });
  document.querySelectorAll('[data-cost-remove]').forEach(el => el.onclick = () => { c.rows = c.rows.filter(r => r.id !== el.dataset.costRemove); state.economics.result = null; save(); render(); });
  document.getElementById('costAdd').onchange = e => { if (!e.target.value) return; const [tag, item] = e.target.value.split('|'); c.rows.push({ id: `r${Date.now().toString(36)}`, tag: tag === 'other' ? '' : tag, item, S: '', sUnit: '', a: '', b: '', n: '', sMin: '', sMax: '', fm: 1 }); state.economics.result = null; save(); render(); };
  document.querySelectorAll('[data-elink]').forEach(el => el.onchange = () => { c[el.dataset.elink] = el.checked; state.economics.result = null; save(); render(); });
}

/* ================= E. HAZOP-lite ================= */
const HAZOP_DEVS = ['No flow', 'Less flow', 'More flow', 'Reverse flow', 'High pressure', 'Low pressure or loss of vacuum', 'High temperature', 'Low temperature', 'High level', 'Low level', 'Contamination or wrong composition'];
const HAZOP_PROMPTS = {
  'No flow': 'What could stop flow here (pump trip, closed valve, blockage)? What happens upstream and downstream?',
  'Less flow': 'What reduces flow? How does it change residence time, heat transfer or separation?',
  'More flow': 'What could increase flow? Can the equipment cope (flooding, carry-over, overload)?',
  'Reverse flow': 'Could flow reverse when a pump stops or pressures change? What would contaminate what?',
  'High pressure': 'What raises the pressure (blocked outlet, heating, loss of cooling)? Where is the relief?',
  'Low pressure or loss of vacuum': 'What if pressure falls, or vacuum is lost or deepens? Consider vessel collapse, air ingress and the boiling point.',
  'High temperature': 'What could overheat the stream? Consider product degradation, fouling and material limits.',
  'Low temperature': 'Consider crystallisation, freezing, higher viscosity or poorer separation.',
  'High level': 'What makes the level rise? Consider overflow and liquid carry-over into vapour lines.',
  'Low level': 'Consider pump cavitation, exposed heating surfaces and gas blow-by.',
  'Contamination or wrong composition': 'Consider tube leaks between streams, wrong feed, and solvent or dust carry-over.'
};
function hazopPrompt(node, dev) {
  const k = node?.kind || '', name = (node?.name || '').toLowerCase();
  if ((k === 'vacpump' || k === 'ejector') && /pressure/i.test(dev)) return 'If vacuum is lost, the boiling temperature rises. What does that do to the product? What if air leaks in, or ejector motive steam fails?';
  if (k === 'hx' && /condenser/.test(name) && /flow/i.test(dev)) return 'If cooling water stops, vapour is not condensed. What happens to the vessel pressure and the vacuum system?';
  if (k === 'evaporator' && dev === 'High temperature') return 'Consider steam pressure control failure, product degradation and faster fouling.';
  if (k === 'column' && dev === 'High pressure') return 'Consider condenser failure or reboiler overheating. Where would you place relief, and what is the relief case?';
  if (k === 'pump' && dev === 'No flow') return 'Consider dry running, pump damage and the levels in the vessels the pump connects.';
  if (/^dryer/.test(k) && dev === 'High temperature') return 'Consider product scorching and dust explosion. What limits the inlet air temperature?';
  if ((k === 'cyclone' || k === 'bagfilter') && /contamination/i.test(dev)) return 'Consider bag rupture, dust emission to atmosphere and fire in the filter.';
  return HAZOP_PROMPTS[dev] || '';
}
function hazopNodes() { const m = pfdEnvSafe(); return m ? m.nodes.filter(n => n.kind !== 'terminal') : []; }
function riskOf(h) { const r = Number(h.s) * Number(h.l); return { r, cls: r >= 20 ? 'vhigh' : r >= 10 ? 'high' : r >= 5 ? 'medium' : 'low', label: r >= 20 ? 'Very high' : r >= 10 ? 'High' : r >= 5 ? 'Medium' : 'Low' }; }
const hazopComplete = h => ['cause', 'consequence', 'safeguards'].every(k => (h[k] || '').trim().length >= 5) && h.s && h.l;
function hazopIssues() {
  const rows = state.hazop || [], done = rows.filter(hazopComplete), nodes = new Set(done.map(h => h.node)), out = [];
  if (done.length < 4) out.push(`Record at least four complete HAZOP deviations (${done.length} so far).`);
  if (nodes.size < 2) out.push('Cover at least two different PFD nodes in the HAZOP.');
  if (!done.some(h => h.node === state.diagram.unitTag)) out.push(`Include at least one deviation on the main unit ${state.diagram.unitTag}.`);
  const noAct = rows.filter(h => riskOf(h).r >= 10 && (h.action || '').trim().length < 5);
  if (noAct.length) out.push(`Give an action for every high-risk deviation (${noAct.length} missing).`);
  return out;
}
let hazopEdit = -1;
function renderHazop() {
  const nodes = hazopNodes(), rows = state.hazop || [], h = hazopEdit >= 0 ? rows[hazopEdit] : { node: nodes.find(n => n.main)?.tag || '', dev: 'High temperature', s: 3, l: 2, by: '' };
  const members = (state.group?.members || []).filter(m => m.name?.trim());
  const node = nodes.find(n => n.tag === h.node), issues = hazopIssues();
  const sel = (id, opts, v) => `<select id="${id}">${opts.map(([val, lab]) => `<option value="${esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(lab)}</option>`).join('')}</select>`;
  const scale = [[1, '1 · Negligible / rare'], [2, '2 · Minor / unlikely'], [3, '3 · Moderate / possible'], [4, '4 · Major / likely'], [5, '5 · Catastrophic / almost certain']];
  const table = rows.length ? `<div class="data-table-wrap"><table class="data-table hazop-table"><thead><tr><th>NODE</th><th>DEVIATION</th><th>CAUSE</th><th>CONSEQUENCE</th><th>SAFEGUARDS</th><th>RISK</th><th>ACTION</th><th>BY</th><th></th></tr></thead><tbody>${rows.map((x, i) => { const r = riskOf(x); return `<tr><td><strong>${esc(x.node)}</strong></td><td>${esc(x.dev)}</td><td>${esc(x.cause)}</td><td>${esc(x.consequence)}</td><td>${esc(x.safeguards)}</td><td><span class="risk ${r.cls}">${r.label} (${r.r})</span></td><td>${esc(x.action || '—')}</td><td>${esc(x.by || '—')}</td><td><div class="table-actions"><button class="mini-btn" data-haz-edit="${i}">Edit</button><button class="mini-btn danger" data-haz-del="${i}">Delete</button></div></td></tr>`; }).join('')}</tbody></table></div>` : '';
  return `<section class="task-card"><div class="task-head"><div class="task-number">14c</div><div><h2>HAZOP-lite on your PFD</h2><p>Choose a node, apply a guideword, then record a realistic cause, its consequence, the safeguards already present and any action. Risk = severity × likelihood.</p></div></div><div class="hazop-form"><div class="field-grid"><div class="field"><label for="hzNode">Node (PFD equipment)</label>${sel('hzNode', nodes.map(n => [n.tag, `${n.tag} ${n.name}`]), h.node)}</div><div class="field"><label for="hzDev">Deviation</label>${sel('hzDev', HAZOP_DEVS.map(d => [d, d]), h.dev)}</div><div class="field full"><div class="hazop-prompt" id="hzPrompt"><b>Think about:</b> ${esc(hazopPrompt(node, h.dev))}</div></div><div class="field"><label for="hzCause">Cause</label><textarea id="hzCause" rows="2">${esc(h.cause || '')}</textarea></div><div class="field"><label for="hzCons">Consequence</label><textarea id="hzCons" rows="2">${esc(h.consequence || '')}</textarea></div><div class="field"><label for="hzSafe">Existing safeguards</label><textarea id="hzSafe" rows="2">${esc(h.safeguards || '')}</textarea></div><div class="field"><label for="hzAct">Action or recommendation</label><textarea id="hzAct" rows="2">${esc(h.action || '')}</textarea></div><div class="field"><label for="hzS">Severity</label>${sel('hzS', scale, h.s)}</div><div class="field"><label for="hzL">Likelihood</label>${sel('hzL', scale, h.l)}</div><div class="field"><label for="hzBy">Recorded by</label>${sel('hzBy', [['', members.length ? 'Choose a member' : 'Add members in Scope'], ...members.map(mb => [mb.name, `${mb.name} (${mb.role})`])], h.by)}</div><div class="field hz-buttons">${hazopEdit >= 0 ? '<button class="ghost" id="hzCancel">Cancel edit</button>' : ''}<button class="primary small" id="hzSave">${hazopEdit >= 0 ? 'Save changes' : 'Add deviation'}</button></div></div><p class="status-note warn" id="hzError"></p></div>${table}<div class="source-alerts">${issues.length ? issues.map(t => `<div class="source-alert">${esc(t)}</div>`).join('') : '<div class="source-alert good">✓ HAZOP covers the main unit and at least two nodes, and every high-risk deviation has an action.</div>'}</div></section>`;
}
function bindHazop() {
  const saveBtn = document.getElementById('hzSave'); if (!saveBtn) return;
  const updatePrompt = () => { const n = hazopNodes().find(x => x.tag === document.getElementById('hzNode').value); document.getElementById('hzPrompt').innerHTML = `<b>Think about:</b> ${esc(hazopPrompt(n, document.getElementById('hzDev').value))}`; };
  document.getElementById('hzNode').onchange = updatePrompt; document.getElementById('hzDev').onchange = updatePrompt;
  saveBtn.onclick = () => {
    const g = id => document.getElementById(id).value.trim();
    const row = { node: g('hzNode'), dev: g('hzDev'), cause: g('hzCause'), consequence: g('hzCons'), safeguards: g('hzSafe'), action: g('hzAct'), s: Number(g('hzS')), l: Number(g('hzL')), by: g('hzBy') };
    if (!hazopComplete(row)) { document.getElementById('hzError').textContent = 'Write a cause, a consequence and the existing safeguards (at least a few words each).'; return; }
    if (riskOf(row).r >= 10 && row.action.length < 5) { document.getElementById('hzError').textContent = 'This is a high-risk deviation. Add an action or recommendation.'; return; }
    state.hazop ||= []; if (hazopEdit >= 0) state.hazop[hazopEdit] = row; else state.hazop.push(row); hazopEdit = -1; save(); render();
  };
  const cancel = document.getElementById('hzCancel'); if (cancel) cancel.onclick = () => { hazopEdit = -1; render(); };
  document.querySelectorAll('[data-haz-edit]').forEach(b => b.onclick = () => { hazopEdit = Number(b.dataset.hazEdit); render(); document.getElementById('hzCause')?.focus(); });
  document.querySelectorAll('[data-haz-del]').forEach(b => b.onclick = () => { if (confirm('Delete this HAZOP row?')) { state.hazop.splice(Number(b.dataset.hazDel), 1); hazopEdit = -1; save(); render(); } });
}
function renderHazopPortfolio() {
  const rows = state.hazop || []; if (!rows.length) return '<p>No HAZOP recorded.</p>';
  return `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>NODE</th><th>DEVIATION</th><th>CAUSE</th><th>CONSEQUENCE</th><th>SAFEGUARDS</th><th>RISK</th><th>ACTION</th><th>BY</th></tr></thead><tbody>${rows.map(x => { const r = riskOf(x); return `<tr><td>${esc(x.node)}</td><td>${esc(x.dev)}</td><td>${esc(x.cause)}</td><td>${esc(x.consequence)}</td><td>${esc(x.safeguards)}</td><td>${r.label} (${r.r})</td><td>${esc(x.action || '—')}</td><td>${esc(x.by || '—')}</td></tr>`; }).join('')}</tbody></table></div>`;
}
