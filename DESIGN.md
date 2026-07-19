# Design-Dokument: Interaktiver Wirkstoff- & Körpersimulator

**Arbeitstitel:** *Corpus* (Platzhalter — frei änderbar)
**Version:** 0.1 (Entwurf)
**Datum:** 19. Juli 2026
**Autor:** Maximilian
**Status:** Konzept / offen zur Weiterentwicklung

---

## 0. Wie dieses Dokument zu lesen ist

Dies ist ein lebendes Design-Dokument, kein fertiger Plan. Es beschreibt *was* gebaut werden soll, *warum* in dieser Reihenfolge, und *worauf* dabei aufgebaut wird. Code enthält es bewusst nicht — es soll die Entscheidungen festhalten, damit die Umsetzung später fokussiert bleibt.

Zwei Leitgedanken ziehen sich durch alles:

1. **Die Wirkung eines Medikaments ist ein Stapel gekoppelter Skalen** (Molekül → Bindung → Funktion → Gewebe → Ganzkörper-Kinetik → Netto-Effekt), nicht ein einzelnes Phänomen.
2. **Nachschlagen ≠ Vorhersagen.** Für bekannte Wirkstoffe ist fast alles ein Datenbank- und Visualisierungsproblem (baubar). Für neue Moleküle wird es Vorhersage mit Fehlerbalken (Forschungsfront). Der Kern des Projekts ist die Nachschlage-Engine; Vorhersage-Module hängen daran, immer mit sichtbarer Unsicherheit.

---

## 1. Vision & Zielsetzung

### 1.1 Kurzbeschreibung

Ein interaktives Programm mit einem 3D-Modell des menschlichen Körpers, in das man einen Wirkstoff (Dosis + Applikationsweg) „gibt". Das Programm zeigt:

- **wo** der Wirkstoff im Körper andockt (Zielstrukturen und ihre Gewebe-Lokalisation),
- **was** er dort molekular tut (Bindungspose, Agonismus/Antagonismus, Signalkaskade),
- **wohin und wann** er sich im Körper verteilt und wie er abgebaut wird (Pharmakokinetik über die Zeit),
- **welchen** Netto-Effekt das ergibt.

Entscheidend: Das Körpermodell ist **hochgradig bearbeitbar**, sodass sich individuelle Menschen (Genetik, Körperbau, Organfunktion, Toleranz, Ko-Medikation) für spezifische Tests abbilden lassen.

### 1.2 Zielgruppen

- **Primär:** der Autor selbst — als Lern-, Explorations- und Portfolio-Projekt an der Schnittstelle von IT, Pharmakologie und 3D-Visualisierung.
- **Sekundär (später):** Lernende, Interessierte, Ausbildung/Lehre — als didaktisches Werkzeug.

### 1.3 Erfolgskriterien (grob)

- Ein bekannter Wirkstoff lässt sich vollständig „durchspielen": Ziel, Mechanismus, Verteilung, Effekt — visuell nachvollziehbar.
- Das Verändern eines Körperparameters (z. B. CYP-Metabolisierertyp) verändert sichtbar und plausibel die Konzentrations-Zeit-Kurve.
- Die Trennung „belegtes Wissen" vs. „geschätzte Vorhersage" ist im Interface jederzeit klar.

---

## 2. Scope & Nicht-Ziele

### 2.1 Im Scope

- Nachschlagen und Visualisieren dokumentierter Wirkmechanismen bekannter Wirkstoffe.
- Physiologiebasierte Pharmakokinetik (PBPK) mit editierbaren Individuen-Parametern.
- Molekulare Bindungsvisualisierung anhand bekannter Strukturen.
- Optional und klar gekennzeichnet: Vorhersage-Module für neue Moleküle (Ziele, ADMET).

### 2.2 Ausdrücklich NICHT im Scope

