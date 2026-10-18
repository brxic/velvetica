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

Die Versorgung ist ein bewusst **nichtmodaler**, explizit schliessbarer Workspace-Dialog auf derselben Base-UI-Basis. Karte und Tastaturfokus ausserhalb bleiben nutzbar; Escape, Schliessknopf und native Zurück-Navigation schliessen den Bereich. Desktop zeigt ein rechtes Panel, Mobile ein Bottom Sheet mit genau einem scrollenden Inhaltsbereich. Kategorieauswahl steht nur in der Trefferliste; in der Detailansicht bleibt Platz für den Ort und die Vorschau. Während einer Stoppvorschau sind Distanz-/Zeitänderung und Übernahme/Verwerfen dauerhaft sichtbar. Die ursprüngliche Routenzusammenfassung ist in diesem Zustand ausgeblendet, damit nicht versehentlich die alte Route gespeichert wird. Quelle, unbekannter Öffnungsstatus und Zugangsgrenzen gehören zur Darstellung, nicht nur zur Dokumentation. Umfang: [Paket C](PACKAGE_C.md).

Die mobile Planung verwendet `PlannerPanel` mit festem Griff/Kopf und einem eigenen Scrollbereich. Eine bewusste Griffbewegung oder die Aktion „Karte“ minimiert auf eine 64-Pixel-Leiste; „Öffnen“ beziehungsweise eine Bewegung nach oben stellt den Inhalt wieder her. Formularwerte und Scrollposition bleiben beim Minimieren erhalten. Der minimierte Inhalt ist `inert`; beim Wechsel zur Desktopbreite bleibt das Formular bedienbar. Vollständiges Schliessen und erneutes Öffnen setzt nur die Sheet-Ansicht zurück, nicht die im Workspace gespeicherten Eingaben. Die Karte berücksichtigt die tatsächliche Sheet-Höhe über die bestehende Randmessung.

Mobile zeigt den vollständigen Marken-Schriftzug, Konto, Bibliothek und ein Base-UI-Menü für Design, Sprache und Hilfe. Die Desktopnavigation bleibt bestehen. Verpflegung und Kategorien lassen sich vor der Berechnung auswählen; ohne Route wird keine POI-Anfrage ausgelöst. Der Höhenprofil-Auswahlpunkt wird als kreisförmiges HTML-Overlay positioniert, unabhängig von der ungleichmässigen SVG-Skalierung.

Planung, mobile Routenzusammenfassung im Bearbeitungsmodus und Wegpunkt-Editor verwenden denselben Griff-/Minimiervertrag aus `map-sheet.tsx`. Die Bearbeitung bleibt beim Minimieren aktiv; Inhalt und Scrollposition werden nicht verworfen. Der mobile Wegpunkt-Editor ist nichtmodal, damit Karte und Zoomcontrols auch bei geöffnetem Editor bedienbar bleiben. Währenddessen wird die zweite Routenzusammenfassung ausgeblendet. Im Querformat sitzt der Wegpunkt-Editor links statt quer über der Karte. Desktop behält den modalen Wegpunkt-Dialog. Die Kartenränder berücksichtigen auch das tatsächlich sichtbare Wegpunkt-Panel.

`SupplyCategoryPicker` stellt die Kategorien in Planung und Versorgungspanel einheitlich als mindestens 44 Pixel hohe Auswahlzeilen mit Icon und Auswahlindikator dar. Tastatur und `aria-pressed` verwenden denselben Zustand wie die Kartenfilter. Der Fahrmodus wird nur im mobilen Layout bis 900 Pixel Breite angeboten. Beim Wechsel zur Desktopbreite werden eine laufende Fahrt und deren Standort-/Wake-Lock-Ressourcen beendet; die bearbeitete Route bleibt erhalten.

## Prüfen

Mobile-Überarbeitung inklusive Bearbeitungskorrektur vom 18. Oktober 2026: 164 Unit-Tests, 77 Browserprüfungen und acht PWA-Prüfungen erfolgreich; neun gerätespezifische Browserfälle werden auf Desktop bewusst übersprungen. Typecheck, ESLint und der isolierte Produktionsbuild sind erfolgreich. Die Fälle prüfen Touch-/Maus-Griffbewegung, minimierten Fokuszustand, erhaltene Eingaben/Scrollposition, Wechsel zur Desktopbreite, 320-Pixel-Header, Menü-Fokus, Sprache/Theme, Verpflegung vor der Planung, Querformat und runde Profilmarker. Hinzu kommen beide minimierbaren Bearbeitungsfenster, Zoom bei geöffnetem Wegpunkt-Editor, geteilte Verpflegungsauswahl und GPS-Freigabe beim Wechsel zur Desktopbreite. Echte Bildschirmtastaturen und Safe Areas müssen weiterhin auf Hardware abgenommen werden.

Beim Dependency-Check meldet npm fünf High-Warnungen in der bestehenden ESLint-Entwicklungskette (`eslint-config-next` / `fast-glob` / `micromatch` / `braces`). Sie stammen nicht von Base UI. Der vorgeschlagene erzwungene Downgrade auf eine ältere Next-ESLint-Hauptversion wurde nicht übernommen; die kompatible Aktualisierung bleibt separat zu prüfen.

`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:e2e` (optional `PLAYWRIGHT_CHANNEL=chrome`). P1-Browsertests prüfen Suche, Fehler/Retry, Tastaturauswahl, kurze mobile Viewports, Kartencontrol-Überdeckung, vollständige Details und Dialogfokus. Kontotests verwenden simulierte Sitzungen; echte Produktionskonten werden nicht verändert. Reales iOS-Tastatur-/PWA-Verhalten muss zusätzlich auf Hardware geprüft werden.
