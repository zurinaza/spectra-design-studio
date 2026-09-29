/* SPECTRA PFD engine
   Operation-specific process flow diagrams, numbered streams, a live stream table
   and engineering consistency checks. Loaded before app.js; uses its globals at call time. */

const PFD_VIEW = { w: 1100, h: 600 };

/* ---------- Water properties (teaching-grade correlations) ---------- */
const water = {
  // Antoine equation, mmHg → kPa. Two coefficient sets: 1–100 °C and 99–374 °C (NIST / Perry's)
  psat(T) { const [A, B, C] = T <= 100 ? [8.07131, 1730.63, 233.426] : [8.14019, 1810.94, 244.485]; return Math.pow(10, A - B / (C + T)) * 0.133322; },
  // Watson correlation anchored at 2257 kJ/kg, 100 °C
  latent(T) { const r = (647.1 - (T + 273.15)) / (647.1 - 373.15); return r > 0 ? 2257 * Math.pow(r, 0.38) : 0; }
};

/* ---------- Symbol sizes ---------- */
const PFD_KINDS = {
  terminal: [100, 28], pump: [36, 36], hx: [42, 42], evaporator: [60, 160], vessel: [50, 110], drum: [100, 44],
  column: [60, 280], vacpump: [40, 40], ejector: [70, 26], fan: [40, 40], cyclone: [44, 90], bagfilter: [56, 90],
  conveyor: [90, 26], dryer_rotary: [170, 56], dryer_spray: [90, 170], dryer_fb: [80, 140], dryer_box: [150, 90],
  mixer_settler: [160, 80], centrifuge: [70, 70], tank_agitated: [90, 110], thickener: [110, 60]
};

/* ---------- Template helpers ---------- */
const T = (id, label, x, y, dir = 'right', extra = {}) => ({ id, kind: 'terminal', label, x, y, dir, ...extra });
const E = (id, tag, name, kind, x, y, extra = {}) => ({ id, tag, name, kind, x, y, ...extra });
// Connect consecutive nodes that are present. Stream ids are stable: `${base}_${fromId}`.
function chain(has, ids, base, opt = {}) {
  const present = ids.filter(has);
  return present.slice(0, -1).map((from, i) => {
    const to = present[i + 1];
    return { id: `${base}_${from}`, from, to, cls: opt.cls || 'process', fp: opt.fpBy?.[from] || opt.fp, tp: opt.tpBy?.[to] || opt.tp, lane: opt.laneBy?.[from], desc: opt.descBy?.[from] || opt.desc || '' };
  });
}
const vacNode = (c, x, y) => c.vacSource === 'ejector'
  ? E('vac', 'J-101', 'Steam-jet ejector', 'ejector', x, y, { lab: 'below', fam: 'vacuum' })
  : E('vac', 'VP-101', 'Liquid-ring vacuum pump', 'vacpump', x, y, { lab: 'below', fam: 'vacuum' });
const vacAux = (label, def) => ({ id: 'vacuum', label, def, vacuumSource: true });

