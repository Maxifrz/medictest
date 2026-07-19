# Datenmodell (Phase 0)

Die Kern-Entitäten folgen §8 des Design-Dokuments. In Phase 0 sind sie als flache
JSON-Dateien abgelegt (eine Datei je Entität); ein späterer Wechsel auf SQLite/PostgreSQL
(§6.1) ändert nur die Persistenz, nicht die Struktur.

## Provenienz-Konvention (zentral)

Jede *fachliche* Angabe wird als Objekt statt als nackter Wert gespeichert:

```json
"molecularWeight": {
  "value": "314.5 g/mol",
  "source": "pubchem",      // id aus data/sources.json
  "confidence": "high",     // high | medium | low
  "mode": "lookup",         // lookup (belegt) | prediction (geschätzt)
  "note": "optional"
}
```

- **`source`** referenziert einen Eintrag in `sources.json` → Herkunft bleibt im Interface sichtbar.
- **`mode`** trennt **Nachschlagen** (belegtes Wissen) von **Vorhersage** (geschätzt) – das
  didaktische Leitprinzip des Projekts. In Phase 0 ist alles `lookup`; Phase 3 (Modus B)
  führt `prediction` ein.
- **`confidence`** macht Unsicherheit auch innerhalb belegter Werte sichtbar
  (z. B. streuende Ki-Werte über Quellen).

## Entitäten

| Datei | Entität | Inhalt |
|-------|---------|--------|
| `sources.json` | Provenance-Registry | Quellen inkl. Lizenz & Zugang |
| `compounds/*.json` | Compound | Molekül: Identifikatoren, Eigenschaften |
| `targets/*.json` | Target | Zielstruktur: UniProt, Typ, PDB-Strukturen |
| `interactions/*.json` | Interaction | Compound↔Target: Wirktyp, Affinität, Signalweg |
| `tissue-expression/*.json` | TissueExpression | Gewebe-Level je Ziel (treibt die Körper-Hervorhebung) |
| `cascades/*.json` | Cascade | Signalkaskade Schritt für Schritt |

Noch nicht instanziiert (spätere Phasen): **Individual** (§7, Phase 2),
**PKModel** / **SimulationRun** (Phase 1), erweiterte **Provenance**-Historie.
