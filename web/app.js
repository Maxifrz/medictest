import { buildBodySVG, REGION_LABELS, STROKE_REGIONS } from "/web/body.js";
import { simulate, REGION_PK_MAP } from "/web/pk.js";
import { createChart } from "/web/chart.js";

// ---------------------------------------------------------------------------
// Datenzugriff
// ---------------------------------------------------------------------------
const DATA = "/data";

async function loadJSON(path) {
  const res = await fetch(`${DATA}/${path}`);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

const state = {
  sources: {},           // id -> source object
  compound: null,
  targets: {},           // id -> target
  interactions: {},      // targetId -> interaction
  expression: {},        // targetId -> tissue-expression
  cascade: null,
  activeTarget: "cb1",
  bodyMode: "expression",  // "expression" (Phase 0) | "concentration" (Phase 1)
  pk: {
    data: null,
    route: "inhalation",
    doseMg: 10,
    model: null,
    chart: null,
    timeH: 0,
    tMaxH: 48,
    playing: false,
    raf: null,
    lastNow: 0,
  },
};

// ---------------------------------------------------------------------------
// Provenienz-Helfer — jede fachliche Angabe zeigt Wert, Herkunft, Konfidenz, Modus.
// ---------------------------------------------------------------------------
function sourceName(id) { return state.sources[id]?.name ?? id ?? "unbekannt"; }
function sourceUrl(id) { return state.sources[id]?.url ?? ""; }

function modeBadge(mode) {
  const map = {
    prediction: { cls: "badge-prediction", label: "Vorhersage" },
    simulation: { cls: "badge-sim", label: "Simulation" },
    lookup: { cls: "badge-lookup", label: "Nachgeschlagen" },
  };
  const m = map[mode] || map.lookup;
  return `<span class="badge ${m.cls}" title="Betriebsmodus">${m.label}</span>`;
}

function confDot(confidence) {
  const c = confidence || "medium";
  return `<span class="conf conf-${c}" title="Konfidenz: ${c}">●</span>`;
}

function provRow(label, field) {
  if (!field) return "";
  const url = sourceUrl(field.source);
  const src = url
    ? `<a href="${url}" target="_blank" rel="noopener">${sourceName(field.source)}</a>`
    : sourceName(field.source);
  const note = field.note ? `<div class="prov-note">${field.note}</div>` : "";
  return `
    <div class="prov-row">
      <div class="prov-label">${label}</div>
      <div class="prov-value">
        <span class="prov-main">${field.value}</span>
        <span class="prov-meta">${confDot(field.confidence)} ${modeBadge(field.mode)}
          <span class="prov-src">Quelle: ${src}</span></span>
        ${note}
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Karten-Renderer (Phase 0)
// ---------------------------------------------------------------------------
function renderCompound(c) {
  const img = c.structureImage
    ? `<img class="struct-img" src="${c.structureImage.url}" alt="2D-Struktur ${c.shortName}"
            onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'struct-fallback',textContent:'Strukturbild offline nicht verfügbar — SMILES siehe unten.'}))"/>`
    : "";
  const i = c.identifiers, p = c.properties;
  return `
    <article class="card">
      <h3>Wirkstoff · ${c.name} <span class="chip">${c.shortName}</span></h3>
      <div class="card-sub">${c.class}</div>
      ${img}
      ${provRow("PubChem CID", i.pubchemCid)}
      ${provRow("Summenformel", i.molecularFormula)}
      ${provRow("Molekulargewicht", i.molecularWeight)}
      ${provRow("XLogP (Lipophilie)", p.xlogp)}
      ${provRow("InChIKey", i.inchikey)}
      ${provRow("SMILES", i.isomericSmiles)}
      ${provRow("IUPAC-Name", i.iupacName)}
    </article>`;
}

