/* SPECTRA assignment reader
   The lecturer uploads (PDF, Word, text) or pastes the assignment; SPECTRA extracts the case
   details, fills the Lecturer tools form and sets per-group ranges. Everything stays editable.
   Loaded after course-tools.js and before app.js. */

const LIBS = {
  pdf: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  pdfWorker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  mammoth: 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js'
};
function loadScript(src, globalName) { if (window[globalName]) return Promise.resolve(window[globalName]); return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = () => res(window[globalName]); s.onerror = () => rej(new Error(`Could not load ${src}`)); document.head.appendChild(s); }); }
async function fileToText(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) {
    const pdfjs = await loadScript(LIBS.pdf, 'pdfjsLib'); pdfjs.GlobalWorkerOptions.workerSrc = LIBS.pdfWorker;
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise; let text = '';
    for (let p = 1; p <= Math.min(doc.numPages, 30); p++) {
      const content = await (await doc.getPage(p)).getTextContent(); let lastY = null;
      content.items.forEach(it => { const y = it.transform[5]; if (lastY !== null && Math.abs(y - lastY) > 2) text += '\n'; else if (lastY !== null) text += ' '; text += it.str; lastY = y; });
      text += '\n\n';
    }
    if (!text.replace(/\s/g, '')) throw new Error('This PDF has no text layer (it may be a scan). Copy the text in by hand or upload a Word version.');
    return text;
  }
  if (name.endsWith('.docx')) { const mammoth = await loadScript(LIBS.mammoth, 'mammoth'); return (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value; }
  if (name.endsWith('.doc')) throw new Error('Old .doc files cannot be read in the browser. Save it as .docx or PDF and try again.');
  return file.text();
}