- **Keine klinische Entscheidungshilfe.** Kein Dosierungsrechner für echte Menschen, keine medizinische Beratung. Modelle sind Näherungen.
- **Keine De-novo-Wirkungsvorhersage mit Genauigkeitsanspruch.** „Gib ein beliebiges Molekül ein und ich sage dir *exakt*, was es tut" ist mit heutiger Wissenschaft nicht seriös lösbar (auch nicht für die Pharmaindustrie).
- Keine Simulation, die als Ersatz für Zulassungsstudien, Tierversuche o. Ä. dienen könnte.

> **Haftungshinweis (im Programm prominent zu platzieren):** Lern- und Forschungswerkzeug. Keine medizinische Beratung. Für gesundheitliche Fragen und Dosierungen ist ausschließlich ärztlicher Rat maßgeblich.

---

## 3. Konzeptuelle Grundlage

### 3.1 Der Skalenstapel

„Was ein Medikament tut" spannt sich über sechs Ebenen. Der 3D-Körper macht vor allem Ebene 4 (wo) und Ebene 5 (wohin/wann) sichtbar.

| # | Ebene | Frage | Beispielgrößen | Werkzeug-Charakter |
|---|-------|-------|----------------|--------------------|
| 1 | Molekül | Welche Struktur/Eigenschaften? | SMILES, logP, pKa, MW | berechenbar (Cheminformatik) |
| 2 | Bindung | Woran bindet es, wie stark? | Ziel, Ki/Kd/IC50 | nachschlagbar / Docking |
| 3 | Funktion | Aktiviert oder blockiert es? | Agonist/Antagonist, Kaskade | überwiegend nachschlagbar |
| 4 | Gewebe | Wo sitzt das Ziel im Körper? | Expressionslevel je Organ | nachschlagbar (Atlas) |
| 5 | Pharmakokinetik | Wohin/wann verteilt & abgebaut? | F, Vd, CL, t½ | simulierbar (PBPK) |
| 6 | Netto-Effekt | Welche spürbare Wirkung? | Emax, EC50, Endpunkt | modellierbar (PK/PD) |

Eine **Querschnitts-Ebene** (Individualisierung) wirkt auf *alle* sechs: Genetik, Körperbau, Organfunktion, Toleranz, Ko-Medikation.

### 3.2 Die zwei Betriebsmodi

**Modus A — Nachschlagen (Kern, baubar).**
Für einen bekannten/zugelassenen Wirkstoff sind Ziele, Mechanismus, ADME-Parameter und Wirkung dokumentiert. Das Programm zieht sie aus kuratierten Datenbanken und *visualisiert* sie. Der „Simulations"-Anteil ist hier der Zeitverlauf (PK) und die räumliche Zuordnung dokumentierter Fakten.

**Modus B — Vorhersagen (optional, mit Fehlerbalken).**
Für ein neues Molekül (nur SMILES): Ziele vorhersagen (Target-Fishing / Reverse-Docking), Bindung vorhersagen (Docking), ADMET vorhersagen (QSAR/ML), Effekt ableiten. Jeder Schritt hat einen relevanten Fehler; die Fehler multiplizieren sich in der Kette. Deshalb: nur als klar markierte Hypothese, nie als Fakt.

---

## 4. Systemarchitektur

Fünf Schichten, lose gekoppelt, damit sich einzelne Teile austauschen lassen.

```
┌───────────────────────────────────────────────────────────────┐
│ 5) Visualisierungs-Schicht                                      │
│    3D-Körper (Organe leuchten je Konzentration) · Molekülviewer │
│    · Zeitkurven · Parameter-Panel                               │
├───────────────────────────────────────────────────────────────┤
│ 4) Individualisierungs-Schicht                                  │
│    "Patient" als Parametersatz → re-parametrisiert Schicht 2    │
├───────────────────────────────────────────────────────────────┤
│ 2) Simulations- & Reasoning-Schicht                             │
│    PBPK-Engine (PK/Zeit) · Docking-Engine · optional PD-Modelle │
│    · optionale ML-Prädiktoren (Modus B) · Mechanismus-Graph     │
├───────────────────────────────────────────────────────────────┤
│ 1) Daten-Schicht                                                │
│    Wirkstoff-DB · Ziel-DB · Struktur-DB · Expressions-Atlas     │
│    · Physiologie-Parametersätze · Individuen-/Populationsprofile │
└───────────────────────────────────────────────────────────────┘
        (Nummerierung folgt dem Skalenstapel, nicht der Reihenfolge)
```