function renderTarget(t) {
  const pdb = t.pdbStructures;
  let pdbHtml = "";
  if (pdb && pdb.entries && pdb.entries.length) {
    const rows = pdb.entries.map(e => `
      <li>
        <a href="https://www.rcsb.org/structure/${e.id}" target="_blank" rel="noopener">${e.id}</a>
        <span class="pdb-meta">${e.state} · ${e.resolution} · ${e.year}</span>
        ${e.referencePose ? '<span class="chip chip-ref">Referenz-Pose</span>' : ""}
        <div class="pdb-title">${e.title}</div>
      </li>`).join("");
    pdbHtml = `
      <div class="prov-label">3D-Strukturen (PDB) ${confDot(pdb.confidence)} ${modeBadge(pdb.mode)}
        <span class="prov-src">Quelle: <a href="${sourceUrl(pdb.source)}" target="_blank" rel="noopener">${sourceName(pdb.source)}</a></span></div>
      <ul class="pdb-list">${rows}</ul>
      ${pdb.note ? `<div class="prov-note">${pdb.note}</div>` : ""}`;
  }
  return `
    <article class="card">
      <h3>Ziel · ${t.name} <span class="chip">${t.shortName}</span></h3>
      ${provRow("Gen", t.gene)}
      ${provRow("UniProt", t.uniprot)}
      ${provRow("Typ", t.type)}
      ${provRow("Funktion", t.function)}
      ${pdbHtml}
    </article>`;
}

function renderInteraction(x, compound, target) {
  return `
    <article class="card">
      <h3>Interaktion · ${compound.shortName} → ${target.shortName}</h3>
      ${provRow("Wirktyp", x.action)}
      ${provRow("Affinität", x.affinity)}
      ${provRow("Signalweg", x.signaling)}
    </article>`;
}

function renderCascade(cas) {
  if (!cas) return "";
  const steps = cas.steps.sort((a, b) => a.order - b.order).map(s => `<li>${s.text}</li>`).join("");
  return `
    <article class="card">
      <h3>Mechanismus · ${cas.name} ${confDot(cas.confidence)} ${modeBadge(cas.mode)}</h3>
      <ol class="cascade">${steps}</ol>
      ${provRow("Netto-Effekt", cas.netEffect)}
      ${provRow("Reactome-Referenz", cas.reactomeRef)}
    </article>`;
}

// ---------------------------------------------------------------------------
// Körper-Highlighting — Expression (Phase 0)
// ---------------------------------------------------------------------------
const TARGET_COLOR = { cb1: "#38d6c4", cb2: "#f4a63b" };
const LEVEL_INTENSITY = { very_high: 1.0, high: 0.78, moderate: 0.52, low: 0.3 };
const LEVEL_LABEL = { very_high: "sehr hoch", high: "hoch", moderate: "mittel", low: "niedrig" };

function resetBody(svg) {
  svg.querySelectorAll(".organ").forEach(el => {
    el.style.fill = ""; el.style.stroke = ""; el.style.filter = ""; el.style.opacity = "";
    el.classList.remove("is-active");
    el.removeAttribute("data-level"); el.removeAttribute("data-target-active");
  });
}

function paintRegion(el, region, color, opacity, blur) {
  if (STROKE_REGIONS.has(region)) el.style.stroke = color;
  else el.style.fill = color;
  el.style.opacity = opacity;
  el.style.filter = `drop-shadow(0 0 ${blur}px ${color})`;
  el.classList.add("is-active");
}

function applyExpression(svg, targetIds) {
  resetBody(svg);
  targetIds.forEach(tid => {
    const expr = state.expression[tid];
    if (!expr) return;
    const color = TARGET_COLOR[tid];
    expr.tissues.forEach(tissue => {
      const intensity = LEVEL_INTENSITY[tissue.level] ?? 0.3;
      const opacity = 0.18 + intensity * 0.82;
      const blur = 1 + intensity * 4;
      svg.querySelectorAll(`[data-region="${tissue.region}"]`).forEach(el => {
        paintRegion(el, tissue.region, color, opacity, blur);
        el.setAttribute("data-level", tissue.level);
        el.setAttribute("data-target-active", tid);
      });
    });
  });
}

function renderExprLegend(targetIds) {
  const parts = targetIds.map(tid =>
    `<span class="lg-target"><span class="lg-dot" style="background:${TARGET_COLOR[tid]}"></span>${tid.toUpperCase()}</span>`).join("");
  const levels = Object.entries(LEVEL_LABEL).map(([k, v]) =>
    `<span class="lg-level"><span class="lg-swatch" data-l="${k}"></span>${v}</span>`).join("");
  document.getElementById("expr-legend").innerHTML =
    `<div class="lg-row">${parts}</div><div class="lg-row lg-levels">${levels}</div>`;
}