/* ---------- Operation templates ---------- */
const PFD_TEMPLATES = {
  evaporation: {
    aux: [
      { id: 'feedPump', label: 'Feed pump P-101', def: () => true },
      { id: 'preheater', label: 'Feed preheater E-101', def: () => false },
      { id: 'separator', label: 'Vapour–liquid separator V-101', def: () => true },
      { id: 'condenser', label: 'Vapour condenser E-102', def: c => c.vacuum },
      vacAux('Vacuum system on condenser vent', c => c.vacuum),
      { id: 'receiver', label: 'Condensate receiver V-102', def: c => c.vacuum },
      { id: 'condPump', label: 'Condensate pump P-103', def: c => c.vacuum },
      { id: 'productPump', label: 'Product pump P-102', def: () => true },
      { id: 'circPump', label: 'Circulation pump P-104', def: c => c.eq === 'forced_circulation' }
    ],
    nodes: c => [
      T('feed', state.diagram.feedLabel, 70, 396),
      c.aux('feedPump') && E('pump', 'P-101', 'Feed pump', 'pump', 185, 396, { fam: 'mover' }),
      c.aux('preheater') && E('pre', 'E-101', 'Feed preheater', 'hx', 300, 396, { fam: 'heat' }),
      E('unit', state.diagram.unitTag, selectedEquipment().label, 'evaporator', 440, 340, { main: true, lab: 'left', labDy: -8 }),
      T('steam', 'Steam', 290, 292, 'right', { fam: 'utility' }),
      T('steamOut', 'Steam condensate', 290, 530, 'left', { fam: 'utility' }),
      c.aux('separator') && E('sep', 'V-101', 'V–L separator', 'vessel', 620, 215, { lab: 'right' }),
      c.aux('condenser') && E('cond', 'E-102', 'Condenser', 'hx', 760, 120, { fam: 'heat', lab: 'bl' }),
      c.aux('condenser') && T('cwIn', 'Cooling water', 610, 42, 'right', { fam: 'utility' }),
      c.aux('condenser') && T('cwOut', 'Cooling water return', 960, 42, 'right', { fam: 'utility' }),
      c.aux('vacuum') && vacNode(c, 900, 120),
      c.aux('vacuum') && T('vent', 'To atmosphere', 1035, 120),
      c.aux('vacuum') && c.vacSource === 'ejector' && T('motive', 'Motive steam', 1030, 200, 'left', { fam: 'utility' }),
      c.aux('receiver') && E('rcv', 'V-102', 'Condensate receiver', 'drum', 760, 255),
      c.aux('condPump') && E('cpump', 'P-103', 'Condensate pump', 'pump', 905, 330, { fam: 'mover' }),
      T('condOut', c.aux('condenser') ? 'Condensate' : 'Vapour', 1030, c.aux('condenser') ? 330 : 120),
      c.aux('productPump') && E('ppump', 'P-102', 'Product pump', 'pump', 760, 455, { fam: 'mover' }),
      T('product', state.diagram.productLabel, 1030, 455),
      c.aux('circPump') && E('circ', 'P-104', 'Circulation pump', 'pump', 610, 530, { fam: 'mover', lab: 'right' })
    ],
    streams: (c, has) => [
      ...chain(has, ['feed', 'pump', 'pre', 'unit'], 'f', { tpBy: { unit: 'left@0.7' }, descBy: { feed: 'Fresh feed', pump: 'Pumped feed', pre: 'Preheated feed' } }),
      { id: 'mix', from: 'unit', to: 'sep', fp: 'top', tp: 'left', desc: 'Vapour + concentrate (two-phase)' },
      { id: 'vap', from: ['sep', 'unit'], to: ['cond', 'condOut'], fp: 'top', tp: 'left', desc: 'Vapour' },
      ...chain(has, ['cond', 'rcv', 'cpump', 'condOut'], 'c', { fpBy: { cond: 'bottom', rcv: 'bottom' }, tpBy: { rcv: 'top' }, descBy: { cond: 'Vapour condensate', rcv: 'Condensate', cpump: 'Condensate to disposal/reuse' } }),
      { id: 'nc', from: 'cond', to: 'vac', fp: 'right', tp: 'left', cls: 'vacuum', desc: 'Non-condensables (vacuum suction)', note: 'VACUUM SUCTION' },
      { id: 'vent', from: 'vac', to: 'vent', cls: 'vacuum', desc: 'Vacuum system exhaust' },
      { id: 'motive', from: 'motive', to: 'vac', fp: 'left', tp: 'bottom', cls: 'utility', desc: 'Ejector motive steam' },
      { id: 'cwi', from: 'cwIn', to: 'cond', fp: 'right', tp: 'top@-0.5', cls: 'utility', desc: 'Cooling water supply' },
      { id: 'cwo', from: 'cond', to: 'cwOut', fp: 'top@0.5', tp: 'left', cls: 'utility', desc: 'Cooling water return' },
      ...chain(has, [has('sep') ? 'sep' : 'unit', 'ppump', 'product'], 'p', { fpBy: { sep: 'bottom@0.4', unit: 'bottom' }, descBy: { sep: 'Concentrate', unit: 'Concentrate', ppump: 'Concentrated product' } }),
      { id: 'circ1', from: ['sep', 'unit'], to: 'circ', fp: 'bottom@-0.4', tp: 'top', cls: 'recycle', desc: 'Recirculated liquor' },
      { id: 'circ2', from: 'circ', to: 'unit', fp: 'left', tp: 'bottom@0.5', cls: 'recycle', desc: 'Recirculated liquor to calandria' },
      { id: 'stm', from: 'steam', to: 'unit', tp: 'left@-0.6', cls: 'utility', desc: 'Heating steam' },
      { id: 'stc', from: 'unit', to: 'steamOut', fp: 'bottom@-0.5', tp: 'right', cls: 'utility', desc: 'Steam condensate' }
    ],
    env(c) {
      const b = balance(), e = energy(), sv = currentSimValues(), vac = c.cfg === 'Vacuum', bpr = evapBPR() || 0;
      const multi = state.mode === 'Multiple effect' ? multiEffect(sv) : null, mOK = multi && !multi.error;
      let Top, Tv;
      if (mOK) { Top = multi.T[multi.N - 1]; Tv = multi.Tv[multi.N - 1]; } else if (vac) { Top = Number(sv.operatingTemp); Tv = Top - bpr; } else { Tv = 100; Top = 100 + bpr; }
      const Pev = water.psat(Tv), dt = Number(state.sizing?.values?.dt ?? 28), Ts = mOK ? multi.Ts : Top + dt, lamS = water.latent(Ts);
      const steam = mOK ? multi.S : (e?.total ? e.total * 3600 / lamS : undefined), mb = massBalance();
      const Vlast = mOK ? multi.V[multi.N - 1] : mb?.R;
      return { b: b?.valid ? b : null, Top, Tv, bpr, Pev, Ts, Ps: water.psat(Ts), steam, lamS, multi: mOK ? multi : null, Tfeed: Number(sv.operatingTemp) - Number(state.dTfeed || 0), cw: Number.isFinite(Vlast) ? Vlast * water.latent(Tv) / (4.18 * 10) : undefined };
    },
    calc(s, v) {
      const b = v.b, F = b ? state.F : undefined;
      const id = s.id.startsWith('f_') ? 'f' : s.id.startsWith('c_') ? 'c' : s.id.startsWith('p_') ? 'p' : s.id;
      if (id === 'f') return s.from === 'feed' ? { ph: 'L', T: v.Tfeed, P: 101.3, m: F, w: state.z } : s.from === 'pump' ? { ph: 'L', T: v.Tfeed, m: F, w: state.z } : { ph: 'L', m: F, w: state.z };
      if (id === 'mix') return { ph: 'V/L', T: v.Top, P: v.Pev, m: F, w: state.z };
      if (id === 'vap') return { ph: 'V', T: v.Top, P: v.Pev, m: b?.R, w: 0 };
      if (id === 'c') return s.from === 'cpump' ? { ph: 'L', T: v.Tv, m: b?.R, w: 0 } : { ph: 'L', T: v.Tv, P: v.Pev, m: b?.R, w: 0 };
      if (id === 'nc') return { ph: 'V', P: v.Pev };
      if (id === 'vent') return { ph: 'V', P: 101.3 };
      if (id === 'p') return s.from === 'ppump' ? { ph: 'L', T: v.Top, m: b?.P, w: state.x } : { ph: 'L', T: v.Top, P: v.Pev, m: b?.P, w: state.x };
      if (id === 'circ1' || id === 'circ2') return { ph: 'L', T: v.Top, w: state.x };
      if (id === 'stm') return { ph: 'V', T: v.Ts, P: v.Ps, m: v.steam, w: 0, util: true };
      if (id === 'stc') return { ph: 'L', T: v.Ts, P: v.Ps, m: v.steam, w: 0, util: true };
      if (id === 'cwi') return { ph: 'L', T: 30, m: v.cw, w: 0, util: true };
      if (id === 'cwo') return { ph: 'L', T: 40, m: v.cw, w: 0, util: true };
      if (id === 'motive') return { ph: 'V' };
      return {};
    },
    notes: v => [
      `The liquor boils at ${v.Top.toFixed(1)} °C; with a boiling-point rise of ${v.bpr.toFixed(2)} K the vapour is saturated at ${v.Tv.toFixed(1)} °C, so the evaporator runs at ${v.Pev.toFixed(1)} kPa abs (Antoine equation). The vapour leaves slightly superheated.`,
      ...(v.multi ? [`Multiple-effect mode: the PFD shows the last effect (${v.multi.N} effects in total). Steam flow is for effect 1 and condenser load is the last effect’s vapour. See the effect-by-effect table in Test.`] : []),
      `Steam condenses at operating temperature + effective ΔT (${v.Ts.toFixed(0)} °C, ${v.Ps.toFixed(0)} kPa abs). Latent heat from the Watson correlation.`,
      'Cooling water is assumed at 30 → 40 °C. Values you type in the table are your own and are shown in italics.'
    ]
  },

  distillation: {
    aux: [
      { id: 'feedPump', label: 'Feed pump P-101', def: () => true },
      { id: 'preheater', label: 'Feed preheater E-101', def: () => false },
      { id: 'condenser', label: 'Overhead condenser E-102', def: () => true },
      { id: 'drum', label: 'Reflux drum V-101', def: () => true },
      vacAux('Vacuum system on reflux drum', c => c.vacuum),
      { id: 'refluxPump', label: 'Reflux pump P-102', def: () => true },
      { id: 'reboiler', label: 'Reboiler E-103', def: () => true },
      { id: 'bottomsCooler', label: 'Bottoms cooler E-104', def: () => false }
    ],
    nodes: c => [
      T('feed', state.diagram.feedLabel, 70, 300),
      c.aux('feedPump') && E('pump', 'P-101', 'Feed pump', 'pump', 185, 300, { fam: 'mover' }),
      c.aux('preheater') && E('pre', 'E-101', 'Feed preheater', 'hx', 300, 300, { fam: 'heat' }),
      E('unit', state.diagram.unitTag, selectedEquipment().label, 'column', 450, 300, { main: true, lab: 'left', labDy: -80, internals: state.equipment === 'packed' ? 'packed' : 'tray' }),
      c.aux('condenser') && E('cond', 'E-102', 'Condenser', 'hx', 620, 90, { fam: 'heat', lab: 'br' }),
      c.aux('condenser') && T('cwIn', 'Cooling water', 520, 34, 'right', { fam: 'utility' }),
      c.aux('condenser') && T('cwOut', 'Cooling water return', 745, 34, 'right', { fam: 'utility' }),
      c.aux('drum') && E('drum', 'V-101', 'Reflux drum', 'drum', 770, 180),
      c.aux('vacuum') && vacNode(c, 900, 100),
      c.aux('vacuum') && T('vent', 'To atmosphere', 1035, 100),
      c.aux('vacuum') && c.vacSource === 'ejector' && T('motive', 'Motive steam', 1030, 170, 'left', { fam: 'utility' }),
      c.aux('refluxPump') && E('rpump', 'P-102', 'Reflux pump', 'pump', 880, 260, { fam: 'mover' }),
      T('dist', state.diagram.productLabel, 1030, 260),
      c.aux('reboiler') && E('reb', 'E-103', 'Reboiler', 'hx', 620, 480, { fam: 'heat', lab: 'br' }),
      c.aux('reboiler') && T('steam', 'Steam', 520, 560, 'right', { fam: 'utility' }),
      c.aux('reboiler') && T('steamOut', 'Steam condensate', 760, 560, 'right', { fam: 'utility' }),
      c.aux('bottomsCooler') && E('bcool', 'E-104', 'Bottoms cooler', 'hx', 800, 480, { fam: 'heat' }),
      T('bottoms', state.diagram.byproductLabel, 1030, 480)
    ],
    streams: (c, has) => [
      ...chain(has, ['feed', 'pump', 'pre', 'unit'], 'f', { descBy: { feed: 'Fresh feed', pump: 'Pumped feed', pre: 'Preheated feed' } }),
      { id: 'ovhd', from: 'unit', to: ['cond', 'drum'], fp: 'top', tp: 'left', desc: 'Overhead vapour' },
      { id: 'cnd', from: 'cond', to: 'drum', fp: 'bottom', tp: 'left', desc: 'Condensed overhead' },
      { id: 'drumOut', from: 'drum', to: ['rpump', 'dist'], fp: 'bottom', tp: 'left', desc: 'Reflux + distillate' },
      { id: 'dst', from: 'rpump', to: 'dist', desc: 'Distillate product' },
      { id: 'rfx', from: ['rpump', 'drum'], to: 'unit', fp: 'bottom', tp: 'right@-0.8', lane: { y: 335 }, cls: 'recycle', desc: 'Reflux' },
      { id: 'nc', from: 'drum', to: 'vac', fp: 'top', tp: 'left', cls: 'vacuum', desc: 'Non-condensables (vacuum suction)', note: 'VACUUM SUCTION' },
      { id: 'vent', from: 'vac', to: 'vent', cls: 'vacuum', desc: 'Vacuum system exhaust' },
      { id: 'motive', from: 'motive', to: 'vac', fp: 'left', tp: 'bottom', cls: 'utility', desc: 'Ejector motive steam' },
      { id: 'cwi', from: 'cwIn', to: 'cond', fp: 'right', tp: 'top@-0.5', cls: 'utility', desc: 'Cooling water supply' },
      { id: 'cwo', from: 'cond', to: 'cwOut', fp: 'top@0.5', tp: 'left', cls: 'utility', desc: 'Cooling water return' },
      { id: 'btm', from: 'unit', to: ['reb', 'bcool', 'bottoms'], fp: 'bottom', tp: 'left', desc: 'Column bottoms liquid' },
      { id: 'boil', from: 'reb', to: 'unit', fp: 'top', tp: 'right@0.75', cls: 'recycle', desc: 'Boil-up vapour' },
      ...chain(has, ['reb', 'bcool', 'bottoms'], 'b', { descBy: { reb: 'Bottoms product', bcool: 'Cooled bottoms product' } }),
      { id: 'stm', from: 'steam', to: 'reb', fp: 'right', tp: 'bottom@-0.5', cls: 'utility', desc: 'Reboiler steam' },
      { id: 'stc', from: 'reb', to: 'steamOut', fp: 'bottom@0.5', tp: 'left', cls: 'utility', desc: 'Steam condensate' }
    ],
    env(c) { const b = balance(); return { b: b?.valid ? b : null, P: c.cfg === 'Atmospheric' ? 101.3 : undefined }; },
    calc(s, v) {
      const b = v.b, top = ['ovhd', 'cnd', 'drumOut', 'dst', 'rfx'].includes(s.id), bot = s.id === 'btm' || s.id === 'boil' || s.id.startsWith('b_');
      if (s.id.startsWith('f_')) return { ph: 'L', m: b ? state.F : undefined, w: state.z, P: s.from === 'feed' ? 101.3 : undefined };
      if (s.id === 'dst') return { ph: 'L', m: b?.P, w: state.x, P: v.P };
      if (s.id.startsWith('b_')) return { ph: 'L', m: b?.R, w: state.y, P: s.from === 'reb' ? v.P : undefined };
      if (top) return { ph: s.id === 'ovhd' ? 'V' : 'L', w: state.x, P: v.P };
      if (bot) return { ph: s.id === 'boil' ? 'V' : 'L', w: state.y, P: v.P };
      if (s.id === 'vent') return { ph: 'V', P: 101.3 };
      if (s.id === 'nc') return { ph: 'V', P: v.P };
      if (s.id === 'cwi') return { ph: 'L', T: 30, w: 0 };
      if (s.id === 'cwo') return { ph: 'L', T: 40, w: 0 };
      if (s.id === 'stm' || s.id === 'motive') return { ph: 'V', w: 0 };
      if (s.id === 'stc') return { ph: 'L', w: 0 };
      return {};
    },
    notes: () => ['Feed, distillate and bottoms flows come from your material balance (distillate = product P, bottoms = separated stream R). Enter temperatures from your bubble-point and dew-point calculations, and reflux/boil-up flows from your reflux ratio.']
  },

  absorption: {
    aux: [
      { id: 'blower', label: 'Gas blower K-101', def: () => true },
      { id: 'solventPump', label: 'Lean solvent pump P-101', def: () => true },
      { id: 'solventCooler', label: 'Lean solvent cooler E-101', def: () => true },
      { id: 'richPump', label: 'Rich solvent pump P-102', def: () => true },
      { id: 'regen', label: 'Solvent regeneration (stripper T-102)', def: () => false },
      { id: 'richHeater', label: 'Rich solvent heater E-102', def: () => false }
    ],
    nodes: c => [
      T('feed', state.diagram.feedLabel, 70, 419),
      c.aux('blower') && E('blower', 'K-101', 'Gas blower', 'fan', 190, 419, { fam: 'mover' }),
      E('unit', state.diagram.unitTag, selectedEquipment().label, 'column', 400, 300, { main: true, lab: 'left', labDy: -70, internals: { packed: 'packed', tray: 'tray', spray: 'spray', bubble: 'bubble' }[state.equipment] }),
      T('treated', state.diagram.productLabel, 575, 60),
      c.aux('solventCooler') && E('cool', 'E-101', 'Solvent cooler', 'hx', 560, 188, { fam: 'heat' }),
      c.aux('solventPump') && E('lpump', 'P-101', 'Lean solvent pump', 'pump', 690, 188, { fam: 'mover', flip: true, lab: 'above' }),
      !c.aux('regen') && T('fresh', 'Fresh solvent', 1030, 188, 'left'),
      c.aux('richPump') && E('rpump', 'P-102', 'Rich solvent pump', 'pump', 520, 520, { fam: 'mover' }),
      c.aux('regen') && c.aux('richHeater') && E('rheat', 'E-102', 'Rich solvent heater', 'hx', 680, 520, { fam: 'heat' }),
      c.aux('regen') && E('strip', 'T-102', 'Solvent stripper', 'column', 880, 300, { h: 260, lab: 'right', internals: 'packed' }),
      c.aux('regen') && T('stripped', state.diagram.byproductLabel, 1030, 60),
      c.aux('regen') && T('steam', 'Stripping steam', 1030, 395, 'left', { fam: 'utility' }),
      !c.aux('regen') && T('richOut', state.diagram.byproductLabel, 1030, 520)
    ],
    streams: (c, has) => [
      ...chain(has, ['feed', 'blower', 'unit'], 'g', { tpBy: { unit: 'left@0.85' }, descBy: { feed: 'Gas feed', blower: 'Compressed gas feed' } }),
      { id: 'tg', from: 'unit', to: 'treated', fp: 'top', tp: 'left', desc: 'Treated gas' },
      ...chain(has, [has('strip') ? 'strip' : 'fresh', 'lpump', 'cool', 'unit'], 'l', { fp: 'left', tp: 'right', fpBy: { strip: 'bottom' }, tpBy: { unit: 'right@-0.8' }, laneBy: { strip: { y: 590 } }, cls: has('strip') ? 'recycle' : 'process', descBy: { strip: 'Regenerated lean solvent', fresh: 'Fresh solvent', lpump: 'Pumped lean solvent', cool: 'Cooled lean solvent' } }),
      ...chain(has, ['unit', 'rpump', 'rheat', has('strip') ? 'strip' : 'richOut'], 'r', { fpBy: { unit: 'bottom' }, tpBy: { rpump: 'left', strip: 'left@-0.6' }, descBy: { unit: 'Rich solvent', rpump: 'Pumped rich solvent', rheat: 'Heated rich solvent' } }),
      { id: 'sg', from: 'strip', to: 'stripped', fp: 'top', tp: 'left', desc: 'Stripped solute gas' },
      { id: 'stm', from: 'steam', to: 'strip', fp: 'left', tp: 'right@0.7', cls: 'utility', desc: 'Stripping steam' }
    ],
    env() { const b = balance(); return { b: b?.valid ? b : null }; },
    calc(s, v) { if (s.id === 'g_feed') return { ph: 'G', m: v.b ? state.F : undefined, w: state.z }; if (s.id.startsWith('g_') || s.id === 'tg' || s.id === 'sg') return { ph: 'G' }; if (s.id === 'stm') return { ph: 'V', w: 0 }; return { ph: 'L' }; },
    notes: () => ['Only the gas feed is fixed by the two-stream balance. Enter solvent flows from your L/G ratio (liquid / minimum liquid rate) and treated-gas composition from your removal target.']
  },

  extraction: {
    aux: [
      { id: 'feedPump', label: 'Feed pump P-101', def: () => true },
      { id: 'solventPump', label: 'Solvent pump P-102', def: () => true },
      { id: 'recovery', label: 'Solvent recovery column T-101', def: () => true },
      { id: 'raffStripper', label: 'Raffinate stripper T-102', def: () => false }
    ],
    nodes: c => {
      const kind = state.equipment === 'mixer_settler' ? 'mixer_settler' : state.equipment === 'centrifugal' ? 'centrifuge' : 'column';
      return [
        T('feed', state.diagram.feedLabel, 70, 400),
        c.aux('feedPump') && E('pump', 'P-101', 'Feed pump', 'pump', 190, 400, { fam: 'mover' }),
        T('fresh', c.aux('recovery') ? 'Solvent make-up' : 'Fresh solvent', 70, 260),
        c.aux('solventPump') && E('spump', 'P-102', 'Solvent pump', 'pump', 190, 260, { fam: 'mover', lab: 'bl' }),
        E('unit', state.diagram.unitTag, selectedEquipment().label, kind, 440, 330, { main: true, h: kind === 'column' ? 260 : undefined, lab: kind === 'column' ? 'right' : 'below', labDy: kind === 'column' ? 90 : 0, internals: { packed: 'packed', pulsed: 'tray', rotating_disc: 'discs' }[state.equipment] }),
        c.aux('recovery') && E('recov', 'T-101', 'Solvent recovery column', 'column', 720, 220, { h: 200, lab: 'right', labDy: 40 }),
        c.aux('recovery') && E('scond', 'E-102', 'Solvent condenser', 'hx', 720, 70, { fam: 'heat', lab: 'br' }),
        c.aux('recovery') && T('steam', 'Steam', 910, 280, 'left', { fam: 'utility' }),
        T('product', state.diagram.productLabel, 1030, 360),
        c.aux('raffStripper') && E('raff', 'T-102', 'Raffinate stripper', 'column', 720, 500, { h: 120, lab: 'left', labDy: -40 }),
        c.aux('raffStripper') && T('rsolv', 'To solvent recovery', 900, 425),
        T('raffOut', state.diagram.byproductLabel, 1030, 520)
      ];
    },
    streams: (c, has) => [
      ...chain(has, ['feed', 'pump', 'unit'], 'f', { tpBy: { unit: 'left@0.5' }, descBy: { feed: 'Fresh feed', pump: 'Pumped feed' } }),
      ...chain(has, ['fresh', 'spump', 'unit'], 's', { tpBy: { unit: 'left@-0.5' }, descBy: { fresh: c.aux('recovery') ? 'Solvent make-up' : 'Fresh solvent', spump: 'Solvent to extractor' } }),
      { id: 'ext', from: 'unit', to: ['recov', 'product'], fp: 'right@-0.5', tp: 'left', desc: 'Extract' },
      { id: 'prod', from: 'recov', to: 'product', fp: 'bottom', tp: 'left', desc: 'Solute product (recovery bottoms)' },
      { id: 'ov', from: 'recov', to: 'scond', fp: 'top', tp: 'bottom', desc: 'Solvent vapour' },
      { id: 'rec', from: 'scond', to: ['spump', 'unit'], fp: 'left', tp: 'top', cls: 'recycle', desc: 'Recovered solvent recycle' },
      { id: 'stm', from: 'steam', to: 'recov', fp: 'left', tp: 'right@0.6', cls: 'utility', desc: 'Reboiler steam' },
      ...chain(has, ['unit', 'raff', 'raffOut'], 'r', { fpBy: { unit: 'bottom' }, descBy: { unit: 'Raffinate', raff: 'Solvent-free raffinate' } }),
      { id: 'rs', from: 'raff', to: 'rsolv', fp: 'top', tp: 'left', desc: 'Stripped solvent' }
    ],
    env() { const b = balance(); return { b: b?.valid ? b : null }; },
    calc(s, v) { if (s.id === 'f_feed') return { ph: 'L', m: v.b ? state.F : undefined, w: state.z, P: 101.3 }; if (s.id === 'ov') return { ph: 'V' }; if (s.id === 'stm') return { ph: 'V', w: 0 }; return { ph: 'L' }; },
    notes: () => ['Only the feed is fixed by the two-stream balance because solvent is added. Enter solvent flow from your solvent/feed ratio and extract/raffinate compositions from your stage calculation.']
  },

  drying: {
    aux: [
      { id: 'feeder', label: 'Feeder (conveyor or pump)', def: () => true },
      { id: 'fan', label: 'Supply-air fan K-101', def: c => c.direct },
      { id: 'heater', label: 'Air heater E-101', def: c => c.direct },
      { id: 'cyclone', label: 'Cyclone S-101', def: c => c.direct },
      { id: 'bagFilter', label: 'Bag filter S-102', def: c => c.direct && ['spray', 'fluidised_bed'].includes(c.eq) },
      { id: 'exhaustFan', label: 'Exhaust fan K-102', def: c => c.direct },
      { id: 'condenser', label: 'Vapour condenser E-102', def: c => c.vacuum },
      vacAux('Vacuum system on condenser', c => c.vacuum),
      { id: 'productConveyor', label: 'Product conveyor X-102', def: () => false }
    ],
    nodes: c => {
      const kind = { rotary: 'dryer_rotary', spray: 'dryer_spray', fluidised_bed: 'dryer_fb' }[state.equipment] || 'dryer_box';
      const spray = state.equipment === 'spray';
      return [
        T('feed', state.diagram.feedLabel, 70, 340),
        c.aux('feeder') && (spray ? E('feeder', 'P-101', 'Feed pump', 'pump', 200, 340, { fam: 'mover' }) : E('feeder', 'X-101', 'Feed conveyor', 'conveyor', 205, 340, { fam: 'solids' })),
        E('unit', state.diagram.unitTag, selectedEquipment().label, kind, 480, 340, { main: true, lab: 'below', shelves: state.equipment === 'freeze' || state.equipment === 'tray', belt: state.equipment === 'belt' }),
        c.direct && T('air', 'Ambient air', 70, 150),
        c.direct && c.aux('fan') && E('fan', 'K-101', 'Supply-air fan', 'fan', 190, 150, { fam: 'mover' }),
        c.direct && c.aux('heater') && E('heater', 'E-101', 'Air heater', 'hx', 320, 150, { fam: 'heat' }),
        c.direct && c.aux('heater') && T('steam', 'Steam', 225, 62, 'right', { fam: 'utility' }),
        c.direct && c.aux('cyclone') && E('cyc', 'S-101', 'Cyclone', 'cyclone', 660, 160, { fam: 'solids', lab: 'right', labDy: 14 }),
        c.direct && c.aux('bagFilter') && E('bag', 'S-102', 'Bag filter', 'bagfilter', 790, 160, { fam: 'solids', lab: 'above' }),
        c.direct && c.aux('bagFilter') && T('dust', 'Collected dust', 905, 232),
        c.direct && c.aux('exhaustFan') && E('xfan', 'K-102', 'Exhaust fan', 'fan', 905, 124, { fam: 'mover', lab: 'above' }),
        c.direct && T('stack', 'Exhaust air', 1030, 124),
        !c.direct && T('heat', 'Heating medium', 300, 520, 'right', { fam: 'utility' }),
        !c.direct && T('heatOut', 'Heating medium return', 700, 520, 'right', { fam: 'utility' }),
        !c.direct && c.aux('condenser') && E('cond', 'E-102', state.equipment === 'freeze' ? 'Ice condenser' : 'Condenser', 'hx', 660, 160, { fam: 'heat', lab: 'above' }),
        !c.direct && c.aux('condenser') && T('condOut', 'Condensate', 830, 250),
        !c.direct && c.aux('vacuum') && vacNode(c, 830, 160),
        !c.direct && T('vent', c.aux('vacuum') ? 'To atmosphere' : 'Vapour vent', 1035, 160),
        !c.direct && c.aux('vacuum') && c.vacSource === 'ejector' && T('motive', 'Motive steam', 1030, 90, 'left', { fam: 'utility' }),
        c.aux('productConveyor') && E('pconv', 'X-102', 'Product conveyor', 'conveyor', 820, 340, { fam: 'solids' }),
        T('product', state.diagram.productLabel, 1030, 340)
      ];
    },
    streams: (c, has) => {
      const spray = state.equipment === 'spray', rotary = state.equipment === 'rotary', fb = state.equipment === 'fluidised_bed';
      return [
        ...chain(has, ['feed', 'feeder', 'unit'], 'f', { tpBy: { unit: spray ? 'top' : rotary ? 'left@0.4' : 'left' }, laneBy: spray ? { [has('feeder') ? 'feeder' : 'feed']: { y: 215 } } : {}, descBy: { feed: 'Wet feed', feeder: 'Wet feed to dryer' } }),
        ...chain(has, ['air', 'fan', 'heater', 'unit'], 'a', { fpBy: { heater: 'right', fan: 'right' }, tpBy: { unit: spray ? 'top@-0.6' : rotary ? 'left@-0.5' : fb ? 'left@0.8' : 'top@-0.5' }, descBy: { air: 'Ambient air', fan: 'Supply air', heater: 'Hot drying air' } }),
        { id: 'stm', from: 'steam', to: 'heater', fp: 'right', tp: 'top', cls: 'utility', desc: 'Heating steam' },
        ...chain(has, ['unit', 'cyc', 'bag', 'xfan', 'stack'], 'x', { fpBy: { unit: rotary ? 'right@-0.6' : 'top@0.5', cyc: 'right@-0.8', bag: 'right@-0.8' }, tpBy: { cyc: 'left@-0.3', bag: 'left@-0.8' }, descBy: { unit: 'Humid exhaust air', cyc: 'Air from cyclone', bag: 'Filtered air', xfan: 'Exhaust to stack' } }),
        { id: 'fines', from: 'cyc', to: 'product', fp: 'bottom', tp: 'top', desc: 'Recovered fines' },
        { id: 'dust', from: 'bag', to: 'dust', fp: 'bottom', tp: 'left', desc: 'Filter dust' },
        ...chain(has, ['unit', 'cond', 'vac', 'vent'], 'v', { fpBy: { unit: 'top@0.5' }, cls: c.vacuum ? 'vacuum' : 'process', descBy: { unit: c.vacuum ? 'Vapour to condenser' : 'Vapour', cond: c.vacuum ? 'Non-condensables (vacuum suction)' : 'Non-condensables', vac: 'Vacuum system exhaust' } }).map(s => s.from === 'cond' && c.vacuum ? { ...s, note: 'VACUUM SUCTION' } : s.from === 'unit' ? { ...s, cls: 'process' } : s),
        { id: 'cnd', from: 'cond', to: 'condOut', fp: 'bottom', tp: 'left', desc: 'Condensate' },
        { id: 'motive', from: 'motive', to: 'vac', fp: 'left', tp: 'top', cls: 'utility', desc: 'Ejector motive steam' },
        { id: 'hm', from: 'heat', to: 'unit', fp: 'right', tp: 'bottom@-0.5', cls: 'utility', desc: 'Heating medium supply' },
        { id: 'hmr', from: 'unit', to: 'heatOut', fp: 'bottom@0.5', tp: 'left', cls: 'utility', desc: 'Heating medium return' },
        ...chain(has, ['unit', 'pconv', 'product'], 'p', { fpBy: { unit: spray ? 'bottom' : fb ? 'right@0.4' : 'right' }, laneBy: spray ? { unit: { y: 470 } } : {}, descBy: { unit: 'Dried product', pconv: 'Dried product' } })
      ];
    },
    env() { const b = balance(); return { b: b?.valid ? b : null }; },
    calc(s, v) {
      if (s.id === 'f_feed' || s.id === 'f_feeder') return { ph: 'S', m: v.b ? state.F : undefined, w: state.z };
      if (s.id.startsWith('p_')) return { ph: 'S', m: v.b?.P, w: state.x };
      if (s.id.startsWith('a_') || s.id.startsWith('x_')) return { ph: 'G' };
      if (s.id.startsWith('v_')) return { ph: 'V' };
      if (s.id === 'fines' || s.id === 'dust') return { ph: 'S' };
      if (s.id === 'stm' || s.id === 'motive') return { ph: 'V', w: 0 };
      return { ph: 'L' };
    },
    notes: v => [`Wet feed and dried product flows come from your balance. Water evaporated (${v.b ? v.b.R.toFixed(1) : '—'} kg/h) leaves in the exhaust air or vapour line; calculate the air flow from a psychrometric balance.`]
  },

  leaching: {
    aux: [
      { id: 'conveyor', label: 'Solids feed conveyor X-101', def: () => true },
      { id: 'solventPump', label: 'Solvent pump P-101', def: () => true },
      { id: 'solventHeater', label: 'Solvent heater E-101', def: () => false },
      { id: 'separator', label: 'Solid–liquid separator S-101', def: c => ['agitated', 'continuous'].includes(c.eq) },
      { id: 'liquorPump', label: 'Liquor pump P-102', def: () => true },
      { id: 'recovery', label: 'Solvent recovery evaporator EV-101', def: () => true }
    ],
    nodes: c => {
      const kind = state.equipment === 'agitated' ? 'tank_agitated' : state.equipment === 'continuous' ? 'dryer_box' : 'vessel';
      return [
        T('feed', state.diagram.feedLabel, 70, 420),
        c.aux('conveyor') && E('conv', 'X-101', 'Solids conveyor', 'conveyor', 205, 420, { fam: 'solids' }),
        T('solv', c.aux('recovery') ? 'Solvent make-up' : 'Fresh solvent', 70, 200),
        c.aux('solventPump') && E('spump', 'P-101', 'Solvent pump', 'pump', 190, 200, { fam: 'mover' }),
        c.aux('solventHeater') && E('sheat', 'E-101', 'Solvent heater', 'hx', 310, 200, { fam: 'heat' }),
        E('unit', state.diagram.unitTag, selectedEquipment().label, kind, 430, 340, { main: true, lab: 'below', bed: kind === 'vessel', belt: kind === 'dryer_box' }),
        c.aux('separator') && E('sep', 'S-101', state.equipment === 'continuous' ? 'Filter / washer' : 'Thickener', 'thickener', 620, 430, { fam: 'solids', lab: 'bl' }),
        T('spent', state.diagram.byproductLabel, 1030, 530),
        c.aux('liquorPump') && E('lpump', 'P-102', 'Liquor pump', 'pump', 740, 402, { fam: 'mover' }),
        c.aux('recovery') && E('evap', 'EV-102', 'Solvent recovery evaporator', 'evaporator', 880, 330, { lab: 'right', labDy: 60 }),
        c.aux('recovery') && E('scond', 'E-102', 'Solvent condenser', 'hx', 880, 120, { fam: 'heat', lab: 'br' }),
        c.aux('recovery') && T('steam', 'Steam', 765, 290, 'right', { fam: 'utility' }),
        T('product', state.diagram.productLabel, 1030, c.aux('recovery') ? 470 : 402)
      ];
    },
    streams: (c, has) => [
      ...chain(has, ['feed', 'conv', 'unit'], 'f', { tpBy: { unit: 'left@0.6' }, descBy: { feed: 'Solids feed', conv: 'Solids to leacher' } }),
      ...chain(has, ['solv', 'spump', 'sheat', 'unit'], 's', { tpBy: { unit: 'top@-0.4' }, descBy: { solv: c.aux('recovery') ? 'Solvent make-up' : 'Fresh solvent', spump: 'Pumped solvent', sheat: 'Heated solvent' } }),
      { id: 'slurry', from: 'unit', to: 'sep', fp: 'right@0.3', tp: 'left', desc: 'Leached slurry' },
      { id: 'uf', from: ['sep', 'unit'], to: 'spent', fp: 'bottom', tp: 'left', desc: 'Spent solids (underflow)' },
      ...chain(has, [has('sep') ? 'sep' : 'unit', 'lpump', 'evap', 'product'], 'l', { fpBy: { sep: 'right@-0.6', unit: 'right@-0.3', evap: 'bottom' }, tpBy: { evap: 'left@0.9' }, descBy: { sep: 'Pregnant solution', unit: 'Pregnant solution', lpump: 'Pumped pregnant solution', evap: 'Concentrated extract' } }),
      { id: 'ov', from: 'evap', to: 'scond', fp: 'top', tp: 'bottom', desc: 'Solvent vapour' },
      { id: 'rec', from: 'scond', to: ['spump', 'sheat', 'unit'], fp: 'left', tp: 'top', cls: 'recycle', desc: 'Recovered solvent recycle' },
      { id: 'stm', from: 'steam', to: 'evap', fp: 'right', tp: 'left@-0.5', cls: 'utility', desc: 'Heating steam' }
    ],
    env() { const b = balance(); return { b: b?.valid ? b : null }; },
    calc(s, v) { if (s.id === 'f_feed' || s.id === 'f_conv') return { ph: 'S', m: v.b ? state.F : undefined, w: state.z }; if (s.id === 'uf' || s.id === 'slurry') return { ph: 'S/L' }; if (s.id === 'ov' || s.id === 'stm') return { ph: 'V' }; return { ph: 'L' }; },
    notes: () => ['Only the solids feed is fixed by the two-stream balance because solvent is added. Enter solvent flow from your solvent/dry-solid ratio and underflow retention from your stage balance.']
  }
};

