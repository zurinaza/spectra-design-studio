/* SPECTRA thermodynamics and models (Recommendation 2)
   Component library · boiling-point rise · ideal relative volatility and column duties ·
   multiple-effect evaporation (forward feed, equal area) · model sensitivity plots.
   Loaded before app.js; uses its globals at call time. */

/* ---------- Component library ----------
   Antoine: log10(P/mmHg) = A − B/(C + T/°C) (Dean, Lange's Handbook; checked against normal boiling points).
   dHvap at Tb (kJ/mol), Tc (K), liquid cp near 25 °C (kJ/kg K). Solutes: nonvolatile, van 't Hoff factor i. */
const COMPONENTS = {
  water: { name: 'Water', mw: 18.015, ant: [8.07131, 1730.63, 233.426], tb: 100.0, tc: 647.1, dh: 40.66, cp: 4.18, polar: true },
  methanol: { name: 'Methanol', mw: 32.04, ant: [8.08097, 1582.271, 239.726], tb: 64.7, tc: 512.6, dh: 35.21, cp: 2.53, polar: true },
  ethanol: { name: 'Ethanol', mw: 46.07, ant: [8.1122, 1592.864, 226.184], tb: 78.3, tc: 513.9, dh: 38.56, cp: 2.44, polar: true },
  propanol: { name: '1-Propanol', mw: 60.10, ant: [7.84767, 1499.21, 204.64], tb: 97.2, tc: 536.8, dh: 41.44, cp: 2.39, polar: true },
  ipa: { name: 'Isopropanol', mw: 60.10, ant: [8.11778, 1580.92, 219.61], tb: 82.3, tc: 508.3, dh: 39.85, cp: 2.60, polar: true },
  acetone: { name: 'Acetone', mw: 58.08, ant: [7.11714, 1210.595, 229.664], tb: 56.1, tc: 508.1, dh: 29.10, cp: 2.16, polar: true },
  aceticacid: { name: 'Acetic acid', mw: 60.05, ant: [7.38782, 1533.313, 222.309], tb: 118.1, tc: 591.95, dh: 23.70, cp: 2.05, polar: true },
  ethylacetate: { name: 'Ethyl acetate', mw: 88.11, ant: [7.10179, 1244.95, 217.88], tb: 77.1, tc: 523.3, dh: 31.94, cp: 1.94, polar: true },
  chloroform: { name: 'Chloroform', mw: 119.38, ant: [6.95465, 1170.966, 226.232], tb: 61.2, tc: 536.4, dh: 29.24, cp: 0.96, polar: true },
  benzene: { name: 'Benzene', mw: 78.11, ant: [6.90565, 1211.033, 220.79], tb: 80.1, tc: 562.0, dh: 30.72, cp: 1.74, polar: false },
  toluene: { name: 'Toluene', mw: 92.14, ant: [6.95464, 1344.8, 219.482], tb: 110.6, tc: 591.8, dh: 33.18, cp: 1.70, polar: false },
  ethylbenzene: { name: 'Ethylbenzene', mw: 106.17, ant: [6.95719, 1424.255, 213.206], tb: 136.2, tc: 617.2, dh: 35.57, cp: 1.72, polar: false },
  pxylene: { name: 'p-Xylene', mw: 106.17, ant: [6.99052, 1453.43, 215.307], tb: 138.4, tc: 616.2, dh: 35.67, cp: 1.72, polar: false },
  hexane: { name: 'n-Hexane', mw: 86.18, ant: [6.87601, 1171.17, 224.41], tb: 68.7, tc: 507.6, dh: 28.85, cp: 2.27, polar: false },
  heptane: { name: 'n-Heptane', mw: 100.20, ant: [6.89677, 1264.9, 216.54], tb: 98.4, tc: 540.2, dh: 31.77, cp: 2.24, polar: false },
  octane: { name: 'n-Octane', mw: 114.23, ant: [6.91868, 1351.99, 209.155], tb: 125.7, tc: 568.7, dh: 34.41, cp: 2.23, polar: false },
  cyclohexane: { name: 'Cyclohexane', mw: 84.16, ant: [6.8413, 1201.53, 222.65], tb: 80.7, tc: 553.6, dh: 29.97, cp: 1.85, polar: false },
  phenol: { name: 'Phenol', mw: 94.11, ant: [7.13301, 1516.79, 174.95], tb: 181.8, tc: 694.2, dh: 45.69, cp: 2.12, polar: true },
  caffeine: { name: 'Caffeine', mw: 194.19, solute: true, i: 1 },
  triolein: { name: 'Vegetable oil (as triolein)', mw: 885.4, solute: true, i: 1 },
  sucrose: { name: 'Sucrose', mw: 342.30, solute: true, i: 1 },
  glucose: { name: 'Glucose', mw: 180.16, solute: true, i: 1 },
  nacl: { name: 'Sodium chloride', mw: 58.44, solute: true, i: 2, electrolyte: true },
  naoh: { name: 'Sodium hydroxide', mw: 40.00, solute: true, i: 2, electrolyte: true }
};
const compOf = id => COMPONENTS[id];
function psatKPa(id, T) { const c = compOf(id); if (!c?.ant) return NaN; const [A, B, C] = c.ant; return Math.pow(10, A - B / (C + T)) * 0.133322; }
function tsatC(id, P) { const c = compOf(id); const [A, B, C] = c.ant; return B / (A - Math.log10(P / 0.133322)) - C; }
function latentMolar(id, T) { const c = compOf(id); const r = (c.tc - (T + 273.15)) / (c.tc - (c.tb + 273.15)); return r > 0 ? c.dh * 1000 * Math.pow(r, 0.38) : 0; }   // kJ/kmol, Watson
function componentChoices() {
  const op = state.operation;
  if (op === 'evaporation') return { key: ['sucrose', 'glucose', 'nacl', 'naoh'], other: ['water'] };
  if (op === 'drying' || op === 'leaching' || op === 'extraction') return { key: Object.keys(COMPONENTS), other: Object.keys(COMPONENTS).filter(k => !COMPONENTS[k].solute) };
  return { key: Object.keys(COMPONENTS).filter(k => !COMPONENTS[k].solute), other: Object.keys(COMPONENTS).filter(k => !COMPONENTS[k].solute) };
}
function syncComponentMW() {
  state.components ||= { key: '', other: '' };
  const k = compOf(state.components.key), o = compOf(state.components.other);
  if (k) state.mw.key = k.mw; if (o) state.mw.other = o.mw;
}
function renderComponentFields() {
  state.components ||= { key: '', other: '' }; const ch = componentChoices(), sel = (id, list, v, label) => `<select id="${id}" data-comp="${id === 'compKey' ? 'key' : 'other'}" aria-label="${label}"><option value="">Other (enter molar mass)</option>${list.map(k => `<option value="${k}" ${k === v ? 'selected' : ''}>${COMPONENTS[k].name}</option>`).join('')}</select>`;
  const kLib = compOf(state.components.key), oLib = compOf(state.components.other);
  return `<div class="field"><label for="compKey">Key component (${esc(state.targetComponent || 'from Scope')})</label>${sel('compKey', ch.key, state.components.key, 'Key component')}<div class="mw-line"><span>M =</span><input id="mwKey" data-mw="key" type="number" step="any" value="${esc(state.mw?.key ?? '')}" ${kLib ? 'readonly' : ''} aria-label="Molar mass of the key component"><span>kg/kmol${kLib ? ' · from library' : ''}</span></div></div><div class="field"><label for="compOther">Other component (solvent or carrier)</label>${sel('compOther', ch.other, state.components.other, 'Other component')}<div class="mw-line"><span>M =</span><input id="mwOther" data-mw="other" type="number" step="any" value="${esc(state.mw?.other ?? '')}" ${oLib ? 'readonly' : ''} aria-label="Molar mass of the other component"><span>kg/kmol${oLib ? ' · from library' : ''}</span></div></div>`;
}

