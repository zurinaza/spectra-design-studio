const phases = [
  { key: 'S', name: 'Scope', sub: 'Define the design problem', color: 'blue' },
  { key: 'P', name: 'Pick', sub: 'Select equipment and mode', color: 'pink' },
  { key: 'E', name: 'Establish', sub: 'Build the evidence base', color: 'cyan' },
  { key: 'C', name: 'Calculate', sub: 'Balance and size', color: 'yellow' },
  { key: 'T', name: 'Test', sub: 'Run the design simulator', color: 'purple' },
  { key: 'R', name: 'Review', sub: 'Check economics and risk', color: 'green' },
  { key: 'A', name: 'Argue & archive', sub: 'Draw and defend the design', color: 'red' }
];

const operations = {
  evaporation: {
    name: 'Evaporation', icon: 'EV', mechanism: 'Remove a volatile solvent by boiling to concentrate a non-volatile solute.',
    driver: 'Temperature and vapour-pressure difference', size: 'heat-transfer area', formula: 'A = Q / (U ΔT)',
    equipment: [
      { id: 'falling_film', label: 'Falling-film evaporator', fit: 'Heat-sensitive, low-viscosity feeds', design: 'Film distribution, residence time and tube wetting' },
      { id: 'forced_circulation', label: 'Forced-circulation evaporator', fit: 'Viscous, scaling or crystallising feeds', design: 'Circulation rate, pump duty and separator volume' },
      { id: 'rising_film', label: 'Rising-film evaporator', fit: 'Low-viscosity, non-fouling feeds', design: 'Tube length, vapour lift and disengagement' },
      { id: 'agitated_film', label: 'Agitated thin-film evaporator', fit: 'Very viscous or strongly heat-sensitive feeds', design: 'Rotor clearance, film thickness and power' }
    ],
    modes: ['Single effect', 'Multiple effect'], configurations: ['Atmospheric', 'Vacuum'],
    inputs: [['duty', 'Heat duty', 'kW', 350], ['u', 'Overall U', 'kW m⁻² K⁻¹', 1.5], ['dt', 'Effective ΔT', 'K', 28]],
    calc: v => ({ value: v.duty / (v.u * v.dt), unit: 'm²', label: 'Required heat-transfer area' }),
    simControls: [['operatingTemp', 'Operating temperature', '°C', 35, 140, 1, 75], ['foulingFactor', 'Available U / clean U', 'fraction', 0.35, 1, 0.05, 0.8], ['capacityPercent', 'Operating load', '% design capacity', 50, 125, 5, 90]]
  },
  drying: {
    name: 'Drying', icon: 'DR', mechanism: 'Transfer moisture from a wet solid or droplet to an unsaturated gas by coupled heat and mass transfer.',
    driver: 'Moisture and temperature driving forces', size: 'drying area', formula: 'A = ṁwater / N̄',
    equipment: [
      { id: 'tray', label: 'Tray dryer', fit: 'Flexible small-scale batch production', design: 'Tray loading, drying time and air distribution' },
      { id: 'rotary', label: 'Rotary dryer', fit: 'Robust free-flowing granular solids', design: 'Residence time, flight design and gas velocity' },
      { id: 'fluidised_bed', label: 'Fluidised-bed dryer', fit: 'Uniform particles needing intense transfer', design: 'Fluidisation velocity, bed depth and pressure drop' },
      { id: 'spray', label: 'Spray dryer', fit: 'Solutions or slurries converted to powder', design: 'Atomisation, chamber diameter and droplet residence time' },
      { id: 'freeze', label: 'Freeze dryer', fit: 'High-value, highly heat-sensitive products', design: 'Freezing, sublimation area and vacuum duty' },
      { id: 'belt', label: 'Belt dryer', fit: 'Continuous fragile solids or pastes', design: 'Belt area, bed depth and zoning' }
    ],
    modes: ['Batch', 'Continuous'], configurations: ['Direct-contact', 'Indirect-contact', 'Vacuum'],
    inputs: [['water', 'Water removed', 'kg h⁻¹', 120], ['rate', 'Average drying rate', 'kg m⁻² h⁻¹', 2.4]],
    calc: v => ({ value: v.water / v.rate, unit: 'm²', label: 'Required drying area' }),
    simControls: [['productTemp', 'Estimated product temperature', '°C', -20, 140, 1, 65], ['finalMoisture', 'Final moisture', 'wt%', 0.2, 30, 0.2, 5], ['residenceTime', 'Residence time', 'h', 0.05, 12, 0.05, 1.5]]
  },
  distillation: {
    name: 'Distillation', icon: 'DC', mechanism: 'Repeated vapour–liquid contacting enriches components according to differences in volatility.',
    driver: 'Vapour–liquid equilibrium', size: 'column diameter', formula: 'D = √(4 V̇ / π udesign)',
    equipment: [
      { id: 'tray', label: 'Tray column', fit: 'Wide operating range and larger diameters', design: 'Tray spacing, weir loading, entrainment and downcomers' },
      { id: 'packed', label: 'Packed column', fit: 'Low pressure drop, vacuum or corrosive service', design: 'Packing type, HETP, flooding and distributors' },
      { id: 'batch_still', label: 'Batch still', fit: 'Small campaigns or changing product grades', design: 'Charge, reflux policy and batch time' }
    ],
    modes: ['Continuous', 'Batch'], configurations: ['Atmospheric', 'Vacuum', 'Pressurised'],
    inputs: [['vapour', 'Vapour flow', 'm³ s⁻¹', 2.1], ['velocity', 'Flooding velocity', 'm s⁻¹', 1.8], ['fraction', 'Design / flooding', 'fraction', 0.75]],
    calc: v => ({ value: Math.sqrt(4 * v.vapour / (Math.PI * v.velocity * v.fraction)), unit: 'm', label: 'Preliminary column diameter' }),
    simControls: [['floodFraction', 'Operating / flooding velocity', 'fraction', 0.35, 1.05, 0.01, 0.75], ['relativeVolatility', 'Relative volatility', '—', 1.01, 8, 0.01, 2.2], ['stages', 'Theoretical stages', '—', 2, 80, 1, 18]]
  },
  absorption: {
    name: 'Absorption', icon: 'AC', mechanism: 'A soluble gas component transfers into a liquid solvent across a gas–liquid interface.',
    driver: 'Difference from gas–liquid equilibrium', size: 'packed or tray height', formula: 'Z = HTU × NTU',
    equipment: [
      { id: 'packed', label: 'Packed absorber', fit: 'Low pressure drop and corrosive service', design: 'Packing, distributors, flooding and wetting' },
      { id: 'tray', label: 'Tray absorber', fit: 'Large diameter and wider liquid-load variation', design: 'Tray efficiency, spacing and downcomers' },
      { id: 'spray', label: 'Spray tower', fit: 'Dirty gases and low pressure-drop duty', design: 'Droplet size, contact time and entrainment' },
      { id: 'bubble', label: 'Bubble column', fit: 'High liquid holdup or reactive absorption', design: 'Gas dispersion, holdup and backmixing' }
    ],
    modes: ['Counter-current', 'Co-current'], configurations: ['Continuous', 'Semi-batch solvent'],
    inputs: [['htu', 'HTU', 'm', 0.75], ['ntu', 'NTU', '—', 5.2]],
    calc: v => ({ value: v.htu * v.ntu, unit: 'm', label: 'Required contact height' }),
    simControls: [['lgRatio', 'Liquid / minimum liquid rate', 'ratio', 0.8, 3, 0.05, 1.5], ['pressureDrop', 'Pressure drop', 'kPa m⁻¹', 0.05, 2.5, 0.05, 0.45], ['removal', 'Predicted solute removal', '%', 20, 99.9, 0.5, 92]]
  },
  extraction: {
    name: 'Liquid–liquid extraction', icon: 'LX', mechanism: 'A solute distributes between two largely immiscible liquid phases.',
    driver: 'Distribution equilibrium', size: 'mixer or contactor volume', formula: 'V = Qtotal × tres',
    equipment: [
      { id: 'mixer_settler', label: 'Mixer–settler', fit: 'Flexible staged contacting and clear phase separation', design: 'Mixing power, residence time and settler area' },
      { id: 'packed', label: 'Packed extraction column', fit: 'Low-shear continuous service', design: 'Droplet size, flooding and axial mixing' },
      { id: 'pulsed', label: 'Pulsed column', fit: 'Enhanced mass transfer with low mechanical complexity', design: 'Pulse intensity, plate spacing and flooding' },
      { id: 'rotating_disc', label: 'Rotating-disc contactor', fit: 'Controllable dispersion for difficult systems', design: 'Rotor speed, compartment height and holdup' },
      { id: 'centrifugal', label: 'Centrifugal extractor', fit: 'Short residence time and fast phase separation', design: 'Rotor speed, throughput and seal limits' }
    ],
    modes: ['Batch', 'Continuous'], configurations: ['Single stage', 'Cross-current multistage', 'Counter-current multistage'],
    inputs: [['flow', 'Total liquid flow', 'm³ h⁻¹', 18], ['residence', 'Mixing time', 'min', 4]],
    calc: v => ({ value: v.flow * v.residence / 60, unit: 'm³', label: 'Mixer working volume' }),
    simControls: [['phaseRatio', 'Solvent / feed ratio', 'ratio', 0.1, 6, 0.05, 1.2], ['mixingTime', 'Mixing/contact time', 'min', 0.2, 30, 0.2, 4], ['stageEfficiency', 'Stage efficiency', '%', 20, 100, 1, 78]]
  },
  leaching: {
    name: 'Leaching', icon: 'LE', mechanism: 'A soluble component moves from a porous solid into a contacting liquid solvent.',
    driver: 'Concentration difference and internal diffusion', size: 'contactor volume', formula: 'V = Msolid / Cslurry',
    equipment: [
      { id: 'agitated', label: 'Agitated leaching vessel', fit: 'Batch testing and fine-particle slurries', design: 'Solids loading, agitation, contact time and filtration' },
      { id: 'percolator', label: 'Percolation extractor', fit: 'Coarse porous solids with acceptable permeability', design: 'Bed depth, channeling and solvent distribution' },
      { id: 'fixed_bed', label: 'Fixed-bed leacher', fit: 'Stationary solids and clear solvent flow', design: 'Pressure drop, breakthrough and washing' },
      { id: 'continuous', label: 'Continuous moving-bed extractor', fit: 'Large-throughput staged counter-current duty', design: 'Solids conveying, stage efficiency and solvent retention' }
    ],
    modes: ['Batch', 'Continuous'], configurations: ['Single stage', 'Cross-current', 'Counter-current'],
    inputs: [['solid', 'Dry solid feed', 'kg batch⁻¹', 800], ['loading', 'Allowable slurry loading', 'kg m⁻³', 160]],
    calc: v => ({ value: v.solid / v.loading, unit: 'm³', label: 'Minimum working volume' }),
    simControls: [['solventRatio', 'Solvent / dry-solid ratio', 'kg kg⁻¹', 0.5, 12, 0.1, 4], ['contactTime', 'Contact time', 'h', 0.1, 24, 0.1, 3], ['recovery', 'Predicted solute recovery', '%', 10, 99.9, 0.5, 86]]
  }
};