/* ---------- Parsing ---------- */
const OP_PATTERNS = { evaporation: /evaporat/gi, drying: /\bdr(y|ying|ier|yer|ied)\b/gi, distillation: /distil/gi, absorption: /\babsor(b|p)/gi, extraction: /liquid[\s–-]+liquid|\bextract(ion|or|ed)?\b|\bsolvent extraction/gi, leaching: /leach/gi };
const FLOW_RE = /(\d{1,3}(?:[,\s]\d{3})+|\d+(?:\.\d+)?)\s*(kg\s*\/\s*h(?:r|our)?|kg\s*h[-−⁻]?1|kg\s+per\s+hour|kmol\s*\/\s*h(?:r|our)?|kmol\s*h[-−⁻]?1|kmol\s+per\s+hour|t(?:onnes?|ons?)?\s*\/\s*h(?:r|our)?|t(?:onnes?|ons?)?\s+per\s+hour|t(?:onnes?|ons?)?\s*\/\s*d(?:ay)?|t(?:onnes?|ons?)?\s+per\s+day|tpd|kg\s*\/\s*day|kg\s+per\s+day|kg\s*\/\s*batch|kg\s+per\s+batch)/i;
const PCT = '(\\d+(?:\\.\\d+)?)\\s*(?:(wt|mass|w\\/w|mol|mole)\\s*%|%\\s*(?:\\(?\\s*(w\\/w|wt|by\\s+(?:mass|weight|mole)|mol|mole)\\s*\\)?)?)';
const STOP = new Set(['in', 'and', 'of', 'the', 'a', 'an', 'to', 'at', 'with', 'is', 'by', 'from', 'for', 'solution', 'aqueous', 'feed', 'basis', 'mass', 'mole', 'weight', 'solids', 'dry']);
function flowToUnit(v, u) {
  u = u.toLowerCase().replace(/\s+/g, '');
  if (/kmol/.test(u)) return { q: v, unit: 'kmol/h' };
  if (/batch/.test(u)) return { q: v, unit: 'kg/batch' };
  if (/^(t|tonnes?|tons?)(\/|per)?h/.test(u)) return { q: v * 1000, unit: 'kg/h' };
  if (/^(t|tonnes?|tons?)(\/|per)?d|tpd/.test(u)) return { q: v * 1000 / 24, unit: 'kg/h' };
  if (/kg(\/|per)?day/.test(u)) return { q: v / 24, unit: 'kg/h' };
  return { q: v, unit: 'kg/h' };
}
function niceRound(v) { if (!(v > 0)) return v; const p = Math.pow(10, Math.floor(Math.log10(v)) - 1); return Math.round(v / p) * p; }
function parseAssignment(raw) {
  const text = raw.replace(/\r/g, '').replace(/[ \t]+/g, ' '), found = [], out = {};
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const sentences = text.replace(/\n+/g, ' \n ').split(/(?<=[.!?;])\s+|\s\n\s/).map(s => s.trim()).filter(s => s.length > 3);
  const note = (field, value, snippet, ok = true) => found.push({ field, value, snippet: (snippet || '').slice(0, 180), ok });
  // Operation
  const counts = Object.fromEntries(Object.entries(OP_PATTERNS).map(([k, re]) => [k, (text.match(re) || []).length]));
  counts.absorption -= (text.match(/adsorp/gi) || []).length;
  const op = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (op[1] > 0) { out.op = op[0]; note('Unit operation', operations[op[0]].name, `mentioned ${op[1]} time${op[1] === 1 ? '' : 's'}`); } else note('Unit operation', 'not found', '', false);
  // Title
  const skip = /^(assignment|project\s*\d|course|subject|ech\s?\d|universiti|university|faculty|department|name|group|due|date|marks?|lecturer|instructions?|semester|session|page\s*\d|question\s*\d)/i;
  const title = lines.find(l => !skip.test(l) && l.length >= 15 && l.length <= 140 && /(design|concentrat|recover|separat|remov|purif|produc|dry|distil|absor|extract|leach|evaporat)/i.test(l) && !/[.:]$/.test(l)) || lines.find(l => !skip.test(l) && l.split(' ').length >= 4 && l.length <= 140);
  if (title) { out.title = title.replace(/^(title|project title)\s*[:–-]\s*/i, ''); note('Project title', out.title, title); } else note('Project title', 'not found', '', false);
  // Throughput
  const flowSentences = sentences.filter(s => FLOW_RE.test(s)), pref = flowSentences.find(s => /(feed|throughput|capacity|process|rate|flow)/i.test(s)) || flowSentences[0];
  if (pref) { const m = pref.match(FLOW_RE), v = Number(m[1].replace(/[,\s]/g, '')), f = flowToUnit(v, m[2]); out.q = Number(f.q.toFixed(f.q < 100 ? 2 : 0)); out.unit = f.unit; note('Throughput', `${out.q} ${out.unit}${f.q !== v ? ` (from ${m[0]})` : ''}`, pref); } else note('Throughput', 'not found', '', false);
  // Compositions
  const basisWord = t => /mol/i.test(t || '') ? 'mole' : /(wt|mass|w\/w|weight)/i.test(t || '') ? 'mass' : '';
  const ft = text.match(/from\s+(\d+(?:\.\d+)?)\s*(?:(wt|mass|w\/w|mol|mole)\s*)?%?\s*(?:[a-z\s]{0,25}?)\s*to\s+(?:about\s+|at\s+least\s+)?(\d+(?:\.\d+)?)\s*(?:(wt|mass|w\/w|mol|mole)\s*)?%\s*(\(?\s*(?:w\/w|wt|by\s+(?:mass|weight|mole)|mol|mole)\s*\)?)?/i);
  let basis = '';
  if (ft) {
    let z = Number(ft[1]) / 100, x = Number(ft[3]) / 100; basis = basisWord(ft[2] || ft[4] || ft[5]);
    if (out.op === 'drying' && x < z) { z = 1 - z; x = 1 - x; out.dryAsSolids = true; out.k = 'Dry solids'; note('Moisture converted to solids', `${(z * 100).toFixed(1)}% → ${(x * 100).toFixed(1)}% dry solids`, ft[0]); }
    out.z = Number(z.toFixed(4)); out.x = Number(x.toFixed(4)); note('Feed fraction z', out.z, ft[0]); note('Product fraction x', out.x, ft[0]);
  }
  const pctRe = new RegExp(PCT, 'gi'), allPct = [];
  sentences.forEach(s => { let m; pctRe.lastIndex = 0; while ((m = pctRe.exec(s))) allPct.push({ v: Number(m[1]) / 100, basis: basisWord(m[2] || m[3]), s, after: s.slice(m.index + m[0].length, m.index + m[0].length + 60), before: s.slice(Math.max(0, m.index - 60), m.index) }); });
  const mf = [...text.matchAll(/(?:mole\s+fraction\s+(?:of\s+)?(?:[a-z]+\s+)?(?:of\s+)?(0?\.\d+))|(?:(0?\.\d+)\s+mole\s+fraction)/gi)].map(m => ({ v: Number(m[1] || m[2]), basis: 'mole', s: sentences.find(x => x.includes(m[0])) || m[0], before: text.slice(Math.max(0, m.index - 60), m.index), after: text.slice(m.index + m[0].length, m.index + m[0].length + 60) }));
  const cands = [...allPct, ...mf].filter(c => c.v > 0 && c.v < 1);
  const isTarget = c => /(remov|recover|extract|efficien|yield|absorb|captur)\w*\s*(at\s+least\s+|of\s+|a\s+minimum\s+of\s+)?$/i.test(c.before) || /^\s*(of\s+(the\s+)?[a-z0-9\s\-]{0,30}?)?\s*(is|are|must\s+be|should\s+be|shall\s+be|to\s+be|has\s+to\s+be)?\s*(removed|recovered|extracted|absorbed|captured)/i.test(c.after) || /(removal|recovery|extraction)\s+(efficiency\s+)?(of|is|must\s+be)?\s*(at\s+least\s+)?$/i.test(c.before);
  const target = cands.find(isTarget);
  if (target) { out.target = target.v; note('Removal / recovery target', `${(target.v * 100).toFixed(1)}%`, target.s); }
  const comp = cands.filter(c => !isTarget(c));
  if (out.z === undefined) { const f = comp.find(c => /(feed|contain|enters|inlet|initial|dilute|raw)/i.test(c.s)); if (f) { out.z = f.v; basis ||= f.basis; note('Feed fraction z', f.v, f.s); } }
  if (out.x === undefined) { const p = comp.find(c => c.v !== out.z && /(product|distillate|concentrat|final|purity|overhead|top|leav|required|specification|at least)/i.test(c.s) && !/(bottom|residue|raffinate|waste|reboiler)/i.test(c.before + c.after.slice(0, 20))); if (p) { out.x = p.v; basis ||= p.basis; note('Product fraction x', p.v, p.s); } }
  if (out.op === 'absorption' && out.target !== undefined && out.z !== undefined) { out.x = Number((out.z * (1 - out.target) / (1 - out.z * out.target)).toFixed(5)); out.y = 1; note('Treated-gas fraction x', out.x, 'calculated from the feed fraction and the removal target (solute-free two-stream balance: the absorbed solute is the separated stream, y = 1)'); }
  const yb = out.op === 'absorption' && out.y === 1 ? null : comp.find(c => c.v !== out.z && c.v !== out.x && /(bottom|residue|raffinate|waste|underflow|spent)/i.test(c.s));
  if (yb) { out.y = yb.v; note('Separated-stream fraction y', yb.v, yb.s); }
  else if (out.op === 'absorption' && out.y === 1) { /* set above */ }
  else if (['evaporation', 'drying'].includes(out.op)) { out.y = 0; note('Separated-stream fraction y', 0, 'solvent or water removed is taken as solute-free', true); }
  else note('Separated-stream fraction y', 'not found: set it below', '', false);
  if (out.z === undefined) note('Feed fraction z', 'not found', '', false); if (out.x === undefined) note('Product fraction x', 'not found', '', false);
  out.basis = basis || (out.unit === 'kmol/h' ? 'mole' : ['distillation', 'absorption'].includes(out.op) ? 'mole' : 'mass'); note('Composition basis', out.basis, basis ? 'from the units in the text' : 'assumed from the operation', Boolean(basis));
  if (out.unit && ((out.basis === 'mole') !== /kmol/.test(out.unit))) note('Units need converting', `The throughput is in ${out.unit} but the compositions are on a ${out.basis} basis`, `Convert the throughput to ${out.basis === 'mole' ? 'kmol/h' : 'kg/h'} in the range below (or change the basis) before generating codes.`, false);
  // Key component
  const kc = comp.map(c => (c.after.match(/^\s*(?:of\s+)?([A-Za-z][A-Za-z0-9\-]*(?:\s+[A-Za-z][A-Za-z\-]*){0,2})/) || [])[1]).filter(Boolean).map(t => t.split(/\s+/).filter(w => !STOP.has(w.toLowerCase())).slice(0, 2).join(' ')).find(t => t && t.length > 2);
  if (out.dryAsSolids) { /* key component already set */ } else if (kc) { out.k = kc.charAt(0).toUpperCase() + kc.slice(1); note('Key component', out.k, comp.find(c => c.after.includes(kc.split(' ')[0]))?.s); } else note('Key component', 'not found', '', false);
  // Feed description and constraints
  const fd = sentences.find(s => /(feed|solution|mixture|slurry|stream)/i.test(s) && s.length < 240);
  if (fd) { out.fd = fd.replace(/\s+/g, ' '); note('Feed description', out.fd, fd); } else note('Feed description', 'not found', '', false);
  const cons = sentences.filter(s => /(must not|should not|shall not|not exceed|maximum|minimum|no more than|limit|below\s+\d|above\s+\d|available|saturated steam|cooling water|heat[-\s]sensitive|degrad|safety|environment|vacuum)/i.test(s) && s.length < 220 && s !== fd).slice(0, 3);
  if (cons.length) { out.c = cons.map(s => s.replace(/\s+/g, ' ').replace(/[.;]$/, '')).join('; '); note('Constraints', out.c, cons[0]); } else note('Constraints', 'none found', '', false);
  return { out, found };
}