/* ---------- Boiling-point rise (evaporation) ---------- */
function molality(w, id = state.components?.key) { const c = compOf(id); if (!c?.solute || !(w > 0) || w >= 1) return NaN; return (w / c.mw) / (1 - w) * 1000; }
function idealBPR(w, id = state.components?.key) { const c = compOf(id); const m = molality(w, id); return Number.isFinite(m) ? 0.512 * (c.i || 1) * m : NaN; }
function evapBPR(w) {   // K, at mass fraction w (default: product); student value wins
  const mb = massBalance(), wp = mb ? mb.x : Number(state.x), ww = w ?? wp;
  const own = Number(state.bprOwn);
  if (state.bprOwn !== undefined && state.bprOwn !== '' && Number.isFinite(own)) return own * (w === undefined ? 1 : ((molality(ww) || ww) / (molality(wp) || wp || 1)));
  const est = idealBPR(ww); return Number.isFinite(est) ? est : 0;
}
function bprNote() {
  const mb = massBalance(), w = mb ? mb.x : Number(state.x), c = compOf(state.components?.key), m = molality(w);
  if (!c) return { text: 'Choose the solute from the library to estimate boiling-point rise, or enter your own value.', warn: false };
  const est = idealBPR(w), warn = c.electrolyte ? m > 1 : m > 2;
  return { est, m, text: `Ideal (colligative) estimate at ${(w * 100).toFixed(1)} wt% ${c.name.toLowerCase()}: molality ${m.toFixed(2)} mol/kg → BPR ≈ ${est.toFixed(2)} K.`, warn, warnText: c.electrolyte ? 'This ideal estimate is far too low for a concentrated electrolyte (e.g. 50 wt% NaOH has a BPR above 40 K). Take the value from a Dühring chart in your textbook and enter it below.' : 'Real sugar solutions deviate from the ideal estimate at this concentration. Check a data source and enter the value below if it differs.' };
}

