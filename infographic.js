/* SPECTRA one-page infographic: the design specification sheet required by the brief.
   Built from the project's own numbers; printed on one A4 page. Loaded before app.js. */

function infoNumbers() {
  const r = state.sizing?.result, sim = state.simulation, econ = state.economics?.result, mech = mechCalc(), u = basisUnits(), b = balance();
  const tiles = [];
  if (r) tiles.push({ label: r.label, value: Number(r.value * state.sensitivity / 100), unit: r.unit, note: `includes ${state.sensitivity - 100}% design allowance` });
  const pri = [/steam consumption/i, /steam economy/i, /required stages/i, /operating reflux/i, /predicted (removal|extraction|recovery)/i, /absorption factor|extraction factor/i, /theoretical stages/i, /total heat-transfer area/i];
  const outs = (sim?.outputs || []).filter(o => Number.isFinite(Number(o[1])));
  pri.map(re => outs.find(o => re.test(o[0]))).filter(Boolean).slice(0, 2).forEach(o => tiles.push({ label: o[0], value: Number(o[1]), unit: o[2] }));
  if (econ) tiles.push({ label: 'Installed capital', value: econ.capex, unit: 'RM', money: true, note: Number.isFinite(econ.payback) ? `payback ${econ.payback.toFixed(1)} years` : 'no payback' });
  return { tiles: tiles.slice(0, 4), r, sim, econ, mech, u, b };
}
function fmtNum(v, unit) { if (!Number.isFinite(v)) return '—'; const a = Math.abs(v); const s = a >= 1e6 ? (v / 1e6).toFixed(2) + ' M' : a >= 1000 ? Math.round(v).toLocaleString('en-MY') : a >= 10 ? v.toFixed(1) : v.toFixed(2); return unit === 'RM' ? `RM ${s}` : s; }
function aspenSummary() {
  const c = ccState(); if (c.na) return null;
  const rows = [...handValues().map(h => ({ hand: h.value ?? c.rows[h.key]?.hand, aspen: c.rows[h.key]?.aspen })), ...c.custom];
  const st = rows.map(r => diffStatus(r.hand, r.aspen).cls).filter(x => x !== 'none');
  return { n: st.length, green: st.filter(x => x === 'green').length, amber: st.filter(x => x === 'amber').length, red: st.filter(x => x === 'red').length, method: c.method };
}
function renderInfographic() {
  const n = infoNumbers(), op = operations[state.operation], eq = selectedEquipment(), g = state.group || {}, members = (g.members || []).filter(m => m.name), asp = aspenSummary();
  const hz = (state.hazop || []), worst = hz.map(h => ({ ...h, risk: riskOf(h) })).sort((a, b) => b.risk.r - a.risk.r)[0];
  const m = n.mech, pfd = state.diagram.type === 'PFD' ? renderPFD(false) : renderPFD(false);
  const row = (k, v) => `<div class="ig-row"><span>${k}</span><strong>${v}</strong></div>`;
  const cond = [];
  const env = pfdEnvSafe()?.env;
  if (state.operation === 'evaporation' && env) { cond.push(row('Boiling temperature', `${env.Top.toFixed(1)} °C`), row('Pressure', `${env.Pev.toFixed(1)} kPa abs`), row('Steam', `${fmtNum(env.steam)} kg/h at ${env.Ts.toFixed(0)} °C`)); if (env.multi) cond.push(row('Effects', `${env.multi.N} · economy ${env.multi.economy.toFixed(2)}`)); }
  if (state.operation === 'distillation') { const f = distillationFUG(currentSimValues()); if (!f.error) cond.push(row('Reflux ratio', `${f.R.toFixed(2)} (R/Rmin ${currentSimValues().refluxFactor})`), row('Theoretical stages', `${Math.ceil(f.N)} · feed at ${Math.round(f.feed || 0)}`), row('Relative volatility', `${currentSimValues().relativeVolatility}`)); }
  if (!cond.length) (n.sim?.outputs || []).slice(0, 3).forEach(o => cond.push(row(o[0], `${fmtNum(Number(o[1]))} ${o[2]}`)));
  return `<div class="ig-page" id="infographicPage">
  <header class="ig-head"><div class="ig-kicker">Design specification · ${esc(op.name)}</div><h1>${esc(state.projectTitle || 'Untitled design')}</h1><div class="ig-meta"><span>${esc(g.name || 'Group')}${members.length ? ': ' + members.map(x => esc(x.name)).join(', ') : ''}</span><span>${new Date().toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div></header>
  <section class="ig-tiles">${n.tiles.map(t => `<div class="ig-tile"><span>${esc(t.label)}</span><strong>${fmtNum(t.value, t.money ? 'RM' : '')}${t.money ? '' : ` <small>${esc(t.unit)}</small>`}</strong>${t.note ? `<em>${esc(t.note)}</em>` : ''}</div>`).join('') || '<div class="ig-tile"><span>Complete sizing, simulation and economics to fill these figures.</span></div>'}</section>
  <section class="ig-body"><div class="ig-col">
    <div class="ig-block"><h2>The unit</h2>${row('Equipment', `${esc(state.diagram.unitTag)} · ${esc(eq.label)}`)}${row('Mode', `${esc(state.mode)} · ${esc(state.configuration)}`)}${m.error ? '' : row('Vessel', `Di ${Math.round(m.Di).toLocaleString('en-MY')} mm × T–T ${Math.round(m.L * 1000).toLocaleString('en-MY')} mm`) + row('Construction', `${esc(MATERIALS[mechState().mat].name.replace(/ \(.*\)/, ''))}, ${m.t} mm`)}</div>
    <div class="ig-block"><h2>Feed and product</h2>${row('Throughput', `${fmtNum(Number(state.throughput))} ${esc(state.flowUnit)}`)}${row(`${esc(state.targetComponent || 'Key component')}`, `${(state.z * 100).toFixed(1)} → ${(state.x * 100).toFixed(1)} ${n.u.pct}`)}${n.b?.valid ? row('Product / separated', `${fmtNum(n.b.P)} / ${fmtNum(n.b.R)} ${n.u.flow}`) : ''}</div>
    <div class="ig-block"><h2>Operating point</h2>${cond.join('') || '<p class="ig-empty">Run the simulator to fill this.</p>'}</div>
  </div><div class="ig-col ig-pfd"><h2>Process flow diagram</h2>${pfd}</div></section>
  <section class="ig-foot"><div class="ig-block"><h2>Checked against Aspen Plus</h2>${asp && asp.n ? `<div class="ig-dots"><span class="g">${asp.green} within tolerance</span><span class="a">${asp.amber} explained</span><span class="r">${asp.red} large difference</span></div><p>${esc(asp.method || '')} property method</p>` : '<p class="ig-empty">Cross-check not completed.</p>'}</div>
  <div class="ig-block"><h2>Safety</h2>${hz.length ? `<p><strong>${hz.length}</strong> HAZOP deviations reviewed.${worst ? ` Highest risk: ${esc(worst.dev.toLowerCase())} at ${esc(worst.node)} (${worst.risk.label.toLowerCase()}).` : ''}</p>` : '<p class="ig-empty">HAZOP not completed.</p>'}</div>
  <div class="ig-block"><h2>Economics</h2>${n.econ ? `<p>Operating cost ${fmtNum(n.econ.opex, 'RM')}/y · ROI ${n.econ.roi.toFixed(1)}% · NPV ${fmtNum(n.econ.npv, 'RM')}</p>` : '<p class="ig-empty">Economics not calculated.</p>'}</div></section>
  ${state.decision ? `<section class="ig-rec"><h2>Recommendation</h2><p>${esc(state.decision.length > 420 ? state.decision.slice(0, 417) + '…' : state.decision)}</p></section>` : ''}
  <div class="ig-brand">SPECTRA Design Studio · ECH3127 Physical Separation Process</div></div>`;
}
function openInfographic() {
  document.getElementById('infographicContent').innerHTML = renderInfographic();
  document.getElementById('infographicDialog').showModal();
}
function printInfographic() { document.body.classList.add('print-info'); const done = () => { document.body.classList.remove('print-info'); window.removeEventListener('afterprint', done); }; window.addEventListener('afterprint', done); window.print(); setTimeout(done, 3000); }
