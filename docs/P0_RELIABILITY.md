# P0: Entwürfe, Speicherung und Höhenvisualisierung

## Entwürfe und Speicherantworten

- Speicherantworten aktualisieren den Versionsstand, überschreiben aber keine zwischenzeitlichen Eingaben und öffnen keine verworfene Route erneut.
- Routenstatus unterscheidet ungesicherte Änderungen, laufende Synchronisierung, lokale Sicherung mit ausstehender Cloud-Synchronisierung, bestätigten Cloud-Stand, Konflikt und fehlgeschlagene Sicherung.
- Neuplanung, Logo/Reset, Routentypwechsel, Ortswechsel, Import, Bibliothekswechsel und Versionswiederherstellung fragen vor dem Verwerfen ungesicherter Entwürfe nach. Browsernavigation wird zusätzlich über `beforeunload` abgesichert, soweit der Browser dies unterstützt. Das ersetzt keine automatische Entwurfswiederherstellung nach einem erzwungenen App-Abbruch.
- Ein voller oder gesperrter Browserspeicher wird bei fehlender Cloud-Sicherung ausdrücklich als Fehler angezeigt.

## Höhenreferenz

`metrics.elevationDistancesKm` ordnet Höhenwerte ihrer Position entlang der unveränderten Routengeometrie zu. Das optionale Feld wird im vorhandenen JSON gespeichert; eine Datenbankmigration ist nicht erforderlich. Valhalla behält Samplingpositionen auch bei fehlenden Höhenwerten. FOSSGIS/swisstopo bildet die gelieferten Profildistanzen von der vereinfachten Anfragegeometrie auf die Originalstrecke ab.

Karte, Profil, Anstiege und Cursor verwenden gemeinsame Distanzstationen. Farbstopps für MapLibre berücksichtigen dessen Web-Mercator-Linienfortschritt. Ältere Routen ohne Distanzfeld bleiben lesbar; bekannte Valhalla-Samplingpositionen werden rekonstruiert, alte swisstopo-Profile ohne ursprüngliche Positionsdaten näherungsweise zugeordnet.

## Prüfen

`npm test`, `npm run typecheck`, `npm run lint`, `npm run build` und `npm run test:e2e`.

Die Browserprüfungen verwenden isoliertes QA-Routing und simulierte Konten. Mit installiertem Chrome kann unter PowerShell `$env:PLAYWRIGHT_CHANNEL = 'chrome'` gesetzt werden. Reale PostGIS-/Backup-Prüfungen sind separat über `npm run test:integration` bei laufender Docker Engine möglich; Produktionsdaten werden nicht verwendet.
