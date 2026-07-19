// Leichter SVG-Linienchart (buildless, keine Chart-Bibliothek) fuer den
// Konzentrations-Zeit-Verlauf. createChart() baut das SVG als DOM auf und gibt
// setTime(h) zurueck, das nur den Zeit-Marker verschiebt (fluessige Animation).

const NS = "http://www.w3.org/2000/svg";
function el(tag, attrs = {}, text) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (text != null) e.textContent = text;
  return e;
}

export function createChart(model, { width = 480, height = 250 } = {}) {
  const ml = 46, mr = 14, mt = 14, mb = 28;
  const plotW = width - ml - mr, plotH = height - mt - mb;
  const tMax = model.t[model.t.length - 1];
  const dt = model.t[1] - model.t[0];
  const yMax = Math.max(1, ...model.thc, ...model.metab) * 1.12;

  const xs = t => ml + (t / tMax) * plotW;
  const ys = v => mt + plotH - (v / yMax) * plotH;

  const svg = el("svg", { viewBox: `0 0 ${width} ${height}`, class: "chart-svg", role: "img" });

  // Y-Gitter + Beschriftung
  const yTicks = 4;
  for (let i = 0; i <= yTicks; i++) {
    const v = (yMax * i) / yTicks, y = ys(v);
    svg.appendChild(el("line", { x1: ml, y1: y, x2: ml + plotW, y2: y, class: "grid" }));
    svg.appendChild(el("text", { x: ml - 6, y: y + 3, class: "axis-label", "text-anchor": "end" },
      v >= 10 ? v.toFixed(0) : v.toFixed(1)));
  }
  // X-Ticks alle 6 h
  for (let th = 0; th <= tMax + 1e-6; th += 6) {
    const x = xs(th);
    svg.appendChild(el("line", { x1: x, y1: mt + plotH, x2: x, y2: mt + plotH + 4, class: "grid" }));
    svg.appendChild(el("text", { x, y: mt + plotH + 16, class: "axis-label", "text-anchor": "middle" }, String(th)));
  }
  svg.appendChild(el("text", { x: ml + plotW / 2, y: height - 3, class: "axis-title", "text-anchor": "middle" }, "Zeit (h)"));
  svg.appendChild(el("text", {
    x: 12, y: mt + plotH / 2, class: "axis-title", "text-anchor": "middle",
    transform: `rotate(-90 12 ${mt + plotH / 2})`,
  }, "ng/mL"));

  // Kurven (subsampled fuer schlankes DOM)
  const polyline = data => {
    const N = data.length, stepp = Math.max(1, Math.floor(N / 240));
    const pts = [];
    for (let i = 0; i < N; i += stepp) pts.push(`${xs(model.t[i]).toFixed(1)},${ys(data[i]).toFixed(1)}`);
    pts.push(`${xs(model.t[N - 1]).toFixed(1)},${ys(data[N - 1]).toFixed(1)}`);
    return pts.join(" ");
  };
  svg.appendChild(el("polyline", { points: polyline(model.thc), class: "series series-thc" }));
  svg.appendChild(el("polyline", { points: polyline(model.metab), class: "series series-metab" }));

  // Zeit-Marker
  const marker = el("line", { class: "marker", x1: xs(0), x2: xs(0), y1: mt, y2: mt + plotH });
  const dotThc = el("circle", { class: "dot dot-thc", r: 3.5, cx: xs(0), cy: ys(model.thc[0]) });
  const dotMet = el("circle", { class: "dot dot-metab", r: 3.5, cx: xs(0), cy: ys(model.metab[0]) });
  const readout = el("text", { class: "chart-readout", x: xs(0) + 5, y: mt + 9 });
  svg.append(marker, dotThc, dotMet, readout);

  const idxFor = th => Math.max(0, Math.min(model.t.length - 1, Math.round(th / dt)));
  function setTime(th) {
    const i = idxFor(th), x = xs(model.t[i]);
    marker.setAttribute("x1", x); marker.setAttribute("x2", x);
    dotThc.setAttribute("cx", x); dotThc.setAttribute("cy", ys(model.thc[i]));
    dotMet.setAttribute("cx", x); dotMet.setAttribute("cy", ys(model.metab[i]));
    const flip = x > ml + plotW * 0.68;
    readout.setAttribute("x", flip ? x - 5 : x + 5);
    readout.setAttribute("text-anchor", flip ? "end" : "start");
    readout.textContent = `${model.t[i].toFixed(1)} h · THC ${model.thc[i].toFixed(1)} · 11-OH ${model.metab[i].toFixed(1)}`;
  }
  setTime(0);

  return { el: svg, setTime };
}
