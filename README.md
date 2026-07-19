# Corpus — Interaktiver Wirkstoff- & Körpersimulator

> **Lern- und Forschungswerkzeug. Keine medizinische Beratung.**
> Modelle sind Näherungen; für gesundheitliche Fragen und Dosierungen ist ausschließlich ärztlicher Rat maßgeblich.

Ein interaktives Programm, das einen Wirkstoff durch den Skalenstapel *Molekül → Bindung →
Funktion → Gewebe → Pharmakokinetik → Netto-Effekt* verfolgt und am Körper sichtbar macht.
Zwei Leitgedanken: Wirkung ist ein **Stapel gekoppelter Skalen**, und **Nachschlagen ≠
Vorhersagen** — jede Angabe zeigt ihre Herkunft und ihren Modus.

Das vollständige Konzept steht in **[DESIGN.md](./DESIGN.md)**.

---

## Was jetzt drin ist — Phase 0

Phase 0 des Roadmaps (DESIGN.md §9): **statisches Nachschlagen + Visualisieren, kein Zeitverlauf.**
Pilot-Domäne sind die Cannabinoide (§10) mit dem Erststart **THC → CB1**.

Die aktuelle App zeigt für THC:

- **Wirkstoff-Steckbrief** (Identifikatoren, Lipophilie) — real aus **PubChem** (CID 16078).
- **Ziel CB1** (Gen, UniProt, Typ, Funktion) — real aus **UniProt** (P21554), plus die
  experimentellen **PDB-Strukturen** aus der **RCSB PDB** (Agonist-gebundene Referenz-Pose).
- **Interaktion** THC→CB1 (partieller Agonist, Affinität, Signalweg).
- **Zielgewebe am Körper**: ein schematisches Körpermodell hebt CB1-reiche Gewebe (v. a. ZNS)
  hervor; Intensität = Expressionslevel (Gewebedaten aus dem **Human Protein Atlas**).
  Umschaltbar auf CB2 (Immun-/Darmgewebe) oder beide.
- **Mechanismus** (Gi/o-Kopplung → Adenylylzyklase-Hemmung → cAMP-Abfall → retrograde
  Neurotransmitter-Hemmung), Schritt für Schritt.

**Jede fachliche Angabe** trägt einen Provenienz-Chip (Quelle), eine Konfidenz-Markierung und
ein **Modus-Badge** („Nachgeschlagen" vs. „Vorhersage"). In Phase 0 ist alles nachgeschlagen —
die Vorhersage-Kennzeichnung ist bereits eingebaut, damit Modus B (Phase 3) sie nur noch nutzt.

### Umsetzungsentscheidung
- **Web-first** (statt Python-first): Phase 0 ist visualisierungslastig, nicht rechenlastig,
  und ein Web-Frontend ist teilbar — das Zielbild aus DESIGN.md §6.
- **Ohne Build-Schritt / ohne externe Laufzeit-Abhängigkeiten**: reines HTML + ES-Module +
  Inline-SVG. Das Körpermodell ist bewusst schematisch (Risiko-Mitigation §11: „mit
  vereinfachtem Modell starten"). Ein echtes 3D-Modell (Z-Anatomy → Three.js) ersetzt später
  nur `web/body.js`.

---

## Starten

Ein lokaler Static-Server ist nötig (ES-Module & `fetch` laufen nicht über `file://`):

```bash
# im Repo-Wurzelverzeichnis
python3 -m http.server 8000
# dann öffnen:  http://localhost:8000/web/
```

Alternativ z. B. `npx serve` oder jeder andere Static-Server. Für die 2D-Molekülstruktur
(von PubChem) wird online geladen; offline erscheint ein SMILES-Fallback.

---

## Projektstruktur

```
data/                     Daten-Schicht (JSON, provenienzbehaftet)
  sources.json            Quellen-Registry inkl. Lizenzen
  schema.md               Datenmodell & Provenienz-Konvention
  compounds/thc.json
  targets/cb1.json cb2.json
  interactions/thc-cb1.json thc-cb2.json
  tissue-expression/cnr1.json cnr2.json
  cascades/cb1-gio.json
web/                      Visualisierungs-Schicht
  index.html  styles.css  app.js  body.js
DESIGN.md                 vollständiges Design-Dokument (Spezifikation)
NOTICE.md                 Lizenzhinweise der Datenquellen
```

Die Provenienz-Konvention (jedes Feld als `{value, source, confidence, mode}`) ist in
[data/schema.md](./data/schema.md) beschrieben.

---

## Roadmap (aus DESIGN.md §9)

| Phase | Ziel | Status |
|------:|------|--------|
| **0** | Ein Wirkstoff, statisch (Ziel, Pose, Gewebe, Mechanismus) | ✅ in diesem Repo |
| 1 | Zeitverlauf (Pharmakokinetik): Dosis + Weg → Konzentration über Zeit | offen |
| 2 | Körper wird bearbeitbar (Individualisierung, §7) | offen |
| 3 | Verallgemeinerung auf „beliebig" (Modus B, SMILES-Eingabe, mit Konfidenz) | offen |
| 4 | Erklär-Ebene (Mechanismus-Erzählungen, DDI-Warnungen) | offen |

### Nächste sinnvolle Schritte
1. Affinitäts- (Ki) und ADME-Werte durch exakt referenzierte Abrufe aus ChEMBL / BindingDB /
   PDSP Ki DB ersetzen (aktuell Literatur-Platzhalter, als solche gekennzeichnet).
2. Phase 1: einfaches ODE-Kompartimentmodell (THC, oral/inhalativ) → Konzentrations-Zeit-Kurve
   und animierte Körper-Anflutung.
3. Datenpersistenz von JSON auf SQLite umstellen (Struktur bleibt, siehe schema.md).

---

## Rechtliches & Ethik (Kurzfassung)
- Zweckbindung: ausschließlich Lernen/Forschung/Exploration; **keine medizinische Verwendung**.
- Datenquellen-Lizenzen siehe [NOTICE.md](./NOTICE.md) — kommerzielle Nutzung getrennt prüfen.
- Keine echten Gesundheitsdaten: Individuen sind parametrische Modelle (ab Phase 2).