// ---------------------------------------------------------------------------
// Körper-Highlighting — Konzentration über Zeit (Phase 1)
// ---------------------------------------------------------------------------
// Heat-Skala: kalt (dunkel) → cyan → amber → rot (hoch).
const HEAT = [
  { t: 0.0, c: [34, 46, 58] },
  { t: 0.35, c: [56, 170, 200] },
  { t: 0.7, c: [244, 200, 80] },
  { t: 1.0, c: [240, 90, 70] },
];
function heatColor(v) {
  v = Math.max(0, Math.min(1, v));
  for (let i = 1; i < HEAT.length; i++) {
    if (v <= HEAT[i].t) {
      const a = HEAT[i - 1], b = HEAT[i];
      const f = (v - a.t) / (b.t - a.t);
      const ch = j => Math.round(a.c[j] + (b.c[j] - a.c[j]) * f);
      return `rgb(${ch(0)},${ch(1)},${ch(2)})`;
    }
  }
  return `rgb(${HEAT[HEAT.length - 1].c.join(",")})`;
}

function applyConcentration(svg, model, timeH) {
  resetBody(svg);
  const dt = model.t[1] - model.t[0];
  const i = Math.max(0, Math.min(model.t.length - 1, Math.round(timeH / dt)));
  for (const region of Object.keys(REGION_PK_MAP)) {
    const intensity = model.regions[region][i]; // 0..1, relativ zum Körpermaximum
    // Perzeptuelle Gamma-Anhebung (0.6): hebt niedrige, aber vorhandene Konzentrationen
    // sichtbar an (z. B. das lang anhaltende Fett-Depot), ohne die Reihenfolge zu ändern.
    // Die echte Größenordnung liefert der Chart; der Körper zeigt die relative Verteilung.
    const shown = Math.pow(intensity, 0.6);
    const color = heatColor(shown);
    const opacity = 0.14 + shown * 0.86;
    const blur = shown * 6;
    svg.querySelectorAll(`[data-region="${region}"]`).forEach(el => {
      paintRegion(el, region, color, opacity, blur);
      el.setAttribute("data-level", intensity.toFixed(3));
    });
  }
}

function renderConcLegend() {
  const grad = `linear-gradient(to right, ${heatColor(0)}, ${heatColor(0.35)}, ${heatColor(0.7)}, ${heatColor(1)})`;
  document.getElementById("conc-legend").innerHTML = `
    <div class="lg-row">
      <span class="lg-bar" style="background:${grad}"></span>
      <span class="lg-ends"><span>niedrig</span><span>hoch</span></span>
    </div>
    <div class="lg-note">relative Gewebe-Konzentration zum aktuellen Zeitpunkt (illustrative Zuordnung der Kompartimente)</div>`;
}

// ---------------------------------------------------------------------------
// Detail-Panel bei Klick auf eine Region
// ---------------------------------------------------------------------------
function showRegionDetail(region) {
  const card = document.getElementById("detail-card");
  const label = REGION_LABELS[region] || region;
  let rows = "";

  if (state.bodyMode === "concentration" && state.pk.model) {
    const m = state.pk.model, dt = m.t[1] - m.t[0];
    const i = Math.round(state.pk.timeH / dt);
    const intensity = m.regions[region]?.[i] ?? 0;
    const map = REGION_PK_MAP[region];
    rows = `
      <div class="prov-row">
        <div class="prov-label">Konzentration (rel.)</div>
        <div class="prov-value">
          <span class="prov-main">${(intensity * 100).toFixed(0)} % des Körpermaximums · t = ${state.pk.timeH.toFixed(1)} h</span>
          <span class="prov-meta">${confDot("low")} ${modeBadge("simulation")}
            <span class="prov-src">Kompartiment: ${map ? map.comp : "–"}</span></span>
          <div class="prov-note">Illustrative Zuordnung der Kompartiment-Konzentration; kein organspezifisches PBPK.</div>
        </div>
      </div>`;
  } else {
    const active = state.activeTarget === "both" ? ["cb1", "cb2"] : [state.activeTarget];
    active.forEach(tid => {
      const tissue = state.expression[tid]?.tissues.find(t => t.region === region);
      if (!tissue) return;
      rows += `
        <div class="prov-row">
          <div class="prov-label">${tid.toUpperCase()} · Expression</div>
          <div class="prov-value">
            <span class="prov-main">${LEVEL_LABEL[tissue.level] ?? tissue.level}${tissue.nTPM ? ` · ${tissue.nTPM} nTPM` : ""}</span>
            <span class="prov-meta">${confDot(tissue.confidence)} ${modeBadge(tissue.mode)}
              <span class="prov-src">Quelle: ${sourceName(tissue.source)}</span></span>
            ${tissue.note ? `<div class="prov-note">${tissue.note}</div>` : ""}
          </div>
        </div>`;
    });
    if (!rows) rows = `<p class="muted">Für dieses Ziel liegt in Phase 0 kein Expressionswert für „${label}“ vor.</p>`;
  }
  card.innerHTML = `<article class="card card-detail"><h3>Region · ${label}</h3>${rows}</article>`;
}