**Warum lose gekoppelt?** Die PBPK-Engine, der Molekülviewer und die Datenquellen entwickeln sich unabhängig. Eine klare API zwischen Backend (Wissenschaft, Python) und Frontend (Darstellung, Web) erlaubt es, z. B. den Renderer zu wechseln, ohne die Simulation anzufassen.

### 4.1 Kernfluss (Modus A, ein Durchlauf)

1. Nutzer wählt Wirkstoff + Dosis + Applikationsweg + Individuum.
2. Daten-Schicht liefert: Molekül, Ziele, Affinitäten, Mechanismus, Gewebe-Expression, PK-Parameter.
3. Individualisierungs-Schicht passt die PK-/PD-Parameter an das gewählte Individuum an.
4. Simulations-Schicht rechnet den Konzentrations-Zeit-Verlauf pro Kompartiment/Organ.
5. Visualisierungs-Schicht animiert Verteilung am Körper, zeigt Bindungspose und Mechanismustext.

---

## 5. Datenquellen

Fast jede Ebene hat fertige, meist kostenlose Quellen. **Lizenzen unbedingt vor kommerzieller Nutzung prüfen** — mehrere sind nur nicht-kommerziell frei.

| Quelle | Liefert | Zugang | Lizenz (grob) | Ebene |
|--------|---------|--------|---------------|-------|
| **PubChem** (NIH/NLM) | Strukturen, Eigenschaften, Bioaktivität | REST (PUG-REST) | frei / public domain | 1, 2 |
| **DrugBank** | umfassende Wirkstoffdaten, Ziele, ADME | Download + API | frei nur nicht-kommerziell; kommerziell Lizenz | 1–3, 5 |
| **ChEMBL** (EBI) | Bioaktivität, Affinitäten | API + Bulk | frei (CC BY-SA) | 2 |
| **BindingDB** | Bindungsaffinitäten | API + Download | frei | 2 |
| **PDSP Ki DB** | Rezeptor-Bindungskonstanten | Web-Abfrage | frei | 2 |
| **RCSB Protein Data Bank** | experimentelle 3D-Zielstrukturen | API | frei / public domain | 2 |
| **AlphaFold DB** (DeepMind/EBI) | vorhergesagte Proteinstrukturen | API + Download | frei (CC BY 4.0) | 2 |
| **UniProt** | Protein-Metadaten, Sequenzen, Annotation | REST | frei (CC BY 4.0) | 2, 4 |
| **Human Protein Atlas** | Gewebe-/Zell-Expression der Ziele | API + Download | frei (Attribution) | 4 |
| **Reactome** | Signalwege / Kaskaden | API + Download | frei (CC BY) | 3 |
| **SwissTargetPrediction / SwissADME** (SIB) | Ziel- und ADME-Vorhersage | Web / programmatisch | frei (akad. Nutzung) | Modus B |
| **BodyParts3D** | anatomisches 3D-Modell | Download | frei (CC BY-SA) | 5 (3D) |
| **Z-Anatomy** | quelloffenes Anatomiemodell (Blender), auf BodyParts3D | Download / Git | frei (CC BY-SA) | 5 (3D) |

**Kuratierungs-Hinweis:** Nicht alle Quellen sind konsistent. Ein interner *Kuratierungs-Layer* sollte Konflikte auflösen (z. B. widersprüchliche Ki-Werte) und die Herkunft jeder Angabe mitführen (Provenienz), damit im Interface „Quelle: ChEMBL / DrugBank" sichtbar bleibt.

---

## 6. Tech-Stack

Ausgewählt entlang vorhandener Kompetenzen (Python, Linux, etwas Web/3D) und Offenheit der Werkzeuge.

### 6.1 Wissenschaftlicher Kern (Backend, Python)