/* ---------- Apply to the Lecturer tools form ---------- */
const VARIATION = { none: { q: 0, c: 0, label: 'Same values for every group' }, small: { q: 0.10, c: 0.01, label: 'Small: ±10% throughput, ±1 point composition' }, moderate: { q: 0.25, c: 0.02, label: 'Moderate: ±25% throughput, ±2 points composition' } };
let lastAssignment = null;
function rangesFrom(o, level) {
  const v = VARIATION[level] || VARIATION.small, clip = x => Math.min(0.995, Math.max(0, Number(x.toFixed(4))));
  const q = Number(o.q) || 1000, qStep = niceRound(q * 0.05) || 1;
  const qr = v.q ? [niceRound(q * (1 - v.q)), niceRound(q * (1 + v.q)), qStep] : [q, q, qStep];
  const cr = (val, d) => val === undefined ? null : d ? [clip(val - d), clip(val + d), 0.005] : [val, val, 0.005];
  if (o.op === 'absorption' && o.y === 1) return { q: qr, z: cr(o.z, v.c / 2), x: [o.x, o.x, 0.0001], y: [1, 1, 0.005] };
  return { q: qr, z: cr(o.z, v.c), x: cr(o.x, v.c * (o.x > 0.9 ? 0.25 : 1)), y: o.y === 0 || o.y === undefined ? (o.y === 0 ? [0, 0, 0.005] : null) : cr(o.y, v.c / 2) };
}
function applyAssignment(level) {
  if (!lastAssignment) return; const o = lastAssignment.out, d = JSON.parse(sessionStorage.getItem('spectra-lecturer') || 'null') || lecturerDefaults(), r = rangesFrom(o, level);
  const pct = v => `${(v * 100).toFixed(v * 100 % 1 ? 1 : 0)}`;
  Object.assign(d, { tg: o.target !== undefined ? Number((o.target * 100).toFixed(2)) : d.tg, op: o.op || d.op, title: o.title || d.title, fd: o.fd || d.fd, k: o.k || d.k, c: o.c || d.c, basis: o.basis || d.basis, unit: o.unit || d.unit, q: r.q, z: r.z || d.z, x: r.x || d.x, y: r.y || d.y, variation: level });
  const tgt = o.target ? ` Remove at least ${pct(o.target)}% of the ${o.k ? o.k.toLowerCase() : 'solute'}.` : '';
  if (o.op === 'evaporation') d.pt = `Concentrate {k} from {z}% to {x}% ({basis} basis)`;
  else if (o.op === 'distillation') d.pt = `Distillate at least {x}% {k} and bottoms no more than {y}% ({basis} basis), from a feed of {z}%`;
  else if (o.op === 'drying') d.pt = `Dry the product to {x}% solids ({basis} basis) from {z}%`;
  else if (o.op === 'absorption' && o.target !== undefined) d.pt = `Remove at least {t}% of the {k} from a gas containing {z}% {k} ({basis} basis)`;
  else if (o.target !== undefined) d.pt = `Recover at least {t}% of the {k}; feed contains {z}% ({basis} basis)`;
  else d.pt = `Feed contains {z}% {k}; product {x}% ({basis} basis).`;
  sessionStorage.setItem('spectra-lecturer', JSON.stringify(d)); renderLecturer();
}
function renderAssignmentSection() {
  const a = lastAssignment, level = (JSON.parse(sessionStorage.getItem('spectra-lecturer') || 'null') || {}).variation || 'small';
  const list = a ? `<div class="found-list">${a.found.map(f => `<div class="found ${f.ok ? 'ok' : 'miss'}"><b>${f.ok ? '✓' : '!'}</b><div><strong>${esc(f.field)}:</strong> ${esc(String(f.value))}${f.snippet ? `<small>“${esc(f.snippet)}”</small>` : ''}</div></div>`).join('')}</div><p class="help">SPECTRA has filled the form below. Check every field, especially any marked “!”, before generating codes.</p>` : '';
  return `<section class="lect-section assign-section"><h3>Start from your assignment (quickest)</h3><p class="help">Upload the assignment sheet or paste its text. SPECTRA reads the operation, feed, throughput, compositions and constraints, and fills in everything below. Nothing leaves your browser.</p><div class="assign-inputs"><label class="drop-zone" id="assignDrop"><input type="file" id="assignFile" accept=".pdf,.docx,.txt,.md"><span>Drop the assignment here or <u>choose a file</u><br><small>PDF, Word (.docx) or text</small></span></label><textarea id="assignText" rows="5" placeholder="…or paste the assignment text here"></textarea></div><div class="assign-bar"><div class="field"><label for="assignVar">How different should each group's brief be?</label><select id="assignVar">${Object.entries(VARIATION).map(([k, v]) => `<option value="${k}" ${k === level ? 'selected' : ''}>${v.label}</option>`).join('')}</select></div><button class="primary" id="assignRead">Read assignment</button></div><p class="status-note" id="assignStatus" role="status"></p>${list}</section>`;
}
function bindAssignment() {
  const status = t => { const el = document.getElementById('assignStatus'); if (el) el.textContent = t; };
  const run = async () => {
    const file = document.getElementById('assignFile').files[0], typed = document.getElementById('assignText').value;
    let text = typed;
    try { if (file) { status(`Reading ${file.name}…`); text = await fileToText(file); } }
    catch (e) { status(e.message); return; }
    if (!text || text.trim().length < 40) { status('Upload a file or paste the assignment text first.'); return; }
    const multi = parseGroups(text);
    if (multi) { lectMulti = multi; lastAssignment = { out: {}, found: [{ field: 'Groups', value: `${multi.groups.length} groups across ${new Set(multi.groups.map(g => g.op)).size} unit operations`, snippet: 'set out in the table below', ok: true }, ...(multi.groups.some(g => g.members.length) ? [{ field: 'Members', value: `names found for ${multi.groups.filter(g => g.members.length).length} groups`, snippet: '', ok: true }] : [])] }; renderLecturer(); return; }
    lectMulti = null; lastAssignment = parseAssignment(text); applyAssignment(document.getElementById('assignVar').value);
  };
  document.getElementById('assignRead').onclick = run;
  document.getElementById('assignFile').onchange = run;
  document.getElementById('assignVar').onchange = e => { if (lastAssignment) applyAssignment(e.target.value); };
  const drop = document.getElementById('assignDrop');
  ['dragover', 'dragenter'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (!f) return; const dt = new DataTransfer(); dt.items.add(f); document.getElementById('assignFile').files = dt.files; run(); });
}