/* ---------- Relative volatility and column duties (distillation) ---------- */
function bubbleT(lk, hk, x, P) { let T = x * compOf(lk).tb + (1 - x) * compOf(hk).tb; for (let i = 0; i < 60; i++) { const f = x * psatKPa(lk, T) + (1 - x) * psatKPa(hk, T) - P; const d = (x * (psatKPa(lk, T + 0.01) - psatKPa(lk, T)) + (1 - x) * (psatKPa(hk, T + 0.01) - psatKPa(hk, T))) / 0.01; const s = f / d; T -= s; if (Math.abs(s) < 1e-4) break; } return T; }
function idealAlpha() {
  const c = state.components || {}, lk0 = c.key, hk0 = c.other;
  if (!compOf(lk0)?.ant || !compOf(hk0)?.ant || lk0 === hk0) return { error: 'Choose two volatile components from the library to estimate α.' };
  const P = Number(state.columnP) > 0 ? Number(state.columnP) : 101.325;
  const lk = compOf(lk0).tb <= compOf(hk0).tb ? lk0 : hk0, hk = lk === lk0 ? hk0 : lk0;
  const xD = moleFracOf(state.x), xB = moleFracOf(state.y);
  if (xD === null || xB === null) return { error: 'Enter compositions and molar masses first.' };
  const xDl = lk === lk0 ? xD : 1 - xD, xBl = lk === lk0 ? xB : 1 - xB;
  const Tt = bubbleT(lk, hk, xDl, P), Tb = bubbleT(lk, hk, xBl, P), at = psatKPa(lk, Tt) / psatKPa(hk, Tt), ab = psatKPa(lk, Tb) / psatKPa(hk, Tb);
  const nonideal = (compOf(lk).polar || compOf(hk).polar) && !(compOf(lk).polar && compOf(hk).polar && [lk, hk].every(x => ['methanol', 'ethanol', 'propanol', 'ipa'].includes(x)));
  return { lk, hk, P, Tt, Tb, at, ab, alpha: Math.sqrt(at * ab), swapped: lk !== lk0, nonideal, water: [lk, hk].includes('water') };
}
function columnDuties(f) {
  const a = idealAlpha(), mf = moleFlows(); if (a.error || !mf || !f || f.error) return null;
  const lamTop = f.xD * latentMolar(a.lk, a.Tt) + (1 - f.xD) * latentMolar(a.hk, a.Tt), lamBot = f.xB * latentMolar(a.lk, a.Tb) + (1 - f.xB) * latentMolar(a.hk, a.Tb);
  const Qc = mf.D * (f.R + 1) * lamTop / 3600, Vb = mf.D * (f.R + 1);       // saturated-liquid feed, constant molal overflow
  return { Qc, Qr: Vb * lamBot / 3600, Tt: a.Tt, Tb: a.Tb };
}

