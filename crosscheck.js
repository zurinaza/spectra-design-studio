/* SPECTRA shortcut models and Aspen Plus cross-check
   Models: binary Fenske–Underwood–Gilliland (+ Kirkbride), Colburn/Kremser absorption,
   Kremser extraction, stage-wise leaching with first-order kinetics.
   Cross-check: Aspen setup record, key-result comparison, pasted Aspen stream results, reflection.
   Loaded before app.js; uses its globals at call time. */

/* ================= Shortcut models ================= */
function moleFracOf(v) { if (!Number.isFinite(Number(v))) return null; if (basis() === 'mole') return Number(v); return mwOK() ? toMoleFrac(Number(v)) : null; }
function moleFlows() {
  const b = balance(); if (!b?.valid) return null;
  if (basis() === 'mole') return { F: state.F, D: b.P, B: b.R };
  if (!mwOK()) return null;
  return { F: bothBases(state.F, state.z).kmol, D: bothBases(b.P, state.x).kmol, B: bothBases(b.R, state.y).kmol };
}
function distillationFUG(v) {
  const alpha = Number(v.relativeVolatility), xD = moleFracOf(state.x), xB = moleFracOf(state.y), zF = moleFracOf(state.z);
  if ([xD, xB, zF].some(x => x === null)) return { error: 'FUG needs mole fractions. Use a mole basis, or enter both molar masses in Calculate.' };
  if (!(xD < 1 && xB > 0)) return { error: 'Perfect purity is impossible. Set the product fraction x below 1 and give the bottoms a small, non-zero fraction y.' };
  if (!(xD > zF && zF > xB)) return { error: 'The distillate (product, x) must be richer in the light key than the feed (z), and the bottoms (y) leaner.' };
  if (!(alpha > 1)) return { error: 'Relative volatility must be greater than 1.' };
  const Nmin = Math.log((xD / (1 - xD)) * ((1 - xB) / xB)) / Math.log(alpha);
  const Rmin = (xD / zF - alpha * (1 - xD) / (1 - zF)) / (alpha - 1);            // Underwood, binary, saturated-liquid feed
  if (!(Rmin > 0)) return { error: 'Minimum reflux came out non-positive: check the compositions and relative volatility.' };
  const R = Rmin * Number(v.refluxFactor), X = Math.max((R - Rmin) / (R + 1), 1e-4);
  const Y = 1 - Math.exp(((1 + 54.4 * X) / (11 + 117.2 * X)) * ((X - 1) / Math.sqrt(X)));   // Gilliland (Molokanov form)
  const N = (Y + Nmin) / (1 - Y);                                                    // theoretical stages incl. partial reboiler
  const mf = moleFlows(); let feed;
  if (mf && mf.D > 0) { const ratio = Math.pow(10, 0.206 * Math.log10((mf.B / mf.D) * ((1 - zF) / zF) * Math.pow(xB / (1 - xD), 2))); feed = N * ratio / (1 + ratio); } // Kirkbride, stages above feed
  return { Nmin, Rmin, R, N, feed, xD, xB, zF, alpha };
}
function absorptionModel(v) {
  const phiT = Number(v.targetRemoval) / 100, A = Number(v.lgRatio) * phiT, NOG = Number(state.sizing?.values?.ntu);
  if (!(NOG > 0)) return { error: 'Calculate the preliminary size first; the model uses your NTU (NOG).' };
  const S = 1 / A, ratio = Math.abs(1 - S) < 1e-6 ? NOG + 1 : (Math.exp(NOG * (1 - S)) - S) / (1 - S);   // Colburn, pure solvent
  const phi = 1 - 1 / ratio;
  const stages = Math.abs(A - 1) < 1e-6 ? phi / (1 - phi) : (A > phi ? Math.log((A - phi) / (1 - phi)) / Math.log(A) - 1 : Infinity); // Kremser equivalent stages
  return { A, NOG, removal: phi * 100, target: phiT * 100, stages };
}
function extractionModel(v) {
  const E = Number(v.distributionK) * Number(v.phaseRatio), eff = Number(v.stageEfficiency) / 100, N = Math.round(Number(v.stages)), cfg = state.configuration;
  let unext;
  if (/single/i.test(cfg)) unext = 1 - eff * E / (1 + E);
  else if (/cross/i.test(cfg)) { const u = 1 / (1 + E / N); unext = Math.pow(1 - eff * (1 - u), N); }
  else { const Nth = N * eff; unext = Math.abs(E - 1) < 1e-6 ? 1 / (Nth + 1) : (E - 1) / (Math.pow(E, Nth + 1) - 1); }  // Kremser, counter-current
  return { E, Nth: /single/i.test(cfg) ? eff : N * eff, extraction: (1 - unext) * 100, target: Number(v.targetExtraction) };
}
function leachingModel(v) {
  const S = Number(v.solventRatio), r = Number(v.retention), N = Math.round(Number(v.stages)), cfg = state.configuration;
  if (!(S > r)) return { error: 'The solvent ratio must exceed the underflow retention, otherwise no solution overflows.' };
  let unrec;
  if (/single/i.test(cfg)) unrec = r / S;
  else if (/cross/i.test(cfg)) { const s = S / N; unrec = (r / s) * Math.pow(r / (r + s), N - 1); }
  else { const R = (S - r) / r; unrec = Math.abs(R - 1) < 1e-6 ? 1 / (N + 1) : (R - 1) / (Math.pow(R, N + 1) - 1); }
  const eta = 1 - Math.exp(-Number(v.rateConstant) * Number(v.contactTime));
  return { equilibrium: (1 - unrec) * 100, eta: eta * 100, recovery: (1 - unrec) * eta * 100, target: Number(v.targetRecovery) };
}

