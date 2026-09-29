/* SPECTRA preliminary mechanical design
   Pressure-vessel shell and head thickness (ASME VIII Div. 1 forms as given in Sinnott & Towler),
   minimum practical thickness, full-vacuum buckling check, vessel mass and a dimensioned sketch.
   Loaded before app.js; uses its globals at call time. */

const MATERIALS = {
  ss304: { name: 'Stainless steel 304 (SA-240)', S: [[100, 138], [200, 129], [300, 115]], rho: 8000, E: 193e3, ca: 1, note: 'Hygienic; usual for food service' },
  ss316: { name: 'Stainless steel 316 (SA-240)', S: [[100, 138], [200, 132], [300, 121]], rho: 8000, E: 193e3, ca: 1, note: 'Better chloride and acid resistance' },
  cs516: { name: 'Carbon steel SA-516 Gr 70', S: [[340, 138]], rho: 7850, E: 200e3, ca: 2, note: 'Economical for non-corrosive, non-food service' },
  cs285: { name: 'Carbon steel SA-285 Gr C', S: [[340, 108]], rho: 7850, E: 200e3, ca: 2, note: 'Low-strength plate for low-pressure vessels' }
};
const PLATES = [5, 6, 8, 10, 12, 14, 16, 18, 20, 22, 25, 28, 30, 32, 36, 40, 45, 50];
function allowable(mat, T) { const pts = MATERIALS[mat].S; if (T <= pts[0][0] || pts.length === 1) return pts[0][1]; for (let i = 1; i < pts.length; i++) if (T <= pts[i][0]) { const [t0, s0] = pts[i - 1], [t1, s1] = pts[i]; return s0 + (s1 - s0) * (T - t0) / (t1 - t0); } return pts[pts.length - 1][1]; }
function minPractical(Dm) { return Dm <= 1 ? 5 : Dm <= 2 ? 7 : Dm <= 2.5 ? 9 : Dm <= 3 ? 10 : 12; }   // mm, including corrosion allowance (Sinnott & Towler)
function mechDefaults() {
  const op = state.operation, m = pfdEnvSafe(), r = state.sizing?.result;
  const Pop = op === 'evaporation' ? m?.env?.Pev : op === 'distillation' ? Number(state.columnP) || 101.325 : 101.325;
  const Top = op === 'evaporation' ? m?.env?.Top : op === 'distillation' ? (columnDuties(distillationFUG(currentSimValues()))?.Tb ?? 100) : 60;
  const D = op === 'distillation' && r?.unit === 'm' ? Number((r.value * state.sensitivity / 100).toFixed(2)) : '';
  return { Pop: Number.isFinite(Pop) ? Number(Pop.toFixed(1)) : 101.3, T: Number.isFinite(Top) ? Math.round(Top + 50) : 110, D };
}
function mechState() { state.mech ||= {}; const d = mechDefaults(), s = state.mech; return { D: s.D ?? d.D, L: s.L ?? '', Pop: s.Pop ?? d.Pop, T: s.T ?? d.T, mat: s.mat ?? (['evaporation', 'drying'].includes(state.operation) ? 'ss304' : 'cs516'), E: s.E ?? 0.85, ca: s.ca ?? '', head: s.head ?? 'ellipsoidal', sf: s.sf ?? 3 }; }
function mechCalc(s = mechState()) {
  const D = Number(s.D), L = Number(s.L), mat = MATERIALS[s.mat]; if (!(D > 0) || !(L > 0)) return { error: 'Enter the vessel inside diameter and tangent-to-tangent length.' };
  const Pg = Number(s.Pop) - 101.325, vacuum = Number(s.Pop) < 101.3;
  const Pd = Math.max(1.1 * Math.max(Pg, 0), 100) / 1000;              // MPa gauge: 10% over operating, at least 1 barg
  const S = allowable(s.mat, Number(s.T)), E = Number(s.E), Di = D * 1000, ca = s.ca === '' ? mat.ca : Number(s.ca);
  const tShell = Pd * Di / (2 * S * E - 1.2 * Pd);
  const tHead = s.head === 'hemispherical' ? Pd * Di / (4 * S * E - 0.4 * Pd) : s.head === 'torispherical' ? 0.885 * Pd * Di / (S * E - 0.1 * Pd) : Pd * Di / (2 * S * E - 0.2 * Pd);
  const tMin = minPractical(D);
  let tVac = 0, vac = null;
  if (vacuum) { const Pext = 0.101325, need = Number(s.sf) * Pext; tVac = (Di + 20) * Math.cbrt(need / (2.2 * mat.E)); }
  const req = Math.max(tShell + ca, tHead + ca, tMin, tVac + ca), t = PLATES.find(p => p >= req) || Math.ceil(req);
  if (vacuum) { const Do = Di + 2 * t, tc = t - ca, Pc = 2.2 * mat.E * Math.pow(tc / Do, 3); vac = { Pc, ok: Pc >= Number(s.sf) * 0.101325, tVac }; }
  const Do = (Di + 2 * t) / 1000, tm = t / 1000, shell = Math.PI * (D + tm) * L * tm * mat.rho, heads = 2 * 1.09 * Do * Do * tm * mat.rho * (s.head === 'hemispherical' ? 1.45 : 1);
  return { Pd, S, E, ca, tShell, tHead, tMin, tVac, req, t, vacuum, vac, shell, heads, total: (shell + heads) * 1.15, Di, L, D };
}
function mechIssues() { const r = mechCalc(); if (r.error) return ['Complete the preliminary mechanical design (vessel diameter and length).']; if (r.vac && !r.vac.ok) return ['The vessel buckles under full vacuum: thicken the shell or add stiffening rings.']; return []; }
function vesselSVG(r, s = mechState()) {
  if (r.error) return '';
  const W = 520, H = 560, maxBody = 330, scale = Math.min(200 / r.D, maxBody / r.L), bw = r.D * scale, bh = r.L * scale, hh = bw / 4, cx = 190, top = 80 + hh, bot = top + bh;
  const f = n => Math.round(n).toLocaleString('en-MY'), mat = MATERIALS[s.mat].name, headName = { ellipsoidal: '2:1 ellipsoidal', torispherical: 'Torispherical', hemispherical: 'Hemispherical' }[s.head];
  const headH = s.head === 'hemispherical' ? bw / 2 : s.head === 'torispherical' ? bw * 0.19 : hh;
  return `<svg class="vessel-svg" id="vesselSvg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Dimensioned vessel sketch"><style>.v{fill:#eef4ff;stroke:#10264f;stroke-width:2}.d{stroke:#0756c9;stroke-width:1.2;fill:none}.t{font:600 12px Arial,sans-serif;fill:#10264f}.s{font:500 11px Arial,sans-serif;fill:#41567a}.n{fill:#fff;stroke:#10264f;stroke-width:1.6}.tb{fill:#fff;stroke:#10264f;stroke-width:1.2}</style><defs><marker id="va" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto-start-reverse"><path d="M0 0 L8 4 L0 8 Z" fill="#0756c9"/></marker></defs>
<path d="M ${cx - bw / 2} ${top} A ${bw / 2} ${headH} 0 0 1 ${cx + bw / 2} ${top} L ${cx + bw / 2} ${bot} A ${bw / 2} ${headH} 0 0 1 ${cx - bw / 2} ${bot} Z" class="v"/>
<line x1="${cx - bw / 2}" y1="${top}" x2="${cx + bw / 2}" y2="${top}" stroke="#10264f" stroke-dasharray="4 3"/><line x1="${cx - bw / 2}" y1="${bot}" x2="${cx + bw / 2}" y2="${bot}" stroke="#10264f" stroke-dasharray="4 3"/>
<rect x="${cx - 7}" y="${top - headH - 22}" width="14" height="22" class="n"/><text x="${cx + 12}" y="${top - headH - 10}" class="s">N1 top outlet</text>
<rect x="${cx - bw / 2 - 22}" y="${top + bh * 0.45}" width="22" height="14" class="n"/><text x="${cx - bw / 2 - 26}" y="${top + bh * 0.45 - 6}" class="s" text-anchor="end">N2 feed</text>
<rect x="${cx - 7}" y="${bot + headH}" width="14" height="22" class="n"/><text x="${cx + 12}" y="${bot + headH + 16}" class="s">N3 bottom outlet</text>
<line x1="${cx - bw / 2}" y1="${bot + headH + 44}" x2="${cx + bw / 2}" y2="${bot + headH + 44}" class="d" marker-start="url(#va)" marker-end="url(#va)"/><text x="${cx}" y="${bot + headH + 60}" class="t" text-anchor="middle">Di = ${f(r.Di)} mm</text>
<line x1="${cx + bw / 2 + 34}" y1="${top}" x2="${cx + bw / 2 + 34}" y2="${bot}" class="d" marker-start="url(#va)" marker-end="url(#va)"/><text x="${cx + bw / 2 + 42}" y="${(top + bot) / 2}" class="t">T–T = ${f(r.L * 1000)} mm</text>
<text x="${cx + bw / 2 + 42}" y="${(top + bot) / 2 + 18}" class="s">shell ${r.t} mm</text>
<rect x="300" y="410" width="212" height="136" class="tb"/><text x="310" y="430" class="t">${esc(state.diagram.unitTag)} · ${esc(selectedEquipment().label.split(' ')[0])}</text><text x="310" y="450" class="s">Material: ${esc(mat.replace(/ \(.*\)/, ''))}</text><text x="310" y="467" class="s">Shell and heads: ${r.t} mm</text><text x="310" y="484" class="s">Heads: ${headName}</text><text x="310" y="501" class="s">Design: ${(r.Pd * 10).toFixed(1)} barg${r.vacuum ? ' / full vacuum' : ''}, ${esc(s.T)} °C</text><text x="310" y="518" class="s">Mass ≈ ${f(r.total)} kg (empty)</text><text x="310" y="536" class="s">${esc(state.group?.name || '')} · not to scale</text>
</svg>`;
}
function renderMechanical() {
  const s = mechState(), r = mechCalc(s), mat = MATERIALS[s.mat], num = (id, label, v, help = '') => `<div class="field"><label for="mech_${id}">${label}</label><input id="mech_${id}" data-mech="${id}" type="number" step="any" value="${esc(v)}">${help ? `<span class="help">${help}</span>` : ''}</div>`;
  const res = r.error ? `<p class="empty-note">${esc(r.error)}</p>` : `<div class="results-grid"><div class="result"><span>Shell (pressure)</span><strong>${r.tShell.toFixed(2)} mm</strong></div><div class="result"><span>Head (pressure)</span><strong>${r.tHead.toFixed(2)} mm</strong></div><div class="result"><span>Minimum practical (incl. corrosion)</span><strong>${r.tMin} mm</strong></div>${r.vacuum ? `<div class="result"><span>Needed for full vacuum</span><strong>${r.tVac.toFixed(1)} mm</strong></div>` : ''}<div class="result standout"><span>Specified plate (incl. ${r.ca} mm corrosion)</span><strong>${r.t} mm</strong></div><div class="result"><span>Vessel mass (empty, +15% nozzles and supports)</span><strong>${Math.round(r.total).toLocaleString('en-MY')} kg</strong></div></div>${r.vac ? `<div class="diagnostic ${r.vac.ok ? 'pass' : 'fail'} mech-vac"><b>${r.vac.ok ? '✓' : '×'}</b><div><strong>Full-vacuum buckling check</strong><span>Critical pressure ${(r.vac.Pc * 1000).toFixed(0)} kPa against ${(s.sf * 101.325).toFixed(0)} kPa required (safety factor ${s.sf}). ${r.vac.ok ? 'Stiffening rings would allow a thinner shell; say which you chose.' : 'Thicken the shell or add stiffening rings and recheck.'}</span></div></div>` : ''}<p class="formula-note">Internal design pressure ${(r.Pd * 1000).toFixed(0)} kPa gauge (10% above operating, at least 1 barg); allowable stress ${r.S.toFixed(0)} MPa at ${s.T} °C; joint efficiency ${r.E}. Record the material data source in the Data Register.</p><div class="vessel-wrap">${vesselSVG(r, s)}</div><div class="import-buttons"><button class="ghost" id="mechDownload">Download sketch (SVG)</button><button class="ghost" id="mechToCost">Send vessel mass to the cost table</button></div>`;
  return `<section class="task-card"><div class="task-head"><div class="task-number">12m</div><div><h2>Preliminary mechanical design</h2><p>Shell and head thickness for the main vessel, a full-vacuum check where needed, its mass and a dimensioned sketch for your report.</p></div></div><div class="equation">Shell: t = P·Di / (2·S·E − 1.2·P) &nbsp; · &nbsp; 2:1 head: t = P·Di / (2·S·E − 0.2·P) &nbsp; · &nbsp; vacuum: Pc = 2.2·E<sub>y</sub>·(t/Do)³</div><div class="field-grid mech-grid">${num('D', 'Inside diameter, Di (m)', s.D, state.operation === 'distillation' ? 'From your column sizing.' : 'From your equipment sizing.')}${num('L', 'Tangent-to-tangent length (m)', s.L)}${num('Pop', 'Operating pressure (kPa abs)', s.Pop, 'Below 101.3 kPa means vacuum service.')}${num('T', 'Design temperature (°C)', s.T, 'Default: operating temperature + 50 °C.')}<div class="field"><label for="mech_mat">Material</label><select id="mech_mat" data-mech="mat">${Object.entries(MATERIALS).map(([k, m]) => `<option value="${k}" ${k === s.mat ? 'selected' : ''}>${m.name}</option>`).join('')}</select><span class="help">${esc(mat.note)}</span></div><div class="field"><label for="mech_head">Head type</label><select id="mech_head" data-mech="head">${[['ellipsoidal', '2:1 ellipsoidal'], ['torispherical', 'Torispherical'], ['hemispherical', 'Hemispherical']].map(([k, l]) => `<option value="${k}" ${k === s.head ? 'selected' : ''}>${l}</option>`).join('')}</select></div><div class="field"><label for="mech_E">Weld joint efficiency</label><select id="mech_E" data-mech="E">${[[1, '1.0: fully radiographed'], [0.85, '0.85: spot radiographed'], [0.7, '0.7: not radiographed']].map(([k, l]) => `<option value="${k}" ${Number(s.E) === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>${num('ca', 'Corrosion allowance (mm)', s.ca, `Blank: ${mat.ca} mm for this material.`)}</div>${res}</section>`;
}
function bindMechanical() {
  if (!document.getElementById('mech_D')) return;
  document.querySelectorAll('[data-mech]').forEach(el => el.onchange = () => { state.mech ||= {}; const k = el.dataset.mech; state.mech[k] = ['mat', 'head'].includes(k) ? el.value : el.value === '' ? '' : Number(el.value); save(); const y = window.scrollY; render(); window.scrollTo(0, y); });
  const dl = document.getElementById('mechDownload'); if (dl) dl.onclick = () => { const svg = document.getElementById('vesselSvg'); if (!svg) return; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' })); a.download = `${state.diagram.unitTag}-vessel-sketch.svg`; a.click(); };
  const tc = document.getElementById('mechToCost'); if (tc) tc.onclick = () => { const r = mechCalc(); if (r.error) return; const c = ensureCosting(); let row = c.rows.find(x => x.id === 'vessel'); if (!row) { row = { id: 'vessel', tag: `${state.diagram.unitTag}-V`, item: 'Pressure vessel shell (mass basis)', a: '', b: '', n: '', sMin: '', sMax: '', fm: 1 }; c.rows.push(row); } row.S = Math.round(r.shell + r.heads); row.sUnit = 'kg'; state.economics.result = null; save(); render(); document.getElementById('costAdd')?.scrollIntoView({ block: 'center' }); };
}
function renderMechanicalPortfolio() {
  const s = mechState(), r = mechCalc(s); if (r.error) return '<p>Mechanical design not completed.</p>';
  return `<p>${esc(MATERIALS[s.mat].name)}; Di ${r.Di.toFixed(0)} mm; T–T ${(r.L * 1000).toFixed(0)} mm; design ${(r.Pd * 1000).toFixed(0)} kPa g${r.vacuum ? ' and full vacuum' : ''} at ${esc(s.T)} °C. Shell and heads <strong>${r.t} mm</strong> (pressure ${r.tShell.toFixed(2)} mm, minimum practical ${r.tMin} mm, corrosion ${r.ca} mm)${r.vac ? `; vacuum check ${r.vac.ok ? 'passed' : '<strong>failed</strong>'}` : ''}. Empty mass ≈ ${Math.round(r.total).toLocaleString('en-MY')} kg.</p><div class="vessel-wrap">${vesselSVG(r, s)}</div>`;
}