// ---------------------------------------------------------------------------
// Phase 1 — PK-Karte: Steuerung, Chart, Zeitleiste
// ---------------------------------------------------------------------------
function renderPkCard() {
  const routes = state.pk.data.routes;
  const routeBtns = Object.entries(routes).map(([id, r]) =>
    `<button class="rt ${id === state.pk.route ? "is-active" : ""}" data-route="${id}">${r.label}</button>`).join("");
  document.getElementById("pk-card").innerHTML = `
    <article class="card pk-card">
      <h3>Pharmakokinetik · Zeitverlauf ${modeBadge("simulation")}</h3>
      <div class="card-sub">3-Kompartiment-Modell mit aktivem Metaboliten 11-OH-THC — vereinfacht, nicht klinisch</div>

      <div class="pk-controls">
        <div class="pk-field">
          <label>Applikationsweg</label>
          <div class="route-toggle" id="route-toggle" role="group">${routeBtns}</div>
        </div>
        <div class="pk-field">
          <label>Dosis <output id="dose-out">${state.pk.doseMg} mg</output></label>
          <input type="range" id="dose-range" min="1" max="50" step="1" value="${state.pk.doseMg}" />
        </div>
      </div>

      <div class="chart-legend">
        <span class="cl-item"><span class="cl-line cl-thc"></span>THC (Plasma)</span>
        <span class="cl-item"><span class="cl-line cl-metab"></span>11-OH-THC (aktiver Metabolit)</span>
      </div>
      <div id="pk-chart" class="pk-chart"></div>

      <div class="pk-timeline">
        <button id="play-btn" class="play-btn" aria-label="Abspielen">▶</button>
        <input type="range" id="time-range" min="0" max="${state.pk.tMaxH}" step="0.1" value="0" />
        <span class="time-out" id="time-out">0.0 h</span>
      </div>
      <div class="pk-stats" id="pk-stats"></div>

      <div class="prov-note">
        Zeitverlauf <strong>berechnet</strong> aus Literatur-Parametern (Quelle: Fachliteratur, Konfidenz niedrig) —
        kein PBPK, keine klinische Dosierung. Die Organ-Intensität ist eine illustrative Zuordnung der
        Kompartiment-Konzentrationen. Parameter werden in Phase 2 individualisierbar.
      </div>
    </article>`;

  document.getElementById("route-toggle").addEventListener("click", e => {
    const btn = e.target.closest(".rt");
    if (!btn) return;
    state.pk.route = btn.dataset.route;
    state.pk.doseMg = routes[state.pk.route].defaultDoseMg;
    document.getElementById("dose-range").value = state.pk.doseMg;
    document.getElementById("dose-out").textContent = `${state.pk.doseMg} mg`;
    runSim();
  });
  document.getElementById("dose-range").addEventListener("input", e => {
    state.pk.doseMg = Number(e.target.value);
    document.getElementById("dose-out").textContent = `${state.pk.doseMg} mg`;
    runSim();
  });
  document.getElementById("time-range").addEventListener("input", e => {
    stopPlay();
    setTimeH(Number(e.target.value));
    if (state.bodyMode !== "concentration") setBodyMode("concentration");
  });
  document.getElementById("play-btn").addEventListener("click", togglePlay);
}