const economicDefaults = { purchaseCost: 180000, installFactor: 2.2, annualHours: 6000, electricityUse: 35, electricityPrice: 0.45, thermalUse: 120, thermalPrice: 0.12, labour: 60000, maintenancePct: 4, consumables: 25000, annualBenefit: 340000, discountRate: 8, projectLife: 8, costYear: new Date().getFullYear() };

function baseDiagram() { return { type: 'BFD', feedLabel: 'Feed', unitTag: 'SEP-101', productLabel: 'Main product', byproductLabel: 'Separated stream', includePump: true, includeHeater: false, includeUtility: false, includeRecycle: false, positions: {} }; }
function createDefaults() {
  return { spectraVersion: 1, phase: 0, operation: 'evaporation', equipment: 'falling_film', mode: 'Single effect', configuration: 'Vacuum', selectionRationale: '', projectTitle: 'Concentrate a heat-sensitive aqueous feed', feedDescription: 'Aqueous solution containing a non-volatile solute', throughput: 1000, flowUnit: 'kg/h', targetComponent: 'Non-volatile solute', productTarget: 'Increase solute from 10 to 40 wt%', constraints: 'Use saturated steam; minimise thermal exposure', basis: '1 hour of operation', assumptions: ['steady', 'nonvolatile'], dataEntries: [], showDataQuality: false, F: 1000, z: 0.10, x: 0.40, y: 0, cp: 4.0, dTfeed: 55, latent: 2257, sizing: {}, sensitivity: 110, simValues: {}, simulation: null, economics: { values: { ...economicDefaults }, result: null }, checks: { units: false, balance: false, range: false, safety: false, operability: false }, decision: '', reflection: '', diagram: baseDiagram() };
}
function readSavedState() { try { return JSON.parse(localStorage.getItem('uds-project') || '{}'); } catch { return {}; } }
const stored = readSavedState();
const hadSavedProject = Object.keys(stored).length > 0;
const defaults = createDefaults();
let state = { ...defaults, ...stored, checks: { ...defaults.checks, ...(stored.checks || {}) }, sizing: stored.sizing || {}, simValues: stored.simValues || {}, economics: { values: { ...economicDefaults, ...(stored.economics?.values || {}) }, result: stored.economics?.result || null }, diagram: { ...baseDiagram(), ...(stored.diagram || {}), positions: { ...(stored.diagram?.positions || {}) } }, assumptions: stored.assumptions || [...defaults.assumptions], dataEntries: stored.dataEntries || [] };
if (!stored.spectraVersion) { const oldMap = [0, 2, 3, 3, 4, 6]; state.phase = oldMap[Math.min(5, Number(stored.phase) || 0)]; state.spectraVersion = 1; }

