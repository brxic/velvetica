# Paket B: Bedienung und Oberfläche

## Umsetzung

Die vorhandene Kartenanwendung bleibt bestehen. Keine neue UI-Library, kein Styling-Wechsel, keine Änderungen an Konto-, Datenbank- oder Routingverträgen.

- **Ansehen und Bearbeiten sind getrennt.** Eine angezeigte Route lässt sich nicht mehr durch einen beiläufigen Kartenklick ändern. „Route bearbeiten“ aktiviert Linie, verschiebbare Punkte, Wegpunktliste, Undo/Redo und „Fertig“. „Fertig“ beendet die Bearbeitung, speichert aber nicht stillschweigend in der Cloud. Die Speicheraktion und ihr Status bleiben sichtbar.
- **Wegpunkte sind ohne Ziehen erreichbar.** Der neue Base-UI-Dialog bietet Ortssuche, Auswahl, Umordnung und Entfernen von Zwischenpunkten. Start und Ziel lassen sich über die Suche versetzen, aber hier nicht löschen. Verdeckte generierte Rundtour-Anker bleiben erhalten. Die bestehende API-Grenze von 20 Punkten gilt auch beim Hinzufügen im Dialog. Fehlgeschlagene Berechnungen behalten den letzten vollständigen Verlauf.
- **Warnungen führen zum Inhalt.** Die Zusammenfassung öffnet die vollständigen Details und fokussiert den Abschnitt mit den tatsächlichen Hinweisen. Es gibt keine erfundenen Abschnittsmarkierungen: Das aktuelle Warnungsmodell enthält Text, keine verlässlichen Geometrieindizes.
- **Mobile Layouts berücksichtigen den verfügbaren Raum.** Im kurzen Querformat scrollt der Planer als Ganzes, statt dass eine angeheftete Fussleiste die Eingaben verdrängt. In kurzen mobilen Ansichten stehen Zoom-/Kompasscontrols horizontal. Dialoge und Panels berücksichtigen Visual Viewport und Safe Areas. Bei Bildschirmtastatur wird die Routenzusammenfassung für das Umbenennen kompakter; Pinch-Zoom wird nicht als Tastatur behandelt.
- **Native Zurück-Navigation berücksichtigt den Arbeitsbereich.** Wegpunktdialog, Bearbeitungsmodus, Bibliothek, mobile Volldetails, Anleitung und Fahransichten können schrittweise geschlossen werden, bevor die Seite verlassen wird. Das ist keine globale Navigation für alle Konto- und Auth-Dialoge.
- **Gemeinsame Details statt zweier Implementierungen.** Geteilte Routen nutzen dieselbe Metrik-/Profil-/Warnungsdarstellung. Fehlende Analyse wird auch dort nicht als 0 % oder 0 Höhenmeter ausgegeben. Vollständige Details sind separat erreichbar.
- **Visuelle Konsistenz.** Längere Bibliothekstitel können zweizeilig stehen; Formulare und Controls verwenden gemeinsame Farben und ausreichend grosse Touchflächen. Validierung leerer Routennamen ist direkt am Eingabefeld sichtbar. Für weiss beschriftete Hauptaktionen gibt es ein kontrastreicheres semantisches Rot; Markenassets und Akzentfarben bleiben unverändert.

## Betroffene Bereiche

`planner-app.tsx` koordiniert weiterhin Route, Berechnung und Speicherung. Der neue `waypoint-editor.tsx` enthält nur die Wegpunktoberfläche, nicht eine zweite Routinglogik. `use-panel-back.ts` und `use-visual-viewport.ts` kapseln Browserverhalten mit Listener-Cleanup. `map-layout.ts` bleibt die gemeinsame Grundlage für freie Kartenränder. Bestehende Tokens und Komponenten-CSS wurden erweitert.

## Reproduzierbare Prüfung

```powershell
npm run typecheck
npm run lint
npm test
$env:PLAYWRIGHT_CHANNEL='chrome'
npm run test:e2e
npm run test:pwa
npm run build
```

