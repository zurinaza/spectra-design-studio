/* SPECTRA data tools
   1. Operation-specific data checklist   2. Reference library
   3. Excel/CSV template download and upload   4. Paste from Excel
   Loaded before app.js; uses its globals (state, esc, save, render, operations) at call time. */

const SOURCE_TYPES = ['Validated database', 'Peer-reviewed journal', 'Textbook or handbook', 'Engineering standard', 'Industrial or vendor datasheet', 'Project brief', 'Experimental data', 'Engineering assumption'];

/* ---------- 1. Checklists: names, units and prompts only. Students find the values. ---------- */
const C = (key, name, unit, prompt, source, req = false, aliases = []) => ({ key, name, unit, prompt, source, req, aliases });
const DATA_CHECKLISTS = {
  evaporation: [
    C('ev_cp', 'Feed heat capacity', 'kJ kg⁻¹ K⁻¹', 'Feed composition and temperature range', 'Validated database', true, ['heat capacity', 'cp', 'specific heat']),
    C('ev_latent', 'Latent heat of vaporisation of the solvent', 'kJ kg⁻¹', 'At the evaporator pressure or boiling temperature', 'Validated database', true, ['latent heat', 'latent heat of water', 'enthalpy of vaporisation']),
    C('ev_bpr', 'Boiling-point rise of the concentrate', 'K', 'At the product concentration and evaporator pressure', 'Textbook or handbook', true, ['boiling point rise', 'boiling point elevation', 'bpr', 'bpe']),
    C('ev_u', 'Overall heat-transfer coefficient', 'kW m⁻² K⁻¹', 'Evaporator type, liquor viscosity, clean or fouled basis', 'Textbook or handbook', true, ['u', 'overall u', 'overall heat transfer coefficient']),
    C('ev_steam', 'Available steam pressure', 'kPa abs', 'Site utility specification', 'Project brief', true, ['steam pressure']),
    C('ev_tmax', 'Maximum allowable product temperature', '°C', 'Product degradation or quality limit, exposure time', 'Peer-reviewed journal', false, ['maximum product temperature', 'degradation temperature']),
    C('ev_fouling', 'Fouling resistance or allowance', 'm² K kW⁻¹', 'Liquor type and cleaning interval', 'Textbook or handbook', false, ['fouling factor', 'fouling resistance']),
    C('ev_visc', 'Liquor viscosity at product concentration', 'mPa s', 'Concentration and temperature', 'Peer-reviewed journal', false, ['viscosity']),
    C('ev_cw', 'Cooling-water supply temperature', '°C', 'Site conditions, design season', 'Project brief', false, ['cooling water temperature'])
  ],
  distillation: [
    C('di_vle', 'Vapour–liquid equilibrium data or activity-model parameters', '—', 'System, pressure, composition range, model (e.g. NRTL)', 'Peer-reviewed journal', true, ['vle', 'vle data', 'nrtl parameters']),
    C('di_alpha', 'Relative volatility of the key components', '—', 'Column pressure; top, bottom or average value', 'Validated database', true, ['relative volatility', 'alpha']),
    C('di_bp', 'Normal boiling points of the key components', '°C', 'At 101.325 kPa; name each component', 'Validated database', true, ['boiling point', 'normal boiling point']),
    C('di_latent', 'Latent heat of the overhead and bottoms', 'kJ kg⁻¹', 'At column pressure', 'Validated database', true, ['latent heat']),
    C('di_rho', 'Vapour and liquid densities', 'kg m⁻³', 'At tray conditions (top and bottom)', 'Validated database', true, ['density', 'vapour density', 'liquid density']),
    C('di_flood', 'Flooding correlation', 'method', 'Tray or packing type, spacing, validity range', 'Textbook or handbook', true, ['flooding correlation', 'fair correlation']),
    C('di_eff', 'Tray efficiency or packing HETP', '% or m', 'System, internals type, operating range', 'Textbook or handbook', false, ['tray efficiency', 'hetp', 'overall efficiency']),
    C('di_sigma', 'Liquid surface tension', 'mN m⁻¹', 'Composition and temperature', 'Validated database', false, ['surface tension'])
  ],
  absorption: [
    C('ab_eq', 'Gas–liquid equilibrium (Henry constant or solubility data)', 'as reported', 'Solute, solvent, temperature and pressure', 'Peer-reviewed journal', true, ['henry constant', 'henrys constant', 'solubility', 'equilibrium data']),
    C('ab_mt', 'Mass-transfer coefficients or HTU correlation', 'as reported', 'Packing or tray type, flow regime', 'Textbook or handbook', true, ['htu', 'mass transfer coefficient', 'kga', 'onda correlation']),
    C('ab_prop', 'Gas and liquid densities and viscosities', 'kg m⁻³, mPa s', 'Column temperature and pressure', 'Validated database', true, ['density', 'viscosity']),
    C('ab_pack', 'Packing data (packing factor, specific area)', 'm⁻¹', 'Packing type and size', 'Industrial or vendor datasheet', true, ['packing factor', 'specific area', 'packing data']),
    C('ab_dp', 'Flooding and pressure-drop correlation', 'method', 'e.g. generalised pressure-drop correlation; validity range', 'Textbook or handbook', true, ['gpdc', 'pressure drop correlation', 'flooding correlation']),
    C('ab_target', 'Required solute removal', '%', 'Emission limit or product specification', 'Project brief', false, ['removal', 'removal target']),
    C('ab_solv', 'Solvent price and make-up rate', 'RM kg⁻¹', 'Supplier, grade, year', 'Industrial or vendor datasheet', false, ['solvent cost', 'solvent price'])
  ],
  extraction: [
    C('ex_k', 'Distribution coefficient of the solute', '—', 'Solvent pair, temperature, concentration basis', 'Peer-reviewed journal', true, ['distribution coefficient', 'partition coefficient', 'k']),
    C('ex_lle', 'Liquid–liquid equilibrium (ternary) data', '—', 'Temperature; tie-line range', 'Peer-reviewed journal', true, ['lle', 'ternary data', 'tie line']),
    C('ex_rho', 'Densities of both liquid phases', 'kg m⁻³', 'Temperature and composition', 'Validated database', true, ['density']),
    C('ex_eff', 'Stage efficiency or HETS', '% or m', 'Contactor type and operating range', 'Textbook or handbook', true, ['stage efficiency', 'hets']),
    C('ex_ift', 'Interfacial tension', 'mN m⁻¹', 'Solvent pair and temperature', 'Peer-reviewed journal', false, ['interfacial tension']),
    C('ex_visc', 'Viscosities of both phases', 'mPa s', 'Temperature', 'Validated database', false, ['viscosity']),
    C('ex_safety', 'Solvent flash point and exposure limit', '°C, ppm', 'Safety data sheet revision', 'Industrial or vendor datasheet', false, ['flash point', 'sds'])
  ],
  drying: [
    C('dr_cmc', 'Critical moisture content', 'kg water kg⁻¹ dry solid', 'Material, particle size, air conditions of the test', 'Experimental data', true, ['critical moisture content', 'critical moisture']),
    C('dr_emc', 'Equilibrium moisture content', 'kg water kg⁻¹ dry solid', 'Air temperature and relative humidity', 'Peer-reviewed journal', true, ['equilibrium moisture content', 'emc', 'sorption isotherm']),
    C('dr_rate', 'Constant-rate drying flux or heat-transfer coefficient', 'kg m⁻² h⁻¹', 'Air velocity, temperature and humidity', 'Experimental data', true, ['drying rate', 'constant rate', 'drying flux']),
    C('dr_air', 'Inlet air temperature and humidity', '°C, kg kg⁻¹', 'Ambient design condition and heater outlet', 'Project brief', true, ['air temperature', 'humidity', 'inlet air']),
    C('dr_tmax', 'Maximum allowable product temperature', '°C', 'Quality or degradation limit', 'Peer-reviewed journal', true, ['maximum product temperature']),
    C('dr_cps', 'Heat capacity of the dry solid', 'kJ kg⁻¹ K⁻¹', 'Temperature range', 'Validated database', false, ['heat capacity', 'cp']),
    C('dr_bulk', 'Particle size and bulk density', 'µm, kg m⁻³', 'Sample and measurement method', 'Experimental data', false, ['particle size', 'bulk density'])
  ],
  leaching: [
    C('le_sol', 'Solubility of the solute in the solvent', 'kg kg⁻¹', 'Temperature and solvent composition', 'Peer-reviewed journal', true, ['solubility']),
    C('le_content', 'Solute content of the feed solid', 'wt%', 'Sample basis (dry or wet), analysis method', 'Experimental data', true, ['solute content', 'oil content', 'feed composition']),
    C('le_ret', 'Solution retained in the underflow', 'kg solution kg⁻¹ inert', 'As a function of concentration, if available', 'Experimental data', true, ['underflow', 'retention', 'solution retention']),
    C('le_kin', 'Leaching kinetics or effective diffusivity', 'm² s⁻¹', 'Particle size and temperature', 'Peer-reviewed journal', true, ['diffusivity', 'kinetics', 'rate constant']),
    C('le_psd', 'Particle size of the feed solid', 'mm', 'After size reduction', 'Experimental data', false, ['particle size']),
    C('le_rho', 'Solvent and solution densities', 'kg m⁻³', 'Temperature and concentration', 'Validated database', false, ['density'])
  ],
  common: [
    C('co_cost', 'Equipment purchase-cost correlation or quotation', 'RM', 'Size parameter, material, cost year and index', 'Textbook or handbook', false, ['cost correlation', 'purchase cost', 'equipment cost']),
    C('co_util', 'Utility prices (steam, electricity, cooling water)', 'RM per unit', 'Supplier or tariff, year', 'Industrial or vendor datasheet', false, ['utility price', 'electricity price', 'steam cost'])
  ]
};
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
function checklistFor(op = state.operation) { return [...(DATA_CHECKLISTS[op] || []), ...DATA_CHECKLISTS.common]; }
function checklistItem(key) { return checklistFor().find(item => item.key === key); }
function guessChecklistKey(name) {
  const n = norm(name); if (!n) return '';
  const items = checklistFor();
  return (items.find(i => norm(i.name) === n) || items.find(i => i.aliases.some(a => norm(a) === n)) || items.find(i => i.aliases.some(a => norm(a).length > 3 && n.includes(norm(a)))) || {}).key || '';
}
function checklistStatus() {
  return checklistFor().map(item => ({ item, index: state.dataEntries.findIndex(e => e.checklistKey === item.key) }));
}
function missingRequired() { return checklistStatus().filter(s => s.item.req && s.index < 0).map(s => s.item); }
function renderChecklist() {
  const rows = checklistStatus(), req = rows.filter(r => r.item.req), opt = rows.filter(r => !r.item.req);
  const done = list => list.filter(r => r.index >= 0).length;
  const row = r => {
    const e = r.index >= 0 ? state.dataEntries[r.index] : null;
    return `<div class="check-item ${e ? 'done' : ''}"><b>${e ? '✓' : '○'}</b><div><strong>${esc(r.item.name)}</strong><span>${e ? `${esc(e.value)} ${esc(e.unit || '')} · ${esc(e.conditions)}` : `Record: ${esc(r.item.prompt)}. Unit: ${esc(r.item.unit)}. Suggested source: ${esc(r.item.source)}.`}</span></div>${e ? `<button class="mini-btn" data-edit="${r.index}">View</button>` : `<button class="mini-btn add" data-check-add="${r.item.key}">Add</button>`}</div>`;
  };
  const pct = req.length ? done(req) / req.length * 100 : 100;
  return `<div class="checklist"><div class="checklist-head"><div><strong>Data checklist for ${esc(operations[state.operation].name.toLowerCase())}</strong><span>The data this design needs. Find each value yourself, then record it with its conditions and source.</span></div><div class="checklist-count"><strong>${done(req)} / ${req.length}</strong><span>required recorded</span></div></div><div class="progress-track"><div style="width:${pct}%"></div></div><div class="check-items">${req.map(row).join('')}</div><details class="optional-data"><summary>Optional data (${done(opt)} of ${opt.length} recorded)</summary><div class="check-items">${opt.map(row).join('')}</div></details></div>`;
}

