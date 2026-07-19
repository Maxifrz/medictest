// -----------------------------------------------------------------------------
// Pharmakokinetik-Modell (Phase 1)
// -----------------------------------------------------------------------------
// 3-Kompartiment-Modell (zentral / gut durchblutet / Fett) mit Resorptionsdepot
// und aktivem Metaboliten (11-OH-THC). Bewusst VEREINFACHT — kein echtes PBPK.
// Der Zeitverlauf wird hier client-seitig per Runge-Kutta (RK4) integriert, damit
// die App buildless bleibt. Ein spaeteres Python/PBPK-Backend (DESIGN §6.1) kann
// diese Datei hinter gleicher Schnittstelle ersetzen.
//
// Zustandsvektor y = [Depot, Zentral, GutDurchblutet, Fett, Metabolit]  (Mengen in mg)

// Zuordnung Koerperregion → Kompartiment + illustrative Gewebe-Skalierung (≈ Kp,
// Gewebe-zu-Kompartiment-Verhaeltnis). Rein zur Visualisierung, KEIN organspezifisches
// PBPK — entsprechend im UI gekennzeichnet.
export const REGION_PK_MAP = {
  adipose:          { comp: "fat",     partition: 3.0 },
  brain:            { comp: "central", partition: 1.0 },
  liver:            { comp: "central", partition: 1.2 },
  lung:             { comp: "central", partition: 1.0 },
  kidney:           { comp: "central", partition: 0.9 },
  heart:            { comp: "central", partition: 0.8 },
  intestine:        { comp: "central", partition: 0.8 },
  spleen:           { comp: "central", partition: 0.7 },
  spinalCord:       { comp: "central", partition: 0.7 },
  peripheralNerves: { comp: "central", partition: 0.5 },
  eyes:             { comp: "central", partition: 0.4 },
};

function num(x) {
  // akzeptiert sowohl blanke Zahl als auch Provenienz-Objekt {value, ...}
  return typeof x === "object" && x !== null ? Number(x.value) : Number(x);
}

// Baut die effektiven Modellparameter aus den JSON-Rohdaten + Route + Dosis.
function buildParams(pkData, route, doseMg) {
  const d = pkData.disposition;
  const r = pkData.routes[route];
  return {
    Vc: num(d.Vc), Vp: num(d.Vp), Vf: num(d.Vf),
    CL: num(d.CL), Q12: num(d.Q12), Q13: num(d.Q13),
    fm: num(d.fm), Vm: num(d.Vm), CLm: num(d.CLm),
    ka: r.ka == null ? 0 : num(r.ka),
    F: num(r.F),
    route,
    doseMg,
  };
}

function derivatives(y, p) {
  const [Ad, Ac, Ap, Af, Am] = y;
  const kel = p.CL / p.Vc;
  const k12 = p.Q12 / p.Vc, k21 = p.Q12 / p.Vp;
  const k13 = p.Q13 / p.Vc, k31 = p.Q13 / p.Vf;
  const kelm = p.CLm / p.Vm;

  const absorb = p.ka * Ad;
  const elim = kel * Ac;

  return [
    -absorb,
    absorb - elim - k12 * Ac + k21 * Ap - k13 * Ac + k31 * Af,
    k12 * Ac - k21 * Ap,
    k13 * Ac - k31 * Af,
    p.fm * elim - kelm * Am,
  ];
}

function rk4Step(y, p, dt) {
  const add = (a, b, s) => a.map((v, i) => v + b[i] * s);
  const k1 = derivatives(y, p);
  const k2 = derivatives(add(y, k1, dt / 2), p);
  const k3 = derivatives(add(y, k2, dt / 2), p);
  const k4 = derivatives(add(y, k3, dt), p);
  return y.map((v, i) => v + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
}

// mg/L → ng/mL (1 mg/L = 1000 ng/mL)
const MG_PER_L_TO_NG_PER_ML = 1000;

/**
 * Simuliert den Konzentrations-Zeit-Verlauf.
 * @returns {{
 *   t:number[], thc:number[], metab:number[],
 *   regions:Record<string,number[]>,          // Glow-Intensitaet 0..1 je Region & Zeit
 *   stats:{ cmaxThc:number, tmaxThc:number, cmaxMetab:number, tmaxMetab:number, halfLifeH:number|null }
 * }}
 */
export function simulate(pkData, { route, doseMg, tMaxH = 48, dtH = 0.02 }) {
  const p = buildParams(pkData, route, doseMg);

  // Anfangsbedingungen
  let y;
  if (route === "iv") y = [0, doseMg, 0, 0, 0];
  else y = [doseMg * p.F, 0, 0, 0, 0]; // nur bioverfuegbarer Anteil wird verfolgt

  const steps = Math.round(tMaxH / dtH);
  const t = new Array(steps + 1);
  const thc = new Array(steps + 1);
  const metab = new Array(steps + 1);
  const regionConc = {}; // Roh-Konzentrationen (ng/mL) je Region
  for (const region of Object.keys(REGION_PK_MAP)) regionConc[region] = new Array(steps + 1);

  for (let i = 0; i <= steps; i++) {
    const [, Ac, , Af, Am] = y;
    const cCentral = (Ac / p.Vc) * MG_PER_L_TO_NG_PER_ML;
    const cFat = (Af / p.Vf) * MG_PER_L_TO_NG_PER_ML;
    const cMetab = (Am / p.Vm) * MG_PER_L_TO_NG_PER_ML;

    t[i] = i * dtH;
    thc[i] = cCentral;
    metab[i] = cMetab;
    for (const [region, m] of Object.entries(REGION_PK_MAP)) {
      const base = m.comp === "fat" ? cFat : cCentral;
      regionConc[region][i] = base * m.partition;
    }
    if (i < steps) y = rk4Step(y, p, dtH);
  }

  // Regionen auf globales Maximum normieren → vergleichbare Glow-Intensitaet 0..1
  let globalMax = 0;
  for (const region of Object.keys(regionConc))
    for (const v of regionConc[region]) if (v > globalMax) globalMax = v;
  const regions = {};
  for (const region of Object.keys(regionConc))
    regions[region] = regionConc[region].map(v => (globalMax > 0 ? v / globalMax : 0));

  return { t, thc, metab, regions, stats: computeStats(t, thc, metab) };
}

function peak(t, c) {
  let cmax = -Infinity, tmax = 0;
  for (let i = 0; i < c.length; i++) if (c[i] > cmax) { cmax = c[i]; tmax = t[i]; }
  return { cmax, tmax };
}

// Terminale Halbwertszeit aus der log-linearen Steigung des Kurvenendes.
function terminalHalfLife(t, c) {
  const n = c.length;
  const iA = Math.floor(n * 0.6), iB = n - 1;
  const cA = c[iA], cB = c[iB];
  if (cA <= 0 || cB <= 0 || cB >= cA) return null;
  const k = Math.log(cA / cB) / (t[iB] - t[iA]);
  return k > 0 ? Math.log(2) / k : null;
}

function computeStats(t, thc, metab) {
  const pThc = peak(t, thc), pMet = peak(t, metab);
  return {
    cmaxThc: pThc.cmax, tmaxThc: pThc.tmax,
    cmaxMetab: pMet.cmax, tmaxMetab: pMet.tmax,
    halfLifeH: terminalHalfLife(t, thc),
  };
}