function runSim() {
  const m = simulate(state.pk.data, {
    route: state.pk.route, doseMg: state.pk.doseMg, tMaxH: state.pk.tMaxH,
  });
  state.pk.model = m;

  // Chart neu aufbauen
  const mount = document.getElementById("pk-chart");
  const chart = createChart(m, { width: 480, height: 250 });
  state.pk.chart = chart;
  mount.replaceChildren(chart.el);

  // Kennzahlen
  const s = m.stats;
  document.getElementById("pk-stats").innerHTML = `
    <span class="stat"><b>Cmax</b> ${s.cmaxThc.toFixed(1)} ng/mL</span>
    <span class="stat"><b>Tmax</b> ${s.tmaxThc.toFixed(2)} h</span>
    <span class="stat"><b>t½ (terminal)</b> ${s.halfLifeH ? s.halfLifeH.toFixed(1) + " h" : "–"}</span>
    <span class="stat"><b>Metabolit Cmax</b> ${s.cmaxMetab.toFixed(1)} ng/mL @ ${s.tmaxMetab.toFixed(1)} h</span>`;

  chart.setTime(state.pk.timeH);
  if (state.bodyMode === "concentration") refreshBody();
}

// ---------------------------------------------------------------------------
// Zeit / Wiedergabe
// ---------------------------------------------------------------------------
function setTimeH(th) {
  state.pk.timeH = Math.max(0, Math.min(state.pk.tMaxH, th));
  document.getElementById("time-range").value = state.pk.timeH;
  document.getElementById("time-out").textContent = `${state.pk.timeH.toFixed(1)} h`;
  state.pk.chart?.setTime(state.pk.timeH);
  if (state.bodyMode === "concentration") refreshBody();
}

const HOURS_PER_SEC = 8; // Wiedergabe-Geschwindigkeit
function togglePlay() { state.pk.playing ? stopPlay() : startPlay(); }
function startPlay() {
  if (state.bodyMode !== "concentration") setBodyMode("concentration");
  if (state.pk.timeH >= state.pk.tMaxH) setTimeH(0);
  state.pk.playing = true;
  document.getElementById("play-btn").textContent = "❚❚";
  state.pk.lastNow = performance.now();
  state.pk.raf = requestAnimationFrame(playTick);
}
function stopPlay() {
  state.pk.playing = false;
  const btn = document.getElementById("play-btn");
  if (btn) btn.textContent = "▶";
  if (state.pk.raf) cancelAnimationFrame(state.pk.raf);
  state.pk.raf = null;
}
function playTick(now) {
  if (!state.pk.playing) return;
  const dtReal = (now - state.pk.lastNow) / 1000;
  state.pk.lastNow = now;
  let th = state.pk.timeH + HOURS_PER_SEC * dtReal;
  if (th >= state.pk.tMaxH) { setTimeH(state.pk.tMaxH); stopPlay(); return; }
  setTimeH(th);
  state.pk.raf = requestAnimationFrame(playTick);
}

// ---------------------------------------------------------------------------
// Körper-Modus & Neuzeichnen
// ---------------------------------------------------------------------------
function refreshBody() {
  const svg = document.querySelector(".body-svg");
  if (!svg) return;
  if (state.bodyMode === "concentration") {
    if (state.pk.model) applyConcentration(svg, state.pk.model, state.pk.timeH);
  } else {
    const ids = state.activeTarget === "both" ? ["cb1", "cb2"] : [state.activeTarget];
    applyExpression(svg, ids);
  }
}

function setBodyMode(mode) {
  state.bodyMode = mode;
  document.querySelectorAll("#body-mode .bm").forEach(b => b.classList.toggle("is-active", b.dataset.mode === mode));
  const isExpr = mode === "expression";
  document.getElementById("target-toggle-row").hidden = !isExpr;
  document.getElementById("expr-legend").hidden = !isExpr;
  document.getElementById("conc-legend").hidden = isExpr;
  document.getElementById("body-title").textContent = isExpr ? "Zielgewebe am Körper" : "Wirkstoff-Verteilung über Zeit";
  document.getElementById("body-hint").textContent = isExpr
    ? "Intensität = Expressionslevel des Ziels im Gewebe. Region anklicken für Details & Herkunft."
    : "Intensität = simulierte Gewebe-Konzentration. Zeitleiste bewegen oder ▶ drücken; Region anklicken für Details.";
  refreshBody();
}