/* ---------- Multiple-effect evaporation (forward feed, equal areas) ---------- */
function gauss(A, b) { const n = b.length; for (let i = 0; i < n; i++) { let p = i; for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r; [A[i], A[p]] = [A[p], A[i]]; [b[i], b[p]] = [b[p], b[i]]; for (let r = i + 1; r < n; r++) { const f = A[r][i] / A[i][i]; for (let c = i; c < n; c++) A[r][c] -= f * A[i][c]; b[r] -= f * b[i]; } } const x = Array(n).fill(0); for (let i = n - 1; i >= 0; i--) { let s = b[i]; for (let c = i + 1; c < n; c++) s -= A[i][c] * x[c]; x[i] = s / A[i][i]; } return x; }
function multiEffect(sv = currentSimValues(), opt = {}) {
  const mb = opt.mb || massBalance(); if (!mb) return { error: 'Complete a valid mass balance (with molar masses if you use a mole basis).' };
  const N = Math.round(opt.N ?? sv.effects ?? 1), Ts = Number(opt.Ts ?? sv.steamTemp ?? (Number(sv.operatingTemp) + Number(state.sizing?.values?.dt ?? 28)));
  const TN = Number(opt.TN ?? sv.operatingTemp), F = mb.F, xF = mb.z, xP = mb.x, TF = Number(opt.TF ?? (Number(sv.operatingTemp) - Number(state.dTfeed || 0)));
  const cpFn = opt.cpFn || (() => Number(state.cp) || 4.0), U0 = Number(state.sizing?.values?.u || 1.5) * Number(sv.foulingFactor ?? 1), U = opt.U || Array(N).fill(U0);
  const bpr = opt.bprFn || (w => evapBPR(w));
  if (basis() === 'mole' && !opt.mb) return { error: 'The multiple-effect model works on a mass basis. Switch Calculate to a mass basis.' };
  if (!(xP > xF)) return { error: 'The product must be more concentrated than the feed.' };
  const Vtot = F * (1 - xF / xP); let V = Array(N).fill(Vtot / N), dT = null, res = null;
  for (let outer = 0; outer < 80; outer++) {
    const L = [], x = []; let l = F; for (let i = 0; i < N; i++) { l -= V[i]; L.push(l); x.push(F * xF / l); }
    const B = x.map(w => bpr(w)), total = Ts - TN - B.slice(0, N - 1).reduce((s, v) => s + v, 0);
    if (!(total > 1)) return { error: `Not enough temperature driving force (${total.toFixed(1)} K for ${N} effect${N > 1 ? 's' : ''}). Raise the steam temperature, lower the last-effect temperature or use fewer effects.` };
    if (!dT) { const w = U.map(u => 1 / u), sw = w.reduce((s, v) => s + v, 0); dT = w.map(v => total * v / sw); } else { const s = dT.reduce((a, v) => a + v, 0); dT = dT.map(v => v * total / s); }
    const T = [], Tv = []; let heat = Ts; for (let i = 0; i < N; i++) { T.push(heat - dT[i]); Tv.push(T[i] - B[i]); heat = Tv[i]; }
    const lamS = water.latent(Ts), lam = Tv.map(t => water.latent(t)), M = Array.from({ length: N + 1 }, () => Array(N + 1).fill(0)), rhs = Array(N + 1).fill(0);
    M[0][0] = lamS; M[0][1] = -lam[0]; rhs[0] = F * cpFn(xF) * (T[0] - TF);
    for (let i = 1; i < N; i++) { const cpL = cpFn(x[i - 1]), d = T[i - 1] - T[i]; M[i][i] = lam[i - 1]; M[i][i + 1] = -lam[i]; for (let j = 1; j <= i; j++) M[i][j] -= cpL * d; rhs[i] = -F * cpL * d; }
    for (let j = 1; j <= N; j++) M[N][j] = 1; rhs[N] = Vtot;
    const sol = gauss(M, rhs), S = sol[0]; V = sol.slice(1);
    const Q = [S * lamS / 3600, ...V.slice(0, N - 1).map((v, i) => v * lam[i] / 3600)], A = Q.map((q, i) => q / (U[i] * dT[i])), Am = A.reduce((s, v) => s + v, 0) / N;
    res = { N, S, V, L, x, T, Tv, B, dT: [...dT], A, Am, Q, economy: Vtot / S, Vtot, Ts, TN, P: Tv.map(t => water.psat(t)) };
    if (V.some(v => !(v > 0)) || dT.some(v => !(v > 0))) return { error: 'The model gave a negative evaporation or temperature difference. Check the feed temperature, steam temperature and compositions.' };
    if (A.every(a => Math.abs(a / Am - 1) < 0.002)) break;
    dT = dT.map((d, i) => d * A[i] / Am);
  }
  return res;
}
function simControlsFor(op = state.operation) {
  const base = operations[op].simControls;
  if (op !== 'evaporation' || state.mode !== 'Multiple effect') return base;
  return base.map(c => c[0] === 'operatingTemp' ? ['operatingTemp', 'Last-effect boiling temperature', '°C', 35, 110, 1, 55] : c).concat([['effects', 'Number of effects', '—', 2, 6, 1, 3], ['steamTemp', 'Steam saturation temperature', '°C', 100, 180, 1, 120]]);
}
function renderEffectsTable(m) {
  if (!m || m.error) return '';
  const row = (label, f, d = 1) => `<tr><td>${label}</td>${m.T.map((_, i) => `<td class="num">${f(i).toFixed(d)}</td>`).join('')}</tr>`;
  return `<div class="data-table-wrap effects-table"><table class="data-table"><thead><tr><th>EFFECT</th>${m.T.map((_, i) => `<th>${i + 1}</th>`).join('')}</tr></thead><tbody>${row('Liquor boiling temperature (°C)', i => m.T[i])}${row('Vapour saturation temperature (°C)', i => m.Tv[i])}${row('Pressure (kPa abs)', i => m.P[i])}${row('Boiling-point rise (K)', i => m.B[i], 2)}${row('ΔT driving force (K)', i => m.dT[i])}${row('Vapour produced (kg/h)', i => m.V[i])}${row('Liquor leaving (kg/h)', i => m.L[i])}${row('Solute leaving (wt%)', i => m.x[i] * 100)}${row('Heat duty (kW)', i => m.Q[i])}${row('Area (m²)', i => m.A[i], 2)}</tbody></table></div><p class="formula-note">Forward feed, equal areas, constant U and heat capacity, saturated steam. Steam ${m.S.toFixed(0)} kg/h; economy ${m.economy.toFixed(2)} kg vapour per kg steam; area ${m.Am.toFixed(1)} m² per effect (${(m.Am * m.N).toFixed(1)} m² in total).</p>`;
}

