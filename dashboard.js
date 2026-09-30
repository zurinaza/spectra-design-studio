/* SPECTRA class dashboard
   The lecturer drops in the groups' project files and sees, in one table, each group's progress through the
   gates, whether its brief code is genuine and still matches, its balance against the brief, evidence,
   Aspen cross-check, HAZOP and mechanical design. Files are read on a temporary copy; nothing is saved.
   Loaded before app.js. */

let dashRows = [];
async function readDashboardFiles(files, pass) {
  const keep = state, rows = [];
  try {
    for (const file of files) {
      let data;
      try { data = JSON.parse(await file.text()); if (!data?.operation || !operations[data.operation]) throw new Error(); }
      catch { rows.push({ file: file.name, error: 'Not a SPECTRA project file' }); continue; }
      try {
        state = hydrateState(data);
        const g = state.group || {}, br = state.brief, b = balance(), u = basisUnits();
        const gates = phases.map((_, i) => phaseReady(i)), passed = gates.filter(Boolean).length;
        let genuine = null; if (br && pass) { const pc = parseBriefCode(br.code); genuine = !pc.error && (await signTag(pass, pc.body)) === pc.tag; }
        let expected = null, diff = null;
        if (br?.p && Number.isFinite(br.p.q)) { const p = br.p; expected = p.q * (p.z - p.y) / (p.x - p.y); if (b?.valid) diff = (b.P - expected) / expected * 100; }
        const entries = state.dataEntries || [], verified = entries.filter(e => e.status === 'Verified' && !e.imported).length;
        const cc = crossCheckIssues(), hz = hazopIssues(), mech = mechIssues();
        rows.push({ file: file.name, group: g.name || '—', members: (g.members || []).filter(m => m.name).length, op: operations[state.operation].name, title: state.projectTitle || '', brief: br?.p?.g || '', genuine, match: br ? briefValuesMatch() : null, passed, stage: phases[state.phase]?.name || '', P: b?.valid ? b.P : null, expected, diff, unit: u.flow, entries: entries.length, verified, missing: missingRequired().length, aspen: cc.length === 0, aspenTodo: cc.length, hazop: hz.length === 0, mech: mech.length === 0, saved: data.savedAt || data.lastFileSave || '' });
      } catch (e) { rows.push({ file: file.name, error: `Could not evaluate: ${e.message}` }); }
    }
  } finally { state = keep; }
  return rows.sort((a, b) => String(a.group).localeCompare(String(b.group), undefined, { numeric: true }));
}
function renderDashboardTable(rows) {
  const tick = v => v === null ? '<span class="muted">—</span>' : v ? '<span class="agree green">✓</span>' : '<span class="agree red">×</span>';
  const body = rows.map(r => r.error ? `<tr><td colspan="11"><strong>${esc(r.file)}</strong>: ${esc(r.error)}</td></tr>` : `<tr><td><strong>${esc(r.group)}</strong><small>${r.members} members</small></td><td>${esc(r.op)}<small>${esc(r.title)}</small></td><td>${r.brief ? `${esc(r.brief)}<small>${r.genuine === null ? 'enter passphrase to verify' : r.genuine ? 'genuine' : '<span class="warn-text">not genuine</span>'}${r.match === false ? ' · <span class="warn-text">values changed</span>' : ''}</small>` : '<span class="muted">no brief</span>'}</td><td><strong>${r.passed}/7</strong><small>at ${esc(r.stage)}</small></td><td class="num">${r.P === null ? '—' : r.P.toFixed(1)}${r.diff !== null ? `<small class="${Math.abs(r.diff) > 1 ? 'warn-text' : ''}">${r.diff >= 0 ? '+' : ''}${r.diff.toFixed(1)}% vs key</small>` : ''}</td><td class="num">${r.verified}/${r.entries}<small>${r.missing ? `${r.missing} required missing` : 'checklist complete'}</small></td><td>${tick(r.aspen)}${r.aspen ? '' : `<small>${r.aspenTodo} to do</small>`}</td><td>${tick(r.hazop)}</td><td>${tick(r.mech)}</td><td><small>${r.saved ? new Date(r.saved).toLocaleString('en-MY', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</small></td></tr>`).join('');
  return `<div class="data-table-wrap" style="margin-top:12px"><table class="data-table dash-table"><thead><tr><th>GROUP</th><th>CASE</th><th>BRIEF</th><th>GATES</th><th>PRODUCT P</th><th>DATA VERIFIED</th><th>ASPEN</th><th>HAZOP</th><th>MECH.</th><th>SAVED</th></tr></thead><tbody>${body}</tbody></table></div><div class="import-buttons" style="margin-top:8px"><button class="ghost" id="dashCopy">Copy table for Excel</button></div>`;
}
function renderDashboardSection() {
  return `<section class="lect-section"><h3>Class dashboard</h3><p class="help">Collect each group's project file (they use <strong>Save file</strong>) and drop them all here. Add your passphrase to check that every brief code is genuine. Nothing is uploaded or saved.</p><div class="assign-inputs"><label class="drop-zone" id="dashDrop"><input type="file" id="dashFiles" accept=".json" multiple><span>Drop all project files here or <u>choose files</u></span></label><div class="field"><label for="dashPass">Marking passphrase (optional)</label><input id="dashPass" type="password" autocomplete="off"></div></div><div id="dashResults"></div></section>`;
}
function bindDashboard() {
  const input = document.getElementById('dashFiles'); if (!input) return;
  const run = async files => { if (!files?.length) return; const host = document.getElementById('dashResults'); host.innerHTML = '<p class="help">Reading files…</p>'; dashRows = await readDashboardFiles([...files], document.getElementById('dashPass').value); host.innerHTML = renderDashboardTable(dashRows);
    document.getElementById('dashCopy').onclick = e => { const tsv = ['Group\tMembers\tOperation\tCase\tBrief\tGenuine\tValues match\tGates passed\tStage\tProduct P\tDiff vs key (%)\tVerified data\tData items\tAspen done\tHAZOP done\tMechanical done\tSaved', ...dashRows.filter(r => !r.error).map(r => [r.group, r.members, r.op, r.title, r.brief, r.genuine, r.match, r.passed, r.stage, r.P?.toFixed(2) ?? '', r.diff?.toFixed(1) ?? '', r.verified, r.entries, r.aspen, r.hazop, r.mech, r.saved].join('\t'))].join('\n'); navigator.clipboard?.writeText(tsv).then(() => { e.target.textContent = 'Copied'; setTimeout(() => e.target.textContent = 'Copy table for Excel', 1200); }, () => prompt('Copy this:', tsv)); }; };
  input.onchange = () => run(input.files);
  bindDropZone(document.getElementById('dashDrop'), e => run(e.dataTransfer.files));
}