// ---------------------------------------------------------------------------
// Ziel-Auswahl (Expression)
// ---------------------------------------------------------------------------
function setTarget(target) {
  state.activeTarget = target;
  const ids = target === "both" ? ["cb1", "cb2"] : [target];
  renderExprLegend(ids);
  document.querySelectorAll("#target-toggle .tgl").forEach(b => b.classList.toggle("is-active", b.dataset.target === target));

  const primary = ids[0];
  document.getElementById("target-card").innerHTML = renderTarget(state.targets[primary]);
  document.getElementById("interaction-card").innerHTML =
    renderInteraction(state.interactions[primary], state.compound, state.targets[primary]);
  document.getElementById("cascade-card").innerHTML = primary === "cb1" ? renderCascade(state.cascade) : "";

  if (state.bodyMode === "expression") refreshBody();
}

function renderSourcesFooter() {
  const items = Object.values(state.sources).map(s =>
    `<li><a href="${s.url}" target="_blank" rel="noopener">${s.name}</a><span class="src-lic">${s.license}</span></li>`).join("");
  document.getElementById("sources-footer").innerHTML =
    `<h4>Datenquellen (Provenienz)</h4><ul class="src-list">${items}</ul>`;
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------
async function main() {
  try {
    const [sources, compound, cb1, cb2, iCb1, iCb2, eCb1, eCb2, cascade, pk] = await Promise.all([
      loadJSON("sources.json"),
      loadJSON("compounds/thc.json"),
      loadJSON("targets/cb1.json"),
      loadJSON("targets/cb2.json"),
      loadJSON("interactions/thc-cb1.json"),
      loadJSON("interactions/thc-cb2.json"),
      loadJSON("tissue-expression/cnr1.json"),
      loadJSON("tissue-expression/cnr2.json"),
      loadJSON("cascades/cb1-gio.json"),
      loadJSON("pk/thc.json"),
    ]);

    sources.sources.forEach(s => (state.sources[s.id] = s));
    state.compound = compound;
    state.targets = { cb1, cb2 };
    state.interactions = { cb1: iCb1, cb2: iCb2 };
    state.expression = { cb1: eCb1, cb2: eCb2 };
    state.cascade = cascade;
    state.pk.data = pk;

    // Statische Karten
    document.getElementById("compound-card").innerHTML = renderCompound(compound);

    // Körper
    document.getElementById("body-container").innerHTML = buildBodySVG();
    const svg = document.querySelector(".body-svg");
    svg.addEventListener("click", e => {
      const el = e.target.closest("[data-region]");
      if (el) showRegionDetail(el.getAttribute("data-region"));
    });

    // Steuerung
    document.getElementById("target-toggle").addEventListener("click", e => {
      const btn = e.target.closest(".tgl");
      if (btn) setTarget(btn.dataset.target);
    });
    document.getElementById("body-mode").addEventListener("click", e => {
      const btn = e.target.closest(".bm");
      if (btn) { stopPlay(); setBodyMode(btn.dataset.mode); }
    });

    // Phase 1 aufbauen
    renderPkCard();
    renderConcLegend();
    runSim();

    renderSourcesFooter();
    setTarget("cb1");        // Ziel-/Interaktions-/Mechanismus-Karten füllen
    setBodyMode("expression"); // Startansicht: Phase-0-Expression

    document.getElementById("loading").hidden = true;
    document.getElementById("content").hidden = false;
  } catch (err) {
    const box = document.getElementById("error");
    box.hidden = false;
    box.innerHTML = `
      <strong>Daten konnten nicht geladen werden:</strong> ${err.message}<br/>
      Bitte über einen lokalen Server starten (nicht per <code>file://</code> öffnen):<br/>
      <code>python3 -m http.server 8000</code> &nbsp;→&nbsp; <code>http://localhost:8000/web/</code>`;
    document.getElementById("loading").hidden = true;
  }
}

main();