| Aufgabe | Werkzeug | Begründung |
|---------|----------|------------|
| Cheminformatik | **RDKit** | De-facto-Standard, frei; Strukturen, Deskriptoren, Konformere |
| Formatkonvertierung | **OpenBabel** | Molekülformate, Protonierung |
| Molekulardocking | **AutoDock Vina** (+ Meeko zur Vorbereitung) | frei, etabliert, skriptbar |
| PBPK-Simulation | **Open Systems Pharmacology (PK-Sim / MoBi)** via `ospsuite` | freies PBPK-Framework mit Populations-/Individuen-Modul — bildet genau die „bearbeitbare" Vision ab |
| PBPK-Alternative (Einstieg) | **eigenes ODE-Kompartimentmodell** mit `scipy.integrate` | schnell prototypbar, didaktisch, volle Kontrolle |
| Systembiologie / Kaskaden (optional) | **COPASI** via `basico` oder **libRoadRunner** (SBML) | für mechanistische PD-Modelle |
| API/Backend | **FastAPI** | Python-nativ, schnell, gute Doku, async |
| Datenhaltung (lokal) | **SQLite** | einfach, dateibasiert, ausreichend für Einzelnutzer |
| Datenhaltung (skalierend) | **PostgreSQL** | erst nötig, wenn Mehrbenutzer/Größe |

### 6.2 Darstellung (Frontend, Web)

| Aufgabe | Werkzeug | Begründung |
|---------|----------|------------|
| 3D-Körper-Renderer | **Three.js** (+ react-three-fiber) | Web-tauglich, teilbar; passt zu Web-Neigung |
| Molekülviewer | **Mol\*** (molstar) oder **3Dmol.js** | Standard für Protein-/Ligand-Darstellung im Browser |
| UI-Framework | **React** + TypeScript | Komponentenmodell, Ökosystem |
| 3D-Asset-Aufbereitung | **Blender** (+ Z-Anatomy) | Organe segmentieren, exportieren (glTF) |
| Diagramme (Zeitkurven) | leichte Chart-Lib (z. B. Recharts) | Konzentrations-Zeit-Plots |

### 6.3 Erklär- & Automatisierungs-Schicht (optional)

| Aufgabe | Werkzeug | Begründung |
|---------|----------|------------|
| Mechanismus-Erzählungen | **LLM-API (Claude)** | vorhandene Erfahrung; erzeugt Fließtext aus strukturierten Daten |
| Pipeline/Orchestrierung | **n8n** | vorhandene Erfahrung; z. B. Batch-Import/Anreicherung von Wirkstoffdaten |

**Architektur-Entscheidung:** Web-Frontend (Three.js/Mol\*) + Python-Backend (FastAPI) ist das Zielbild, weil es teilbar ist und zur Web-Neigung passt. Für die *ersten* wissenschaftlichen Prototypen ist ein Python-natives Setup mit einfachem Viewer schneller — die Wissenschaft zuerst validieren, dann die Web-Hülle bauen.

---

## 7. Individualisierungsmodell (das Herzstück)

Der Kern der Vision: der Körper muss extrem bearbeitbar sein. Ein „Individuum" ist ein Parametersatz, der die Simulations-Schicht re-parametrisiert. PK-Sims Populations-/Individuen-Funktionen bilden vieles davon direkt ab.