/* ---------- Calculate-stage property card ---------- */
function renderPropertyCard() {
  const op = state.operation;
  if (op === 'evaporation') {
    const n = bprNote(), own = state.bprOwn ?? '', lam = water.latent(Number(currentSimValues().operatingTemp) - (Number(evapBPR()) || 0));
    return `<section class="task-card"><div class="task-head"><div class="task-number">07a</div><div><h2>Boiling-point rise and latent heat</h2><p>A dissolved solute raises the boiling point, which reduces the temperature driving force. SPECTRA uses this in the PFD, the simulator and the multiple-effect model.</p></div></div><div class="prop-panel"><p>${esc(n.text)}</p>${n.warn ? `<div class="error-item">${esc(n.warnText)}</div>` : ''}<div class="field-grid"><div class="field"><label for="bprOwn">Your boiling-point rise at product concentration (K)</label><input id="bprOwn" type="number" step="any" value="${esc(own)}" placeholder="leave blank to use the estimate"><span class="help">Record the source in the Data Register (checklist: boiling-point rise).</span></div><div class="field"><label>Latent heat of water at the vapour temperature</label><div class="prop-value">${lam.toFixed(0)} kJ/kg <button class="mini-btn" id="useLatent" ${basis() === 'mole' ? 'disabled' : ''}>Use in energy balance</button></div><span class="help">Watson correlation. The energy balance currently uses ${esc(state.latent)} ${basisUnits().latent}.</span></div></div></div></section>`;
  }
  if (op === 'distillation') {
    const a = idealAlpha(), f = distillationFUG(currentSimValues()), dut = columnDuties(f);
    const body = a.error ? `<p class="empty-note">${esc(a.error)}</p>` : `<div class="results-grid"><div class="result"><span>Top (bubble point of distillate)</span><strong>${a.Tt.toFixed(1)} °C · α ${a.at.toFixed(2)}</strong></div><div class="result"><span>Bottom (bubble point of bottoms)</span><strong>${a.Tb.toFixed(1)} °C · α ${a.ab.toFixed(2)}</strong></div><div class="result standout"><span>Geometric-mean α (Raoult's law)</span><strong>${a.alpha.toFixed(3)}</strong></div></div>${a.swapped ? `<p class="formula-note">${esc(compOf(a.lk).name)} is the more volatile component, so it is treated as the light key.</p>` : ''}${a.nonideal ? `<div class="error-item">${a.water ? 'Water with an organic compound is strongly non-ideal and may form an azeotrope' : 'This pair is non-ideal (polar with non-polar)'}. Raoult's law can badly misjudge α. Use NRTL or UNIQUAC in Aspen and compare in the cross-check.</div>` : ''}<button class="primary small" id="useAlpha">Use α = ${a.alpha.toFixed(3)} in the simulator</button>${dut ? `<p class="formula-note">At the current reflux (R = ${f.R.toFixed(2)}): condenser duty ≈ ${dut.Qc.toFixed(0)} kW, reboiler duty ≈ ${dut.Qr.toFixed(0)} kW (saturated-liquid feed, constant molal overflow).</p>` : ''}`;
    return `<section class="task-card"><div class="task-head"><div class="task-number">07a</div><div><h2>Relative volatility from the component library</h2><p>Estimate α at the column pressure from vapour pressures (Antoine) at the top and bottom bubble points.</p></div></div><div class="field-grid"><div class="field"><label for="columnP">Column pressure (kPa abs)</label><input id="columnP" type="number" step="any" value="${esc(state.columnP ?? 101.325)}"><span class="help">${state.configuration === 'Atmospheric' ? 'Atmospheric: 101.325 kPa.' : `Set the ${state.configuration.toLowerCase()} operating pressure.`}</span></div></div>${body}</section>`;
  }
  return '';
}
function bindPropertyCard() {
  document.querySelectorAll('[data-comp]').forEach(el => el.onchange = () => { state.components ||= {}; state.components[el.dataset.comp] = el.value; syncComponentMW(); state.simulation = null; save(); render(); });
  const own = document.getElementById('bprOwn'); if (own) own.onchange = () => { state.bprOwn = own.value === '' ? '' : Number(own.value); state.simulation = null; save(); render(); };
  const ul = document.getElementById('useLatent'); if (ul) ul.onclick = () => { state.latent = Math.round(water.latent(Number(currentSimValues().operatingTemp) - (Number(evapBPR()) || 0))); state.simulation = null; save(); render(); };
  const cp = document.getElementById('columnP'); if (cp) cp.onchange = () => { state.columnP = Number(cp.value) || 101.325; state.simulation = null; save(); render(); };
  const ua = document.getElementById('useAlpha'); if (ua) ua.onclick = () => { const a = idealAlpha(); if (a.error) return; state.simValues.relativeVolatility = Number(a.alpha.toFixed(3)); state.simulation = null; save(); render(); };
}