function esc(value = '') { return String(value).replace(/[&<>\"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' })[char]); }
function save() { localStorage.setItem('uds-project', JSON.stringify(state)); renderNotebook(); renderProgress(); refreshGate(); }
function syncSelection(reset = false) {
  const operation = operations[state.operation];
  if (reset || !operation.equipment.some(item => item.id === state.equipment)) state.equipment = operation.equipment[0].id;
  if (reset || !operation.modes.includes(state.mode)) state.mode = operation.modes[0];
  if (reset || !operation.configurations.includes(state.configuration)) state.configuration = operation.configurations[0];
  if (reset) { state.sizing = {}; state.simValues = {}; state.simulation = null; state.diagram.unitTag = `${operation.icon}-101`; state.selectionRationale = ''; }
}
syncSelection();
function selectedEquipment() { const operation = operations[state.operation]; return operation.equipment.find(item => item.id === state.equipment) || operation.equipment[0]; }

function balance() {
  const { F, z, x, y } = state, denominator = x - y;
  if (!F || !Number.isFinite(denominator) || Math.abs(denominator) < 1e-9) return null;
  const P = F * (z - y) / denominator, R = F - P, closure = (P + R - F) / F * 100;
  return { P, R, closure, valid: P >= 0 && R >= 0 && [z, x, y].every(v => v >= 0 && v <= 1) };
}
function energy() { const b = balance(); if (!b?.valid) return null; const qSens = state.F * state.cp * state.dTfeed / 3600, qLat = b.R * state.latent / 3600; return { qSens, qLat, total: qSens + qLat }; }
function dataIssues(entries = state.dataEntries) {
  const issues = [];
  if (!entries.length) return ['Add at least one project-specific data item, method or correlation.'];
  entries.forEach((entry, index) => {
    const label = `Item ${index + 1} (${entry.name || 'unnamed'})`;
    if (/\d/.test(entry.value || '') && !entry.unit?.trim()) issues.push(`${label}: add a unit or state that the value is dimensionless.`);
    if (!entry.conditions?.trim()) issues.push(`${label}: state the temperature, pressure, composition or equipment conditions.`);
    if (!entry.reference?.trim() || entry.reference.trim().length < 12) issues.push(`${label}: provide a traceable reference.`);
    if (entry.sourceType === 'Peer-reviewed journal' && !/(doi|https?:\/\/|journal|vol\.?)/i.test(entry.reference || '')) issues.push(`${label}: add a DOI, URL or complete journal citation.`);
    if (entry.sourceType === 'Engineering assumption' && entry.status !== 'Assumed') issues.push(`${label}: mark an engineering assumption as “Assumed”.`);
    if (entry.status === 'Verified' && (entry.applicability || '').trim().length < 15) issues.push(`${label}: explain why the source applies to this system and range.`);
  });
  return issues;
}

function simDefaults() { const values = {}; operations[state.operation].simControls.forEach(([id, , , , , , value]) => values[id] = value); return values; }
function currentSimValues() { return { ...simDefaults(), ...(state.simValues || {}) }; }
function simulationFingerprint(values = currentSimValues()) { return JSON.stringify({ operation: state.operation, equipment: state.equipment, mode: state.mode, configuration: state.configuration, sizing: state.sizing, values }); }
function runOperationSimulation(values = currentSimValues()) {
  const result = state.sizing?.result, checks = [], outputs = [];
  const critical = (pass, label, detail) => checks.push({ pass, severity: 'critical', label, detail });
  const warning = (pass, label, detail) => checks.push({ pass, severity: 'warning', label, detail });
  critical(Boolean(result && Number(result.value) > 0), 'Preliminary size available', 'Complete the balance and sizing calculation first.');
  if (state.operation === 'evaporation') {
    const adjustedArea = result ? result.value / Math.max(values.foulingFactor, 0.01) * values.capacityPercent / 100 : 0;
    outputs.push(['Adjusted area', adjustedArea, 'm²'], ['Operating load', values.capacityPercent, '%']);
    critical(values.foulingFactor >= 0.5, 'Heat-transfer allowance', 'Available U is below 50% of the clean value; revise fouling control or area.');
    critical(values.capacityPercent <= 100, 'Capacity limit', 'Operating load exceeds the preliminary design capacity.');
    warning(!/heat-sensitive/i.test(`${state.projectTitle} ${state.constraints}`) || values.operatingTemp <= 85, 'Product-temperature protection', 'Evaluate a lower temperature or vacuum for the stated heat-sensitive service.');
  } else if (state.operation === 'drying') {
    const intensity = Number(state.sizing?.values?.water || 0) / Math.max(values.residenceTime, 0.01);
    outputs.push(['Removal intensity', intensity, 'kg h⁻²'], ['Final moisture', values.finalMoisture, 'wt%']);
    critical(values.finalMoisture > 0 && values.finalMoisture <= 15, 'Product moisture target', 'Final moisture is outside the preliminary 0–15 wt% design window.');
    critical(values.residenceTime >= 0.1, 'Residence time', 'Residence time is too short for this preliminary model.');
    warning(state.equipment === 'freeze' || values.productTemp <= 90, 'Thermal exposure', 'Check product degradation or select a lower-temperature dryer.');
  } else if (state.operation === 'distillation') {
    const separationIndex = Math.log(Math.max(values.relativeVolatility, 1.001)) * values.stages;
    outputs.push(['Separation index', separationIndex, 'α-stage index'], ['Hydraulic load', values.floodFraction * 100, '% flood']);
    critical(values.relativeVolatility >= 1.1, 'Volatility difference', 'Relative volatility is too close to one for ordinary distillation to be attractive.');
    critical(values.floodFraction >= 0.5 && values.floodFraction <= 0.85, 'Hydraulic operating window', 'Use a preliminary operating range of 50–85% of flooding.');
    warning(separationIndex >= 8, 'Indicative separation capability', 'Increase stages or investigate reflux and equilibrium requirements.');
  } else if (state.operation === 'absorption') {
    const performanceIndex = values.removal * Math.min(values.lgRatio / 1.5, 1);
    outputs.push(['Performance index', performanceIndex, '%'], ['Pressure drop', values.pressureDrop, 'kPa m⁻¹']);
    critical(values.lgRatio >= 1.1, 'Solvent-flow margin', 'Liquid rate is too close to or below the estimated minimum.');
    critical(values.pressureDrop <= 1.5, 'Pressure-drop limit', 'Pressure drop is high for preliminary absorber operation.');
    warning(values.removal >= 80, 'Removal target', 'Predicted removal is below 80%; compare against the project specification.');
  } else if (state.operation === 'extraction') {
    const extractionIndex = values.phaseRatio * values.stageEfficiency / 100;
    outputs.push(['Extraction index', extractionIndex, 'ratio'], ['Contact time', values.mixingTime, 'min']);
    critical(values.phaseRatio >= 0.3 && values.phaseRatio <= 4, 'Phase-ratio window', 'The solvent/feed ratio is outside the preliminary 0.3–4 range.');
    critical(values.mixingTime >= 0.5 && values.mixingTime <= 20, 'Contact-time window', 'Mixing time is outside the preliminary 0.5–20 min range.');
    warning(values.stageEfficiency >= 50, 'Stage efficiency', 'Low stage efficiency may require more stages or a different contactor.');
  } else {
    const recoveryRate = values.recovery / Math.max(values.contactTime, 0.01);
    outputs.push(['Recovery rate index', recoveryRate, '% h⁻¹'], ['Solvent ratio', values.solventRatio, 'kg kg⁻¹']);
    critical(values.solventRatio >= 1 && values.solventRatio <= 10, 'Solvent-ratio window', 'The solvent/dry-solid ratio is outside the preliminary 1–10 range.');
    critical(values.contactTime >= 0.25 && values.contactTime <= 16, 'Contact-time window', 'Contact time is outside the preliminary 0.25–16 h range.');
    warning(values.recovery >= 70, 'Recovery target', 'Predicted recovery is below 70%; verify equilibrium, diffusion and washing.');
  }
  const criticalFails = checks.filter(item => !item.pass && item.severity === 'critical').length, warnings = checks.filter(item => !item.pass && item.severity === 'warning').length;
  return { status: criticalFails ? 'fail' : warnings ? 'conditional' : 'pass', checks, outputs, fingerprint: simulationFingerprint(values), runAt: new Date().toISOString() };
}

function economicFingerprint(values = state.economics.values) { return JSON.stringify(values); }
function economicInputIssues(values = state.economics.values) {
  const issues = [];
  if (!(values.purchaseCost > 0)) issues.push('Purchased equipment cost must be positive.');
  if (!(values.installFactor >= 1)) issues.push('Installation factor must be at least 1.0.');
  if (!(values.annualHours > 0 && values.annualHours <= 8760)) issues.push('Annual operating time must be between 0 and 8760 h/y.');
  if ([values.electricityUse, values.electricityPrice, values.thermalUse, values.thermalPrice, values.labour, values.maintenancePct, values.consumables, values.annualBenefit, values.discountRate].some(value => value < 0 || !Number.isFinite(value))) issues.push('Economic inputs must be finite and non-negative.');
  if (!(values.projectLife > 0)) issues.push('Project life must be positive.');
  return issues;
}
function calculateEconomics(values = state.economics.values) {
  const capex = values.purchaseCost * values.installFactor;
  const electricity = values.electricityUse * values.electricityPrice * values.annualHours;
  const thermal = values.thermalUse * values.thermalPrice * values.annualHours;
  const maintenance = capex * values.maintenancePct / 100;
  const opex = electricity + thermal + values.labour + maintenance + values.consumables;
  const netBenefit = values.annualBenefit - opex;
  const roi = capex > 0 ? netBenefit / capex * 100 : NaN, payback = netBenefit > 0 ? capex / netBenefit : Infinity;
  const rate = values.discountRate / 100, annuity = rate > 0 ? (1 - Math.pow(1 + rate, -values.projectLife)) / rate : values.projectLife;
  return { capex, electricity, thermal, maintenance, opex, netBenefit, roi, payback, npv: -capex + netBenefit * annuity, fingerprint: economicFingerprint(values) };
}

function phaseBlockers(index) {
  const blockers = [];
  if (index === 0) {
    if (!state.projectTitle?.trim()) blockers.push('Add a project title.');
    if (!state.feedDescription?.trim()) blockers.push('Describe the feed and its condition.');
    if (!(Number(state.throughput) > 0)) blockers.push('Enter a positive design throughput.');
    if (!state.productTarget?.trim() || !/\d/.test(state.productTarget)) blockers.push('State a numerical product target.');
  }
  if (index === 1) {
    if (!state.equipment) blockers.push('Select an equipment type.');
    if (!state.mode || !state.configuration) blockers.push('Select the operating mode and configuration.');
    if ((state.selectionRationale || '').trim().length < 20) blockers.push('Justify the equipment choice in at least one clear sentence.');
  }
  if (index === 2) {
    if (!state.basis?.trim()) blockers.push('State the calculation basis.');
    if (!state.assumptions.length) blockers.push('Declare at least one assumption.');
    blockers.push(...dataIssues().slice(0, 3));
  }
  if (index === 3) {
    if (!balance()?.valid) blockers.push('Enter a physically valid material balance.');
    if (!state.sizing?.result) blockers.push('Calculate the preliminary equipment size.');
  }
  if (index === 4) {
    if (!state.simulation) blockers.push('Run the design simulation.');
    else if (state.simulation.fingerprint !== simulationFingerprint()) blockers.push('Inputs changed; run the simulation again.');
    else if (state.simulation.status === 'fail') blockers.push('Resolve the red simulation checks before continuing.');
  }
  if (index === 5) {
    blockers.push(...economicInputIssues().slice(0, 2));
    if (!state.economics.result || state.economics.result.fingerprint !== economicFingerprint()) blockers.push('Calculate or refresh the economic evaluation.');
    if (Object.values(state.checks).filter(Boolean).length < Object.keys(state.checks).length) blockers.push('Complete all engineering review confirmations.');
    if ((state.reflection || '').trim().length < 15) blockers.push('Record what you revised after the review.');
  }
  if (index === 6 && (state.decision || '').trim().length < 40) blockers.push('Write a defensible recommendation with evidence and limitations.');
  return blockers;
}
function phaseReady(index) { return phaseBlockers(index).length === 0; }
function phaseUnlocked(index) { return index === 0 || phases.slice(0, index).every((_, i) => phaseReady(i)); }
function phaseScore(index) { const requirements = [4, 3, 3, 2, 1, 3, 1][index], remaining = phaseBlockers(index).length; return Math.max(0, Math.min(1, (requirements - Math.min(requirements, remaining)) / requirements)); }

function renderNav() {
  const nav = document.getElementById('phaseNav');
  nav.innerHTML = phases.map((phase, index) => {
    const unlocked = phaseUnlocked(index) || index === state.phase;
    return `<button class="phase-btn phase-${phase.color} ${state.phase === index ? 'active' : ''}" data-phase="${index}" ${state.phase === index ? 'aria-current="step"' : ''} ${unlocked ? '' : 'disabled'}><span class="phase-letter">${phase.key}</span><span class="phase-label"><strong>${phase.name}</strong><span>${phase.sub}</span></span><span class="phase-status ${phaseReady(index) ? 'done' : ''}">${phaseReady(index) ? '✓' : unlocked ? '○' : '·'}</span></button>`;
  }).join('');
  nav.querySelectorAll('[data-phase]:not([disabled])').forEach(button => button.onclick = () => { state.phase = Number(button.dataset.phase); save(); render(); document.getElementById('workspace').focus(); });
}
function renderProgress() {
  const completed = phases.filter((_, index) => phaseReady(index)).length, percent = Math.round(completed / phases.length * 100);
  document.getElementById('progressText').textContent = `${percent}%`; document.getElementById('progressBar').style.width = `${percent}%`;
  document.getElementById('progressHint').textContent = percent === 100 ? 'Portfolio ready for review.' : `${completed} of ${phases.length} SPECTRA stages ready.`;
  renderNav();
}
function spectraFlow() { return `<div class="spectra-flow" aria-label="SPECTRA project sequence">${phases.map((phase, index) => `${index ? '<i></i>' : ''}<div class="flow-step ${index === state.phase ? 'active' : ''} ${phaseReady(index) ? 'complete' : ''}"><b>${phase.key}</b><span>${phase.name}</span></div>`).join('')}</div>`; }
function gatePanel() {
  const blockers = phaseBlockers(state.phase);
  if (!blockers.length) return `<div class="gate-panel ready" id="stageGate"><div class="gate-icon">✓</div><div><strong>Stage ready</strong><span>The evidence required for this stage is complete. You may continue.</span></div></div>`;
  return `<div class="gate-panel revise" id="stageGate"><div class="gate-icon">!</div><div><strong>Complete before continuing</strong><ul>${blockers.map(item => `<li>${esc(item)}</li>`).join('')}</ul></div></div>`;
}
function refreshGate() {
  const gate = document.getElementById('stageGate');
  if (gate) gate.outerHTML = gatePanel();
  const next = document.getElementById('nextBtn');
  if (next) next.disabled = !phaseReady(state.phase);
}
function shell(title, description, body) {
  const phase = phases[state.phase], ready = phaseReady(state.phase); document.body.dataset.phase = phase.color;
  return `<div class="phase-title-row"><div><div class="phase-kicker">${phase.key} · ${phase.name.toUpperCase()}</div><h1>${title}</h1><p>${description}</p></div><span class="step-chip">STAGE ${state.phase + 1} / ${phases.length}</span></div>${spectraFlow()}<div class="phase-callout"><div class="big-letter">${phase.key}</div><div><strong>${phase.name}</strong><span>${phase.sub}. Every saved decision becomes part of the design portfolio.</span></div></div>${body}${gatePanel()}<div class="button-row"><button class="ghost" id="prevBtn" ${state.phase === 0 ? 'disabled' : ''}>← Previous stage</button><button class="primary" id="nextBtn" ${ready ? '' : 'disabled'}>${state.phase === phases.length - 1 ? 'Open portfolio' : 'Save & continue →'}</button></div>`;
}
function field(id, label, value, help = '', type = 'text', full = '') { return `<div class="field ${full}"><label for="${id}">${label}</label><input id="${id}" data-field="${id}" type="${type}" ${type === 'number' ? 'step="any"' : ''} value="${esc(value)}">${help ? `<span class="help">${help}</span>` : ''}</div>`; }

function renderScope() {
  return shell('Scope the design problem', 'Translate the project brief into measurable feed, product and operating requirements.',
    `<section class="task-card accent-card"><div class="task-head"><div class="task-number">01</div><div><h2>Define a measurable design brief</h2><p>Specify what enters, what must leave and which limits the design must respect.</p></div></div><div class="field-grid">${field('projectTitle', 'Project title', state.projectTitle, 'Begin with an action such as concentrate, recover, remove or purify.', 'text', 'full')}${field('feedDescription', 'Feed and condition', state.feedDescription, 'Name phases, important components and physical condition.', 'text', 'full')}<div class="field"><label for="throughput">Design throughput</label><div class="inline-fields"><input id="throughput" data-field="throughput" type="number" step="any" min="0" value="${state.throughput}"><select id="flowUnit" data-field="flowUnit"><option ${state.flowUnit === 'kg/h' ? 'selected' : ''}>kg/h</option><option ${state.flowUnit === 'kg/batch' ? 'selected' : ''}>kg/batch</option><option ${state.flowUnit === 'kmol/h' ? 'selected' : ''}>kmol/h</option></select></div></div>${field('targetComponent', 'Key component', state.targetComponent)}${field('productTarget', 'Product target', state.productTarget, 'State composition basis, recovery or removal efficiency numerically.', 'text', 'full')}${field('constraints', 'Design constraints', state.constraints, 'Include temperature, pressure, utility, safety or quality limits.', 'text', 'full')}</div><div class="info-strip"><div>◆</div><div><strong>Design check:</strong> “High purity” is incomplete. State a value, unit and composition basis.</div></div><button class="ghost" id="briefCheck">Check brief</button> <span class="status-note" id="briefStatus"></span></section>`);
}

function renderPick() {
  const operation = operations[state.operation], equipment = selectedEquipment();
  return shell('Pick an equipment route', 'Compare alternatives before selecting the equipment type, operating mode and configuration.',
    `<section class="task-card"><div class="task-head"><div class="task-number">02</div><div><h2>Choose the unit operation</h2><p>The selected process changes the equipment catalogue, sizing relation and simulator checks.</p></div></div><div class="operation-grid">${Object.entries(operations).map(([key, item]) => `<button class="operation-card ${state.operation === key ? 'selected' : ''}" data-operation="${key}"><span class="operation-icon">${item.icon}</span><strong>${item.name}</strong><span>${item.driver}</span></button>`).join('')}</div></section>
    <section class="task-card"><div class="task-head"><div class="task-number">03</div><div><h2>Select equipment type</h2><p>Choose the closest preliminary route. The final design must still verify detailed geometry and operating limits.</p></div></div><div class="equipment-grid">${operation.equipment.map(item => `<button class="equipment-card ${state.equipment === item.id ? 'selected' : ''}" data-equipment="${item.id}"><strong>${item.label}</strong><span>${item.fit}</span><small>Design focus: ${item.design}</small></button>`).join('')}</div><div class="selection-path"><span>${operation.name}</span><b>→</b><span>${equipment.label}</span><b>→</b><span>${esc(state.mode)}</span></div></section>
    <section class="task-card"><div class="task-head"><div class="task-number">04</div><div><h2>Set the operating route</h2><p>Mode and configuration affect the balance basis, equipment arrangement and cost.</p></div></div><div class="field-grid"><div class="field"><label for="mode">Operating mode</label><select id="mode" data-selection="mode">${operation.modes.map(item => `<option ${state.mode === item ? 'selected' : ''}>${item}</option>`).join('')}</select></div><div class="field"><label for="configuration">Configuration</label><select id="configuration" data-selection="configuration">${operation.configurations.map(item => `<option ${state.configuration === item ? 'selected' : ''}>${item}</option>`).join('')}</select></div>${field('selectionRationale', 'Why is this route suitable?', state.selectionRationale, 'Link feed behaviour, production scale, product quality, safety or energy use to the selection.', 'text', 'full')}</div></section>
    <section class="blueprint"><div class="diagram-heading"><h3>INITIAL BLOCK FLOW DIAGRAM</h3><span>Updated from your selected route</span></div>${renderDiagramSVG('BFD', false)}</section>`);
}

function renderDataRegister() {
  const rows = state.dataEntries.map((entry, index) => `<tr><td><span class="data-title">${esc(entry.name)}</span><span class="data-meta">${esc(entry.conditions)}</span></td><td>${esc(entry.value)} ${esc(entry.unit || '')}</td><td><strong>${esc(entry.sourceType)}</strong><span class="data-meta">${esc(entry.reference)}</span></td><td><span class="quality-pill ${(entry.status || 'Provisional').toLowerCase()}">${esc(entry.status || 'Provisional')}</span></td><td><div class="table-actions"><button class="mini-btn" data-edit="${index}">Edit</button><button class="mini-btn danger" data-delete="${index}">Delete</button></div></td></tr>`).join('');
  const issues = dataIssues();
  return `<div class="data-toolbar"><div class="quality-summary"><span>Recorded evidence</span><strong>${state.dataEntries.length}</strong><span class="quality-pill ${issues.length ? 'provisional' : 'verified'}">${issues.length ? `${issues.length} check${issues.length === 1 ? '' : 's'}` : 'Ready'}</span></div><div><button class="ghost" id="sourceGuideBtn">Source guide</button><button class="primary small" id="addDataBtn">+ Add data item</button></div></div><div class="source-guide" id="sourceGuide" hidden><div class="source-map"><div><span>Feed and product requirements</span><strong>Project brief</strong></div><div><span>Physical and thermodynamic properties</span><strong>Validated database</strong></div><div><span>Design methods and correlations</span><strong>Textbook / standard</strong></div><div><span>Equilibrium and kinetic data</span><strong>Journal / experiment</strong></div><div><span>Equipment operating limits</span><strong>Vendor / industry</strong></div><div><span>Cost and utility data</span><strong>Vendor / current industry</strong></div><div><span>Missing information</span><strong>Declared assumption</strong></div></div></div>${state.dataEntries.length ? `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>DATA / CONDITIONS</th><th>VALUE</th><th>SOURCE / REFERENCE</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>${rows}</tbody></table></div>` : `<div class="data-empty"><strong>No design evidence recorded yet</strong><span>Add properties, equilibrium or kinetic data, methods, correlations, operating limits and cost data.</span><br><button class="primary small" id="addDataEmpty">Add the first item</button></div>`}<button class="ghost data-check" id="dataCheckBtn">Check data quality</button>${state.showDataQuality ? `<div class="source-alerts">${issues.length ? issues.map(issue => `<div class="source-alert">${esc(issue)}</div>`).join('') : '<div class="source-alert good">✓ Every item has traceable evidence, conditions and applicability.</div>'}</div>` : ''}`;
}

function renderEstablish() {
  const operation = operations[state.operation];
  return shell('Establish the engineering evidence', 'Explain why the separation works and record every value, method, correlation and assumption with its source.',
    `<section class="mechanism-band"><div><span>SEPARATION MECHANISM</span><strong>${operation.mechanism}</strong></div><div><span>PRIMARY DRIVER</span><strong>${operation.driver}</strong></div><div><span>FIRST DESIGN OUTPUT</span><strong>${operation.size}</strong></div></section><section class="task-card"><div class="task-head"><div class="task-number">05</div><div><h2>Declare basis and assumptions</h2><p>Assumptions define the boundary of the result and must be tested later.</p></div></div><div class="field-grid">${field('basis', 'Calculation basis', state.basis, 'Examples: 1 hour operation, one batch, or 100 kg feed.', 'text', 'full')}<div class="field full"><span class="group-label">Assumptions used now</span><div class="choice-list"><label class="check-row"><input type="checkbox" data-assumption="steady" ${state.assumptions.includes('steady') ? 'checked' : ''}><span><strong>Steady state</strong><br>No accumulation within the selected boundary.</span></label><label class="check-row"><input type="checkbox" data-assumption="nonvolatile" ${state.assumptions.includes('nonvolatile') ? 'checked' : ''}><span><strong>Key solute is non-volatile</strong><br>Appropriate only where supported by the process chemistry.</span></label><label class="check-row"><input type="checkbox" data-assumption="lossless" ${state.assumptions.includes('lossless') ? 'checked' : ''}><span><strong>Negligible material loss</strong><br>No leakage, entrainment or unaccounted hold-up.</span></label></div></div></div></section><section class="task-card"><div class="task-head"><div class="task-number">06</div><div><h2>Build the Design Data Register</h2><p>Textbooks rarely contain every project-specific value. Find missing data in journals, validated databases, standards or industrial sources, then record conditions and applicability.</p></div></div><div class="source-explainer"><div><strong>FIND</strong><span>Select a suitable source for the data type.</span></div><div><strong>VERIFY</strong><span>Check system, range, conditions and units.</span></div><div><strong>JUSTIFY</strong><span>Explain why the evidence applies here.</span></div></div>${renderDataRegister()}</section>`);
}

function sizingInputs() { const operation = operations[state.operation], current = state.sizing?.values || {}; return operation.inputs.map(([id, label, unit, value]) => field(`size_${id}`, `${label} (${unit})`, current[id] ?? value, '', 'number')).join(''); }
function renderCalculate() {
  const b = balance(), e = energy(), operation = operations[state.operation], equipment = selectedEquipment(), result = state.sizing?.result;
  return shell('Calculate balances and preliminary size', 'Convert the design basis into stream loads, energy requirements and a first equipment size.',
    `<section class="task-card"><div class="task-head"><div class="task-number">07</div><div><h2>Two-component material balance</h2><p>Use mass fractions on a consistent basis and verify the physical meaning of every stream.</p></div></div><div class="equation"><strong>Total:</strong> F = P + R &nbsp;&nbsp; <strong>Component:</strong> Fz = Px + Ry</div><div class="field-grid calculation-fields">${field('F', 'Feed, F (kg/h)', state.F, 'Match the selected time basis.', 'number')}${field('z', 'Feed fraction, z', state.z, 'Enter 0–1.', 'number')}${field('x', 'Product fraction, x', state.x, 'Enter 0–1.', 'number')}${field('y', 'Separated-stream fraction, y', state.y, 'Use zero only when justified.', 'number')}</div><div class="results-grid">${b?.valid ? `<div class="result"><span>Product, P</span><strong>${b.P.toFixed(2)} kg/h</strong></div><div class="result"><span>Separated stream, R</span><strong>${b.R.toFixed(2)} kg/h</strong></div><div class="result"><span>Closure error</span><strong>${Math.abs(b.closure).toFixed(3)}%</strong></div>` : '<div class="error-item">Enter independent, physically consistent compositions.</div>'}</div></section><section class="task-card"><div class="task-head"><div class="task-number">08</div><div><h2>Estimate thermal duty</h2><p>This sensible-plus-latent screen is most relevant to evaporation and drying; adapt the energy terms for the selected operation.</p></div></div><div class="field-grid">${field('cp', 'Average heat capacity (kJ kg⁻¹ K⁻¹)', state.cp, '', 'number')}${field('dTfeed', 'Feed temperature change (K)', state.dTfeed, '', 'number')}${field('latent', 'Latent heat (kJ kg⁻¹)', state.latent, 'Record conditions and source.', 'number')}</div><div class="results-grid">${e ? `<div class="result"><span>Sensible duty</span><strong>${e.qSens.toFixed(1)} kW</strong></div><div class="result"><span>Latent duty</span><strong>${e.qLat.toFixed(1)} kW</strong></div><div class="result"><span>Illustrative total</span><strong>${e.total.toFixed(1)} kW</strong></div>` : ''}</div></section><section class="task-card sizing-card"><div class="task-head"><div class="task-number">09</div><div><h2>${equipment.label}: preliminary sizing</h2><p>Design focus: ${equipment.design}.</p></div></div><div class="equation"><strong>Starting relation:</strong> ${operation.formula}</div><div class="field-grid calculation-fields">${sizingInputs()}</div><button class="primary" id="calculateSize">Calculate preliminary size</button>${result ? `<div class="results-grid"><div class="result standout"><span>${result.label}</span><strong>${Number(result.value).toFixed(2)} ${result.unit}</strong></div><div class="result"><span>Design allowance</span><strong>${state.sensitivity}%</strong></div><div class="result"><span>Adjusted size</span><strong>${(result.value * state.sensitivity / 100).toFixed(2)} ${result.unit}</strong></div></div>` : ''}<p class="formula-note">This transparent screening equation is not a complete mechanical design. Verify equipment-specific correlations, geometry, hydraulics and safety limits.</p></section>`);
}

function simulationStatus(result) {
  if (!result) return { label: 'Not run', detail: 'Enter the controls and run the model.', cls: 'neutral' };
  if (result.fingerprint !== simulationFingerprint()) return { label: 'Inputs changed', detail: 'Run again to refresh the readiness decision.', cls: 'conditional' };
  if (result.status === 'pass') return { label: 'Ready to proceed', detail: 'All critical and advisory checks passed.', cls: 'pass' };
  if (result.status === 'conditional') return { label: 'Proceed with limitations', detail: 'Critical checks passed; address advisory findings in your decision.', cls: 'conditional' };
  return { label: 'Revise design', detail: 'At least one critical feasibility check failed.', cls: 'fail' };
}
function renderTest() {
  const operation = operations[state.operation], values = currentSimValues(), result = state.simulation, status = simulationStatus(result);
  return shell('Test the design in the simulator', 'Change operating inputs, run the transparent model and use the diagnostics to decide whether the design is ready.',
    `<section class="simulator-shell"><div class="simulator-top"><div><span class="sim-label">PRELIMINARY DIGITAL TWIN</span><h2>${selectedEquipment().label}</h2><p>${state.mode} · ${state.configuration}</p></div><div class="simulation-status ${status.cls}"><span>${status.label}</span><small>${status.detail}</small></div></div><div class="simulator-grid"><div class="sim-controls">${operation.simControls.map(([id, label, unit, min, max, step]) => `<div class="control-row"><div><label for="sim_${id}">${label}</label><span>${unit}</span></div><div class="control-input"><input id="sim_${id}" data-sim="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${values[id]}"><output id="out_${id}">${values[id]}</output></div></div>`).join('')}<button class="primary run-sim" id="runSimulation">▶ Run design simulation</button></div><div class="simulation-visual ${status.cls}"><div class="flow-line"></div><div class="digital-unit"><span>${operation.icon}-101</span><strong>${operation.name}</strong><small>${selectedEquipment().label}</small></div><div class="flow-line out"></div><div class="pulse pulse-one"></div><div class="pulse pulse-two"></div></div></div></section><section class="task-card"><div class="task-head"><div class="task-number">10</div><div><h2>Simulation diagnostics</h2><p>The gate checks model validity and preliminary operating limits. Cite a suitable source before changing a default acceptance range.</p></div></div>${result ? `<div class="simulation-results"><div class="output-strip">${result.outputs.map(([label, value, unit]) => `<div><span>${label}</span><strong>${Number(value).toFixed(2)} ${unit}</strong></div>`).join('')}</div><div class="diagnostic-list">${result.checks.map(check => `<div class="diagnostic ${check.pass ? 'pass' : check.severity === 'critical' ? 'fail' : 'conditional'}"><b>${check.pass ? '✓' : check.severity === 'critical' ? '×' : '!'}</b><div><strong>${check.label}</strong><span>${check.pass ? 'Within the preliminary acceptance range.' : check.detail}</span></div></div>`).join('')}</div></div>` : '<div class="data-empty"><strong>No simulation result yet</strong><span>Run the model to receive a readiness decision and corrective feedback.</span></div>'}<div class="model-boundary"><strong>Model boundary</strong><span>This educational simulator performs transparent preliminary checks. It does not replace a validated thermodynamic property package, detailed vendor design or Aspen Plus.</span></div></section>`);
}

function money(value) { if (!Number.isFinite(value)) return '—'; return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 0 }).format(value); }
function econField(id, label, unit, value) { return `<div class="field"><label for="econ_${id}">${label}</label><div class="econ-input"><span>${unit}</span><input id="econ_${id}" data-econ="${id}" type="number" step="any" value="${value}"></div></div>`; }
function renderReview() {
  const result = state.sizing?.result, capacity = [80, 90, 100, 110, 120], values = capacity.map(percent => result ? result.value * 100 / percent : 0), econ = state.economics.result, v = state.economics.values;
  return shell('Review economics, sensitivity and risk', 'A feasible unit must also be operable, safe and economically defensible over its stated cost basis.',
    `<section class="task-card"><div class="task-head"><div class="task-number">11</div><div><h2>Capacity and design-margin sensitivity</h2><p>Observe how the required size changes when the assumed operating capacity changes.</p></div></div>${result ? `<div class="sensitivity"><div><label class="group-label" for="sensitivity">Design allowance: <strong id="sensitivityValue">${state.sensitivity}%</strong></label><input id="sensitivity" type="range" min="100" max="150" step="5" value="${state.sensitivity}"><p class="formula-note">Adjusted size: <strong id="adjustedSize">${(result.value * state.sensitivity / 100).toFixed(2)} ${result.unit}</strong></p></div><div><div class="sensitivity-chart">${values.map(value => `<div class="bar" style="height:${Math.min(100, value / (Math.max(...values) || 1) * 100)}%"><span>${value.toFixed(1)}</span></div>`).join('')}</div><div class="bar-labels">${capacity.map(value => `<span>${value}%</span>`).join('')}</div></div></div>` : '<div class="error-item">Complete preliminary sizing before sensitivity analysis.</div>'}</section><section class="task-card economics-card"><div class="task-head"><div class="task-number">12</div><div><h2>Preliminary economic evaluation</h2><p>Use a consistent currency and cost year. Support purchase cost, utility price and annual benefit with traceable evidence.</p></div></div><div class="field-grid economics-grid">${econField('purchaseCost', 'Purchased equipment cost', 'RM', v.purchaseCost)}${econField('installFactor', 'Installation factor', '×', v.installFactor)}${econField('annualHours', 'Annual operating time', 'h/y', v.annualHours)}${econField('costYear', 'Cost basis year', 'year', v.costYear)}${econField('electricityUse', 'Electrical load', 'kW', v.electricityUse)}${econField('electricityPrice', 'Electricity price', 'RM/kWh', v.electricityPrice)}${econField('thermalUse', 'Thermal utility use', 'kg/h', v.thermalUse)}${econField('thermalPrice', 'Thermal utility price', 'RM/kg', v.thermalPrice)}${econField('labour', 'Annual labour', 'RM/y', v.labour)}${econField('maintenancePct', 'Annual maintenance', '% CAPEX', v.maintenancePct)}${econField('consumables', 'Consumables and disposal', 'RM/y', v.consumables)}${econField('annualBenefit', 'Annual revenue or avoided cost', 'RM/y', v.annualBenefit)}${econField('discountRate', 'Discount rate', '%', v.discountRate)}${econField('projectLife', 'Project life', 'years', v.projectLife)}</div><button class="primary" id="calculateEconomics">Calculate economics</button>${econ ? `<div class="economic-dashboard"><div><span>Total installed capital</span><strong>${money(econ.capex)}</strong></div><div><span>Annual OPEX</span><strong>${money(econ.opex)}</strong></div><div class="${econ.netBenefit >= 0 ? 'positive' : 'negative'}"><span>Annual net benefit</span><strong>${money(econ.netBenefit)}</strong></div><div class="${econ.roi >= 0 ? 'positive' : 'negative'}"><span>Simple ROI</span><strong>${Number.isFinite(econ.roi) ? econ.roi.toFixed(1) + '%' : '—'}</strong></div><div><span>Simple payback</span><strong>${Number.isFinite(econ.payback) ? econ.payback.toFixed(2) + ' years' : 'No payback'}</strong></div><div class="${econ.npv >= 0 ? 'positive' : 'negative'}"><span>Screening NPV</span><strong>${money(econ.npv)}</strong></div></div><div class="equation economics-equation"><strong>ROI:</strong> annual net benefit / installed capital × 100 &nbsp; · &nbsp; <strong>Payback:</strong> installed capital / annual net benefit</div>` : ''}<p class="formula-note">Preliminary estimate only. Define whether annual benefit means product revenue, avoided cost or incremental profit, and keep that basis consistent.</p></section><section class="task-card"><div class="task-head"><div class="task-number">13</div><div><h2>Engineering review confirmations</h2><p>Confirm each statement using calculations, sources and simulation evidence.</p></div></div><div class="choice-list">${[['units', 'All equations use one consistent unit system.'], ['balance', 'Material and energy balances close within the stated tolerance.'], ['range', 'Correlations and data apply at the selected operating conditions.'], ['safety', 'A relevant hazard and practical design response are identified.'], ['operability', 'Start-up, shutdown, cleaning, control and maintenance have been considered.']].map(([key, text]) => `<label class="check-row"><input type="checkbox" data-review="${key}" ${state.checks[key] ? 'checked' : ''}><span>${text}</span></label>`).join('')}</div>${field('reflection', 'Revision note', state.reflection, 'What changed after simulation and economic review, and why?', 'text', 'full')}</section>`);
}

function diagramNodes(type = state.diagram.type) {
  const p = state.diagram.positions || {}, node = (id, label, kind, x, y) => ({ id, label, kind, x: p[id]?.x ?? x, y: p[id]?.y ?? y });
  const nodes = [node('feed', state.diagram.feedLabel, 'stream', 72, 170)];
  if (type === 'PFD' && state.diagram.includePump) nodes.push(node('pump', 'P-101', 'pump', 230, 170));
  if (type === 'PFD' && state.diagram.includeHeater) nodes.push(node('heater', 'E-101', 'heater', 380, 170));
  nodes.push(node('unit', `${state.diagram.unitTag}\n${selectedEquipment().label}`, 'unit', 550, 170));
  nodes.push(node('product', state.diagram.productLabel, 'stream', 805, 100), node('byproduct', state.diagram.byproductLabel, 'stream', 805, 250));
  if (type === 'PFD' && state.diagram.includeUtility) nodes.push(node('utility', 'Utility', 'utility', 550, 315));
  return nodes;
}
function renderDiagramSVG(type = state.diagram.type, draggable = true) {
  const nodes = diagramNodes(type), byId = Object.fromEntries(nodes.map(item => [item.id, item])), mainIds = ['feed', ...(byId.pump ? ['pump'] : []), ...(byId.heater ? ['heater'] : []), 'unit', 'product'];
  const line = (a, b, id, dashed = false) => `<line id="edge_${id}" x1="${a.x + 55}" y1="${a.y}" x2="${b.x - 55}" y2="${b.y}" class="diagram-edge ${dashed ? 'dashed' : ''}" marker-end="url(#arrowhead)"/>`;
  let edges = mainIds.slice(0, -1).map((id, i) => line(byId[id], byId[mainIds[i + 1]], `${id}_${mainIds[i + 1]}`)).join('');
  edges += line(byId.unit, byId.byproduct, 'unit_byproduct');
  if (byId.utility) edges += `<line x1="${byId.utility.x}" y1="${byId.utility.y - 32}" x2="${byId.unit.x}" y2="${byId.unit.y + 48}" class="diagram-edge utility-edge" marker-end="url(#arrowhead)"/>`;
  if (type === 'PFD' && state.diagram.includeRecycle) edges += `<path d="M ${byId.byproduct.x} ${byId.byproduct.y + 32} L ${byId.byproduct.x} 350 L ${byId.feed.x} 350 L ${byId.feed.x} ${byId.feed.y + 34}" class="diagram-edge recycle-edge" marker-end="url(#arrowhead)"/><text x="430" y="342" class="edge-label">RECYCLE</text>`;
  const renderNode = item => {
    const lines = String(item.label).split('\n'); let shape = `<rect x="-58" y="-32" width="116" height="64" rx="7" class="node-shape ${item.kind}"/>`;
    if (item.kind === 'pump') shape = `<circle cx="0" cy="0" r="35" class="node-shape pump"/><path d="M -13 -13 L 18 0 L -13 13 Z" class="node-symbol"/>`;
    if (item.kind === 'heater') shape = `<rect x="-42" y="-34" width="84" height="68" rx="5" class="node-shape heater"/><path d="M -28 -22 L 28 22 M 28 -22 L -28 22" class="node-symbol stroke"/>`;
    if (item.kind === 'unit' && ['distillation','absorption'].includes(state.operation)) shape = `<rect x="-42" y="-68" width="84" height="136" rx="38" class="node-shape unit"/><path d="M -30 -25 L 30 -25 M -30 0 L 30 0 M -30 25 L 30 25" class="node-symbol stroke"/>`;
    return `<g class="diagram-node ${draggable ? 'draggable' : ''}" data-node="${item.id}" transform="translate(${item.x} ${item.y})">${shape}<text text-anchor="middle" class="node-label">${lines.map((text, i) => `<tspan x="0" dy="${i ? 15 : lines.length > 1 ? -3 : 5}">${esc(text)}</tspan>`).join('')}</text></g>`;
  };
  return `<svg class="process-svg" id="processSvg" viewBox="0 0 900 390" role="img" aria-label="${type === 'PFD' ? 'Process flow diagram' : 'Block flow diagram'}"><defs><marker id="arrowhead" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto"><polygon points="0 0, 9 3.5, 0 7"/></marker></defs><text x="25" y="28" class="diagram-title">${type} · ${operations[state.operation].name.toUpperCase()} · ${esc(state.mode.toUpperCase())}</text>${edges}${nodes.map(renderNode).join('')}</svg>`;
}

function renderArgue() {
  const econ = state.economics.result, sim = simulationStatus(state.simulation);
  const readiness = [['Scope and target', phaseReady(0)], ['Equipment route', phaseReady(1)], ['Evidence register', phaseReady(2)], ['Balances and size', phaseReady(3)], ['Simulation gate', phaseReady(4)], ['Economics and review', phaseReady(5)]];
  return shell('Argue, draw and archive the design', 'Build the process diagram and present a claim supported by evidence, calculations, simulation, economics and limitations.',
    `<section class="task-card diagram-builder"><div class="task-head"><div class="task-number">14</div><div><h2>Process diagram builder</h2><p>Start with a BFD, then add selected auxiliary equipment for a preliminary PFD. Drag blocks to improve the layout.</p></div></div><div class="diagram-toolbar"><div class="toggle-group"><button class="diagram-type ${state.diagram.type === 'BFD' ? 'active' : ''}" data-diagram-type="BFD">Block Flow Diagram</button><button class="diagram-type ${state.diagram.type === 'PFD' ? 'active' : ''}" data-diagram-type="PFD">Process Flow Diagram</button></div><button class="ghost" id="resetDiagram">Reset layout</button><button class="primary small" id="downloadDiagram">Download SVG</button></div><div class="diagram-canvas">${renderDiagramSVG()}</div><div class="field-grid diagram-fields">${field('diagramFeed', 'Feed label', state.diagram.feedLabel)}${field('diagramProduct', 'Main product label', state.diagram.productLabel)}${field('diagramByproduct', 'Separated-stream label', state.diagram.byproductLabel)}${field('diagramTag', 'Main equipment tag', state.diagram.unitTag)}<div class="field full"><span class="group-label">PFD auxiliaries</span><div class="diagram-options">${[['includePump','Feed pump'],['includeHeater','Heater / cooler'],['includeUtility','Utility connection'],['includeRecycle','Recycle stream']].map(([key,label]) => `<label><input type="checkbox" data-diagram-option="${key}" ${state.diagram[key] ? 'checked' : ''}> ${label}</label>`).join('')}</div></div></div><p class="formula-note">This is a process-level diagram, not a detailed piping and instrumentation diagram. Add stream conditions and control philosophy in the final report.</p></section><section class="task-card"><div class="task-head"><div class="task-number">15</div><div><h2>Defensible recommendation</h2><p>Use claim–evidence–limitation and address any conditional simulation or economic finding.</p></div></div><div class="evidence-ribbon"><span>${operations[state.operation].name}</span><span>${selectedEquipment().label}</span><span>${sim.label}</span><span>${econ ? `ROI ${econ.roi.toFixed(1)}%` : 'Economics pending'}</span></div><div class="field full"><label for="decision">Final design recommendation</label><textarea id="decision" data-field="decision" rows="6" placeholder="I recommend… The evidence is… The preliminary size is… The simulation shows… The ROI is… The main limitations are…">${esc(state.decision)}</textarea><span class="help">Write at least 40 characters and include numerical evidence.</span></div><div class="info-strip"><div>◆</div><div><strong>Defence prompt:</strong> If the feed rate increases by 20%, which calculation changes first, and which equipment or economic limit becomes most important?</div></div></section><section class="task-card"><div class="task-head"><div class="task-number">16</div><div><h2>Portfolio readiness</h2><p>The portfolio compiles the complete design trail automatically.</p></div></div><div class="readiness-grid">${readiness.map(([label, ready]) => `<div class="readiness-item ${ready ? 'ready' : ''}"><b>${ready ? '✓' : '○'}</b><span>${label}</span></div>`).join('')}</div><button class="primary" id="openPortfolio">Review complete portfolio</button></section>`);
}

function render() { syncSelection(); const views = [renderScope, renderPick, renderEstablish, renderCalculate, renderTest, renderReview, renderArgue]; document.getElementById('workspace').innerHTML = views[state.phase](); bindWorkspace(); renderNotebook(); renderProgress(); }
function bindWorkspace() {
  document.querySelectorAll('[data-field]').forEach(input => input.oninput = () => {
    const value = input.type === 'number' ? Number(input.value) : input.value;
    if (input.id.startsWith('diagram')) { const map = { diagramFeed: 'feedLabel', diagramProduct: 'productLabel', diagramByproduct: 'byproductLabel', diagramTag: 'unitTag' }; state.diagram[map[input.id]] = value; }
    else state[input.dataset.field] = value;
    if (['F','z','x','y','cp','dTfeed','latent'].includes(input.dataset.field)) state.simulation = null;
    save();
  });
  document.querySelectorAll('[data-operation]').forEach(button => button.onclick = () => { state.operation = button.dataset.operation; syncSelection(true); save(); render(); });
  document.querySelectorAll('[data-equipment]').forEach(button => button.onclick = () => { state.equipment = button.dataset.equipment; state.sizing = {}; state.simulation = null; save(); render(); });
  document.querySelectorAll('[data-selection]').forEach(select => select.onchange = () => { state[select.dataset.selection] = select.value; state.simulation = null; save(); render(); });
  document.querySelectorAll('[data-assumption]').forEach(input => input.onchange = () => { state.assumptions = input.checked ? [...new Set([...state.assumptions, input.dataset.assumption])] : state.assumptions.filter(item => item !== input.dataset.assumption); save(); renderProgress(); });
  document.querySelectorAll('[data-review]').forEach(input => input.onchange = () => { state.checks[input.dataset.review] = input.checked; save(); renderProgress(); });
  document.querySelectorAll('[data-edit]').forEach(button => button.onclick = () => openDataDialog(Number(button.dataset.edit)));
  document.querySelectorAll('[data-delete]').forEach(button => button.onclick = () => { const index = Number(button.dataset.delete); if (confirm(`Delete “${state.dataEntries[index].name}” from the Data Register?`)) { state.dataEntries.splice(index, 1); state.showDataQuality = false; save(); render(); } });
  ['addDataBtn', 'addDataEmpty'].forEach(id => { const button = document.getElementById(id); if (button) button.onclick = () => openDataDialog(); });
  const guideButton = document.getElementById('sourceGuideBtn'); if (guideButton) guideButton.onclick = () => { const guide = document.getElementById('sourceGuide'); guide.hidden = !guide.hidden; guideButton.textContent = guide.hidden ? 'Source guide' : 'Hide source guide'; };
  const dataCheck = document.getElementById('dataCheckBtn'); if (dataCheck) dataCheck.onclick = () => { state.showDataQuality = true; save(); render(); };
  const previous = document.getElementById('prevBtn'); if (previous) previous.onclick = () => { state.phase = Math.max(0, state.phase - 1); save(); render(); document.getElementById('workspace').focus(); };
  const next = document.getElementById('nextBtn'); if (next) next.onclick = () => { if (!phaseReady(state.phase)) return; if (state.phase === phases.length - 1) openPortfolio(); else { state.phase += 1; save(); render(); document.getElementById('workspace').focus(); } };
  const briefCheck = document.getElementById('briefCheck'); if (briefCheck) briefCheck.onclick = () => { const blockers = phaseBlockers(0), output = document.getElementById('briefStatus'); output.textContent = blockers.length ? ` ${blockers.join(' ')}` : ' ✓ Brief is measurable and ready.'; output.className = `status-note ${blockers.length ? 'warn' : 'good'}`; };
  const calculate = document.getElementById('calculateSize'); if (calculate) calculate.onclick = () => { const operation = operations[state.operation], values = {}; operation.inputs.forEach(([id]) => values[id] = Number(document.getElementById(`size_${id}`).value)); const result = operation.calc(values); if (!Number.isFinite(result.value) || result.value <= 0) { alert('Enter positive, physically meaningful sizing inputs.'); return; } state.sizing = { values, result }; state.simulation = null; save(); render(); };
  document.querySelectorAll('[data-sim]').forEach(input => input.oninput = () => { const value = Number(input.value); state.simValues[input.dataset.sim] = value; document.getElementById(`out_${input.dataset.sim}`).value = value; save(); });
  const runSimulation = document.getElementById('runSimulation'); if (runSimulation) runSimulation.onclick = () => { state.simulation = runOperationSimulation(); save(); render(); };
  const sensitivity = document.getElementById('sensitivity'); if (sensitivity) sensitivity.oninput = () => { state.sensitivity = Number(sensitivity.value); document.getElementById('sensitivityValue').textContent = `${state.sensitivity}%`; document.getElementById('adjustedSize').textContent = `${(state.sizing.result.value * state.sensitivity / 100).toFixed(2)} ${state.sizing.result.unit}`; save(); };
  document.querySelectorAll('[data-econ]').forEach(input => input.oninput = () => { state.economics.values[input.dataset.econ] = Number(input.value); state.economics.result = null; save(); });
  const calculateEconomicsButton = document.getElementById('calculateEconomics'); if (calculateEconomicsButton) calculateEconomicsButton.onclick = () => { const issues = economicInputIssues(); if (issues.length) { alert(issues.join(' ')); return; } state.economics.result = calculateEconomics(); save(); render(); };
  document.querySelectorAll('[data-diagram-type]').forEach(button => button.onclick = () => { state.diagram.type = button.dataset.diagramType; state.diagram.positions = {}; save(); render(); });
  document.querySelectorAll('[data-diagram-option]').forEach(input => input.onchange = () => { state.diagram[input.dataset.diagramOption] = input.checked; state.diagram.positions = {}; save(); render(); });
  const resetDiagram = document.getElementById('resetDiagram'); if (resetDiagram) resetDiagram.onclick = () => { state.diagram.positions = {}; save(); render(); };
  const downloadDiagram = document.getElementById('downloadDiagram'); if (downloadDiagram) downloadDiagram.onclick = exportDiagram;
  bindDiagramDrag(); const openPortfolioButton = document.getElementById('openPortfolio'); if (openPortfolioButton) openPortfolioButton.onclick = openPortfolio;
}

function bindDiagramDrag() {
  const svg = document.getElementById('processSvg'); if (!svg) return;
  svg.querySelectorAll('.diagram-node.draggable').forEach(node => { node.onpointerdown = event => {
    event.preventDefault(); node.setPointerCapture(event.pointerId); const id = node.dataset.node, point = svg.createSVGPoint();
    const locate = e => { point.x = e.clientX; point.y = e.clientY; return point.matrixTransform(svg.getScreenCTM().inverse()); };
    const start = locate(event), current = diagramNodes().find(item => item.id === id); node.classList.add('dragging');
    node.onpointermove = move => { const here = locate(move), x = Math.max(60, Math.min(840, current.x + here.x - start.x)), y = Math.max(70, Math.min(340, current.y + here.y - start.y)); state.diagram.positions[id] = { x, y }; node.setAttribute('transform', `translate(${x} ${y})`); };
    node.onpointerup = () => { node.classList.remove('dragging'); node.onpointermove = null; save(); render(); };
  }; });
}
function exportDiagram() {
  const svg = document.getElementById('processSvg'); if (!svg) return; const copy = svg.cloneNode(true); copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style'); style.textContent = '.node-shape{fill:#fff;stroke:#0756c9;stroke-width:3}.node-shape.unit{fill:#e8f4ff}.node-shape.pump{fill:#fff2b2}.node-shape.heater{fill:#ffd9ec}.node-shape.utility{fill:#dff7ee}.node-symbol{fill:#0756c9}.node-symbol.stroke{fill:none;stroke:#0756c9;stroke-width:3}.node-label{font:700 12px Arial;fill:#0a234d}.diagram-edge{stroke:#10b8d4;stroke-width:3;fill:none}.utility-edge{stroke-dasharray:7 5}.recycle-edge{stroke:#e63879}.edge-label,.diagram-title{font:700 12px Arial;fill:#0a234d}marker polygon{fill:#10b8d4}'; copy.prepend(style);
  const blob = new Blob([new XMLSerializer().serializeToString(copy)], { type: 'image/svg+xml' }), anchor = document.createElement('a'); anchor.href = URL.createObjectURL(blob); anchor.download = `spectra-${state.diagram.type.toLowerCase()}.svg`; anchor.click(); URL.revokeObjectURL(anchor.href);
}

function openDataDialog(index = -1) {
  const dialog = document.getElementById('dataDialog'), entry = index >= 0 ? state.dataEntries[index] : { name: '', value: '', unit: '', conditions: '', sourceType: 'Validated database', status: 'Verified', reference: '', applicability: '' };
  document.getElementById('dataDialogTitle').textContent = index >= 0 ? 'Edit data item' : 'Add a data item'; document.getElementById('dataIndex').value = index;
  ['Name', 'Value', 'Unit', 'Conditions', 'Reference', 'Applicability'].forEach(key => document.getElementById(`data${key}`).value = entry[key.toLowerCase()] || '');
  document.getElementById('dataSourceType').value = entry.sourceType; document.getElementById('dataStatus').value = entry.status; document.getElementById('dataFormFeedback').textContent = ''; dialog.showModal(); setTimeout(() => document.getElementById('dataName').focus(), 0);
}
function saveDataEntry(event) {
  event.preventDefault(); const entry = { name: document.getElementById('dataName').value.trim(), value: document.getElementById('dataValue').value.trim(), unit: document.getElementById('dataUnit').value.trim(), conditions: document.getElementById('dataConditions').value.trim(), sourceType: document.getElementById('dataSourceType').value, status: document.getElementById('dataStatus').value, reference: document.getElementById('dataReference').value.trim(), applicability: document.getElementById('dataApplicability').value.trim() };
  const immediateIssues = []; if (/\d/.test(entry.value) && !entry.unit) immediateIssues.push('Add a unit or state “dimensionless”.'); if (entry.sourceType === 'Engineering assumption') entry.status = 'Assumed'; if (entry.sourceType === 'Peer-reviewed journal' && !/(doi|https?:\/\/|journal|vol\.?)/i.test(entry.reference)) immediateIssues.push('Add a DOI, URL or complete journal citation.');
  if (immediateIssues.length) { document.getElementById('dataFormFeedback').textContent = immediateIssues.join(' '); return; }
  const index = Number(document.getElementById('dataIndex').value); if (index >= 0) state.dataEntries[index] = entry; else state.dataEntries.push(entry); state.showDataQuality = false; save(); document.getElementById('dataDialog').close(); render();
}

function renderNotebook() {
  const operation = operations[state.operation], equipment = selectedEquipment(), b = balance(), result = state.sizing?.result, verified = state.dataEntries.filter(entry => entry.status === 'Verified').length, sim = simulationStatus(state.simulation), econ = state.economics.result;
  document.getElementById('notebookContent').innerHTML = `<section class="notebook-section"><h3>S · SCOPE</h3><div class="note-row"><span>Project</span><strong>${esc(state.projectTitle || '—')}</strong></div><div class="note-row"><span>Throughput</span><strong>${state.throughput} ${state.flowUnit}</strong></div></section><section class="notebook-section"><h3>P · PICK</h3><div class="note-row"><span>Route</span><strong>${operation.name} · ${equipment.label}</strong></div><div class="note-row"><span>Mode</span><strong>${esc(state.mode)} · ${esc(state.configuration)}</strong></div></section><section class="notebook-section"><h3>E · ESTABLISH</h3><div class="note-row"><span>Evidence</span><strong>${state.dataEntries.length} items · ${verified} verified</strong></div><div>${state.assumptions.map(item => `<span class="tag">${item}</span>`).join('')}</div></section><section class="notebook-section"><h3>C · CALCULATE</h3>${b?.valid ? `<div class="note-row"><span>Product / separated</span><strong>${b.P.toFixed(1)} / ${b.R.toFixed(1)} kg/h</strong></div>` : '<p class="empty-note">Balance incomplete.</p>'}${result ? `<div class="note-row"><span>${result.label}</span><strong>${Number(result.value).toFixed(2)} ${result.unit}</strong></div>` : ''}</section><section class="notebook-section"><h3>T · TEST</h3><div class="note-row"><span>Simulator</span><strong class="text-${sim.cls}">${sim.label}</strong></div></section><section class="notebook-section"><h3>R · REVIEW</h3>${econ ? `<div class="note-row"><span>ROI / payback</span><strong>${econ.roi.toFixed(1)}% / ${Number.isFinite(econ.payback) ? econ.payback.toFixed(2) + ' y' : 'No payback'}</strong></div>` : '<p class="empty-note">Economics not calculated.</p>'}</section><section class="notebook-section"><h3>A · ARGUE</h3>${state.decision ? `<div class="decision-box">${esc(state.decision)}</div>` : '<p class="empty-note">Recommendation pending.</p>'}</section>`;
}
function openPortfolio() {
  const operation = operations[state.operation], equipment = selectedEquipment(), b = balance(), e = energy(), result = state.sizing?.result, econ = state.economics.result, sim = simulationStatus(state.simulation);
  const dataRows = state.dataEntries.length ? state.dataEntries.map(entry => `<tr><td>${esc(entry.name)}</td><td>${esc(entry.value)} ${esc(entry.unit)}</td><td>${esc(entry.conditions)}</td><td>${esc(entry.sourceType)}: ${esc(entry.reference)}</td><td>${esc(entry.status)}</td></tr>`).join('') : '<tr><td colspan="5">No evidence recorded.</td></tr>';
  document.getElementById('portfolioContent').innerHTML = `<div class="portfolio-grid"><section class="portfolio-section"><h3>S · Design scope</h3><p><strong>${esc(state.projectTitle || 'Untitled project')}</strong></p><p>${esc(state.feedDescription)} at ${state.throughput} ${state.flowUnit}. Target: ${esc(state.productTarget)}.</p><p><strong>Constraints:</strong> ${esc(state.constraints || 'Not recorded')}</p></section><section class="portfolio-section"><h3>P · Equipment route</h3><p><strong>${operation.name}:</strong> ${equipment.label}</p><p>${esc(state.mode)} · ${esc(state.configuration)}</p><p><strong>Rationale:</strong> ${esc(state.selectionRationale || 'Not recorded')}</p></section><section class="portfolio-section full-span"><h3>E · Design Data Register</h3><div class="data-table-wrap"><table class="data-table"><thead><tr><th>DATA / METHOD</th><th>VALUE</th><th>CONDITIONS</th><th>SOURCE</th><th>STATUS</th></tr></thead><tbody>${dataRows}</tbody></table></div></section><section class="portfolio-section"><h3>C · Calculations</h3>${b?.valid ? `<p>F = ${state.F} kg/h; P = ${b.P.toFixed(2)} kg/h; R = ${b.R.toFixed(2)} kg/h.</p>` : '<p>Material balance incomplete.</p>'}${e ? `<p>Illustrative thermal duty = ${e.total.toFixed(1)} kW.</p>` : ''}${result ? `<p>${result.label}: <strong>${Number(result.value).toFixed(2)} ${result.unit}</strong>; adjusted: ${(result.value * state.sensitivity / 100).toFixed(2)} ${result.unit}.</p>` : ''}</section><section class="portfolio-section"><h3>T · Simulation</h3><p><strong>${sim.label}</strong></p>${state.simulation ? `<ul>${state.simulation.checks.map(item => `<li>${item.pass ? 'Pass' : 'Review'}: ${esc(item.label)}</li>`).join('')}</ul>` : '<p>Not run.</p>'}</section><section class="portfolio-section"><h3>R · Economics and review</h3>${econ ? `<p>Installed capital: ${money(econ.capex)}; OPEX: ${money(econ.opex)} per year.</p><p>ROI: <strong>${econ.roi.toFixed(1)}%</strong>; payback: <strong>${Number.isFinite(econ.payback) ? econ.payback.toFixed(2) + ' years' : 'No payback'}</strong>; screening NPV: ${money(econ.npv)}.</p>` : '<p>Economic evaluation incomplete.</p>'}<p><strong>Revision:</strong> ${esc(state.reflection || 'Not recorded')}</p></section><section class="portfolio-section"><h3>A · Recommendation</h3><p>${esc(state.decision || 'Recommendation not recorded.')}</p></section><section class="portfolio-section full-span"><h3>${state.diagram.type} · Process diagram</h3>${renderDiagramSVG(state.diagram.type, false)}</section></div>`; document.getElementById('portfolioDialog').showModal();
}

function showModule() { document.getElementById('entrance').hidden = true; document.getElementById('moduleApp').hidden = false; window.scrollTo({ top: 0, behavior: 'instant' }); render(); document.getElementById('workspace').focus(); }
function showEntrance() { document.getElementById('moduleApp').hidden = true; document.getElementById('entrance').hidden = false; window.scrollTo({ top: 0, behavior: 'instant' }); }
document.getElementById('enterModule').textContent = hadSavedProject ? 'Resume design project →' : 'Start design project →';
document.getElementById('enterModule').onclick = showModule; document.getElementById('homeBtn').onclick = showEntrance;
document.getElementById('resourcesBtn').onclick = () => document.getElementById('resourcesDialog').showModal(); document.getElementById('entranceResources').onclick = () => document.getElementById('resourcesDialog').showModal();
document.getElementById('portfolioBtn').onclick = openPortfolio; document.querySelectorAll('[data-scroll]').forEach(button => button.onclick = () => document.getElementById(button.dataset.scroll).scrollIntoView({ behavior: 'smooth' })); document.querySelectorAll('[data-close]').forEach(button => button.onclick = () => document.getElementById(button.dataset.close).close());
document.getElementById('dataForm').onsubmit = saveDataEntry; document.getElementById('printBtn').onclick = () => window.print();
document.getElementById('downloadBtn').onclick = () => { const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }), anchor = document.createElement('a'); anchor.href = URL.createObjectURL(blob); anchor.download = 'spectra-design-project.json'; anchor.click(); URL.revokeObjectURL(anchor.href); };
document.getElementById('resetBtn').onclick = () => { if (confirm('Reset all saved project work on this device?')) { localStorage.removeItem('uds-project'); state = createDefaults(); syncSelection(); document.getElementById('enterModule').textContent = 'Start design project →'; render(); } };