/* ---------- Context, model and routing ---------- */
function pfdStore(key) { state.diagram[key] ||= {}; state.diagram[key][state.operation] ||= {}; return state.diagram[key][state.operation]; }
function pfdContext() {
  const op = state.operation, tpl = PFD_TEMPLATES[op], stored = pfdStore('pfdAux');
  const ctx = { op, eq: state.equipment, mode: state.mode, cfg: state.configuration, vacSource: state.diagram.vacuumSource || 'pump' };
  ctx.vacuum = ctx.cfg === 'Vacuum' || (op === 'drying' && ctx.eq === 'freeze');
  ctx.direct = op === 'drying' && ctx.cfg === 'Direct-contact' && ctx.eq !== 'freeze';
  ctx.aux = id => { const d = tpl.aux.find(a => a.id === id); return d ? (stored[id] ?? d.def(ctx)) : false; };
  return ctx;
}
function pfdModel() {
  const ctx = pfdContext(), tpl = PFD_TEMPLATES[ctx.op], pos = pfdStore('pfdPositions');
  const nodes = tpl.nodes(ctx).filter(Boolean).map(n => {
    const [w0, h0] = PFD_KINDS[n.kind]; const w = n.kind === 'terminal' ? Math.max(84, String(n.label).length * 6.1 + 26) : w0;
    return { ...n, w, h: n.h || h0, x: pos[n.id]?.x ?? n.x, y: pos[n.id]?.y ?? n.y };
  });
  const byId = Object.fromEntries(nodes.map(n => [n.id, n])), has = id => Boolean(byId[id]);
  const pick = c => (Array.isArray(c) ? c : [c]).find(has);
  const streams = []; let no = 0;
  tpl.streams(ctx, has).filter(Boolean).forEach(s => {
    const from = pick(s.from), to = pick(s.to);
    if (!from || !to || from === to || streams.some(x => x.id === s.id)) return;
    streams.push({ ...s, from, to, cls: s.cls || 'process', no: ++no });
  });
  const env = tpl.env(ctx);
  return { ctx, tpl, nodes, byId, streams, env };
}
function pfdPort(n, spec) {
  const [side, f] = String(spec).split('@'), fr = Number(f) || 0, hw = n.w / 2, hh = n.h / 2;
  if (side === 'left') return { x: n.x - hw, y: n.y + fr * hh, d: [-1, 0] };
  if (side === 'right') return { x: n.x + hw, y: n.y + fr * hh, d: [1, 0] };
  if (side === 'top') return { x: n.x + fr * hw, y: n.y - hh, d: [0, -1] };
  return { x: n.x + fr * hw, y: n.y + hh, d: [0, 1] };
}
function autoPorts(a, b) { const dx = b.x - a.x, dy = b.y - a.y; return Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? ['right', 'left'] : ['left', 'right']) : (dy >= 0 ? ['bottom', 'top'] : ['top', 'bottom']); }
function pfdRoute(s, byId) {
  const a = byId[s.from], b = byId[s.to], [fa, ta] = autoPorts(a, b);
  const S = pfdPort(a, s.fp || fa), Z = pfdPort(b, s.tp || ta), pts = [[S.x, S.y]];
  if (s.lane) {
    const s1 = [S.x + S.d[0] * 14, S.y + S.d[1] * 14], e1 = [Z.x + Z.d[0] * 14, Z.y + Z.d[1] * 14];
    pts.push(s1); if (s.lane.y !== undefined) pts.push([s1[0], s.lane.y], [e1[0], s.lane.y]); else pts.push([s.lane.x, s1[1]], [s.lane.x, e1[1]]); pts.push(e1);
  } else {
    const sh = S.d[1] === 0, eh = Z.d[1] === 0;
    if (sh && eh) { const mx = (S.x + Z.x) / 2; pts.push([mx, S.y], [mx, Z.y]); }
    else if (!sh && !eh) { const my = (S.y + Z.y) / 2; pts.push([S.x, my], [Z.x, my]); }
    else if (sh) pts.push([Z.x, S.y]); else pts.push([S.x, Z.y]);
  }
  pts.push([Z.x, Z.y]);
  const clean = pts.filter((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 0.5);
  let best = { len: -1, mid: clean[0] };
  for (let i = 1; i < clean.length; i++) { const [x1, y1] = clean[i - 1], [x2, y2] = clean[i], len = Math.hypot(x2 - x1, y2 - y1); if (len > best.len) best = { len, mid: [(x1 + x2) / 2, (y1 + y2) / 2], horiz: Math.abs(y2 - y1) < 0.5 }; }
  return { d: 'M ' + clean.map(p => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L '), mid: best.mid, horiz: best.horiz, start: clean[0] };
}

/* ---------- Symbols ---------- */
function pfdSymbol(n) {
  const hw = n.w / 2, hh = n.h / 2, fill = n.main ? 'eq main' : `eq ${n.fam || ''}`;
  switch (n.kind) {
    case 'terminal': { const p = n.dir === 'left' ? `${hw},${-hh} ${-hw + 10},${-hh} ${-hw},0 ${-hw + 10},${hh} ${hw},${hh}` : `${-hw},${-hh} ${hw - 10},${-hh} ${hw},0 ${hw - 10},${hh} ${-hw},${hh}`; return `<polygon points="${p}" class="term ${n.fam || ''}"/><text class="term-label" text-anchor="middle" y="3.5" x="${n.dir === 'left' ? 4 : -4}">${esc(n.label)}</text>`; }
    case 'pump': return `<g ${n.flip ? 'transform="scale(-1 1)"' : ''}><path d="M -12 ${hh - 2} L -16 ${hh + 6} H 16 L 12 ${hh - 2}" class="${fill}"/><circle r="${hw}" class="${fill}"/><path d="M -7 -9 L 11 0 L -7 9 Z" class="sym-fill"/></g>`;
    case 'hx': return `<circle r="${hw}" class="${fill}"/><path d="M ${-hw} 0 L -11 -9 L -3 9 L 5 -9 L 13 9 L ${hw} 0" class="sym"/>`;
    case 'evaporator': return `<path d="M ${-hw} ${-hh + 22} Q 0 ${-hh - 10} ${hw} ${-hh + 22} V ${hh - 22} Q 0 ${hh + 10} ${-hw} ${hh - 22} Z" class="${fill}"/><path d="M ${-hw} ${-hh + 40} H ${hw} M ${-hw} ${hh - 40} H ${hw} M -18 ${-hh + 40} V ${hh - 40} M -6 ${-hh + 40} V ${hh - 40} M 6 ${-hh + 40} V ${hh - 40} M 18 ${-hh + 40} V ${hh - 40}" class="sym thin"/>`;
    case 'vessel': return `<rect x="${-hw}" y="${-hh}" width="${n.w}" height="${n.h}" rx="${hw}" class="${fill}"/>${n.bed ? `<path d="M ${-hw} -10 H ${hw} M ${-hw} 22 H ${hw} M ${-hw + 6} 20 L ${-hw + 20} -8 M -8 20 L 6 -8 M 8 20 L ${hw - 4} -6" class="sym thin"/>` : `<path d="M ${-hw + 8} ${-hh + 30} H ${hw - 8}" class="sym thin dash"/>`}`;
    case 'drum': return `<rect x="${-hw}" y="${-hh}" width="${n.w}" height="${n.h}" rx="${hh}" class="${fill}"/><path d="M ${-hw + 14} 6 H ${hw - 14}" class="sym thin dash"/>`;
    case 'column': {
      let inner = ''; const top = -hh + 30, bot = hh - 30, span = bot - top;
      if (n.internals === 'packed') inner = [0, 1].map(k => { const y1 = top + k * span / 2 + 8, y2 = top + (k + 1) * span / 2 - 8; return `<path d="M ${-hw} ${y1} H ${hw} M ${-hw} ${y2} H ${hw} M ${-hw} ${y1} L ${hw} ${y2} M ${hw} ${y1} L ${-hw} ${y2}" class="sym thin"/>`; }).join('');
      else if (n.internals === 'spray') inner = `<path d="M -14 ${top} v 14 M 0 ${top} v 18 M 14 ${top} v 14" class="sym thin dash"/>`;
      else if (n.internals === 'bubble') inner = [0.3, 0.5, 0.7].map(f => `<circle cx="${(f - 0.5) * 30}" cy="${top + span * f}" r="4" class="sym thin"/>`).join('');
      else if (n.internals === 'discs') inner = Array.from({ length: 6 }, (_, i) => `<path d="M -14 ${top + (i + 0.5) * span / 6} H 14" class="sym"/>`).join('') + `<path d="M 0 ${-hh} V ${hh}" class="sym thin"/>`;
      else { const k = Math.max(4, Math.round(span / 34)); inner = Array.from({ length: k }, (_, i) => { const y = top + (i + 0.5) * span / k; return i % 2 ? `<path d="M ${-hw * 0.55} ${y} H ${hw}" class="sym thin"/>` : `<path d="M ${-hw} ${y} H ${hw * 0.55}" class="sym thin"/>`; }).join(''); }
      return `<rect x="${-hw}" y="${-hh}" width="${n.w}" height="${n.h}" rx="${hw * 0.9}" class="${fill}"/>${inner}`;
    }
    case 'vacpump': return `<circle r="${hw}" class="${fill}"/><circle cx="4" cy="-3" r="${hw * 0.5}" class="sym thin"/><text class="sym-text" text-anchor="middle" y="4" x="4">V</text>`;
    case 'ejector': return `<polygon points="${-hw},${-hh} -6,-4 6,-4 ${hw},${-hh} ${hw},${hh} 6,4 -6,4 ${-hw},${hh}" class="${fill}"/>`;
    case 'fan': return `<circle r="${hw}" class="${fill}"/><path d="M 0 0 L -10 -14 L 6 -14 Z M 0 0 L 10 14 L -6 14 Z" class="sym-fill"/>`;
    case 'cyclone': return `<path d="M ${-hw} ${-hh} H ${hw} V ${-hh + 34} L 6 ${hh} H -6 L ${-hw} ${-hh + 34} Z" class="${fill}"/><path d="M -8 ${-hh - 6} V ${-hh + 22} M 8 ${-hh - 6} V ${-hh + 22}" class="sym thin"/>`;
    case 'bagfilter': return `<path d="M ${-hw} ${-hh} H ${hw} V ${hh - 26} L 8 ${hh} H -8 L ${-hw} ${hh - 26} Z" class="${fill}"/><path d="M -16 ${-hh + 10} V ${hh - 34} M -5 ${-hh + 10} V ${hh - 34} M 6 ${-hh + 10} V ${hh - 34} M 17 ${-hh + 10} V ${hh - 34}" class="sym thin"/>`;
    case 'conveyor': return `<rect x="${-hw}" y="${-hh}" width="${n.w}" height="${n.h}" rx="4" class="${fill}"/><path d="M ${-hw + 8} 0 ${Array.from({ length: 8 }, (_, i) => `L ${-hw + 14 + i * 9.5} ${i % 2 ? 8 : -8}`).join(' ')}" class="sym thin"/>`;
    case 'dryer_rotary': return `<rect x="${-hw}" y="${-hh}" width="${n.w}" height="${n.h}" rx="10" class="${fill}"/><path d="M ${-hw + 34} ${-hh - 5} V ${hh + 5} M ${hw - 34} ${-hh - 5} V ${hh + 5}" class="sym"/><path d="M ${-hw + 50} 10 l 12 -12 M ${-hw + 80} 10 l 12 -12 M ${-hw + 110} 10 l 12 -12" class="sym thin"/>`;
    case 'dryer_spray': return `<path d="M ${-hw} ${-hh + 12} Q 0 ${-hh - 6} ${hw} ${-hh + 12} V 20 L 10 ${hh} H -10 L ${-hw} 20 Z" class="${fill}"/><path d="M -8 ${-hh + 16} L 0 ${-hh + 26} L 8 ${-hh + 16} M 0 ${-hh + 26} L -22 ${-hh + 60} M 0 ${-hh + 26} L 22 ${-hh + 60}" class="sym thin dash"/>`;
    case 'dryer_fb': return `<rect x="${-hw}" y="${-hh}" width="${n.w}" height="${n.h}" rx="8" class="${fill}"/><path d="M ${-hw} ${hh - 28} H ${hw}" class="sym dash"/><circle cx="-14" cy="${hh - 44}" r="4" class="sym thin"/><circle cx="6" cy="${hh - 56}" r="4" class="sym thin"/><circle cx="18" cy="${hh - 40}" r="4" class="sym thin"/>`;
    case 'dryer_box': return `<rect x="${-hw}" y="${-hh}" width="${n.w}" height="${n.h}" rx="6" class="${fill}"/>${n.belt ? `<rect x="${-hw + 14}" y="-6" width="${n.w - 28}" height="14" rx="7" class="sym thin"/>` : n.shelves ? `<path d="M ${-hw + 12} -20 H ${hw - 12} M ${-hw + 12} 0 H ${hw - 12} M ${-hw + 12} 20 H ${hw - 12}" class="sym thin"/>` : `<path d="M ${-hw + 12} 10 H ${hw - 12}" class="sym thin dash"/>`}`;
    case 'mixer_settler': return `<rect x="${-hw}" y="${-hh}" width="${n.w}" height="${n.h}" rx="5" class="${fill}"/><path d="M ${-hw + 55} ${-hh} V ${hh} M ${-hw + 27} ${-hh - 10} V 8 M ${-hw + 15} 8 H ${-hw + 39}" class="sym"/><path d="M ${-hw + 60} 4 H ${hw - 6}" class="sym thin dash"/>`;
    case 'centrifuge': return `<circle r="${hw}" class="${fill}"/><circle r="${hw * 0.55}" class="sym thin"/><path d="M -12 0 H 12 M 0 -12 V 12" class="sym thin"/>`;
    case 'tank_agitated': return `<path d="M ${-hw} ${-hh + 8} V ${hh - 18} Q 0 ${hh + 10} ${hw} ${hh - 18} V ${-hh + 8} Z" class="${fill}"/><rect x="-10" y="${-hh - 12}" width="20" height="14" class="${fill}"/><path d="M 0 ${-hh + 2} V ${hh - 26} M -18 ${hh - 26} H 18" class="sym"/>`;
    case 'thickener': return `<path d="M ${-hw} ${-hh} H ${hw} V ${-hh + 24} L 12 ${hh} H -12 L ${-hw} ${-hh + 24} Z" class="${fill}"/><path d="M -38 ${-hh + 20} L 0 ${hh - 12} L 38 ${-hh + 20}" class="sym thin dash"/>`;
    default: return `<rect x="${-hw}" y="${-hh}" width="${n.w}" height="${n.h}" rx="6" class="${fill}"/>`;
  }
}
function pfdLabel(n) {
  if (n.kind === 'terminal') return '';
  const hw = n.w / 2, hh = n.h / 2, dy = n.labDy || 0, lab = n.lab || 'below';
  const at = { below: [0, hh + 15, 'middle'], above: [0, -hh - 22, 'middle'], right: [hw + 8, -4, 'start'], left: [-hw - 8, -4, 'end'], br: [hw + 4, hh + 8, 'start'], bl: [-hw - 4, hh + 8, 'end'] }[lab];
  return `<text class="eq-tag" x="${at[0]}" y="${at[1] + dy}" text-anchor="${at[2]}">${esc(n.tag)}</text><text class="eq-name" x="${at[0]}" y="${at[1] + dy + 13}" text-anchor="${at[2]}">${esc(n.name)}</text>`;
}
function pfdEdgesSVG(model) {
  return model.streams.map(s => {
    const r = pfdRoute(s, model.byId), [mx, my] = r.mid;
    return `<g class="stream ${s.cls}"><path d="${r.d}" class="line" marker-end="url(#pfd-arrow-${s.cls})"/><g transform="translate(${mx} ${my})"><rect x="-9" y="-9" width="18" height="18" transform="rotate(45)" class="dia"/><text text-anchor="middle" y="3.5" class="dia-no">${s.no}</text></g></g>`;
  }).join('');
}
function pfdNotesSVG(model) {
  return model.streams.filter(s => s.note).map(s => {
    const r = pfdRoute(s, model.byId), [mx, my] = r.mid;
    return r.horiz ? `<text class="edge-note" text-anchor="middle" x="${mx}" y="${my - 15}">${s.note}</text>` : `<text class="edge-note" x="${mx + 14}" y="${my + 4}">${s.note}</text>`;
  }).join('');
}

const PFD_CSS = `.pfd-svg{font-family:"DM Sans",Arial,sans-serif}
.pfd-svg .bg{fill:#fbfdff}.pfd-svg .grid{stroke:#e3ecf7;stroke-width:1}
.pfd-svg .eq{fill:#fff;stroke:#10264f;stroke-width:2}.pfd-svg .eq.main{fill:#dfeeff;stroke:#0756c9;stroke-width:2.5}
.pfd-svg .eq.mover{fill:#fff6c9}.pfd-svg .eq.heat{fill:#ffe6f1}.pfd-svg .eq.vacuum{fill:#efe6ff;stroke:#6b35c0}.pfd-svg .eq.solids{fill:#e3f7ee}
.pfd-svg .sym{fill:none;stroke:#10264f;stroke-width:2}.pfd-svg .sym.thin{stroke-width:1.3}.pfd-svg .sym.dash{stroke-dasharray:5 4}.pfd-svg .sym-fill{fill:#10264f}.pfd-svg .sym-text{font:700 11px "DM Sans",Arial;fill:#6b35c0}
.pfd-svg .term{fill:#fff;stroke:#10264f;stroke-width:1.5}.pfd-svg .term.utility{stroke:#079668;fill:#f0fbf6}
.pfd-svg .term-label{font:700 10px "DM Sans",Arial;fill:#10264f;pointer-events:none}
.pfd-svg .eq-tag{font:700 11px "Space Mono",monospace;fill:#0756c9;pointer-events:none}.pfd-svg .eq-name{font:500 10px "DM Sans",Arial;fill:#41567a;pointer-events:none}
.pfd-svg .stream .line{fill:none;stroke-width:2.2}.pfd-svg .process .line{stroke:#0a3f9c}.pfd-svg .utility .line{stroke:#079668;stroke-dasharray:7 4}.pfd-svg .vacuum .line{stroke:#6b35c0;stroke-dasharray:3 3;stroke-width:2.6}.pfd-svg .recycle .line{stroke:#d63384}
.pfd-svg .dia{fill:#fff;stroke-width:1.6}.pfd-svg .process .dia{stroke:#0a3f9c}.pfd-svg .utility .dia{stroke:#079668}.pfd-svg .vacuum .dia{stroke:#6b35c0}.pfd-svg .recycle .dia{stroke:#d63384}
.pfd-svg .dia-no{font:700 10px "Space Mono",monospace;fill:#10264f}.pfd-svg .edge-note{font:700 9px "Space Mono",monospace;fill:#6b35c0;letter-spacing:.04em;paint-order:stroke;stroke:#fbfdff;stroke-width:3px}
.pfd-svg marker polygon{stroke:none}.pfd-svg #pfd-arrow-process polygon{fill:#0a3f9c}.pfd-svg #pfd-arrow-utility polygon{fill:#079668}.pfd-svg #pfd-arrow-vacuum polygon{fill:#6b35c0}.pfd-svg #pfd-arrow-recycle polygon{fill:#d63384}
.pfd-svg .title{font:700 12px "Space Mono",monospace;fill:#0a358a}.pfd-svg .legend text{font:500 10px "DM Sans",Arial;fill:#41567a}
.pfd-svg .diagram-node.draggable{cursor:grab}.pfd-svg .diagram-node.dragging{cursor:grabbing}`;

function renderPFD(draggable = true) {
  const m = pfdModel(), { w, h } = PFD_VIEW;
  const markers = [['process', '#0a3f9c'], ['utility', '#079668'], ['vacuum', '#6b35c0'], ['recycle', '#d63384']].map(([k, c]) => `<marker id="pfd-arrow-${k}" markerWidth="9" markerHeight="8" refX="8" refY="4" orient="auto" markerUnits="userSpaceOnUse"><polygon points="0 0, 9 4, 0 8" fill="${c}"/></marker>`).join('');
  const grid = Array.from({ length: Math.floor(w / 50) }, (_, i) => `<path d="M ${(i + 1) * 50} 0 V ${h}" class="grid"/>`).join('') + Array.from({ length: Math.floor(h / 50) }, (_, i) => `<path d="M 0 ${(i + 1) * 50} H ${w}" class="grid"/>`).join('');
  const nodes = m.nodes.map(n => `<g class="diagram-node ${draggable ? 'draggable' : ''}" data-node="${n.id}" transform="translate(${n.x} ${n.y})">${pfdSymbol(n)}${pfdLabel(n)}</g>`).join('');
  const legend = [['process', 'Process'], ['recycle', 'Recycle'], ['utility', 'Utility'], ['vacuum', 'Vacuum']].map(([k, l], i) => `<g class="stream ${k}" transform="translate(${24 + i * 92} ${h - 18})"><path d="M 0 0 H 26" class="line"/><text x="32" y="3.5">${l}</text></g>`).join('');
  return `<svg class="process-svg pfd-svg" id="processSvg" data-pfd="1" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Process flow diagram"><style>${PFD_CSS}</style><defs>${markers}</defs><rect width="${w}" height="${h}" class="bg"/>${grid}<text x="24" y="26" class="title">PFD · ${esc(operations[state.operation].name.toUpperCase())} · ${esc(state.mode.toUpperCase())} · ${esc(state.configuration.toUpperCase())}</text><g id="pfdEdges">${pfdEdgesSVG(m)}</g>${nodes}<g id="pfdNotes">${pfdNotesSVG(m)}</g><g class="legend">${legend}</g></svg>`;
}

/* ---------- Stream table ---------- */
const fmt = (v, d = 1) => Number.isFinite(v) ? Number(v).toFixed(d) : '';
function pfdStreamRows(m = pfdModel()) {
  const user = pfdStore('streamData');
  return m.streams.map(s => {
    const calc = m.tpl.calc(s, m.env) || {}, u = user[s.id] || {}, row = { s, ph: calc.ph || '—', cells: {} };
    [['T', 1], ['P', 1], ['m', 1], ['w', 1]].forEach(([k, d]) => {
      let val = calc[k]; if (k === 'w' && Number.isFinite(val)) val *= 100;
      if (k === 'm' && calc.util && Number.isFinite(val) && basis() === 'mole') val /= 18.015;
      row.cells[k] = Number.isFinite(val) ? { v: fmt(val, d), auto: true } : { v: u[k] ?? '', auto: false };
    });
    return row;
  });
}
function renderStreamTable(editable = true, m = pfdModel()) {
  const rows = pfdStreamRows(m), name = id => { const n = m.byId[id]; return n.kind === 'terminal' ? n.label : n.tag; };
  const cell = (r, k) => r.cells[k].auto ? `<td class="num auto">${r.cells[k].v}</td>` : editable ? `<td class="num"><input class="stream-input" data-stream="${r.s.id}" data-key="${k}" inputmode="decimal" value="${esc(r.cells[k].v)}" aria-label="Stream ${r.s.no} ${k}" placeholder="enter"></td>` : `<td class="num user">${esc(r.cells[k].v) || '—'}</td>`;
  const key = state.operation === 'evaporation' ? 'Solute' : 'Key comp.', u = basisUnits();
  return `<div class="data-table-wrap"><table class="data-table stream-table"><thead><tr><th>NO.</th><th>STREAM</th><th>FROM → TO</th><th>PHASE</th><th>T (°C)</th><th>P (kPa abs)</th><th>FLOW (${u.flow})</th><th>${key} (${u.pct})</th></tr></thead><tbody>${rows.map(r => `<tr class="${r.s.cls}"><td><span class="stream-no ${r.s.cls}">${r.s.no}</span></td><td>${esc(r.s.desc)}</td><td class="muted">${esc(name(r.s.from))} → ${esc(name(r.s.to))}</td><td>${r.ph}</td>${cell(r, 'T')}${cell(r, 'P')}${cell(r, 'm')}${cell(r, 'w')}</tr>`).join('')}</tbody></table></div><ul class="stream-notes">${m.tpl.notes(m.env).map(t => `<li>${esc(t)}</li>`).join('')}<li>Flows are on your ${basis()} basis${basis() === 'mole' ? '; steam and cooling water are converted with M = 18.015 kg/kmol' : ''}. Bold values are calculated from your earlier stages; blank cells are yours to fill from your own calculations.</li></ul>`;
}

/* ---------- Consistency checks ---------- */
function pfdChecks(m = pfdModel()) {
  const c = m.ctx, a = c.aux, out = [], v = m.env, brief = `${state.projectTitle} ${state.constraints} ${state.feedDescription}`;
  const crit = (pass, label, detail) => out.push({ pass, severity: 'critical', label, detail });
  const warn = (pass, label, detail) => out.push({ pass, severity: 'warning', label, detail });
  const vacName = c.vacSource === 'ejector' ? 'steam-jet ejector' : 'vacuum pump';
  if (c.op === 'evaporation') {
    if (c.vacuum) {
      crit(a('condenser'), 'Vacuum service has a condenser', 'Under vacuum, the vapour must be condensed first so the vacuum system only handles non-condensable gas. Add condenser E-102.');
      crit(a('vacuum') && a('condenser'), 'Vacuum drawn from the condenser vent', `The vacuum is pulled from the condenser's non-condensable outlet, not the evaporator body. Add the ${vacName} on the condenser vent.`);
      warn(v.Pev < 101.3, 'Operating pressure is below atmospheric', `The vapour is saturated at ${v.Tv.toFixed(0)} °C, which means ${v.Pev.toFixed(0)} kPa abs: not below atmospheric pressure. Lower the operating temperature in Test or choose atmospheric operation.`);
      if (a('condenser')) warn(v.Tv >= 45, 'Condenser can reject heat to cooling water', `Vapour condenses at about ${v.Tv.toFixed(0)} °C. Cooling water at 30 → 40 °C needs roughly a 5 K approach, so it cannot condense vapour this cold. Use chilled water or raise the operating temperature.`);
      warn(a('productPump'), 'Concentrate can leave the vacuum vessel', 'Liquid will not drain by gravity from a vessel under vacuum. Add product pump P-102 or specify a barometric leg in your report.');
      if (a('condenser')) warn(a('condPump'), 'Condensate can leave the vacuum system', 'Condensate is also under vacuum. Add condensate pump P-103 or specify a barometric leg.');
    } else {
      warn(!a('vacuum'), 'Vacuum system matches the configuration', 'You drew a vacuum system but selected atmospheric operation. Change the configuration in Pick, or remove the vacuum system.');
      warn(!/heat.?sensitive/i.test(brief), 'Thermal protection for a heat-sensitive feed', 'The brief mentions a heat-sensitive feed, but the evaporator boils at 100 °C. Consider vacuum operation.');
    }
    if (c.eq === 'forced_circulation') crit(a('circPump'), 'Forced circulation has a circulation pump', 'A forced-circulation evaporator depends on circulation pump P-104 to keep tube velocity high and suppress boiling in the tubes.');
    warn(Number.isFinite(v.steam), 'Steam demand is calculated', 'Complete the thermal duty in Calculate so the steam flow can be filled in.');
    if (c.mode === 'Multiple effect') warn(false, 'Multiple effect is drawn as one effect', 'The PFD shows the last effect of the train. In your report, draw every effect, with vapour from effect n heating effect n + 1 at falling pressure. Use the effect table in Test for the stream conditions.');
  }
  if (c.op === 'distillation') {
    crit(a('condenser'), 'Column has an overhead condenser', 'Without a condenser there is no liquid reflux. Add E-102.');
    crit(a('drum'), 'Column has a reflux drum', 'The reflux drum provides surge volume and splits reflux from distillate. Add V-101.');
    crit(a('reboiler') || c.eq === 'batch_still', 'Column has a reboiler', 'The reboiler generates boil-up vapour. Add E-103.');
    warn(a('refluxPump'), 'Reflux is pumped', 'Reflux normally needs pump P-102 unless the drum is elevated for gravity return.');
    if (c.vacuum) crit(a('vacuum') && a('drum'), 'Vacuum drawn from the reflux drum', `Connect the ${vacName} to the reflux drum vent, downstream of the condenser.`);
    else warn(!a('vacuum'), 'Vacuum system matches the configuration', 'You drew a vacuum system but did not select vacuum operation.');
    warn(a('feedPump'), 'Feed is pumped into the column', 'Add feed pump P-101 to overcome column pressure and elevation.');
  }
  if (c.op === 'absorption') {
    crit(a('solventPump'), 'Solvent is pumped to the absorber top', 'Solvent enters at the top of the column and needs pump P-101.');
    warn(a('blower'), 'Gas feed can overcome pressure drop', 'Add gas blower K-101 to overcome the packing or tray pressure drop.');
    warn(a('regen'), 'Solvent is regenerated', 'Rich solvent leaves the process. Justify single-pass solvent use (cost, disposal) or add stripper T-102.');
    if (a('regen')) { warn(a('solventCooler'), 'Lean solvent is cooled', 'Gas solubility falls as temperature rises. Cool the regenerated solvent (E-101) before it returns to the absorber.'); warn(a('richPump'), 'Rich solvent is pumped to the stripper', 'Add rich solvent pump P-102.'); }
  }
  if (c.op === 'extraction') {
    warn(a('feedPump') && a('solventPump'), 'Both liquid feeds are pumped', 'Add feed pump P-101 and solvent pump P-102.');
    warn(a('recovery'), 'Solvent is recovered', 'Without recovery, solvent leaves in the extract. Add recovery column T-101 or justify single-pass use.');
    if (a('recovery')) warn(a('raffStripper'), 'Solvent in the raffinate is addressed', 'Some solvent dissolves in the raffinate. Add stripper T-102 or state the expected solvent loss.');
  }
  if (c.op === 'drying') {
    if (c.direct) {
      crit(a('heater'), 'Drying air is heated', 'Direct-contact drying needs hot air. Add air heater E-101.');
      crit(a('fan') || a('exhaustFan'), 'Air is moved by a fan', 'Add supply fan K-101 and/or exhaust fan K-102.');
      const dusty = ['spray', 'fluidised_bed'].includes(c.eq);
      (dusty ? crit : warn)(a('cyclone') || a('bagFilter'), 'Exhaust air is de-dusted', 'Exhaust air carries fine product. Add cyclone S-101 and, for fine powders, bag filter S-102.');
    }
    if (c.vacuum) { crit(a('condenser'), 'Vacuum drying has a condenser', 'Condense the water vapour before the vacuum system. Add E-102.'); crit(a('vacuum') && a('condenser'), 'Vacuum drawn from the condenser', `Connect the ${vacName} after the condenser.`); }
    warn(a('feeder'), 'Wet feed has a feeder', 'Add a conveyor or pump so the feed rate can be controlled.');
  }
  if (c.op === 'leaching') {
    (['agitated', 'continuous'].includes(c.eq) ? crit : warn)(a('separator'), 'Solids are separated from the solution', 'Add solid–liquid separator S-101 (thickener or filter) to recover pregnant solution from the slurry.');
    warn(a('recovery'), 'Solvent is recovered', 'Add solvent recovery EV-102 or justify single-pass solvent use.');
  }
  const blanks = pfdStreamRows(m).reduce((n, r) => n + ['T', 'P', 'm'].filter(k => !r.cells[k].auto && !String(r.cells[k].v).trim()).length, 0);
  warn(blanks === 0, 'Stream table is complete', `${blanks} temperature, pressure or flow value${blanks === 1 ? ' is' : 's are'} still blank. Fill them from your own calculations.`);
  return out;
}
function pfdCritical() { return pfdChecks().filter(x => !x.pass && x.severity === 'critical'); }

/* ---------- Builder panel ---------- */
function renderPfdOptions() {
  const c = pfdContext(), tpl = PFD_TEMPLATES[c.op];
  const boxes = tpl.aux.map(d => `<label><input type="checkbox" data-pfd-aux="${d.id}" ${c.aux(d.id) ? 'checked' : ''}> ${esc(d.label)}</label>`).join('');
  const hasVac = tpl.aux.some(d => d.vacuumSource) && c.aux('vacuum');
  const vac = hasVac ? `<div class="field vac-source"><label for="vacSource">Vacuum source</label><select id="vacSource"><option value="pump" ${c.vacSource === 'pump' ? 'selected' : ''}>Liquid-ring vacuum pump</option><option value="ejector" ${c.vacSource === 'ejector' ? 'selected' : ''}>Steam-jet ejector</option></select></div>` : '';
  return `<div class="field full"><span class="group-label">Equipment on the PFD (${esc(operations[c.op].name)} · ${esc(c.cfg)})</span><div class="diagram-options">${boxes}</div>${vac}</div>`;
}
function renderPfdChecks() {
  const checks = pfdChecks();
  return `<div class="diagnostic-list pfd-checks">${checks.map(ch => `<div class="diagnostic ${ch.pass ? 'pass' : ch.severity === 'critical' ? 'fail' : 'conditional'}"><b>${ch.pass ? '✓' : ch.severity === 'critical' ? '×' : '!'}</b><div><strong>${esc(ch.label)}</strong><span>${ch.pass ? 'Consistent with your selected route.' : esc(ch.detail)}</span></div></div>`).join('')}</div>`;
}