/* ================= Multi-group sheets ================= */
const OP_NAMES = [[/liquid\s*[-–—]?\s*liquid\s+extraction|\blle\b/i, 'extraction'], [/solid\s*[-–—]?\s*liquid\s+extraction|leaching|\bsle\b/i, 'leaching'], [/\bdr(?:yer|ier|ying)s?\b/i, 'drying'], [/evaporat(?:or|ion)/i, 'evaporation'], [/distillation/i, 'distillation'], [/absor(?:ption|ber)/i, 'absorption']];
const OP_RE = /(liquid\s*[-–—]?\s*liquid\s+extraction|solid\s*[-–—]?\s*liquid\s+extraction(?:\s*\(leaching\))?|leaching|dryer|drier|drying|evaporator|evaporation|distillation|absorption)/i;
const opOf = t => (OP_NAMES.find(([re]) => re.test(t)) || [])[1];
const OP_DEFAULTS = {
  extraction: { q: [5000, 20000, 500], basis: 'mass', c: 'Justify solvent toxicity, flammability and recovery; steam 400 kPa abs; cooling water 30 °C', title: 'Liquid–liquid extraction' },
  leaching: { q: [5000, 20000, 500], basis: 'mass', c: 'Mechanical pressing excluded; solvent must be recovered; residual oil in meal ≤ 0.5 wt%; steam 400 kPa abs; cooling water 30 °C', title: 'Solid–liquid extraction' },
  drying: { q: [200, 1000, 50], basis: 'mass', c: 'Product ≤ 70 °C; final moisture ≤ 12 wt% wet basis; ambient air 30 °C, 80% RH', title: 'Dryer design' },
  evaporation: { q: [5000, 15000, 500], basis: 'mass', c: 'Product ≤ 70 °C (heat-sensitive); saturated steam 300 kPa abs; cooling water 30 °C', title: 'Evaporator design' },
  distillation: { q: [100, 300, 10], basis: 'mole', c: 'Cooling water 30 °C', title: 'Distillation column' },
  absorption: { q: [1000, 5000, 100], basis: 'mole', c: 'Operate near 1 atm', title: 'Gas absorber' }
};
const CASE_PRESETS = [
  { op: 'extraction', re: /phenol/i, name: 'Phenol removal from wastewater', k: 'Phenol', fd: 'Wastewater containing phenol', z: [0.002, 0.006, 0.0005], tg: 99 },
  { op: 'extraction', re: /acetic/i, name: 'Acetic acid recovery', k: 'Acetic acid', fd: 'Aqueous acetic acid stream', z: [0.10, 0.30, 0.01], tg: 95 },
  { op: 'extraction', re: /caffeine|tea/i, name: 'Caffeine extraction from tea', k: 'Caffeine', fd: 'Aqueous tea extract containing caffeine', z: [0.002, 0.005, 0.0005], tg: 95 },
  { op: 'leaching', re: /soy/i, name: 'Soybean oil from flakes', k: 'Oil', fd: 'Conditioned soybean flakes', z: [0.18, 0.21, 0.005], x: 1, y: 0.005, tg: 97 },
  { op: 'leaching', re: /canola|rapeseed/i, name: 'Canola oil from pre-pressed cake', k: 'Oil', fd: 'Pre-pressed canola cake', z: [0.15, 0.20, 0.005], x: 1, y: 0.005, tg: 97 },
  { op: 'drying', re: /jerky|beef|meat/i, name: 'Beef jerky', k: 'Dry solids', fd: 'Marinated beef strips', z: [0.35, 0.60, 0.01], x: 0.88, y: 0, extra: 'jerky needs a lethality step ≥ 71 °C before drying' },
  { op: 'drying', re: /mango/i, name: 'Mango slices', k: 'Dry solids', fd: 'Fresh mango slices', z: [0.35, 0.60, 0.01], x: 0.88, y: 0 },
  { op: 'drying', re: /banana/i, name: 'Banana slices', k: 'Dry solids', fd: 'Fresh banana slices', z: [0.35, 0.60, 0.01], x: 0.88, y: 0 },
  { op: 'drying', re: /fruit/i, name: 'Dried fruit', k: 'Dry solids', fd: 'Fresh fruit slices', z: [0.35, 0.60, 0.01], x: 0.88, y: 0 },
  { op: 'evaporation', re: /milk/i, name: 'Evaporated milk', k: 'Total solids', fd: 'Fresh whole milk', z: [0.12, 0.13, 0.002], x: 0.26, y: 0 },
  { op: 'evaporation', re: /tomato/i, name: 'Tomato paste', k: 'Total solids', fd: 'Tomato juice', z: [0.05, 0.07, 0.002], x: 0.28, y: 0 },
  { op: 'evaporation', re: /soup|mushroom/i, name: 'Condensed mushroom soup', k: 'Total solids', fd: 'Mushroom soup base', z: [0.08, 0.12, 0.005], x: 0.24, y: 0 }
];
const presetFor = (op, name) => CASE_PRESETS.find(p => p.op === op && p.re.test(name || '')) || null;
let lectMulti = null;
function expandGroups(s) { const out = new Set(); s.split(/\s*(?:,|&|\band\b)\s*/).forEach(part => { const m = part.match(/(\d{1,2})\s*(?:[-–]|to)\s*(\d{1,2})/); if (m) { for (let i = Number(m[1]); i <= Number(m[2]); i++) out.add(i); } else if (/^\d{1,2}$/.test(part.trim())) out.add(Number(part)); }); return [...out]; }
function parseGroups(raw) {
  const text = raw.replace(/\r/g, ''), groups = new Map(), segs = [];
  const re = new RegExp(`(?:^|\\n|\\|)\\s*((?:\\d{1,2}\\s*(?:,|&|and|–|-|to)\\s*)+\\d{1,2}|\\d{1,2})\\s*(?:\\||\\t|\\n)?\\s*${OP_RE.source}`, 'gi');
  let m;
  while ((m = re.exec(text))) {
    const nums = expandGroups(m[1]), op = opOf(m[2]); if (!op || !nums.length || nums.some(n => n > 40)) continue;
    const after = text.slice(m.index + m[0].length).split('\n').map(l => l.replace(/^\s*\|\s*|\s*\|\s*$/g, '').trim()).filter(Boolean);
    let caseName = '', members = [];
    const sameLine = text.slice(m.index + m[0].length).split('\n')[0].replace(/^\s*\|?\s*/, '');
    const cells = sameLine.split(/\s*\|\s*|\t/).map(x => x.trim()).filter(Boolean);
    const candidates = cells.length ? cells : after.slice(0, 2);
    if (nums.length === 1) {
      const c0 = candidates[0] || '', c1 = candidates[1] || '';
      if (c0 && c0.length < 90 && !/[–:]/.test(c0) && !/^\d/.test(c0) && !OP_RE.test(c0)) caseName = c0;
      if (c1 && /;/.test(c1)) members = c1.split(';').map(x => x.trim()).filter(x => x && !/^name$/i.test(x));
    }
    nums.forEach(n => { if (!groups.has(n)) groups.set(n, { n, op, caseName, members: [...members] }); });
    segs.push({ op, at: m.index, nums });
  }
  // Member list section (e.g. "GROUP DISTRIBUTION … 1 / name / name …")
  const head = text.search(/group\s+(distribution|nama|members|list)|\bgroup\s+nama\b/i);
  if (head >= 0) {
    let cur = null;
    text.slice(head).split('\n').slice(1).map(l => l.trim()).filter(Boolean).forEach(l => {
      const mm = l.match(/^(\d{1,2})\b\s*(.*)$/);
      if (mm && Number(mm[1]) <= 40) { cur = Number(mm[1]); if (!groups.has(cur)) groups.set(cur, { n: cur, op: '', caseName: '', members: [] }); if (mm[2] && !/^nam/i.test(mm[2])) groups.get(cur).members.push(mm[2].trim()); }
      else if (cur && /^[A-Za-z][A-Za-z.'@\-\s]{1,60}$/.test(l) && !/^(group|nama|name)$/i.test(l)) groups.get(cur).members.push(l);
    });
  }
  // Give groups sharing an operation different cases, in the order the sheet mentions them
  segs.sort((a, b) => a.at - b.at);
  segs.forEach((sg, i) => {
    const segText = text.slice(sg.at, segs[i + 1]?.at ?? sg.at + 900);
    const mentioned = CASE_PRESETS.filter(p => p.op === sg.op && p.re.test(segText)).sort((a, b) => segText.search(a.re) - segText.search(b.re));
    const open = sg.nums.map(n => groups.get(n)).filter(g => g && !g.caseName);
    open.forEach((g, j) => { if (mentioned.length) g.caseName = mentioned[j % mentioned.length].name; });
    const ini = segText.match(/initial[^\n.]*?(\d+(?:\.\d+)?)\s*(?:wt\s*)?%?\s*(?:[-–]|to)\s*(\d+(?:\.\d+)?)\s*(?:wt\s*)?%/i), fin = segText.match(/final[^\n.]*?[<≤]?\s*(\d+(?:\.\d+)?)\s*(?:wt\s*)?%/i);
    sg.override = {}; if (sg.nums.length < 2) return; if (ini) sg.override.z = [Number(ini[1]) / 100, Number(ini[2]) / 100]; if (fin) sg.override.x = Number(fin[1]) / 100;
  });
  const list = [...groups.values()].filter(g => g.op).sort((a, b) => a.n - b.n);
  list.forEach(g => { g.members = [...new Set(g.members)].slice(0, 8); });
  return list.length >= 2 ? { groups: list, segs } : null;
}
function caseSpec(g) {
  const d = OP_DEFAULTS[g.op] || OP_DEFAULTS.evaporation, p = presetFor(g.op, g.caseName) || {};
  const title = `${d.title}: ${g.caseName || 'case to be chosen'}`;
  return { op: g.op, title, fd: p.fd || '', k: p.k || '', basis: d.basis, q: d.q, z: p.z || [0.1, 0.2, 0.01], x: p.x, y: p.y ?? 0, tg: p.tg, c: d.c + (p.extra ? `; ${p.extra}` : ''), preset: Boolean(p.name) };
}
function narrowRange([a, b, s], level) { if (level === 'none') { const mid = (a + b) / 2; return [mid, mid, s]; } if (level === 'small') { const q = (b - a) / 4; return [a + q, b - q, s]; } return [a, b, s]; }
function renderMultiPanel() {
  const M = lectMulti, level = (JSON.parse(sessionStorage.getItem('spectra-lecturer') || 'null') || {}).variation || 'small';
  const opSel = (i, v) => `<select class="imp-input" data-mg="${i}" data-mk="op">${Object.keys(OP_DEFAULTS).map(k => `<option value="${k}" ${k === v ? 'selected' : ''}>${operations[k].name}</option>`).join('')}</select>`;
  const caseSel = (i, g) => { const opts = CASE_PRESETS.filter(p => p.op === g.op).map(p => p.name); return `<input class="imp-input wide" list="cases-${g.op}" data-mg="${i}" data-mk="caseName" value="${esc(g.caseName)}" placeholder="choose or type a case"><datalist id="cases-${g.op}">${opts.map(o => `<option value="${esc(o)}"></option>`).join('')}</datalist>`; };
  const pct = v => `${(v * 100).toFixed(v < 0.01 ? 2 : 1)}%`;
  const rows = M.groups.map((g, i) => { const s = applyOverrides(g, caseSpec(g)); return `<tr><td><strong>${g.n}</strong></td><td>${opSel(i, g.op)}</td><td>${caseSel(i, g)}</td><td><input class="imp-input wide" data-mg="${i}" data-mk="members" value="${esc(g.members.join('; '))}" placeholder="Name; Name; …"></td><td class="muted">${!s.preset ? '<span class="warn-text">no preset: set in the single-case form</span>' : g.op === 'drying' ? `moisture ${pct(1 - s.z[1])}–${pct(1 - s.z[0])} → ≤ ${pct(1 - s.x)}` : `${pct(s.z[0])}–${pct(s.z[1])}${s.x !== undefined && g.op !== 'leaching' && g.op !== 'extraction' ? ` → ${pct(s.x)}` : ''}${s.tg ? ` · target ${s.tg}%` : ''}`}</td></tr>`; }).join('');
  return `<section class="lect-section"><h3>Groups found in your sheet</h3><p class="help">${M.groups.length} groups. Check each operation and case; members fill each group's Design group card. Specification ranges come from SPECTRA's case presets, which match the SPECTRA brief. ${M.segs.some(s => s.override?.z || s.override?.x) ? '<strong>Your sheet also states compositions for some operations: these override the presets.</strong>' : ''}</p><div class="data-table-wrap"><table class="data-table multi-table"><thead><tr><th>GROUP</th><th>OPERATION</th><th>CASE</th><th>MEMBERS</th><th>FEED → PRODUCT</th></tr></thead><tbody>${rows}</tbody></table></div><div class="field-grid" style="margin-top:14px"><div class="field"><label for="mVar">How different should the groups' values be?</label><select id="mVar">${Object.entries(VARIATION).map(([k, v]) => `<option value="${k}" ${k === level ? 'selected' : ''}>${k === 'none' ? 'Same values for groups with the same case' : k === 'small' ? 'Small: middle half of each range' : 'Moderate: the full range'}</option>`).join('')}</select></div><div class="field"><label for="mPass">Marking passphrase</label><input id="mPass" type="password" autocomplete="off" placeholder="keep it private"></div><div class="field"><label for="mTa">Aspen: green within (%)</label><input id="mTa" type="number" value="5"></div><div class="field"><label for="mTr">Amber up to (%)</label><input id="mTr" type="number" value="15"></div></div><button class="primary" id="mGenerate">Generate codes for all ${M.groups.length} groups</button> <button class="ghost" id="mSingle">Use the single-case form instead</button><p class="status-note warn" id="mError"></p><div id="mResults"></div></section>`;
}
function applyOverrides(g, s) { const sg = lectMulti.segs.find(x => x.nums.includes(g.n) && x.op === g.op); if (!sg?.override) return s; const o = { ...s }; if (sg.override.z) o.z = [...sg.override.z, 0.005]; if (sg.override.x !== undefined) o.x = sg.override.x; if (g.op === 'drying' && (sg.override.z || sg.override.x)) { if (o.z[0] > 0.3 && o.z[1] <= 0.8 && sg.override.z) o.z = [1 - sg.override.z[1], 1 - sg.override.z[0], 0.005]; if (sg.override.x !== undefined && sg.override.x < 0.3) o.x = 1 - sg.override.x; } return o; }
async function generateMulti() {
  const err = document.getElementById('mError'), pass = document.getElementById('mPass').value, level = document.getElementById('mVar').value; err.textContent = '';
  if (pass.length < 6) { err.textContent = 'Enter a marking passphrase of at least 6 characters.'; return; }
  const ta = Number(document.getElementById('mTa').value) || 5, tr = Number(document.getElementById('mTr').value) || 15, rows = [];
  for (const g of lectMulti.groups) {
    const s = applyOverrides(g, caseSpec(g)), unit = s.basis === 'mole' ? 'kmol/h' : 'kg/h';
    const zr = narrowRange(s.z, level), qr = narrowRange(s.q, level);
    const z = pickInRange([zr[0], zr[1], s.z[2]]), q = niceRound(pickInRange([qr[0], qr[1], s.q[2]]));
    let x = s.x, y = s.y;
    if (g.op === 'extraction' && s.tg) { x = 1; y = Number((z * (1 - s.tg / 100) / (1 - z * s.tg / 100)).toFixed(6)); }
    if (x === undefined) { err.textContent = `Group ${g.n}: no product specification for “${g.caseName}”. Choose a listed case or use the single-case form.`; return; }
    const pctS = v => `${round(v * 100, v < 0.01 ? 2 : 1)}%`;
    const pt = g.op === 'evaporation' ? `Concentrate from ${pctS(z)} to ${pctS(x)} total solids (mass basis); product ≤ 70 °C`
      : g.op === 'drying' ? `Dry from ${pctS(1 - z)} to ≤ ${pctS(1 - x)} moisture (wet basis); enter dry-solids fractions ${round(z, 3)} → ${round(x, 3)}`
      : g.op === 'leaching' ? `Recover at least ${s.tg}% of the oil from a feed containing ${pctS(z)} oil; residual oil in meal ≤ ${pctS(y)}`
      : g.op === 'extraction' ? `Extract at least ${s.tg}% of the ${s.k.toLowerCase()} from a feed containing ${pctS(z)}`
      : `Feed ${pctS(z)}; product ${pctS(x)}`;
    const payload = { g: `G${String(g.n).padStart(2, '0')}`, gn: `Group ${g.n}`, o: g.op, t: s.title, fd: s.fd, k: s.k, pt, c: s.c, q, u: unit, b: s.basis, z, x, y, ta, tr, ...(s.tg ? { tg: s.tg } : {}), ...(g.members.length ? { m: g.members } : {}) };
    const P = q * (z - y) / (x - y);
    rows.push({ g: payload.g, n: g.n, op: operations[g.op].name, caseName: g.caseName, q, z, x, y, P, R: q - P, code: await makeBriefCode(payload, pass), unit });
  }
  lecturerRows = rows;
  const tsv = ['Group\tOperation\tCase\tThroughput\tz\tx\ty\tExpected P\tExpected R\tBrief code', ...rows.map(r => [r.g, r.op, r.caseName, `${r.q} ${r.unit}`, r.z, r.x, r.y, r.P.toFixed(2), r.R.toFixed(2), r.code].join('\t'))].join('\n');
  document.getElementById('mResults').innerHTML = `<div class="data-table-wrap" style="margin-top:14px"><table class="data-table"><thead><tr><th>GROUP</th><th>CASE</th><th>THROUGHPUT</th><th>z</th><th>x</th><th>y</th><th>EXPECTED P</th><th>EXPECTED R</th><th>CODE</th></tr></thead><tbody>${rows.map((r, i) => `<tr><td><strong>${r.g}</strong></td><td>${esc(r.caseName)}</td><td class="num">${r.q} ${r.unit}</td><td class="num">${r.z}</td><td class="num">${r.x}</td><td class="num">${r.y}</td><td class="num">${r.P.toFixed(2)}</td><td class="num">${r.R.toFixed(2)}</td><td><button class="mini-btn" data-copy-code="${i}">Copy code</button></td></tr>`).join('')}</tbody></table></div><p class="help">Keep this marking key with your passphrase.</p><textarea class="lect-tsv" readonly rows="6">${esc(tsv)}</textarea><div class="import-buttons"><button class="ghost" id="mCopyAll">Copy all for Excel</button></div>`;
  const copy = (text, btn) => { const done = () => { const t = btn.textContent; btn.textContent = 'Copied'; setTimeout(() => btn.textContent = t, 1200); }; navigator.clipboard?.writeText(text).then(done, () => prompt('Copy this:', text)); };
  document.querySelectorAll('[data-copy-code]').forEach(b => b.onclick = () => copy(lecturerRows[Number(b.dataset.copyCode)].code, b));
  document.getElementById('mCopyAll').onclick = e => copy(tsv, e.target);
}
function bindMulti() {
  if (!document.getElementById('mGenerate')) return;
  document.querySelectorAll('[data-mg]').forEach(el => el.onchange = () => { const g = lectMulti.groups[Number(el.dataset.mg)], k = el.dataset.mk; g[k] = k === 'members' ? el.value.split(';').map(x => x.trim()).filter(Boolean) : el.value; if (k === 'op') g.caseName = ''; renderLecturer(); });
  document.getElementById('mGenerate').onclick = generateMulti;
  document.getElementById('mSingle').onclick = () => { lectMulti = null; renderLecturer(); };
  document.getElementById('mVar').onchange = e => { const d = JSON.parse(sessionStorage.getItem('spectra-lecturer') || 'null') || lecturerDefaults(); d.variation = e.target.value; sessionStorage.setItem('spectra-lecturer', JSON.stringify(d)); };
}
