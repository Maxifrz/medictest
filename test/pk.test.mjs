// Isolierte Verifikation des PK-Modells (web/pk.js) ohne Browser.
// Ausfuehren:  node test/pk.test.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { simulate, REGION_PK_MAP } from "../web/pk.js";

const here = dirname(fileURLToPath(import.meta.url));
const pkData = JSON.parse(readFileSync(join(here, "../data/pk/thc.json"), "utf8"));

let passed = 0, failed = 0;
function check(name, cond, detail = "") {
  if (cond) { passed++; console.log(`  ok   ${name}`); }
  else { failed++; console.log(`  FAIL ${name}${detail ? "  — " + detail : ""}`); }
}

const inh = simulate(pkData, { route: "inhalation", doseMg: 10 });
const oral = simulate(pkData, { route: "oral", doseMg: 10 });
const iv = simulate(pkData, { route: "iv", doseMg: 5 });

console.log("PK-Modell — Verifikation\n");

// 1. Keine negativen Konzentrationen
const allNonNeg = [inh, oral, iv].every(s =>
  s.thc.every(v => v >= -1e-9) && s.metab.every(v => v >= -1e-9));
check("Konzentrationen nie negativ", allNonNeg);

// 2. Applikationsweg wirkt plausibel: inhalativ flutet schneller an als oral
check("Tmax(inhalativ) < Tmax(oral)", inh.stats.tmaxThc < oral.stats.tmaxThc,
  `inh=${inh.stats.tmaxThc.toFixed(2)}h oral=${oral.stats.tmaxThc.toFixed(2)}h`);

// 3. i.v. hat sofortiges Maximum bei t≈0
check("Tmax(i.v.) ≈ 0", iv.stats.tmaxThc < 0.1, `tmax=${iv.stats.tmaxThc.toFixed(2)}h`);

// 4. Niedrige orale Bioverfuegbarkeit → deutlich kleineres Cmax als inhalativ (gleiche Dosis)
check("Cmax(oral) < Cmax(inhalativ) bei gleicher Dosis",
  oral.stats.cmaxThc < inh.stats.cmaxThc,
  `oral=${oral.stats.cmaxThc.toFixed(1)} inh=${inh.stats.cmaxThc.toFixed(1)} ng/mL`);

// 5. Linearitaet: doppelte Dosis → ~doppeltes Cmax
const inh20 = simulate(pkData, { route: "inhalation", doseMg: 20 });
const ratio = inh20.stats.cmaxThc / inh.stats.cmaxThc;
check("Dosis verdoppeln ≈ Cmax verdoppeln", Math.abs(ratio - 2) < 0.05,
  `ratio=${ratio.toFixed(3)}`);

// 6. Aktiver Metabolit entsteht erst nach der Muttersubstanz (Peak spaeter, > 0)
check("Metabolit-Peak nach THC-Peak", inh.stats.tmaxMetab > inh.stats.tmaxThc,
  `THC=${inh.stats.tmaxThc.toFixed(2)}h Metabolit=${inh.stats.tmaxMetab.toFixed(2)}h`);
check("Metabolit wird gebildet (Cmax > 0)", inh.stats.cmaxMetab > 0);

// 7. Lange terminale Halbwertszeit durch Fettverteilung (plausibel > 10 h)
check("Terminale t½ > 10 h (Fett-Depot)", inh.stats.halfLifeH != null && inh.stats.halfLifeH > 10,
  `t½=${inh.stats.halfLifeH ? inh.stats.halfLifeH.toFixed(1) : "n/a"} h`);

// 8. Fett-Signatur: adipose haelt spaet einen groesseren Anteil seines Eigen-Maximums
//    als ein rein durchblutetes Organ (Leber).
function retention(region, s) {
  const arr = s.regions[region];
  const own = Math.max(...arr);
  const last = arr[Math.floor(arr.length * 0.75)]; // ~36 h
  return own > 0 ? last / own : 0;
}
const adiRet = retention("adipose", inh);
const livRet = retention("liver", inh);
check("Fett behaelt Beladung laenger als Leber", adiRet > livRet,
  `adipose=${adiRet.toFixed(2)} liver=${livRet.toFixed(2)} (Anteil Eigen-Max bei ~36 h)`);

// 9. Region-Intensitaeten sind normiert (0..1) und decken alle SVG-Regionen ab
const inRange = Object.values(inh.regions).every(a => a.every(v => v >= 0 && v <= 1 + 1e-9));
check("Region-Intensitaeten in [0,1]", inRange);
check("alle Regionen aus REGION_PK_MAP simuliert",
  Object.keys(REGION_PK_MAP).every(r => Array.isArray(inh.regions[r])));

console.log(`\n${passed} ok, ${failed} fehlgeschlagen`);
console.log(`\nKennzahlen inhalativ 10 mg: Cmax=${inh.stats.cmaxThc.toFixed(1)} ng/mL @ ${inh.stats.tmaxThc.toFixed(2)} h, ` +
  `Metabolit Cmax=${inh.stats.cmaxMetab.toFixed(1)} @ ${inh.stats.tmaxMetab.toFixed(1)} h, t½≈${inh.stats.halfLifeH.toFixed(1)} h`);
console.log(`Kennzahlen oral 10 mg:      Cmax=${oral.stats.cmaxThc.toFixed(1)} ng/mL @ ${oral.stats.tmaxThc.toFixed(2)} h`);
console.log(`Kennzahlen i.v. 5 mg:       Cmax=${iv.stats.cmaxThc.toFixed(1)} ng/mL @ ${iv.stats.tmaxThc.toFixed(2)} h`);

process.exit(failed ? 1 : 0);