| Kategorie | Parameter (Beispiele) | Wirkt auf | Warum es zählt |
|-----------|-----------------------|-----------|----------------|
| Anthropometrie | Alter, Geschlecht, Gewicht, Größe, Körperfett-%, Magermasse | Organvolumina, Blutflüsse, Verteilungsvolumen | lipophile Stoffe verteilen sich in Fett; Organgrößen skalieren die Kinetik |
| Pharmakogenetik | CYP2D6, 3A4, 2C9, 2C19, 2B6 als Phänotyp (PM/IM/EM/UM) | Enzymaktivität → Metabolismus → Clearance | Poor vs. Ultrarapid Metabolizer ändern Wirkspiegel dramatisch |
| Organfunktion | eGFR (Niere), Leberfunktion (Child-Pugh) | Elimination | eingeschränkte Ausscheidung → Kumulation |
| Physiologischer Zustand | Schwangerschaft, Krankheitszustände | mehrere Parameter | verschiebt Verteilung & Abbau |
| Ziel/Pharmakodynamik | Rezeptordichte, Toleranz/Downregulation, Grundtonus | Emax, EC50 | erklärt Toleranzentwicklung, individuelle Empfindlichkeit |
| Ko-Medikation | Enzym-Hemmer/-Induktoren | Enzymaktivität (DDI) | Wechselwirkungen verstärken/abschwächen Wirkung |
| Applikation | Weg (oral/i.v./inhalativ/transdermal), Dosis, Formulierung | Absorption, Bioverfügbarkeit | bestimmt Anflutung und Spiegelverlauf |

**Umsetzungsidee:** Reglerbasiertes Panel. Jeder Regler bildet transparent auf einen oder mehrere Modellparameter ab; eine kleine Legende zeigt „dieser Regler ändert X". Voreinstellungen als „Personas" (z. B. Standard-Erwachsener, CYP2D6-PM, Leber-eingeschränkt) beschleunigen Tests.

---

## 8. Datenmodell (Kern-Entitäten, skizziert)

Nur die Struktur, keine Implementierung — als Grundlage für das spätere Schema.