/* ---------- Model sensitivity (Review stage) ---------- */
const SWEEPS = {
  evaporation: [
    { id: 'econN', label: 'Steam economy vs number of effects', x: 'Number of effects', y: 'Steam economy (kg/kg)', xs: [1, 2, 3, 4, 5, 6], f: n => { const m = multiEffect(currentSimValues(), { N: n, Ts: currentSimValues().steamTemp ?? 120 }); return m.error ? NaN : m.economy; }, cur: () => state.mode === 'Multiple effect' ? currentSimValues().effects : 1 },
    { id: 'areaN', label: 'Total heat-transfer area vs number of effects', x: 'Number of effects', y: 'Total area (m²)', xs: [1, 2, 3, 4, 5, 6], f: n => { const m = multiEffect(currentSimValues(), { N: n, Ts: currentSimValues().steamTemp ?? 120 }); return m.error ? NaN : m.Am * n; }, cur: () => state.mode === 'Multiple effect' ? currentSimValues().effects : 1 },
    { id: 'steamT', label: 'Steam use vs last-effect temperature', x: 'Last-effect boiling temperature (°C)', y: 'Steam (kg/h)', xs: [40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90], f: t => { const sv = currentSimValues(); const m = multiEffect(sv, { N: state.mode === 'Multiple effect' ? sv.effects : 1, TN: t, Ts: sv.steamTemp ?? (t + Number(state.sizing?.values?.dt ?? 28)), TF: Number(sv.operatingTemp) - Number(state.dTfeed || 0) }); return m.error ? NaN : m.S; }, cur: () => currentSimValues().operatingTemp }
  ],
  distillation: [
    { id: 'NvR', label: 'Required stages vs reflux ratio', x: 'R / Rmin', y: 'Theoretical stages', xs: [1.05, 1.1, 1.15, 1.2, 1.3, 1.4, 1.5, 1.75, 2, 2.5, 3], f: r => distillationFUG({ ...currentSimValues(), refluxFactor: r }).N, cur: () => currentSimValues().refluxFactor },
    { id: 'QvR', label: 'Reboiler duty vs reflux ratio', x: 'R / Rmin', y: 'Reboiler duty (kW)', xs: [1.05, 1.1, 1.2, 1.3, 1.5, 1.75, 2, 2.5, 3], f: r => { const f = distillationFUG({ ...currentSimValues(), refluxFactor: r }); return columnDuties(f)?.Qr ?? NaN; }, cur: () => currentSimValues().refluxFactor },
    { id: 'Nva', label: 'Required stages vs relative volatility', x: 'Relative volatility', y: 'Theoretical stages', xs: [1.2, 1.4, 1.6, 1.8, 2, 2.5, 3, 4, 5], f: a => distillationFUG({ ...currentSimValues(), relativeVolatility: a }).N, cur: () => currentSimValues().relativeVolatility }
  ],
  absorption: [
    { id: 'remL', label: 'Removal vs solvent rate', x: 'L / Lmin', y: 'Removal (%)', xs: [1.05, 1.1, 1.2, 1.3, 1.5, 1.75, 2, 2.5, 3], f: r => absorptionModel({ ...currentSimValues(), lgRatio: r }).removal, cur: () => currentSimValues().lgRatio, target: () => currentSimValues().targetRemoval },
    { id: 'remN', label: 'Removal vs column height (NTU)', x: 'NTU (NOG)', y: 'Removal (%)', xs: [1, 2, 3, 4, 5, 6, 8, 10, 12], f: n => { const s = state.sizing; const keep = s?.values?.ntu; if (!s?.values) return NaN; s.values.ntu = n; const r = absorptionModel(currentSimValues()).removal; s.values.ntu = keep; return r; }, cur: () => state.sizing?.values?.ntu, target: () => currentSimValues().targetRemoval }
  ],
  extraction: [
    { id: 'extS', label: 'Extraction vs solvent ratio', x: 'Solvent / feed ratio', y: 'Extraction (%)', xs: [0.2, 0.4, 0.6, 0.8, 1, 1.5, 2, 3, 4], f: s => extractionModel({ ...currentSimValues(), phaseRatio: s }).extraction, cur: () => currentSimValues().phaseRatio, target: () => currentSimValues().targetExtraction },
    { id: 'extN', label: 'Extraction vs number of stages', x: 'Actual stages', y: 'Extraction (%)', xs: [1, 2, 3, 4, 5, 6, 8, 10], f: n => extractionModel({ ...currentSimValues(), stages: n }).extraction, cur: () => currentSimValues().stages, target: () => currentSimValues().targetExtraction }
  ],
  drying: [
    { id: 'tvT', label: 'Drying time vs air temperature', x: 'Air temperature entering the dryer (°C)', y: 'Total drying time (h)', xs: [40, 45, 50, 55, 60, 65, 70, 75, 80, 90, 100], f: T => { const d = dryingModel({ ...currentSimValues(), airInletTemp: T, exhaustTemp: Math.min(currentSimValues().exhaustTemp, T - 5) }); return d.error ? NaN : d.t; }, cur: () => currentSimValues().airInletTemp },
    { id: 'GvT2', label: 'Air flow vs exhaust temperature', x: 'Exhaust air temperature (°C)', y: 'Dry-air flow (kg/h)', xs: [32, 35, 38, 40, 42, 45, 48, 50, 55, 60], f: T => { const v = currentSimValues(); if (T >= v.airInletTemp) return NaN; const d = dryingModel({ ...v, exhaustTemp: T }); return d.error || d.RH2 >= 1 ? NaN : d.Gdry; }, cur: () => currentSimValues().exhaustTemp },
    { id: 'tvV', label: 'Drying time vs air velocity', x: 'Air velocity (m/s)', y: 'Total drying time (h)', xs: [1, 1.5, 2, 3, 4, 5, 6, 8, 10], f: u => { const d = dryingModel({ ...currentSimValues(), airVelocity: u }); return d.error ? NaN : d.t; }, cur: () => currentSimValues().airVelocity }
  ],
  leaching: [
    { id: 'recS', label: 'Recovery vs solvent ratio', x: 'Solvent / dry-solid ratio', y: 'Recovery (%)', xs: [1, 1.5, 2, 3, 4, 5, 6, 8, 10], f: s => leachingModel({ ...currentSimValues(), solventRatio: s }).recovery, cur: () => currentSimValues().solventRatio, target: () => currentSimValues().targetRecovery },
    { id: 'recN', label: 'Recovery vs number of stages', x: 'Stages', y: 'Recovery (%)', xs: [1, 2, 3, 4, 5, 6, 8, 10], f: n => leachingModel({ ...currentSimValues(), stages: n }).recovery, cur: () => currentSimValues().stages, target: () => currentSimValues().targetRecovery }
  ]
};
function lineChart(sw) {
  const pts = sw.xs.map(x => [x, sw.f(x)]).filter(p => Number.isFinite(p[1]) && Math.abs(p[1]) < 1e7);
  if (pts.length < 2) return '<div class="error-item">Not enough valid points: complete the balance, sizing and simulator inputs first.</div>';
  const W = 640, H = 300, L = 62, R = 18, T = 16, B = 46, xmin = Math.min(...pts.map(p => p[0])), xmax = Math.max(...pts.map(p => p[0]));
  const tgt = sw.target?.(); let ymin = Math.min(...pts.map(p => p[1]), Number.isFinite(tgt) ? tgt : Infinity), ymax = Math.max(...pts.map(p => p[1]), Number.isFinite(tgt) ? tgt : -Infinity);
  const pad = (ymax - ymin) * 0.08 || 1; ymin -= pad; ymax += pad; if (ymin < 0 && Math.min(...pts.map(p => p[1])) >= 0) ymin = 0;
  const sx = x => L + (x - xmin) / (xmax - xmin || 1) * (W - L - R), sy = y => H - B - (y - ymin) / (ymax - ymin || 1) * (H - T - B);
  const yt = Array.from({ length: 5 }, (_, i) => ymin + (ymax - ymin) * i / 4), fmtN = v => Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2);
  const cx = Number(sw.cur?.()), cy = Number.isFinite(cx) ? sw.f(cx) : NaN;
  return `<svg class="sens-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(sw.label)}">${yt.map(v => `<line x1="${L}" x2="${W - R}" y1="${sy(v)}" y2="${sy(v)}" class="grid"/><text x="${L - 8}" y="${sy(v) + 4}" text-anchor="end" class="tick">${fmtN(v)}</text>`).join('')}${(() => { let last = -1e9; return pts.map(p => { const X = sx(p[0]); if (X - last < 30) return ''; last = X; return `<text x="${X}" y="${H - B + 16}" text-anchor="middle" class="tick">${p[0]}</text>`; }).join(''); })()}<line x1="${L}" x2="${L}" y1="${T}" y2="${H - B}" class="axis"/><line x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}" class="axis"/>${Number.isFinite(tgt) ? `<line x1="${L}" x2="${W - R}" y1="${sy(tgt)}" y2="${sy(tgt)}" class="target"/><text x="${W - R - 4}" y="${sy(tgt) - 6}" text-anchor="end" class="target-label">target ${tgt}</text>` : ''}<polyline points="${pts.map(p => `${sx(p[0])},${sy(p[1])}`).join(' ')}" class="line"/>${pts.map(p => `<circle cx="${sx(p[0])}" cy="${sy(p[1])}" r="3.5" class="pt"/>`).join('')}${Number.isFinite(cy) && cx >= xmin && cx <= xmax ? `<circle cx="${sx(cx)}" cy="${sy(cy)}" r="7" class="cur"/><text x="${sx(cx) + 10}" y="${sy(cy) - 10}" class="cur-label">your design: ${fmtN(cy)}</text>` : ''}<text x="${(L + W - R) / 2}" y="${H - 8}" text-anchor="middle" class="axis-label">${esc(sw.x)}</text><text x="16" y="${(T + H - B) / 2}" text-anchor="middle" transform="rotate(-90 16 ${(T + H - B) / 2})" class="axis-label">${esc(sw.y)}</text></svg>`;
}
function renderSensitivityCard() {
  const list = SWEEPS[state.operation]; if (!list) return '';
  const pick = list.find(s => s.id === state.sweep) || list[0];
  return `<section class="task-card"><div class="task-head"><div class="task-number">11b</div><div><h2>Model sensitivity</h2><p>See how the design responds to one variable while the others stay at your current values. Compare the shape with an Aspen Plus sensitivity analysis.</p></div></div><div class="toggle-group sweep-tabs" role="group" aria-label="Sensitivity plot">${list.map(s => `<button class="diagram-type ${s.id === pick.id ? 'active' : ''}" data-sweep="${s.id}">${esc(s.label)}</button>`).join('')}</div><div class="sens-wrap">${lineChart(pick)}</div><p class="formula-note">Where is the curve flattening? The trade-off between capital (more stages, effects or height) and operating cost (more steam or solvent) is the basis of an optimum design.</p></section>`;
}
function bindSensitivity() { document.querySelectorAll('[data-sweep]').forEach(b => b.onclick = () => { state.sweep = b.dataset.sweep; save(); render(); }); }
