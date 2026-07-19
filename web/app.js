import { buildBodySVG, REGION_LABELS, STROKE_REGIONS } from "/web/body.js";

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
};

// ---------------------------------------------------------------------------
// Provenienz-Helfer — jede fachliche Angabe zeigt Wert, Herkunft, Konfidenz, Modus.
// ---------------------------------------------------------------------------
function sourceName(id) {
  return state.sources[id]?.name ?? id ?? "unbekannt";
}
function sourceUrl(id) {
  return state.sources[id]?.url ?? "";
}

function modeBadge(mode) {
  const m = mode === "prediction"
    ? { cls: "badge-prediction", label: "Vorhersage" }
    : { cls: "badge-lookup", label: "Nachgeschlagen" };
  return `<span class="badge ${m.cls}" title="Betriebsmodus">${m.label}</span>`;
}

function confDot(confidence) {
  const c = confidence || "medium";
  return `<span class="conf conf-${c}" title="Konfidenz: ${c}">●</span>`;
}

// Rendert ein {value, source, confidence, mode, note}-Feld als Zeile mit Herkunft.
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
// Karten-Renderer
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
  const steps = cas.steps
    .sort((a, b) => a.order - b.order)
    .map(s => `<li>${s.text}</li>`).join("");
  return `
    <article class="card">
      <h3>Mechanismus · ${cas.name} ${confDot(cas.confidence)} ${modeBadge(cas.mode)}</h3>
      <ol class="cascade">${steps}</ol>
      ${provRow("Netto-Effekt", cas.netEffect)}
      ${provRow("Reactome-Referenz", cas.reactomeRef)}
    </article>`;
}

// ---------------------------------------------------------------------------
// Körper-Highlighting
// ---------------------------------------------------------------------------
const TARGET_COLOR = { cb1: "#38d6c4", cb2: "#f4a63b" }; // CB1 teal, CB2 amber
const LEVEL_INTENSITY = { very_high: 1.0, high: 0.78, moderate: 0.52, low: 0.3 };
const LEVEL_LABEL = { very_high: "sehr hoch", high: "hoch", moderate: "mittel", low: "niedrig" };

function resetBody(svg) {
  svg.querySelectorAll(".organ").forEach(el => {
    el.style.fill = "";
    el.style.stroke = "";
    el.style.filter = "";
    el.classList.remove("is-active");
    el.removeAttribute("data-level");
    el.removeAttribute("data-target-active");
  });
}

// Mischt eine Glow-Farbe ueber der Basis anhand der Intensitaet (0..1).
function glow(color, intensity) {
  const a = 0.18 + intensity * 0.82;
  return { color, opacity: a, blur: 1 + intensity * 4 };
}

function applyExpression(svg, targetIds) {
  resetBody(svg);
  const applied = {}; // region -> {level, targets:[], notes}
  targetIds.forEach(tid => {
    const expr = state.expression[tid];
    if (!expr) return;
    const color = TARGET_COLOR[tid];
    expr.tissues.forEach(tissue => {
      const els = svg.querySelectorAll(`[data-region="${tissue.region}"]`);
      if (!els.length) return;
      const g = glow(color, LEVEL_INTENSITY[tissue.level] ?? 0.3);
      els.forEach(el => {
        const strokeMode = STROKE_REGIONS.has(tissue.region);
        if (strokeMode) el.style.stroke = g.color;
        else el.style.fill = g.color;
        el.style.opacity = g.opacity;
        el.style.filter = `drop-shadow(0 0 ${g.blur}px ${g.color})`;
        el.classList.add("is-active");
        el.setAttribute("data-level", tissue.level);
        el.setAttribute("data-target-active", tid);
      });
      applied[tissue.region] = applied[tissue.region] || { level: tissue.level, targets: [], tissue };
      applied[tissue.region].targets.push(tid);
    });
  });
  return applied;
}

function renderExprLegend(targetIds) {
  const parts = targetIds.map(tid => {
    const dot = `<span class="lg-dot" style="background:${TARGET_COLOR[tid]}"></span>`;
    return `<span class="lg-target">${dot}${tid.toUpperCase()}</span>`;
  }).join("");
  const levels = Object.entries(LEVEL_LABEL).map(([k, v]) =>
    `<span class="lg-level"><span class="lg-swatch" data-l="${k}"></span>${v}</span>`).join("");
  document.getElementById("expr-legend").innerHTML =
    `<div class="lg-row">${parts}</div><div class="lg-row lg-levels">${levels}</div>`;
}

// ---------------------------------------------------------------------------
// Detail-Panel bei Klick auf eine Region
// ---------------------------------------------------------------------------
function showRegionDetail(region) {
  const card = document.getElementById("detail-card");
  const label = REGION_LABELS[region] || region;
  const active = state.activeTarget === "both" ? ["cb1", "cb2"] : [state.activeTarget];
  let rows = "";
  active.forEach(tid => {
    const expr = state.expression[tid];
    const tissue = expr?.tissues.find(t => t.region === region);
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
  card.innerHTML = `<article class="card card-detail"><h3>Region · ${label}</h3>${rows}</article>`;
  card.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// ---------------------------------------------------------------------------
// Steuerung
// ---------------------------------------------------------------------------
function setTarget(target) {
  state.activeTarget = target;
  const svg = document.querySelector(".body-svg");
  const ids = target === "both" ? ["cb1", "cb2"] : [target];
  applyExpression(svg, ids);
  renderExprLegend(ids);
  document.querySelectorAll("#target-toggle .tgl").forEach(b =>
    b.classList.toggle("is-active", b.dataset.target === target));

  // Ziel-/Interaktionskarte auf primaeres Ziel setzen
  const primary = ids[0];
  document.getElementById("target-card").innerHTML = renderTarget(state.targets[primary]);
  document.getElementById("interaction-card").innerHTML =
    renderInteraction(state.interactions[primary], state.compound, state.targets[primary]);
  document.getElementById("cascade-card").innerHTML =
    primary === "cb1" ? renderCascade(state.cascade) : "";
}

function renderSourcesFooter() {
  const items = Object.values(state.sources).map(s =>
    `<li><a href="${s.url}" target="_blank" rel="noopener">${s.name}</a>
       <span class="src-lic">${s.license}</span></li>`).join("");
  document.getElementById("sources-footer").innerHTML =
    `<h4>Datenquellen (Provenienz)</h4><ul class="src-list">${items}</ul>`;
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------
async function main() {
  try {
    const [sources, compound, cb1, cb2, iCb1, iCb2, eCb1, eCb2, cascade] = await Promise.all([
      loadJSON("sources.json"),
      loadJSON("compounds/thc.json"),
      loadJSON("targets/cb1.json"),
      loadJSON("targets/cb2.json"),
      loadJSON("interactions/thc-cb1.json"),
      loadJSON("interactions/thc-cb2.json"),
      loadJSON("tissue-expression/cnr1.json"),
      loadJSON("tissue-expression/cnr2.json"),
      loadJSON("cascades/cb1-gio.json"),
    ]);

    sources.sources.forEach(s => (state.sources[s.id] = s));
    state.compound = compound;
    state.targets = { cb1, cb2 };
    state.interactions = { cb1: iCb1, cb2: iCb2 };
    state.expression = { cb1: eCb1, cb2: eCb2 };
    state.cascade = cascade;

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

    renderSourcesFooter();
    setTarget("cb1");

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