function registerAgentTools() {
  const context = document.modelContext; if (!context?.registerTool) return; const register = tool => Promise.resolve(context.registerTool(tool)).catch(() => {});
  register({ name: 'start_design_project', title: 'Start design project', description: 'Open SPECTRA and configure the unit operation, equipment type, operating mode and project title.', inputSchema: { type: 'object', properties: { operation: { type: 'string', enum: Object.keys(operations) }, equipment: { type: 'string' }, mode: { type: 'string' }, projectTitle: { type: 'string', minLength: 3 } }, required: ['operation', 'projectTitle'], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute(input) { if (!operations[input?.operation] || typeof input?.projectTitle !== 'string' || input.projectTitle.trim().length < 3) throw new Error('A valid operation and project title are required.'); state.operation = input.operation; syncSelection(true); const operation = operations[state.operation]; if (input.equipment && operation.equipment.some(item => item.id === input.equipment)) state.equipment = input.equipment; if (input.mode && operation.modes.includes(input.mode)) state.mode = input.mode; state.projectTitle = input.projectTitle.trim(); state.phase = 0; save(); showModule(); return { operation: state.operation, equipment: state.equipment, mode: state.mode, projectTitle: state.projectTitle, stage: phases[state.phase].name }; } });
  register({ name: 'add_design_data', title: 'Add design data', description: 'Add one traceable property, design method, cost item, correlation or assumption to the Design Data Register.', inputSchema: { type: 'object', properties: { name: { type: 'string' }, value: { type: 'string' }, unit: { type: 'string' }, conditions: { type: 'string' }, sourceType: { type: 'string' }, status: { type: 'string', enum: ['Verified', 'Provisional', 'Assumed'] }, reference: { type: 'string' }, applicability: { type: 'string' } }, required: ['name', 'value', 'conditions', 'sourceType', 'status', 'reference', 'applicability'], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: true }, execute(input) { if (!input || ['name','value','conditions','sourceType','status','reference','applicability'].some(key => typeof input[key] !== 'string' || !input[key].trim())) throw new Error('All required evidence fields must be completed.'); if (/\d/.test(input.value) && !input.unit?.trim()) throw new Error('Numerical data require a unit or “dimensionless”.'); state.dataEntries.push({ ...input, unit: input.unit || '', status: input.sourceType === 'Engineering assumption' ? 'Assumed' : input.status }); state.phase = 2; save(); showModule(); render(); return { saved: true, itemCount: state.dataEntries.length, qualityChecks: dataIssues().length }; } });
  register({ name: 'run_design_simulation', title: 'Run design simulation', description: 'Run the operation-specific preliminary simulator using the visible equipment selection, sizing result and control values.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute() { state.simulation = runOperationSimulation(); state.phase = 4; save(); showModule(); render(); return { status: state.simulation.status, outputs: state.simulation.outputs, failedChecks: state.simulation.checks.filter(item => !item.pass).map(item => item.label) }; } });
  register({ name: 'read_design_summary', title: 'Read design summary', description: 'Read the current SPECTRA stage, equipment route, evidence, calculation, simulation and economic status without changing it.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: true }, execute() { const b = balance(), result = state.sizing?.result, econ = state.economics.result; return { projectTitle: state.projectTitle, operation: operations[state.operation].name, equipment: selectedEquipment().label, mode: state.mode, stage: phases[state.phase].name, evidenceItems: state.dataEntries.length, dataQualityChecks: dataIssues().length, balance: b?.valid ? { product: b.P, separated: b.R } : null, preliminarySize: result || null, simulationStatus: state.simulation?.status || 'not_run', roiPercent: econ?.roi ?? null, progressPercent: Math.round(phases.filter((_, index) => phaseReady(index)).length / phases.length * 100) }; } });
}
registerAgentTools(); render();
