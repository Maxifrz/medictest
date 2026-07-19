# Datenquellen & Lizenzen

Dieses Projekt zeigt Daten aus öffentlichen wissenschaftlichen Ressourcen. Die Herkunft jeder
Angabe ist im Interface sichtbar (Provenienz-Chip) und maschinenlesbar in `data/sources.json`
hinterlegt. **Vor kommerzieller Nutzung sind die Lizenzen einzeln zu prüfen** — mehrere Quellen
sind nur für nicht-kommerzielle bzw. akademische Nutzung frei.

| Quelle | Betreiber | Lizenz (grob) | Verwendung hier |
|--------|-----------|---------------|-----------------|
| PubChem | NIH / NLM | frei / gemeinfrei | THC-Identifikatoren, Eigenschaften, 2D-Struktur |
| UniProt | UniProt Consortium | CC BY 4.0 | CB1/CB2-Metadaten, Funktion |
| RCSB Protein Data Bank | RCSB PDB | frei / gemeinfrei | CB1-3D-Strukturen (PDB-IDs) |
| Human Protein Atlas | HPA-Projekt | CC BY-SA 3.0 (Attribution) | Gewebe-Expression CNR1/CNR2 |
| ChEMBL | EMBL-EBI | CC BY-SA 3.0 | (vorgesehen) Affinitätswerte |
| Reactome | Reactome | CC BY 4.0 | (referenziert) Signalweg |

Als „literatur" gekennzeichnete Werte (z. B. Ki-Größenordnungen, Signalkaskade) fassen
etabliertes Lehrbuchwissen zusammen und sind Platzhalter, die in späteren Phasen durch
primär-referenzierte, quellenexakte Datenbankwerte ersetzt werden.

Die 2D-Molekülstruktur wird zur Laufzeit direkt von PubChem geladen und nicht im Repo
gespeichert.
