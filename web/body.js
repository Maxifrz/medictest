// Schematisches Front-Körpermodell als Inline-SVG (Phase 0, bewusst vereinfacht).
// Jede farbbare Region traegt data-region, damit app.js sie datengetrieben einfaerben kann.
// Regel: Elemente mit fill="none" werden ueber die Kontur (stroke) eingefaerbt, alle
// anderen ueber die Flaeche (fill). Ein spaeteres echtes 3D-Modell (Z-Anatomy/Three.js,
// §6.2) ersetzt nur diese Datei — die Highlight-Logik in app.js bleibt.

export const REGION_LABELS = {
  brain: "Gehirn / ZNS",
  spinalCord: "Rückenmark",
  peripheralNerves: "Periphere Nerven",
  eyes: "Augen",
  adipose: "Fettgewebe",
  liver: "Leber",
  intestine: "Magen-Darm-Trakt",
  spleen: "Milz / lymphatisches Gewebe",
  heart: "Herz",
  lung: "Lunge",
  kidney: "Niere",
};

// Regionen, die ueber die Kontur (stroke) statt Flaeche (fill) eingefaerbt werden.
export const STROKE_REGIONS = new Set(["adipose", "intestine", "peripheralNerves"]);

export function buildBodySVG() {
  return `
<svg viewBox="0 0 240 520" class="body-svg" role="img" aria-label="Schematisches Körpermodell">
  <defs>
    <linearGradient id="bodyFill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#20272f"/>
      <stop offset="1" stop-color="#171c22"/>
    </linearGradient>
  </defs>

  <!-- Silhouette (gingerbread-Schema) -->
  <g class="silhouette" fill="url(#bodyFill)" stroke="#3a444f" stroke-width="1.5">
    <circle cx="120" cy="52" r="34"/>
    <rect x="110" y="82" width="20" height="16"/>
    <rect x="78" y="92" width="84" height="150" rx="20"/>
    <rect x="84" y="230" width="72" height="52" rx="16"/>
    <rect x="49" y="100" width="22" height="150" rx="11"/>
    <rect x="169" y="100" width="22" height="150" rx="11"/>
    <rect x="88" y="278" width="28" height="212" rx="14"/>
    <rect x="124" y="278" width="28" height="212" rx="14"/>
  </g>

  <!-- Adipose / subkutaner Fettmantel (Kontur, hervorhebbar) -->
  <rect data-region="adipose" class="organ organ-stroke" x="82" y="96" width="76" height="142" rx="18" fill="none"/>
  <rect data-region="adipose" class="organ organ-stroke" x="88" y="234" width="64" height="44" rx="14" fill="none"/>

  <!-- Organe (Flaeche) -->
  <ellipse data-region="brain" class="organ" cx="120" cy="48" rx="23" ry="18"/>
  <circle data-region="eyes" class="organ" cx="110" cy="60" r="3.4"/>
  <circle data-region="eyes" class="organ" cx="130" cy="60" r="3.4"/>
  <rect data-region="spinalCord" class="organ" x="116.5" y="86" width="7" height="150" rx="3.5"/>

  <ellipse data-region="lung" class="organ" cx="100" cy="128" rx="13" ry="22"/>
  <ellipse data-region="lung" class="organ" cx="140" cy="128" rx="13" ry="22"/>
  <ellipse data-region="heart" class="organ" cx="126" cy="132" rx="9" ry="11"/>

  <path data-region="liver" class="organ" d="M86 158 q26 -10 40 0 q4 18 -8 22 q-22 6 -32 -6 z"/>
  <ellipse data-region="spleen" class="organ" cx="148" cy="166" rx="8" ry="11"/>

  <ellipse data-region="kidney" class="organ" cx="98" cy="196" rx="6" ry="11"/>
  <ellipse data-region="kidney" class="organ" cx="142" cy="196" rx="6" ry="11"/>

  <!-- Organe (Kontur) -->
  <path data-region="intestine" class="organ organ-stroke" fill="none"
        d="M94 206 h52 a10 10 0 0 1 0 20 h-42 a8 8 0 0 0 0 16 h44 a9 9 0 0 1 0 18 h-52"/>
  <path data-region="peripheralNerves" class="organ organ-stroke" fill="none" stroke-dasharray="2 5"
        d="M120 250 q-30 30 -34 120 M120 250 q30 30 34 120"/>
</svg>`;
}