/* ---------- 2. Reference library ---------- */
function refKey(text) { return norm(text); }
function addReference(text, sourceType) {
  const t = String(text || '').trim(); if (t.length < 12) return false;
  state.references ||= [];
  if (state.references.some(r => refKey(r.text) === refKey(t))) return false;
  state.references.push({ id: `ref${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, text: t, sourceType: SOURCE_TYPES.includes(sourceType) ? sourceType : 'Textbook or handbook' });
  return true;
}
function referenceOptions(selectedText = '') {
  const refs = state.references || [];
  return `<option value="">${refs.length ? 'Choose from my reference library…' : 'Library empty: save a reference below to reuse it'}</option>` + refs.map(r => `<option value="${r.id}" ${refKey(r.text) === refKey(selectedText) ? 'selected' : ''}>${esc(r.text.length > 90 ? r.text.slice(0, 88) + '…' : r.text)}</option>`).join('');
}
function renderLibrary() {
  const refs = state.references || [], uses = r => state.dataEntries.filter(e => refKey(e.reference) === refKey(r.text)).length;
  const unsaved = [...new Set(state.dataEntries.map(e => e.reference).filter(t => t && t.trim().length >= 12 && !refs.some(r => refKey(r.text) === refKey(t))))];
  document.getElementById('libraryContent').innerHTML = `<div class="library-list">${refs.length ? refs.map(r => `<div class="library-item"><div><span class="lib-type">${esc(r.sourceType)}</span><p>${esc(r.text)}</p><small>Used by ${uses(r)} data item${uses(r) === 1 ? '' : 's'}</small></div><button class="mini-btn danger" data-lib-delete="${r.id}">Remove</button></div>`).join('') : '<div class="data-empty"><strong>No saved references yet</strong><span>Add the sources you cite most often, such as Perry\'s, Sinnott & Towler or a key journal paper.</span></div>'}</div>${unsaved.length ? `<div class="info-strip"><div>◆</div><div>${unsaved.length} reference${unsaved.length === 1 ? '' : 's'} in your register ${unsaved.length === 1 ? 'is' : 'are'} not in the library. <button class="mini-btn" id="libCollect">Add ${unsaved.length === 1 ? 'it' : 'them'}</button></div></div>` : ''}<div class="library-add field-grid"><div class="field full"><label for="libText">New reference</label><textarea id="libText" rows="3" placeholder="Author/organisation, year, title, edition or journal, DOI/URL"></textarea></div><div class="field"><label for="libType">Source category</label><select id="libType">${SOURCE_TYPES.map(t => `<option>${t}</option>`).join('')}</select></div><div class="field lib-add-btn"><button class="primary small" id="libAdd">Add to library</button></div></div><div class="form-feedback" id="libFeedback"></div>`;
  document.querySelectorAll('[data-lib-delete]').forEach(b => b.onclick = () => { state.references = state.references.filter(r => r.id !== b.dataset.libDelete); save(); renderLibrary(); });
  const collect = document.getElementById('libCollect'); if (collect) collect.onclick = () => { unsaved.forEach(t => addReference(t, state.dataEntries.find(e => e.reference === t)?.sourceType)); save(); renderLibrary(); };
  document.getElementById('libAdd').onclick = () => { const ok = addReference(document.getElementById('libText').value, document.getElementById('libType').value); if (!ok) { document.getElementById('libFeedback').textContent = 'Enter a complete reference (at least 12 characters) that is not already in the library.'; return; } save(); renderLibrary(); };
}
function openLibrary() { renderLibrary(); document.getElementById('libraryDialog').showModal(); }

/* ---------- 3 & 4. Template, upload, paste ---------- */
const IMPORT_COLUMNS = [
  ['checklistKey', 'Checklist ID'], ['name', 'Data, equation or method'], ['value', 'Value or method name'], ['unit', 'Unit'],
  ['conditions', 'Conditions and system'], ['sourceType', 'Source category'], ['reference', 'Traceable reference'], ['applicability', 'Why is it applicable?'], ['guidance', 'Guidance (not imported)']
];
let importRows = [];
function loadSheetJS() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  return new Promise((resolve, reject) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload = () => resolve(window.XLSX); s.onerror = () => reject(new Error('Excel library could not load')); document.head.appendChild(s); });
}
function templateRows() {
  const items = checklistFor();
  return items.map(i => ({ checklistKey: i.key, name: i.name, value: '', unit: i.unit, conditions: '', sourceType: i.source, reference: '', applicability: '', guidance: `${i.req ? 'REQUIRED. ' : 'Optional. '}Record: ${i.prompt}.` }));
}
function downloadBlob(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
async function downloadTemplate(format = 'xlsx') {
  const rows = templateRows(), fileBase = `spectra-data-register-${state.operation}`;
  if (format === 'xlsx') {
    try {
      const XLSX = await loadSheetJS();
      const aoa = [IMPORT_COLUMNS.map(c => c[1]), ...rows.map(r => IMPORT_COLUMNS.map(c => r[c[0]]))];
      for (let i = 0; i < 10; i++) aoa.push(IMPORT_COLUMNS.map(c => c[0] === 'guidance' ? 'Extra row: add any other data you use.' : ''));
      const ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = [12, 42, 18, 14, 38, 26, 50, 44, 52].map(w => ({ wch: w }));
      const help = XLSX.utils.aoa_to_sheet([
        ['How to use this template'], [''],
        ['1. Each row is one data item. Rows already listed are the data your selected operation needs.'],
        ['2. Fill in Value, Unit, Conditions, Source category, Traceable reference and Why is it applicable.'],
        ['3. Leave the Checklist ID unchanged so SPECTRA can tick the matching checklist item.'],
        ['4. Rows without a value are skipped on import. Use the extra rows for any other data.'],
        ['5. Upload the file in SPECTRA (Establish stage → Import data). Imported items arrive as Provisional; review each one before it counts as verified.'],
        [''], ['Allowed source categories'], ...SOURCE_TYPES.map(t => [t])
      ]); help['!cols'] = [{ wch: 110 }];
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Data register'); XLSX.utils.book_append_sheet(wb, help, 'Instructions');
      XLSX.writeFile(wb, `${fileBase}.xlsx`); return;
    } catch { /* fall back to CSV */ }
  }
  const csvCell = v => /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
  const csv = [IMPORT_COLUMNS.map(c => c[1]), ...rows.map(r => IMPORT_COLUMNS.map(c => r[c[0]]))].map(r => r.map(csvCell).join(',')).join('\r\n');
  downloadBlob(new Blob(['\ufeff' + csv], { type: 'text/csv' }), `${fileBase}.csv`);
}
function parseDelimited(text, delim) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
    else if (ch === '"' && cell === '') q = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => String(c).trim() !== ''));
}
function matchSourceType(v) {
  const n = norm(v); if (!n) return '';
  const exact = SOURCE_TYPES.find(t => norm(t) === n); if (exact) return exact;
  const rules = [['database', 'Validated database'], ['nist', 'Validated database'], ['journal', 'Peer-reviewed journal'], ['paper', 'Peer-reviewed journal'], ['textbook', 'Textbook or handbook'], ['handbook', 'Textbook or handbook'], ['book', 'Textbook or handbook'], ['standard', 'Engineering standard'], ['vendor', 'Industrial or vendor datasheet'], ['datasheet', 'Industrial or vendor datasheet'], ['industr', 'Industrial or vendor datasheet'], ['brief', 'Project brief'], ['experiment', 'Experimental data'], ['lab', 'Experimental data'], ['assum', 'Engineering assumption']];
  return (rules.find(([k]) => n.includes(k)) || [])[1] || '';
}
function rowsToItems(table) {
  if (!table.length) return [];
  const head = table[0].map(norm);
  const find = tests => head.findIndex(h => tests.some(t => h.includes(t)));
  const map = { checklistKey: find(['checklist']), name: find(['data equation', 'data', 'name', 'property', 'parameter']), value: find(['value']), unit: find(['unit']), conditions: find(['condition']), sourceType: find(['source category', 'source type', 'category']), reference: find(['reference', 'citation']), applicability: find(['applicab', 'why']), status: find(['status']) };
  const hasHeader = map.name >= 0 && map.value >= 0;
  const body = hasHeader ? table.slice(1) : table;
  const order = ['name', 'value', 'unit', 'conditions', 'sourceType', 'reference', 'applicability'];
  return body.map(r => {
    const get = k => String(hasHeader ? (map[k] >= 0 ? r[map[k]] ?? '' : '') : (r[order.indexOf(k)] ?? '')).trim();
    const item = { name: get('name'), value: get('value'), unit: get('unit'), conditions: get('conditions'), sourceType: matchSourceType(get('sourceType')), reference: get('reference'), applicability: get('applicability') };
    const ck = hasHeader ? get('checklistKey') : '';
    item.checklistKey = checklistItem(ck) ? ck : guessChecklistKey(item.name);
    return item;
  }).filter(i => i.name || i.value);
}
function rowIssues(r) {
  const blocking = [], quality = [];
  if (!r.name) blocking.push('No data name');
  if (!r.value) blocking.push('No value (row skipped)');
  if (/\d/.test(r.value) && !r.unit) quality.push('Add a unit or “dimensionless”');
  if (!r.conditions) quality.push('State the conditions');
  if (!r.sourceType) quality.push('Choose a source category');
  if (r.reference.length < 12) quality.push('Add a traceable reference');
  if (r.sourceType === 'Peer-reviewed journal' && !/(doi|https?:\/\/|journal|vol\.?)/i.test(r.reference)) quality.push('Add a DOI, URL or full journal citation');
  if (r.applicability.length < 15) quality.push('Explain why it applies');
  const dup = state.dataEntries.some(e => norm(e.name) === norm(r.name) && norm(e.conditions) === norm(r.conditions));
  if (dup) quality.push('Already in your register');
  return { blocking, quality, dup };
}
function setImportRows(items) {
  importRows = items.map(r => { const iss = rowIssues(r); return { ...r, include: !iss.blocking.length && !iss.dup }; });
  renderImportPreview();
}
function renderImportPreview() {
  const host = document.getElementById('importPreview');
  if (!importRows.length) { host.innerHTML = ''; return; }
  const checklistOpts = sel => `<option value="">— none —</option>` + checklistFor().map(i => `<option value="${i.key}" ${i.key === sel ? 'selected' : ''}>${esc(i.name)}</option>`).join('');
  const rowHtml = i => {
    const r = importRows[i], iss = rowIssues(r), blocked = iss.blocking.length > 0;
    const inp = (k, w = '') => `<input class="imp-input ${w}" data-imp="${i}" data-k="${k}" value="${esc(r[k])}">`;
    return `<tr class="${blocked ? 'blocked' : ''} ${r.include ? '' : 'excluded'}"><td><input type="checkbox" data-imp-include="${i}" ${r.include ? 'checked' : ''} ${blocked ? 'disabled' : ''} aria-label="Import row ${i + 1}"></td><td class="imp-issues">${[...iss.blocking.map(t => `<span class="bad">${t}</span>`), ...iss.quality.map(t => `<span>${t}</span>`)].join('') || '<span class="ok">✓ Ready</span>'}</td><td>${inp('name', 'wide')}</td><td>${inp('value')}</td><td>${inp('unit', 'narrow')}</td><td>${inp('conditions', 'wide')}</td><td><select class="imp-input" data-imp="${i}" data-k="sourceType"><option value="">Choose…</option>${SOURCE_TYPES.map(t => `<option ${t === r.sourceType ? 'selected' : ''}>${t}</option>`).join('')}</select></td><td>${inp('reference', 'wide')}</td><td>${inp('applicability', 'wide')}</td><td><select class="imp-input" data-imp="${i}" data-k="checklistKey">${checklistOpts(r.checklistKey)}</select></td></tr>`;
  };
  const idx = importRows.map((_, i) => i), ready = idx.filter(i => !rowIssues(importRows[i]).blocking.length), skippedIdx = idx.filter(i => rowIssues(importRows[i]).blocking.length);
  const head = `<thead><tr><th></th><th>CHECKS</th><th>DATA</th><th>VALUE</th><th>UNIT</th><th>CONDITIONS</th><th>SOURCE CATEGORY</th><th>REFERENCE</th><th>WHY APPLICABLE</th><th>CHECKLIST ITEM</th></tr></thead>`;
  const n = importRows.filter(r => r.include).length, skipped = importRows.filter(r => rowIssues(r).blocking.length).length;
  const openSkipped = host.querySelector('.skipped-rows')?.open;
  host.innerHTML = `<div class="import-summary"><strong>${importRows.length} rows read</strong><span>${n} selected to import${skipped ? ` · ${skipped} without a value will be skipped` : ''}. You can correct any cell here before importing.</span></div>${ready.length ? `<div class="data-table-wrap import-wrap"><table class="data-table import-table">${head}<tbody>${ready.map(rowHtml).join('')}</tbody></table></div>` : '<div class="error-item">No rows have a value yet. Open the skipped rows below to fill them in, or check your file.</div>'}${skippedIdx.length ? `<details class="skipped-rows" ${ready.length ? '' : 'open'}><summary>Show ${skippedIdx.length} skipped row${skippedIdx.length === 1 ? '' : 's'} without a value</summary><div class="data-table-wrap import-wrap"><table class="data-table import-table">${head}<tbody>${skippedIdx.map(rowHtml).join('')}</tbody></table></div></details>` : ''}<label class="check-row import-lib"><input type="checkbox" id="importAddRefs" checked><span>Also save the references in these rows to my reference library</span></label><div class="dialog-actions import-actions"><button class="ghost" id="importClear">Start again</button><button class="primary" id="importConfirm" ${n ? '' : 'disabled'}>Import ${n} item${n === 1 ? '' : 's'}</button></div>`;
  if (openSkipped && host.querySelector('.skipped-rows')) host.querySelector('.skipped-rows').open = true;
  host.querySelectorAll('[data-imp]').forEach(el => el.onchange = () => { const r = importRows[Number(el.dataset.imp)]; r[el.dataset.k] = el.value.trim(); const iss = rowIssues(r); if (iss.blocking.length) r.include = false; else if (el.dataset.k === 'value' && !r.include && !iss.dup) r.include = true; renderImportPreview(); });
  host.querySelectorAll('[data-imp-include]').forEach(el => el.onchange = () => { importRows[Number(el.dataset.impInclude)].include = el.checked; renderImportPreview(); });
  document.getElementById('importClear').onclick = () => { importRows = []; document.getElementById('importPaste').value = ''; document.getElementById('importFile').value = ''; setImportStatus(''); renderImportPreview(); };
  document.getElementById('importConfirm').onclick = confirmImport;
}
function setImportStatus(text, bad = false) { const el = document.getElementById('importStatus'); el.textContent = text; el.className = `status-note ${bad ? 'warn' : ''}`; }
async function readImportFile(file) {
  if (!file) return;
  setImportStatus(`Reading ${file.name}…`);
  try {
    let table;
    if (/\.(xlsx|xls|ods)$/i.test(file.name)) {
      const XLSX = await loadSheetJS(), wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheet = wb.Sheets['Data register'] || wb.Sheets[wb.SheetNames[0]];
      table = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
    } else {
      const text = (await file.text()).replace(/^\ufeff/, ''); const first = text.split(/\r?\n/)[0];
      table = parseDelimited(text, first.includes('\t') ? '\t' : (first.split(';').length > first.split(',').length ? ';' : ','));
    }
    const items = rowsToItems(table.filter(r => r.some(c => String(c).trim() !== '')));
    if (!items.length) { setImportStatus('No data rows were found. Check that the file uses the template columns.', true); return; }
    setImportStatus(`Read ${file.name}.`); setImportRows(items);
  } catch (err) { setImportStatus(`${file.name} could not be read. ${/\.(xlsx|xls)$/i.test(file.name) ? 'Save it as CSV and try again, or paste the rows instead.' : ''}`, true); }
}
function readPaste() {
  const text = document.getElementById('importPaste').value; if (!text.trim()) { setImportStatus('Paste some rows first.', true); return; }
  const first = text.split(/\r?\n/)[0], table = parseDelimited(text, first.includes('\t') ? '\t' : ',');
  const items = rowsToItems(table);
  if (!items.length) { setImportStatus('No data rows were found in the pasted text.', true); return; }
  setImportStatus(''); setImportRows(items);
}
function confirmImport() {
  const chosen = importRows.filter(r => r.include && !rowIssues(r).blocking.length); if (!chosen.length) return;
  const addRefs = document.getElementById('importAddRefs')?.checked;
  chosen.forEach(r => {
    const assumed = r.sourceType === 'Engineering assumption';
    state.dataEntries.push({ name: r.name, value: r.value, unit: r.unit, conditions: r.conditions, sourceType: r.sourceType || 'Textbook or handbook', status: assumed ? 'Assumed' : 'Provisional', reference: r.reference, applicability: r.applicability, checklistKey: r.checklistKey || '', imported: true });
    if (addRefs) addReference(r.reference, r.sourceType);
  });
  importRows = []; state.showDataQuality = true; save(); document.getElementById('importDialog').close(); render();
}
function openImport() {
  importRows = []; document.getElementById('importPaste').value = ''; document.getElementById('importFile').value = ''; setImportStatus(''); renderImportPreview();
  document.getElementById('importOpName').textContent = operations[state.operation].name.toLowerCase();
  document.getElementById('importDialog').showModal();
}
function bindDataTools() {
  document.getElementById('tplXlsx').onclick = () => downloadTemplate('xlsx');
  document.getElementById('tplCsv').onclick = () => downloadTemplate('csv');
  document.getElementById('importFile').onchange = e => readImportFile(e.target.files[0]);
  document.getElementById('importPasteBtn').onclick = readPaste;
  const drop = document.getElementById('importDrop');
  ['dragover', 'dragenter'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => readImportFile(e.dataTransfer.files[0]));
}