/* ================= Aspen cross-check ================= */
const ASPEN_GUIDE = {
  evaporation: { blocks: 'Heater (feed preheat) → Flash2 at the evaporator pressure; add a HeatX or a second Heater for the steam side. Chain Flash2 blocks for multiple effects.', method: 'NRTL for aqueous organic solutes (e.g. sucrose). ELECNRTL for salt solutions: it predicts boiling-point rise. STEAM-TA or IAPWS-95 for pure water and steam.', optional: false },
  distillation: { blocks: 'DSTWU first (the same Fenske–Underwood–Gilliland method as SPECTRA), then RadFrac using DSTWU’s stages, feed stage and reflux ratio. DSTWU counts the condenser and reboiler as stages.', method: 'NRTL or UNIQUAC for non-ideal polar mixtures (check for azeotropes, e.g. ethanol–water). Peng–Robinson or RK-Soave for hydrocarbons. IDEAL only for near-ideal pairs such as benzene–toluene.', optional: false },
  absorption: { blocks: 'RadFrac with Condenser = None and Reboiler = None; solvent to stage 1, gas to the bottom stage (on-stage). Use rate-based RadFrac for packed columns if available.', method: 'NRTL with the solute declared as a Henry component for gases in water. ENRTL-RK or ELECNRTL for amine or acid-gas systems.', optional: false },
  extraction: { blocks: 'Extract block (counter-current). Specify the number of stages and the key components of each liquid phase.', method: 'NRTL or UNIQUAC with liquid–liquid (LLE) binary parameters. Check that the parameters were regressed from LLE, not VLE, data.', optional: false },
  drying: { blocks: 'Model the AIR SYSTEM, not the dryer size: ambient moist air → Heater → Dryer block in shortcut mode (or a Flash2 in which the air picks up the evaporated water). Size the dryer itself by hand from the drying curve.', method: 'IDEAL for air and water vapour; STEAM-TA if you model a steam heater.', optional: false },
  leaching: { blocks: 'Model the HEXANE RECOVERY section: miscella evaporator or stripper (RadFrac or Flash2), hexane condenser and solvent recycle. Stretch: model the counter-current stages as linked split blocks with a recycle. Size the extractor itself by hand.', method: 'NRTL for oil–hexane (represent the oil by a triglyceride such as triolein, or UNIFAC if parameters are missing).', optional: false }
};
const PROPERTY_METHODS = ['IDEAL', 'NRTL', 'UNIQUAC', 'WILSON', 'UNIFAC', 'NRTL-HOC', 'PENG-ROB', 'RK-SOAVE', 'SRK', 'ELECNRTL', 'ENRTL-RK', 'STEAM-TA', 'IAPWS-95', 'Other'];
const DIFF_REASONS = ['SPECTRA neglects boiling-point rise', 'Ideal vs non-ideal thermodynamics (property method)', 'Constant relative volatility assumed in SPECTRA', 'Different specification or stage counting', 'Different basis (mass vs mole) or units', 'Feed condition or heat losses differ', 'Aspen result has warnings or did not fully converge', 'Different physical-property data source', 'Other'];
function ccState() { state.crossCheck ||= {}; const c = state.crossCheck; c.rows ||= {}; c.custom ||= []; c.paste ||= { raw: '', map: {}, comp: '' }; return c; }
function ccThresholds() { const p = state.brief?.p || {}; return { amber: Number(p.ta) > 0 ? Number(p.ta) : 5, red: Number(p.tr) > 0 ? Number(p.tr) : 15 }; }
function diffStatus(hand, aspen) {
  const h = Number(hand), a = Number(aspen);
  if (String(aspen).trim() === '' || !Number.isFinite(a)) return { cls: 'none', label: 'Enter Aspen value' };
  if (String(hand).trim() === '' || !Number.isFinite(h)) return { cls: 'none', label: 'Enter hand value' };
  const base = Math.abs(a) > 1e-12 ? Math.abs(a) : Math.abs(h) || 1, d = (h - a) / base * 100, t = ccThresholds(), ad = Math.abs(d);
  return { d, cls: ad <= t.amber ? 'green' : ad <= t.red ? 'amber' : 'red', label: `${d >= 0 ? '+' : ''}${d.toFixed(1)}%` };
}
function handValues() {
  const op = state.operation, v = currentSimValues(), b = balance(), u = basisUnits(), out = [];
  const add = (key, label, unit, value, note = '') => out.push({ key, label, unit, value: Number.isFinite(value) ? value : undefined, note });
  if (op === 'evaporation') { const m = pfdEnvSafe(), e = energy(), me = m?.env?.multi; add('P', 'Concentrated product flow', u.flow, b?.valid ? b.P : NaN); add('R', 'Vapour (solvent evaporated)', u.flow, b?.valid ? b.R : NaN); if (!me) add('Q', 'Evaporator heat duty', 'kW', e?.total); add('T', me ? 'Last-effect boiling temperature' : 'Liquor boiling temperature', '°C', m?.env?.Top, `Includes a boiling-point rise of ${(m?.env?.bpr ?? 0).toFixed(2)} K`); add('steam', 'Steam consumption', 'kg/h', m?.env?.steam); if (me) { add('econ', 'Steam economy', 'kg/kg', me.economy); add('Q1', 'Effect 1 heat duty', 'kW', me.Q[0]); add('T1', 'Effect 1 boiling temperature', '°C', me.T[0]); } }
  else if (op === 'distillation') { const f = distillationFUG(v); add('Nmin', 'Minimum stages, Nmin', '—', f.Nmin); add('Rmin', 'Minimum reflux ratio, Rmin', '—', f.Rmin); add('R', 'Actual reflux ratio', '—', f.R); add('N', 'Theoretical stages (incl. reboiler)', '—', f.N, 'DSTWU also counts the condenser'); add('feed', 'Stages above the feed (Kirkbride)', '—', f.feed); add('D', 'Distillate flow', u.flow, b?.valid ? b.P : NaN); add('B', 'Bottoms flow', u.flow, b?.valid ? b.R : NaN); const dut = columnDuties(f); add('Qc', 'Condenser duty', 'kW', dut?.Qc, 'Ideal, constant molal overflow'); add('Qr', 'Reboiler duty', 'kW', dut?.Qr, 'Saturated-liquid feed'); add('Ttop', 'Top temperature (distillate bubble point)', '°C', dut?.Tt); }
  else if (op === 'absorption') { const a = absorptionModel(v); add('removal', 'Solute removal', '%', a.removal); add('A', 'Absorption factor, A', '—', a.A); add('stages', 'Equivalent theoretical stages (Kremser)', '—', a.stages); }
  else if (op === 'extraction') { const x = extractionModel(v); add('ext', 'Solute extracted', '%', x.extraction); add('E', 'Extraction factor, E', '—', x.E); add('Nth', 'Theoretical stages', '—', x.Nth); }
  else if (op === 'drying') { const d = dryingModel(v), ok = !d.error; add('R', 'Water evaporated', u.flow, b?.valid ? b.R : NaN); add('air', 'Dry-air flow', 'kg/h', ok ? d.Gdry : NaN, 'Adiabatic saturation line'); add('Qh', 'Air heater duty', 'kW', ok ? d.Q : NaN); add('Hex', 'Exhaust air humidity', 'kg water/kg dry air', ok ? d.H2 : NaN, `At the exhaust temperature you set (${v.exhaustTemp} °C)`); add('Tw', 'Wet-bulb temperature of the drying air', '°C', ok ? d.Tw : NaN); }
  else { const l = leachingModel(v); add('rec', 'Oil recovery (stage balance)', '%', l.recovery); add('mis', 'Miscella flow to solvent recovery', 'kg/h', NaN); add('oil', 'Oil in miscella', 'wt%', NaN); add('hex', 'Hexane recovered', 'kg/h', NaN); add('stm', 'Stripping steam or evaporator duty', 'kg/h or kW', NaN); }
  return out;
}

