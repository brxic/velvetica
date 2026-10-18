# Frontend-System

## Gestaltungsbasis

- Bestehende Logos, Foundry Context, Markenrot und Lucide bleiben erhalten.
- `src/app/tokens.css` ist die gemeinsame Quelle für semantische Farben, Schriftgrössen, Abstände, Rundungen, Control-Grösse, Bewegung und Ebenen. Dark Mode wird auch für Portals über `html[data-theme]` gesetzt.
- `globals.css` enthält Komponenten und Breakpoints. Die frühere zweite Override-Schicht `workspace.css` wurde konsolidiert und entfernt. Neue Varianten gehören zur jeweiligen Komponente, nicht in eine weitere Überschreibungsdatei.

## Wiederverwendbare Controls

`components/ui/button.tsx`: Primary, Secondary, Text, Icon; Disabled-/Busy-State und zugängliche Icon-Tooltips. `components/ui/input.tsx`: native Eingaben mit gemeinsamen Zuständen.

`components/ui/dialog.tsx`: kontrollierte Dialoge mit Base UI, Fokusbegrenzung und -rückgabe, Escape, isoliertem Hintergrund und Scroll-Lock. Konto, Bibliothek, Anleitung, Teilen und vollständige mobile Details benutzen diese Basis. Entwürfe verwenden einen Base-UI-AlertDialog mit Fokus auf der sicheren Abbruchaktion. Der manuelle Fokusfallen-Hook wurde entfernt.

`PlaceSearch` verwendet Base UI Autocomplete: Tastaturnavigation, portallierte Trefferliste, abgebrochene veraltete Suchanfragen, Retry-, Loading- und Empty-State. Suchtext und der gewählte Routenpunkt sind getrennt. Nur die Auswahl eines Treffers ändert den Routenpunkt.

`RouteActions` hält Speichern und Export direkt sichtbar; weitere Aktionen liegen in einem Base-UI-Menü. Neue Overlays sollen diese Basis verwenden, nicht eigene document-Keydown-Handler. Keine Tailwind-Migration und keine zusätzliche UI-Primitives-Library nötig.

## Kartenarbeitsbereich

Der Planer ist ein explizit ein-/ausblendbarer Arbeitszustand. Nach Berechnung oder Laden bleibt die Karte im Fokus. Ausführliche Desktop-Details stehen rechts; mobil gibt es eine kompakte, nicht intern scrollende Zusammenfassung und eine separat geöffnete vollständige Detailansicht. Warnungen, Untergrund und Datenherkunft sind dort erreichbar. Planung nutzt mobil ein Bottom Sheet mit erreichbarer Hauptaktion.

Eine bestehende Route startet im Ansichtsmodus. Erst „Route bearbeiten“ aktiviert Geometrieänderungen. Die Wegpunktliste verwendet denselben Berechnungs- und Undo-Vertrag wie Kartenänderungen und dieselbe Base-UI-Suche wie die Planung. „Fertig“ beendet den Modus, die bestehende Speicheraktion bleibt separat. Warnungsaktionen fokussieren den tatsächlichen Hinweisabschnitt. Geteilte Routen verwenden ebenfalls `RouteDetails`.

`map-layout.ts` berechnet freie Kartenränder aus den gemessenen Header-/Panel-Rechtecken. ResizeObserver und Layout-/Geometrieänderungen aktualisieren Kamera und Controls gemeinsam. Ein Style-/Daten-Idle-Ereignis stellt auch die erste Kameraanpassung nach asynchronem Kartenstart sicher. Safe Areas und reduzierte Bewegung werden berücksichtigt.

Die Bearbeitungsleiste gehört ebenfalls zu diesen Kartenrändern. Kurze mobile Ansichten verwenden horizontale Kartencontrols. `useVisualViewport` liefert Tastaturhöhe und sichtbare Dialoghöhe, ohne Pinch-Zoom umzudeuten; Listener und CSS-Zustände werden beim Unmount entfernt. `usePanelBack` verwaltet einen reversiblen History-Eintrag für aktive Workspace-Ebenen. Er ist kein Ersatz für Next-Routing und keine globale Auth-Dialogverwaltung. Umfang und menschliche Abnahme: [Paket B](PACKAGE_B.md).

## Prüfen

Beim Dependency-Check meldet npm fünf High-Warnungen in der bestehenden ESLint-Entwicklungskette (`eslint-config-next` / `fast-glob` / `micromatch` / `braces`). Sie stammen nicht von Base UI. Der vorgeschlagene erzwungene Downgrade auf eine ältere Next-ESLint-Hauptversion wurde nicht übernommen; die kompatible Aktualisierung bleibt separat zu prüfen.

`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:e2e` (optional `PLAYWRIGHT_CHANNEL=chrome`). P1-Browsertests prüfen Suche, Fehler/Retry, Tastaturauswahl, kurze mobile Viewports, Kartencontrol-Überdeckung, vollständige Details und Dialogfokus. Kontotests verwenden simulierte Sitzungen; echte Produktionskonten werden nicht verändert. Reales iOS-Tastatur-/PWA-Verhalten muss zusätzlich auf Hardware geprüft werden.
