/* SPECTRA drying model (direct-contact air drying)
   Psychrometrics for air–water at 101.325 kPa, wet-bulb temperature, constant drying rate from
   h = 0.0204 G^0.8 (air parallel to the surface; Geankoplis), constant- and falling-rate drying time
   (linear falling rate to X*), tray or belt area, dry-air flow on the adiabatic line, heater duty.
   Loaded before app.js; uses its globals at call time. */

const PSY = {
  P: 101.325,
  H(pw) { return 0.622 * pw / (this.P - pw); },                          // kg water / kg dry air
  pw(H) { return H * this.P / (0.622 + H); },
  Hsat(T) { return this.H(water.psat(T)); },
  cs(H) { return 1.005 + 1.88 * H; },                                    // humid heat, kJ/kg dry air K
  vH(H, T) { return (2.83e-3 + 4.56e-3 * H) * (T + 273.15); },           // humid volume, m³/kg dry air
  RH(H, T) { return this.pw(H) / water.psat(T); },
  wetBulb(T, H) { let lo = -10, hi = T; for (let i = 0; i < 80; i++) { const Tw = (lo + hi) / 2, f = this.Hsat(Tw) - H - this.cs(H) * (T - Tw) / water.latent(Tw); if (f > 0) hi = Tw; else lo = Tw; } return (lo + hi) / 2; }
};
function dryingModel(v = currentSimValues(), opt = {}) {
  const mb = opt.mb || massBalance(); if (!mb) return { error: 'Complete a valid mass balance on a mass basis (dry-solids fractions).' };
  const z = mb.z, x = mb.x; if (!(z > 0 && z < 1 && x > z && x <= 1)) return { error: 'Enter dry-solids fractions: the product must contain more dry solid than the feed (x > z).' };
  const X1 = (1 - z) / z, X2 = (1 - x) / x, Xc = Number(v.criticalX), Xe = Number(v.equilibriumX);
  if (!(X2 > Xe)) return { error: `The target moisture (${X2.toFixed(3)} kg/kg dry solid) is at or below the equilibrium moisture (${Xe}). Air at these conditions cannot dry the product that far.` };
  const T0 = Number(v.ambientT), T1 = Number(v.airInletTemp), T2 = Number(v.exhaustTemp), loading = Number(v.loading);
  const H0 = PSY.H(Number(v.ambientRH) / 100 * water.psat(T0)), H1 = H0;
  const Tw = PSY.wetBulb(T1, H1), lamW = water.latent(Tw);
  const rhoAir = (1 + H1) / PSY.vH(H1, T1), G = rhoAir * Number(v.airVelocity) * 3600, h = 0.0204 * Math.pow(G, 0.8);
  const Rc = Number(v.constantRate) > 0 ? Number(v.constantRate) : h * (T1 - Tw) * 3600 / (lamW * 1000);
  const tc = X1 > Xc ? loading * (X1 - Xc) / Rc : 0;
  const tf = loading * (Xc - Xe) / Rc * Math.log((Math.min(X1, Xc) - Xe) / (X2 - Xe));
  const t = tc + tf, Ls = mb.F * z, batch = /batch/.test(state.flowUnit || '') || state.mode === 'Batch';
  const area = batch ? Ls / loading : Ls * t / loading;
  const E = mb.R, rate = batch ? E / Math.max(t, 1e-6) : E;                  // kg water per hour
  const H2 = H1 + PSY.cs(H1) * (T1 - T2) / lamW, Gdry = rate / (H2 - H1);
  const Q = Gdry * PSY.cs(H0) * (T1 - T0) / 3600, RH2 = PSY.RH(H2, T2), eff = (T1 - T2) / (T1 - T0);
  return { X1, X2, Xc, Xe, T0, T1, T2, H0, H1, H2, Tw, G, h, Rc, tc, tf, t, Ls, area, E, rate, Gdry, Q, RH2, eff, batch, dewExhaust: PSY.wetBulb(T2, H2) };
}
function dryingChecks(m, v, critical, warning) {
  critical(v.airInletTemp > v.exhaustTemp, 'Air cools as it dries the product', 'The exhaust temperature must be below the air inlet temperature.');
  critical(m.RH2 < 1, 'Exhaust air is not saturated', `At ${m.T2} °C the exhaust would be ${(m.RH2 * 100).toFixed(0)}% saturated: raise the exhaust temperature or the air flow.`);
  warning(m.RH2 <= 0.85, 'Margin against condensation in the exhaust', `Exhaust relative humidity ${(m.RH2 * 100).toFixed(0)}%. Above about 85%, moisture can condense in ducts and the cyclone.`);
  warning(m.G >= 2450 && m.G <= 29300, 'Heat-transfer correlation within its range', `Air mass velocity ${m.G.toFixed(0)} kg/h m² is outside 2,450–29,300, the range of h = 0.0204 G^0.8. Justify the flux another way.`);
  warning(v.airInletTemp <= 70 || !/70\s*°?C|heat.?sensitive/i.test(`${state.constraints} ${state.productTarget}`), 'Product temperature in the falling-rate period', `During falling-rate drying the product surface rises from the wet-bulb (${m.Tw.toFixed(0)} °C) towards the air temperature (${v.airInletTemp} °C), above the 70 °C limit. Lower the air temperature or dry in two stages.`);
}
const DRYING_CONTROLS = [['airInletTemp', 'Air temperature entering the dryer', '°C', 35, 150, 1, 70], ['exhaustTemp', 'Exhaust air temperature', '°C', 25, 120, 1, 45], ['ambientT', 'Ambient air temperature', '°C', 15, 40, 0.5, 30], ['ambientRH', 'Ambient relative humidity', '%', 20, 100, 1, 80], ['airVelocity', 'Air velocity over the product', 'm/s', 0.5, 10, 0.1, 3], ['loading', 'Dry-solid loading on trays or belt', 'kg m⁻²', 1, 50, 0.5, 8], ['criticalX', 'Critical moisture content, Xc', 'kg/kg dry solid', 0.05, 4, 0.01, 1], ['equilibriumX', 'Equilibrium moisture content, X*', 'kg/kg dry solid', 0, 0.5, 0.005, 0.06], ['constantRate', 'Measured constant-rate flux (0 = calculate)', 'kg m⁻² h⁻¹', 0, 20, 0.1, 0]];