/* ----- Aspen stream-results parser (clipboard from the Aspen Plus stream summary) ----- */
const num = s => { const t = String(s ?? '').trim().replace(/,/g, ''); if (t === '' || !/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(t)) return NaN; return Number(t); };
function convT(v, u) { u = (u || '').toUpperCase(); if (/^K/.test(u)) return v - 273.15; if (/^F/.test(u)) return (v - 32) / 1.8; if (/^R$/.test(u)) return (v - 491.67) / 1.8; return v; }
function convP(v, u) { u = (u || '').toLowerCase().replace(/\s/g, ''); if (/^mbar/.test(u)) return v / 10; if (/^bar/.test(u)) return v * 100; if (/^mpa/.test(u)) return v * 1000; if (/^kpa/.test(u)) return v; if (/^pa/.test(u) || u === 'n/sqm') return v / 1000; if (/^atm/.test(u)) return v * 101.325; if (/^psi/.test(u)) return v * 6.894757; if (/torr|mmhg/.test(u)) return v * 0.133322; return v; }
function convMass(v, u) { u = (u || '').toLowerCase().replace(/\s/g, ''); if (/^lb/.test(u)) return v * 0.453592 * (/sec|\/s$/.test(u) ? 3600 : 1); if (/^(tonne|ton|t)\//.test(u)) return v * 1000; if (/kg\/(sec|s)$/.test(u)) return v * 3600; if (/kg\/day/.test(u)) return v / 24; return v; }
function convMole(v, u) { u = (u || '').toLowerCase().replace(/\s/g, ''); if (/^lbmol/.test(u)) return v * 0.453592; if (/^mol\/(sec|s)/.test(u)) return v * 3.6; if (/^mol\/h/.test(u)) return v / 1000; if (/^kmol\/(sec|s)/.test(u)) return v * 3600; return v; }
function parseAspenStreams(text) {
  if (!text?.trim()) return null;
  const rows = parseDelimited(text, text.includes('\t') ? '\t' : ','), head = rows.find(r => r.slice(1).some(c => String(c).trim() && Number.isNaN(num(c))));
  if (!head) return { error: 'No stream names were found. Copy the whole stream summary, including the row of stream names.' };
  const unitCol = rows.filter(r => r !== head && r.slice(2).some(c => !Number.isNaN(num(c)))).filter(r => String(r[1] || '').trim() && Number.isNaN(num(r[1]))).length > 1;
  const start = unitCol ? 2 : 1, names = head.slice(start).map(s => String(s).trim()).filter(Boolean);
  if (!names.length) return { error: 'No stream names were found.' };
  const data = Object.fromEntries(names.map(n => [n, { massFrac: {}, moleFrac: {}, compMass: {}, compMole: {} }])), comps = new Set();
  let section = '', sectionUnit = '';
  rows.forEach(r => {
    if (r === head) return;
    const label = String(r[0] || '').trim(); let unit = unitCol ? String(r[1] || '').trim() : '';
    const vals = r.slice(start, start + names.length).map(num);
    if (!label) return;
    if (vals.every(Number.isNaN)) { section = label.toLowerCase(); sectionUnit = unit; return; }
    if (!unit) { const m = label.match(/\s([A-Za-z/°]+(?:\/[A-Za-z]+)?)$/); if (m && /^(C|K|F|bar|kPa|atm|psia|psi|Pa|MPa|kg\/hr|kg\/h|kmol\/hr|kmol\/h|lb\/hr|lbmol\/hr|mbar)$/i.test(m[1])) unit = m[1]; }
    const L = label.toLowerCase();
    if (/^(mole|mass) flows?$/.test(L) || /^(mole|mass) flows? /.test(L)) { section = L; sectionUnit = unit; }
    names.forEach((n, i) => {
      const v = vals[i]; if (Number.isNaN(v)) return; const d = data[n];
      if (/^temp/.test(L)) d.T = convT(v, unit || 'C');
      else if (/^pres/.test(L)) d.P = convP(v, unit || 'bar');
      else if (/vapou?r frac/.test(L)) d.vf = v;
      else if (/^mass frac/.test(L) && L.split(/\s+/).length > 2) { const c = label.split(/\s+/).slice(2).join(' '); d.massFrac[c] = v; comps.add(c); }
      else if (/^mole frac/.test(L) && L.split(/\s+/).length > 2) { const c = label.split(/\s+/).slice(2).join(' '); d.moleFrac[c] = v; comps.add(c); }
      else if (/mass frac/.test(section)) { d.massFrac[label] = v; comps.add(label); }
      else if (/mole frac/.test(section)) { d.moleFrac[label] = v; comps.add(label); }
      else if (/^(total )?mass flow|^mass flow/.test(L) || (/total flow/.test(L) && /mass/.test(section)) || (/total flow/.test(L) && /kg|lb\//i.test(unit) && !/mol/i.test(unit))) d.mass = convMass(v, unit || sectionUnit || 'kg/hr');
      else if (/^(total )?mole flow/.test(L) || (/total flow/.test(L) && /mol/i.test(unit || sectionUnit))) d.mole = convMole(v, unit || sectionUnit || 'kmol/hr');
      else if (/mass flow/.test(section)) { d.compMass[label] = convMass(v, sectionUnit || 'kg/hr'); comps.add(label); }
      else if (/mole flow/.test(section)) { d.compMole[label] = convMole(v, sectionUnit || 'kmol/hr'); comps.add(label); }
    });
  });
  names.forEach(n => { const d = data[n]; const sm = Object.values(d.compMass).reduce((s, x) => s + x, 0), sn = Object.values(d.compMole).reduce((s, x) => s + x, 0);
    if (d.mass === undefined && sm > 0) d.mass = sm; if (d.mole === undefined && sn > 0) d.mole = sn;
    Object.entries(d.compMass).forEach(([c, x]) => { if (d.massFrac[c] === undefined && sm > 0) d.massFrac[c] = x / sm; });
    Object.entries(d.compMole).forEach(([c, x]) => { if (d.moleFrac[c] === undefined && sn > 0) d.moleFrac[c] = x / sn; }); });
  return { names, data, comps: [...comps] };
}

/* ----- Issues, rendering, binding ----- */
function crossCheckIssues() {
  const c = ccState(), g = ASPEN_GUIDE[state.operation], out = [];
  if (c.na && g.optional) { if ((c.naWhy || '').trim().length < 40) out.push('Describe the independent check you used instead of Aspen (at least a few sentences).'); return out; }
  if (!c.method) out.push('Record the Aspen property method.');
  if ((c.methodWhy || '').trim().length < 20) out.push('Justify the property method choice.');
  if (!(c.blocks || '').trim()) out.push('Record the Aspen blocks you used.');
  if (!c.convergence) out.push('Record whether the Aspen simulation converged.');
  if (c.convergence === 'Not converged') out.push('Get the Aspen simulation to converge before comparing results.');
  const rows = [...handValues().map(h => ({ ...h, ...(c.rows[h.key] || {}), hand: h.value ?? c.rows[h.key]?.hand })), ...c.custom];
  const compared = rows.filter(r => diffStatus(r.hand, r.aspen).d !== undefined);
  if (compared.length < 3) out.push(`Compare at least three key results with Aspen (${compared.length} so far).`);
  const unexplained = compared.filter(r => ['amber', 'red'].includes(diffStatus(r.hand, r.aspen).cls) && (!r.reason || (r.note || '').trim().length < 10));
  if (unexplained.length) out.push(`Explain every amber or red difference: choose a reason and add a short note (${unexplained.length} missing).`);
  if ((c.reflection || '').trim().length < 40) out.push('Write what the Aspen comparison taught you about your hand design.');
  return out;
}
function guessAspenComp(parsed, c, mole) {
  const byName = parsed.comps.find(x => norm(state.targetComponent).split(' ').some(w => w.length > 3 && norm(x).includes(w)));
  if (byName) return byName;
  const feed = parsed.data[c.paste.map[Object.keys(c.paste.map).find(k => k.startsWith('f_') || k.startsWith('g_'))] || parsed.names[0]];
  const z = Number(state.z), frac = x => (mole ? feed?.moleFrac[x] : feed?.massFrac[x]);
  return parsed.comps.filter(x => Number.isFinite(frac(x))).sort((a, b) => Math.abs(frac(a) - z) - Math.abs(frac(b) - z))[0] || parsed.comps[0] || '';
}
function renderStreamCompare(c) {
  const parsed = parseAspenStreams(c.paste.raw);
  if (!parsed) return '';
  if (parsed.error) return `<div class="error-item">${esc(parsed.error)}</div>`;
  const rows = pfdStreamRows(), mole = basis() === 'mole', comp = c.paste.comp || guessAspenComp(parsed, c, mole);
  const opts = sel => `<option value="">—</option>` + parsed.names.map(n => `<option ${n === sel ? 'selected' : ''}>${esc(n)}</option>`).join('');
  const cell = (hand, aspen, d = 1) => { const st = diffStatus(hand, aspen); return `<td class="num">${String(hand).trim() === '' ? '—' : esc(hand)}</td><td class="num">${Number.isFinite(aspen) ? aspen.toFixed(d) : '—'}</td><td><span class="agree ${st.cls}">${st.d !== undefined ? st.label : ''}</span></td>`; };
  const body = rows.map(r => { const a = c.paste.map[r.s.id] ? parsed.data[c.paste.map[r.s.id]] : null; const fr = a ? (mole ? a.moleFrac[comp] : a.massFrac[comp]) : undefined;
    return `<tr><td><span class="stream-no ${r.s.cls}">${r.s.no}</span></td><td>${esc(r.s.desc)}</td><td><select class="imp-input" data-asp-map="${r.s.id}" aria-label="Aspen stream for stream ${r.s.no}">${opts(c.paste.map[r.s.id])}</select></td>${a ? cell(r.cells.T.v, a.T) + cell(r.cells.P.v, a.P) + cell(r.cells.m.v, mole ? a.mole : a.mass, mole ? 3 : 1) + cell(r.cells.w.v, Number.isFinite(fr) ? fr * 100 : NaN, 2) : '<td colspan="12" class="muted">Choose the matching Aspen stream</td>'}</tr>`; }).join('');
  return `<div class="import-summary"><strong>${parsed.names.length} Aspen streams read</strong><span>${esc(parsed.names.join(', '))}. Key component in Aspen: <select id="aspComp">${parsed.comps.map(x => `<option ${x === comp ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></span></div><div class="data-table-wrap"><table class="data-table stream-compare"><thead><tr><th rowspan="2">NO.</th><th rowspan="2">STREAM</th><th rowspan="2">ASPEN STREAM</th><th colspan="3">T (°C)</th><th colspan="3">P (kPa abs)</th><th colspan="3">FLOW (${basisUnits().flow})</th><th colspan="3">KEY (${basisUnits().pct})</th></tr><tr>${'<th>SPECTRA</th><th>ASPEN</th><th>DIFF</th>'.repeat(4)}</tr></thead><tbody>${body}</tbody></table></div>`;
}
function renderCrossCheck() {
  const c = ccState(), g = ASPEN_GUIDE[state.operation], t = ccThresholds(), issues = crossCheckIssues();
  const naBox = g.optional ? `<label class="check-row"><input type="checkbox" id="ccNa" ${c.na ? 'checked' : ''}><span><strong>Aspen is not a good tool for this operation.</strong> Use an independent check instead (for example a spreadsheet stage balance or psychrometric calculation) and describe it.</span></label>${c.na ? `<div class="field full"><label for="ccNaWhy">Independent check and what it showed</label><textarea id="ccNaWhy" data-cc="naWhy" rows="4">${esc(c.naWhy || '')}</textarea></div>` : ''}` : '';
  if (c.na && g.optional) return `<section class="task-card aspen-card"><div class="task-head"><div class="task-number">10b</div><div><h2>Independent cross-check</h2><p>${esc(g.blocks)}</p></div></div>${naBox}${renderCcIssues(issues)}</section>`;
  const reasons = sel => `<option value="">Choose a reason…</option>` + DIFF_REASONS.map(r => `<option ${r === sel ? 'selected' : ''}>${esc(r)}</option>`).join('');
  const keyRows = handValues().map(h => { const r = c.rows[h.key] || {}, hand = h.value !== undefined ? h.value : r.hand, st = diffStatus(hand, r.aspen), needs = ['amber', 'red'].includes(st.cls);
    return `<tr class="${st.cls}"><td><strong>${esc(h.label)}</strong>${h.note ? `<small>${esc(h.note)}</small>` : ''}</td><td>${esc(h.unit)}</td><td class="num">${h.value !== undefined ? `<strong>${Number(h.value).toPrecision(4)}</strong>` : `<input class="imp-input narrow" data-ccrow="${h.key}" data-ck="hand" value="${esc(r.hand ?? '')}" placeholder="your value" aria-label="Hand value for ${esc(h.label)}">`}</td><td><input class="imp-input narrow" data-ccrow="${h.key}" data-ck="aspen" value="${esc(r.aspen ?? '')}" placeholder="Aspen" aria-label="Aspen value for ${esc(h.label)}"></td><td><span class="agree ${st.cls}">${st.label}</span></td><td>${needs || r.reason ? `<select class="imp-input" data-ccrow="${h.key}" data-ck="reason">${reasons(r.reason)}</select><input class="imp-input wide" data-ccrow="${h.key}" data-ck="note" value="${esc(r.note || '')}" placeholder="Explain the difference">` : ''}</td></tr>`; }).join('');
  const customRows = c.custom.map((r, i) => { const st = diffStatus(r.hand, r.aspen), needs = ['amber', 'red'].includes(st.cls);
    return `<tr class="${st.cls}"><td><input class="imp-input wide" data-ccc="${i}" data-ck="label" value="${esc(r.label || '')}" placeholder="Quantity"></td><td><input class="imp-input narrow" data-ccc="${i}" data-ck="unit" value="${esc(r.unit || '')}" placeholder="unit"></td><td><input class="imp-input narrow" data-ccc="${i}" data-ck="hand" value="${esc(r.hand ?? '')}" placeholder="your value"></td><td><input class="imp-input narrow" data-ccc="${i}" data-ck="aspen" value="${esc(r.aspen ?? '')}" placeholder="Aspen"></td><td><span class="agree ${st.cls}">${st.label}</span></td><td>${needs || r.reason ? `<select class="imp-input" data-ccc="${i}" data-ck="reason">${reasons(r.reason)}</select><input class="imp-input wide" data-ccc="${i}" data-ck="note" value="${esc(r.note || '')}" placeholder="Explain the difference">` : ''}<button class="mini-btn danger" data-ccc-del="${i}">Remove</button></td></tr>`; }).join('');
  return `<section class="task-card aspen-card"><div class="task-head"><div class="task-number">10b</div><div><h2>Aspen Plus cross-check</h2><p>Predict by hand, simulate the same case in Aspen Plus, then explain every difference. A simulator is only as good as its set-up.</p></div></div>${naBox}
  <div class="aspen-steps"><div class="aspen-step"><span class="step-no">1</span><div><strong>Set up the same case in Aspen</strong><p><b>Suggested blocks:</b> ${esc(g.blocks)}</p><p><b>Property method:</b> ${esc(g.method)}</p></div></div></div>
  <div class="field-grid"><div class="field"><label for="ccVersion">Aspen Plus version</label><input id="ccVersion" data-cc="version" value="${esc(c.version || '')}" placeholder="e.g. V14"></div><div class="field"><label for="ccComponents">Components used</label><input id="ccComponents" data-cc="components" value="${esc(c.components || '')}" placeholder="e.g. WATER, SUCROSE"></div><div class="field"><label for="ccMethod">Property method</label><select id="ccMethod" data-cc="method"><option value="">Choose…</option>${PROPERTY_METHODS.map(m => `<option ${m === c.method ? 'selected' : ''}>${m}</option>`).join('')}</select></div><div class="field"><label for="ccConv">Convergence</label><select id="ccConv" data-cc="convergence"><option value="">Choose…</option>${['Converged without warnings', 'Converged with warnings', 'Not converged'].map(m => `<option ${m === c.convergence ? 'selected' : ''}>${m}</option>`).join('')}</select></div><div class="field full"><label for="ccWhy">Why this property method?</label><textarea id="ccWhy" data-cc="methodWhy" rows="2" placeholder="Refer to the components, phases, pressure and any non-ideality or electrolytes.">${esc(c.methodWhy || '')}</textarea></div><div class="field full"><label for="ccBlocks">Aspen blocks and key specifications</label><input id="ccBlocks" data-cc="blocks" value="${esc(c.blocks || '')}" placeholder="e.g. Flash2 at 38.5 kPa, duty specified; Heater for feed"></div></div>
  <div class="aspen-steps"><div class="aspen-step"><span class="step-no">2</span><div><strong>Compare the key results</strong><p>Hand values in bold come from your SPECTRA calculations and models. Agreement: green within ${t.amber}%, amber up to ${t.red}%, red beyond. Every amber or red result needs a reason.</p></div></div></div>
  <div class="data-table-wrap"><table class="data-table cc-table"><thead><tr><th>QUANTITY</th><th>UNIT</th><th>SPECTRA / HAND</th><th>ASPEN</th><th>DIFFERENCE</th><th>EXPLANATION</th></tr></thead><tbody>${keyRows}${customRows}</tbody></table></div><button class="ghost" id="ccAddRow">+ Add another quantity</button>
  <div class="aspen-steps"><div class="aspen-step"><span class="step-no">3</span><div><strong>Paste the Aspen stream results (optional, recommended)</strong><p>In Aspen Plus, open the stream summary, select the whole table and copy it. Paste it here, then match each Aspen stream to the SPECTRA stream number.</p></div></div></div>
  <textarea id="aspPaste" class="asp-paste" rows="4" placeholder="Paste the Aspen stream summary here">${esc(c.paste.raw || '')}</textarea><div class="import-buttons"><button class="ghost" id="aspRead">Read Aspen streams</button>${c.paste.raw ? '<button class="ghost" id="aspClear">Clear</button>' : ''}</div>${renderStreamCompare(c)}
  <div class="aspen-steps"><div class="aspen-step"><span class="step-no">4</span><div><strong>Reflect</strong><p>Which assumption in your hand design mattered most? What will you change, and which result do you trust more, and why?</p></div></div></div>
  <div class="field full"><textarea id="ccReflection" data-cc="reflection" rows="4" aria-label="Reflection on the Aspen comparison">${esc(c.reflection || '')}</textarea></div>${renderCcIssues(issues)}</section>`;
}
function renderCcIssues(issues) { return `<div class="source-alerts">${issues.length ? issues.map(t => `<div class="source-alert">${esc(t)}</div>`).join('') : '<div class="source-alert good">✓ Cross-check complete: set-up recorded, results compared and differences explained.</div>'}</div>`; }
function bindCrossCheck() {
  if (!document.querySelector('.aspen-card')) return;
  const c = ccState(), rerender = () => { save(); const y = window.scrollY; render(); window.scrollTo(0, y); };
  document.querySelectorAll('[data-cc]').forEach(el => el.onchange = () => { c[el.dataset.cc] = el.value; rerender(); });
  document.querySelectorAll('[data-ccrow]').forEach(el => el.onchange = () => { c.rows[el.dataset.ccrow] ||= {}; c.rows[el.dataset.ccrow][el.dataset.ck] = el.value.trim(); rerender(); });
  document.querySelectorAll('[data-ccc]').forEach(el => el.onchange = () => { c.custom[Number(el.dataset.ccc)][el.dataset.ck] = el.value.trim(); rerender(); });
  document.querySelectorAll('[data-ccc-del]').forEach(el => el.onclick = () => { c.custom.splice(Number(el.dataset.cccDel), 1); rerender(); });
  const add = document.getElementById('ccAddRow'); if (add) add.onclick = () => { c.custom.push({ label: '', unit: '', hand: '', aspen: '' }); rerender(); };
  const na = document.getElementById('ccNa'); if (na) na.onchange = () => { c.na = na.checked; rerender(); };
  const read = document.getElementById('aspRead'); if (read) read.onclick = () => { c.paste.raw = document.getElementById('aspPaste').value.slice(0, 200000); c.paste.map = {}; autoMapAspen(c); rerender(); };
  const clear = document.getElementById('aspClear'); if (clear) clear.onclick = () => { c.paste = { raw: '', map: {}, comp: '' }; rerender(); };
  document.querySelectorAll('[data-asp-map]').forEach(el => el.onchange = () => { c.paste.map[el.dataset.aspMap] = el.value; rerender(); });
  const comp = document.getElementById('aspComp'); if (comp) comp.onchange = () => { c.paste.comp = comp.value; rerender(); };
}
function autoMapAspen(c) {
  const parsed = parseAspenStreams(c.paste.raw); if (!parsed?.names) return;
  const rows = pfdStreamRows();
  rows.forEach(r => { const hit = parsed.names.find(n => n === String(r.s.no) || n.toUpperCase() === `S${r.s.no}` || n.replace(/\D/g, '') === String(r.s.no) && n.replace(/\d/g, '').length <= 2); if (hit) c.paste.map[r.s.id] = hit; });
}
function renderCrossCheckPortfolio() {
  const c = ccState(), g = ASPEN_GUIDE[state.operation];
  if (c.na && g.optional) return `<p><strong>Independent check (Aspen not used):</strong> ${esc(c.naWhy || 'Not recorded')}</p>`;
  const rows = [...handValues().map(h => ({ label: h.label, unit: h.unit, hand: h.value !== undefined ? Number(h.value).toPrecision(4) : c.rows[h.key]?.hand, ...(c.rows[h.key] || {}) , handShown: h.value !== undefined ? Number(h.value).toPrecision(4) : c.rows[h.key]?.hand })), ...c.custom.map(r => ({ ...r, handShown: r.hand }))];
  return `<p>Aspen Plus ${esc(c.version || '')} · ${esc(c.method || 'method not recorded')} · ${esc(c.convergence || 'convergence not recorded')}</p><p><strong>Why:</strong> ${esc(c.methodWhy || '—')}</p><p><strong>Blocks:</strong> ${esc(c.blocks || '—')}</p><div class="data-table-wrap"><table class="data-table"><thead><tr><th>QUANTITY</th><th>SPECTRA</th><th>ASPEN</th><th>DIFF</th><th>EXPLANATION</th></tr></thead><tbody>${rows.filter(r => String(r.aspen ?? '').trim()).map(r => { const st = diffStatus(r.handShown, r.aspen); return `<tr><td>${esc(r.label)} (${esc(r.unit)})</td><td>${esc(r.handShown ?? '—')}</td><td>${esc(r.aspen)}</td><td>${st.d !== undefined ? st.label : '—'}</td><td>${esc([r.reason, r.note].filter(Boolean).join(': ') || '—')}</td></tr>`; }).join('') || '<tr><td colspan="5">No results compared.</td></tr>'}</tbody></table></div><p><strong>Reflection:</strong> ${esc(c.reflection || '—')}</p>`;
}
