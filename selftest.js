/* SPECTRA model self-test
   Re-runs the textbook validation cases and smoke tests in the lecturer's own browser, so the models can
   be confirmed after any update. Runs on a temporary copy of the project; the lecturer's work is untouched.
   Loaded before app.js. */

async function runSelfTests() {
  const keep = state, out = [];
  const within = (got, want, tol, rel = true) => Number.isFinite(got) && Math.abs(got - want) <= (rel ? Math.abs(want) * tol : tol);
  const add = (group, name, got, want, tol, rel = true, unit = '') => out.push({ group, name, got, want, tol, rel, unit, pass: within(got, want, tol, rel) });
  const ok = (group, name, pass, detail = '') => out.push({ group, name, pass: Boolean(pass), detail });
  const fresh = patch => { state = hydrateState({ ...createDefaults(), ...patch }); return state; };
  try {
    add('Properties', 'Water vapour pressure at 100 °C', water.psat(100), 101.325, 0.005, true, 'kPa');
    add('Properties', 'Latent heat of water at 100 °C', water.latent(100), 2257, 0.002, true, 'kJ/kg');
    Object.entries(COMPONENTS).filter(([, c]) => c.ant).forEach(([id, c]) => add('Properties', `${c.name}: normal boiling point from Antoine`, tsatC(id, 101.325), c.tb, 0.5, false, '°C'));
    fresh({ operation: 'distillation', basis: 'mole', flowUnit: 'kmol/h', throughput: 100, F: 100, z: 0.5, x: 0.95, y: 0.05 });
    const f = distillationFUG({ relativeVolatility: 2.5, refluxFactor: 1.3 });
    add('Distillation', 'Fenske minimum stages (textbook 6.43)', f.Nmin, 6.43, 0.01);
    add('Distillation', 'Underwood minimum reflux (textbook 1.10)', f.Rmin, 1.10, 0.01);
    const me = multiEffect({}, { mb: { F: 22680, z: 0.10, x: 0.50 }, N: 3, Ts: 121.1, TN: 51.67 + 2.445, TF: 26.7, cpFn: x => 4.19 - 2.35 * x, U: [3.123, 1.987, 1.136], bprFn: x => 1.78 * x + 6.22 * x * x });
    add('Evaporation', 'Geankoplis 8.5-1: steam (textbook 8,936 kg/h)', me.S, 8936, 0.03, true, 'kg/h');
    add('Evaporation', 'Geankoplis 8.5-1: area per effect (textbook 104.9 m²)', me.Am, 104.9, 0.03, true, 'm²');
    const T = 65.6, H = 0.010, Tw = PSY.wetBulb(T, H), G = (1 + H) / PSY.vH(H, T) * 6.1 * 3600, Rc = 0.0204 * Math.pow(G, 0.8) * (T - Tw) * 3600 / (water.latent(Tw) * 1000);
    add('Drying', 'Geankoplis 9.6-1: wet-bulb temperature (textbook 28.9 °C)', Tw, 28.9, 0.5, false, '°C');
    add('Drying', 'Geankoplis 9.6-1: constant drying rate (textbook 3.39)', Rc, 3.39, 0.03, true, 'kg/m² h');
    fresh({ operation: 'absorption', sizing: { values: { ntu: 5 }, result: { value: 1, unit: 'm', label: 'x' } } });
    add('Absorption', 'Colburn: NOG = 5, A = 2 gives 95.72% removal', absorptionModel({ lgRatio: 2 / 0.9, targetRemoval: 90 }).removal, 95.72, 0.002, true, '%');
    fresh({ operation: 'extraction', configuration: 'Counter-current multistage' });
    add('Extraction', 'Kremser: E = 1.25, 5 ideal stages gives 91.12%', extractionModel({ distributionK: 1.25, phaseRatio: 1, stages: 5, stageEfficiency: 100, targetExtraction: 90 }).extraction, 91.12, 0.002, true, '%');
    fresh({ operation: 'leaching', configuration: 'Counter-current' });
    add('Leaching', 'Stage balance: S = 4, r = 0.8, 3 stages gives 98.82%', leachingModel({ solventRatio: 4, retention: 0.8, stages: 3, rateConstant: 50, contactTime: 10, targetRecovery: 90 }).equilibrium, 98.82, 0.001, true, '%');
    fresh({ operation: 'evaporation', mech: { D: 1, L: 1, Pop: 101.325 + 1000 / 1.1, T: 50, mat: 'ss304', E: 1 } });
    add('Mechanical', 'Shell thickness at 1 MPa, Di 1 m (3.64 mm)', mechCalc().tShell, 3.639, 0.005, true, 'mm');
    const code = await makeBriefCode({ g: 'T01', o: 'evaporation', q: 1000, z: 0.1, x: 0.5, y: 0 }, 'test-passphrase'), parsed = parseBriefCode(code);
    ok('Brief codes', 'Code reads back with its values', !parsed.error && parsed.p.q === 1000);
    ok('Brief codes', 'Correct passphrase verifies', (await signTag('test-passphrase', parsed.body)) === parsed.tag);
    ok('Brief codes', 'Wrong passphrase is rejected', (await signTag('wrong-passphrase', parsed.body)) !== parsed.tag);
    ok('Brief codes', 'A mistyped code is caught', Boolean(parseBriefCode(code.slice(0, -1) + (code.endsWith('a') ? 'b' : 'a')).error));
    const one = parseAssignment('Design of an evaporator to concentrate juice\nThe plant capacity is 5 tonnes per hour of juice. Concentrate the juice from 12 wt% to 55 wt% sucrose.').out;
    ok('Assignment reader', 'Single case: 5 t/h, 12 → 55 wt%', one.op === 'evaporation' && one.q === 5000 && one.z === 0.12 && one.x === 0.55, JSON.stringify({ op: one.op, q: one.q, z: one.z, x: one.x }));
    const table = ['| Group | Unit operation | Case | Members |', ...[['Liquid–liquid extraction', 'Phenol removal'], ['Liquid–liquid extraction', 'Acetic acid recovery'], ['Drying', 'Beef jerky'], ['Evaporation', 'Evaporated milk']].map(([o, c], i) => `| ${i + 1} | ${o} | ${c} | A; B |`)].join('\n');
    const multi = parseGroups(table);
    ok('Assignment reader', 'Group table: four groups with their cases and members', multi?.groups.length === 4 && multi.groups[3].caseName === 'Evaporated milk' && multi.groups[0].members.length === 2);
    for (const op of Object.keys(operations)) {
      try {
        fresh({ operation: op }); syncSelection(true);
        Object.assign(state, op === 'distillation' ? { z: 0.5, x: 0.95, y: 0.05 } : op === 'drying' ? { z: 0.45, x: 0.88, y: 0 } : op === 'absorption' ? { z: 0.05, x: 0.001, y: 1 } : { z: 0.1, x: 0.4, y: 0 });
        state.sizing = { values: { ntu: 5, dt: 28, u: 1.5 }, result: { value: 10, unit: 'm²', label: 'x' } };
        const svg = renderPFD(false), sim = runOperationSimulation(), rows = pfdStreamRows(), hv = handValues();
        ok('Smoke tests', `${operations[op].name}: PFD, simulator, stream table and cross-check`, svg.length > 1000 && sim.checks.length > 0 && rows.length > 3 && hv.length > 0);
      } catch (e) { ok('Smoke tests', `${operations[op].name}: PFD, simulator, stream table and cross-check`, false, e.message); }
    }
  } catch (e) { ok('Self-test', 'Test run completed', false, e.message); }
  finally { state = keep; }
  return out;
}
async function renderSelfTest() {
  const host = document.getElementById('selfTestResults'); host.innerHTML = '<p class="help">Running…</p>';
  const rows = await runSelfTests(), fails = rows.filter(r => !r.pass);
  const val = r => r.want !== undefined ? `${Number.isFinite(r.got) ? Number(r.got).toFixed(3) : '—'} ${r.unit} (expected ${r.want} ± ${r.rel ? `${r.tol * 100}%` : `${r.tol} ${r.unit}`})` : esc(r.detail || '');
  host.innerHTML = `<div class="diagnostic ${fails.length ? 'fail' : 'pass'}"><b>${fails.length ? '×' : '✓'}</b><div><strong>${fails.length ? `${fails.length} of ${rows.length} checks failed` : `All ${rows.length} checks passed`}</strong><span>${fails.length ? 'Send the failed rows to whoever maintains SPECTRA before using this version in class.' : 'The models reproduce the textbook cases and every operation runs end to end.'}</span></div></div><div class="data-table-wrap" style="margin-top:10px"><table class="data-table selftest-table"><thead><tr><th></th><th>AREA</th><th>CHECK</th><th>RESULT</th></tr></thead><tbody>${rows.map(r => `<tr class="${r.pass ? '' : 'red'}"><td>${r.pass ? '✓' : '×'}</td><td>${esc(r.group)}</td><td>${esc(r.name)}</td><td class="muted">${val(r)}</td></tr>`).join('')}</tbody></table></div>`;
}