Die Browserprüfung nutzt den isolierten lokalen QA-Server. Konto- und Routingantworten werden für die Regression kontrolliert simuliert. Das prüft Interaktionen, nicht die reale Wegqualität oder den produktiven Mailversand.

Für die visuelle Abnahme separat `node scripts/qa-server.mjs` starten und `node scripts/workspace-visual-qa.mjs` ausführen. Screenshots liegen unter dem ignorierten Verzeichnis `.data/workspace-qa/after`: 1440 × 1000, 412 × 850, 390 × 667 und 800 × 390, jeweils Hell/Dunkel, Planung, Route, Bearbeitung, Wegpunktdialog, Bibliothek und Konto. Die Vorher-Aufnahmen bleiben lokal unter `before`. Keine produktiven Konten oder Routen dafür verwenden. QA-Server vor Produktionsbuilds wieder stoppen.

## Noch notwendige menschliche Abnahme

Automatisierte Tests sind kein Usability-Test mit echten Personen und keine Hardware-Abnahme. Vor einer öffentlichen Freigabe:

1. Fünf Personen ohne Erklärung eine Rundtour ab einem gesuchten Startort planen lassen. Beobachten: finden sie Fahrradtyp, Distanz, Planung und Hinweise?
2. Route umbenennen, speichern und aus „Meine Routen“ wieder öffnen lassen. Beobachten: verstehen sie Entwurf, lokale Sicherung und bestätigte Kontosynchronisierung?
3. Route über „Route bearbeiten“ anpassen lassen. Je eine Person soll nur die Tastatur beziehungsweise die Wegpunktliste nutzen. Beobachten: finden sie Fertig, Undo und das anschliessende Speichern?
4. Warnungen prüfen, vollständige Details öffnen, zur Karte zurückkehren und GPX exportieren lassen. Keine echten Freigabelinks mit Privatadressen verwenden.
5. Auf echtem iPhone/Safari und Android/Chromium jeweils Browser und installierte PWA prüfen: Tastatur bei Ortssuche und Routennamen, Querformat, Safe Areas, Zurück, Offline-Kaltstart und Wiederverbindung. GPS nur im Stillstand prüfen.

Für jede Aufgabe Erfolg ohne Hilfestellung, Abbrüche und konkrete Missverständnisse notieren. Beobachtete Blocker zuerst korrigieren; daraus nicht automatisch neue Funktionen ableiten. Diese Abnahme wurde nicht durch synthetische Tests ersetzt.

Die offenen Routing-/Hosting- und Feldabnahmepunkte aus [Paket A](PACKAGE_A.md) bleiben unverändert. Paket B führt keine neuen Schlüssel, Migrationen oder kostenpflichtigen Dienste ein.

## Prüfprotokoll

- 150 Unit-, Komponenten- und API-Tests bestanden. Neue Prüfungen decken Kartenränder, Visual-Viewport-Zustände samt Cleanup sowie gemeinsame Details der Freigabeansicht ab.
- Vollständige Desktop-/Mobile-Regression: 57 bestanden, ein bewusst übersprungener Desktop-Fall für den ausschliesslich mobilen Tastaturvertrag. Der anschliessend erweiterte Paket-B-Test bestätigte zusätzlich Bibliothek und mobile Volldetails bei nativer Zurück-Navigation (11 bestanden, derselbe Desktop-Tastaturfall übersprungen).
- Acht PWA-Prüfungen mit echtem Produktions-Service-Worker bestanden: Offline-Speichern, geschützte Freigabeinhalte, Update während einer Fahrt und Aktivierung nach ausdrücklicher Anforderung.
- TypeScript, ESLint und Diff-Whitespace-Prüfung bestanden.
- 48 lokale Screenshots in vier Bildschirmgrössen und beiden Themes aufgenommen; insbesondere kurze Planung, kompakte Routendetails, Bearbeitungsleiste und Wegpunktdialog visuell geprüft.
- Sowohl isolierter PWA-Produktionsbuild als auch normaler Produktionsbuild erfolgreich.

Die Tests ändern keine Produktionskonten. Es wurde keine erneute Live-Routing-Feldabnahme und kein Test mit fünf echten Personen durchgeführt.