- **Compound** — id, name, SMILES, InChIKey, MW, logP, pKa, Quellen-Referenzen
- **Target** — id, name, UniProt-ID, Typ (GPCR/Enzym/Ionenkanal/Transporter), PDB-IDs
- **Interaction** — compound_id, target_id, Typ (Agonist/Antagonist/partiell/…), Affinität (Ki/Kd/IC50), Quelle, Konfidenz
- **TissueExpression** — target_id, Gewebe, Level, Quelle (HPA)
- **Cascade** — target_id, Signalweg-Beschreibung, Reactome-Referenz
- **Individual** — id, Anthropometrie, Genetik, Organfunktion, Toleranzzustand, Ko-Medikation
- **PKModel** — Kompartimente/Organe, Parameter (Vd, CL, F …), Modelltyp
- **SimulationRun** — compound_id, Dosis, Weg, individual_id, Zeitreihen-Ergebnisse, Zeitstempel
- **Provenance** — für jede Angabe: Quelle, Abrufdatum, Konfidenz (zentral für die „nachschlagen vs. vorhersagen"-Kennzeichnung)

---

## 9. Phasenplan / Roadmap

Jede Phase liefert etwas Vorzeigbares und schafft die Grundlage für die nächste. Abnahmekriterien halten den Fokus.

### Phase 0 — Ein Wirkstoff, statisch

**Ziel:** Reines Nachschlagen + Visualisieren, kein Zeitverlauf.
**Umfang:** Ein gut charakterisierter Wirkstoff (Pilot: siehe §10). Zeige Ziel, Bindungspose aus der PDB, hervorgehobene Zielgewebe am einfachen 3D-Körper, erklärender Mechanismustext.
**Abnahme:** Für den Pilot-Wirkstoff sind Ziel, Pose und Gewebe korrekt aus den Quellen gezogen und dargestellt; jede Angabe zeigt ihre Herkunft.

### Phase 1 — Zeitverlauf (Pharmakokinetik)

**Ziel:** Dosis + Weg wählen, Konzentration in Blut/Organen über Zeit sehen.
**Umfang:** Kompartiment- oder PBPK-Modell; Organe „leuchten" je nach Konzentration, animiert; Konzentrations-Zeit-Plot.
**Abnahme:** Kurve reagiert plausibel auf Dosis und Applikationsweg; Verlauf am Körper animiert.

### Phase 2 — Der Körper wird bearbeitbar (Individualisierung)

**Ziel:** Der Kern der Vision.
**Umfang:** Parameter-Panel (§7). Änderungen (z. B. CYP-Typ, Körperfett, Nierenfunktion, Toleranz) verändern Kurven und Effekt.
**Abnahme:** Umschalten von EM auf PM verschiebt die Kurve in erwartete Richtung; Personas funktionieren.

### Phase 3 — Verallgemeinerung auf „beliebig" (Modus B)

**Ziel:** SMILES-Eingabe für neue Moleküle.
**Umfang:** Struktur + bekannte Ziele aus PubChem/ChEMBL ziehen; ADMET per Vorhersage-Tool schätzen; Reverse-Docking für Ziel-Hypothesen — alles mit sichtbaren Konfidenzangaben.
**Abnahme:** Für ein neues Molekül erscheinen Ziel-Hypothesen und ADMET-Schätzungen klar als „Vorhersage (unsicher)" markiert, deutlich von belegten Fakten unterscheidbar.

### Phase 4 — Erklär-Ebene

**Ziel:** Automatische Mechanismus-Erzählungen und Wechselwirkungswarnungen.
**Umfang:** Aus strukturierten Daten generierter Fließtext (LLM); DDI-Hinweise aus Ko-Medikation.
**Abnahme:** Erzeugte Erklärungen sind faktentreu zu den Quelldaten (kein Halluzinieren über die Daten hinaus).

---

## 10. Pilot-Domäne: Cannabinoide

Als erster Wirkstoff/erstes Zielsystem ideal — und motivierend.

- Das **Endocannabinoid-System** ist gut kartiert.
- **CB1/CB2** haben gelöste Kryo-EM-Strukturen in der PDB → Docking wird anschaulich.
- **Rezeptor-Downregulation** bei chronischem Konsum ist ein Lehrbuchbeispiel für die Toleranz-Achse der Individualisierung.
- **THCs Lipophilie** macht die Fettverteilung in der PK spannend und nicht-trivial.
- Der **CYP2C9/CYP3A4-Abbau** von THC zum *aktiven* Metaboliten **11-OH-THC** ist ein Paradebeispiel für Metabolismus mit wirksamen Zwischenprodukten — perfekt, um die Metabolismus-Ebene didaktisch zu zeigen.

**Konkreter Phase-0-Erststart:** THC → Ziel CB1 → Bindungspose aus PDB → CB1-reiche Gewebe (v. a. ZNS) am Körper hervorheben → Mechanismus (Gi/o-Kopplung, Hemmung der Adenylylzyklase, retrograde Neurotransmitter-Hemmung) als Text.

---

## 11. Risiken & offene Fragen

| Thema | Risiko | Umgang |
|-------|--------|--------|
| Vorhersage-Genauigkeit (Modus B) | Kettenfehler; „exakte" Wirkung nicht seriös lösbar | strikt als Hypothese kennzeichnen; Konfidenz zeigen |
| Datenkonsistenz | widersprüchliche Werte über Quellen | Kuratierungs-Layer + Provenienz |
| Lizenzen | mehrere Quellen nur nicht-kommerziell frei | vor kommerzieller Nutzung klären (v. a. DrugBank) |
| 3D-Aufwand | Organsegmentierung/Performance im Browser | mit vereinfachtem Modell starten; Detail später |
| Modell-Fehlinterpretation | Nutzer hält Simulation für medizinische Wahrheit | prominenter Haftungshinweis; „nachschlagen vs. vorhersagen" sichtbar |
| Scope-Creep | Ambition frisst Umsetzung | Phasen-Abnahmekriterien einhalten |
| Datenschutz (falls echte Personendaten) | sensible Gesundheitsdaten | keine echten Patientendaten verarbeiten; nur synthetische/parametrische Individuen |

**Offene Entscheidungen:**

- Web-first oder Desktop-Python-first für den ersten wissenschaftlichen Prototyp?
- Eigenes ODE-Modell vs. direkt PK-Sim für Phase 1?
- Wie granular soll das 3D-Modell in Phase 0 sein (Organgruppen vs. einzelne Strukturen)?

---

## 12. Rechtliches & Ethik (Kurzfassung)

- **Zweckbindung:** ausschließlich Lernen/Forschung/Exploration; keine medizinische Verwendung.
- **Lizenzen:** Quell-Lizenzen dokumentieren; kommerzielle Nutzung getrennt prüfen.
- **Keine echten Gesundheitsdaten:** Individuen sind parametrische Modelle, keine realen Personen.
- **Transparenz:** Herkunft jeder Angabe sichtbar; Grenzen der Aussagekraft klar benennen.

---

## 13. Glossar

Weil das Projekt IT, Pharmakologie und Strukturbiologie verbindet — die wichtigsten Begriffe:

- **ADME** — Absorption, Distribution, Metabolismus, Exkretion (der Weg des Wirkstoffs durch den Körper).
- **PBPK** — physiologiebasierte Pharmakokinetik: Körper als Organkompartimente, verbunden über Blutfluss.
- **PK / PD** — Pharmakokinetik (was der Körper mit dem Stoff macht) / Pharmakodynamik (was der Stoff mit dem Körper macht).
- **Ligand / Target** — bindendes Molekül / Zielstruktur (Rezeptor, Enzym, Ionenkanal, Transporter).
- **Agonist / Antagonist** — aktiviert / blockiert das Ziel; dazu partielle Agonisten, inverse Agonisten, allosterische Modulatoren.
- **Ki / Kd / IC50 / EC50** — Maße für Bindungsstärke bzw. Wirkkonzentration.
- **Bioverfügbarkeit (F)** — Anteil der Dosis, der systemisch ankommt.
- **Verteilungsvolumen (Vd)** — scheinbares Volumen, in dem sich der Stoff verteilt.
- **Clearance (CL)** — Eliminationsleistung des Körpers.
- **Halbwertszeit (t½)** — Zeit bis zur Halbierung der Konzentration.
- **CYP450 / Cytochrom P450** — zentrale Enzymfamilie des Leberstoffwechsels (z. B. CYP2D6, CYP3A4).
- **Pharmakogenetik** — genetische Varianten, die Wirkstoffmetabolismus/-wirkung beeinflussen.
- **PM/IM/EM/UM** — poor/intermediate/extensive/ultrarapid Metabolizer (Phänotypen der Enzymaktivität).
- **DDI** — Drug-Drug-Interaction (Arzneimittelwechselwirkung).
- **Docking** — rechnerische Vorhersage, wie/wo ein Molekül an ein Ziel bindet.
- **SMILES / InChIKey** — textuelle Repräsentationen einer Molekülstruktur.
- **QSAR / ADMET-Prädiktion** — Vorhersage von Eigenschaften/ADME aus der Struktur.

---

## 14. Werkzeuge & Referenzen (Einstieg)

**Daten:** PubChem · DrugBank · ChEMBL · BindingDB · PDSP Ki DB · RCSB PDB · AlphaFold DB · UniProt · Human Protein Atlas · Reactome
**Simulation/Chemie:** RDKit · OpenBabel · AutoDock Vina · Open Systems Pharmacology (PK-Sim/MoBi) · COPASI · libRoadRunner
**Vorhersage (Modus B):** SwissTargetPrediction · SwissADME · pkCSM
**3D/Visualisierung:** BodyParts3D · Z-Anatomy · Three.js · Mol\* / 3Dmol.js · Blender
**Backend/Web:** FastAPI · React/TypeScript

*(Konkrete URLs bewusst nicht eingetragen, da sie sich ändern können — bei Bedarf einmal sammeln und hier ergänzen.)*

---

### Nächste sinnvolle Schritte

1. Entscheiden: Web-first oder Python-first für den ersten Prototyp.
2. Phase 0 auf THC/CB1 einschränken und die genauen Datenfelder festlegen, die dargestellt werden.
3. Ein vereinfachtes 3D-Körpermodell mit segmentierten Organgruppen aus Z-Anatomy exportieren.
4. Provenienz-/Konfidenz-Feld von Anfang an ins Datenmodell aufnehmen (spart später viel Nacharbeit).

*Ende des Entwurfs — bereit zur Weiterentwicklung.*
