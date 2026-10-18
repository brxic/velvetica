# P2: PWA, Verbindungen und sichere Updates

## Verhalten

- Ein Update übernimmt nicht mehr sofort die Kontrolle. Die Statusleiste bietet „Jetzt aktualisieren“ an. Nicht gesicherte Routen, gesetzte Planungspunkte und laufende Planungs-/Speichervorgänge verhindern den Reload. Vor dem tatsächlichen Reload wird erneut geprüft.
- Weitere offene Fenster oder Tabs derselben App verhindern die Aktivierung per Update-Button. Erst diese schliessen, dann erneut aktualisieren. Der Worker prüft deren Entwürfe nicht.
- Bei Verbindungsverlust bleibt der aktuelle Arbeitsbereich geöffnet. Lokales Speichern meldet nicht „Cloud synchronisiert“. Die Netzwerk-Rückkehr ist nur ein Hinweis: Ob die Cloud erreichbar und der Inhalt synchronisiert ist, zeigen weiterhin die jeweiligen Routen-/Fehlerzustände.
- Die Statusleiste reserviert gemessenen Platz. Karte, Planungsbereich und Routenzusammenfassung berücksichtigen diesen auch im kurzen mobilen Viewport. Vollständige Details bleiben separat erreichbar.

## Cache-Grenzen

`public/sw.js` verwendet einen neuen Cache `velvetia-shell-v2`; beim Aktivieren werden alte Velvetia-Caches entfernt, fremde Caches bleiben unangetastet. Cachefehler beim Schreiben dürfen erfolgreiche Netzantworten nicht verbergen.

Nur die öffentliche Planer-HTML-Seite `/` ohne Query-String wird bei erfolgreicher Navigation für einen späteren Offline-Aufruf gespeichert. Dazu kommen geladene gehashte Next-Assets, öffentliche Icons und die `.mjs`-Dateien von MapLibre. APIs, Auth-Endpunkte, RSC-Anfragen, Freigabe-HTML und externe Karten werden nicht gespeichert. Bei Offline-Navigation zu einer Freigabe erscheint die Offline-Seite, niemals eine möglicherweise widerrufene alte Freigabe aus einem Cache.

Neuplanung, Karten, Anmeldung, neue Höhenabfragen und Cloud-Zugriffe brauchen Internet. Ein Offline-Kaltstart ist nur mit zuvor geladenem Shell-/Asset-Cache möglich; sonst erscheint die Offline-Seite. Kontogebundene lokale Daten werden nicht ohne geklärte Identität als Gastbibliothek eingeblendet. Browser können lokale Daten und Caches löschen; wichtige Touren zusätzlich als GPX exportieren.

## Build-Erkennung

`scripts/prepare-pwa.mjs` erzeugt `public/pwa-build.js` als Fingerprint von Anwendungscode, Markenassets, Fonts, Offline-Seite, Lockfile, Konfiguration und Worker. Der Worker importiert diese Datei. Somit erkennt der Browser auch reine App-Änderungen als Update; identische Builds erzeugen kein zeitstempelbedingtes Update. Beide Worker-Dateien haben No-Cache/No-Store-Header, `updateViaCache: 'none'` gilt bei Registrierung. Das generierte Artefakt gehört nicht ins Git; `prebuild`, `predev` und die QA-Skripte erzeugen es automatisch.

Bereits installierte Versionen ohne Update-UI brauchen einmal einen normalen Online-Neustart. Ein schon geöffnetes altes Fenster wird nicht zum Reload gezwungen.

## Prüfen

- `npm test`: Service-Worker-Policy mit Install/Activate, Mehrtab-Schutz, Cache-Ausschlüssen, Offline-Fallback, `.mjs` und vollem Cache.
- `npm run test:e2e`: bisherige Funktionsregression auf Desktop und Mobile.
- `npm run test:pwa`: echter isolierter **Produktionsbuild** und Chromium-Service-Worker; je drei Abläufe auf Desktop und Mobile. Testet Manifest/Worker-Header, Offline-Speichern, Shell-Reload, Statusrückkehr, erfolgreiche Freigabe ohne Offline-Cache sowie Updates durch geänderte importierte Build-Dateien mit Entwurfs- und Mehrtab-Schutz.

Die Produktions-PWA-Tests verwenden einen reinen Localhost-Testproxy, synthetische Freigaben und deaktivierte Cloud-Konfiguration. Sie ändern keine produktiven Konten oder Freigaben. Der Proxy wird nicht deployt. Optional `PLAYWRIGHT_CHANNEL=chrome` setzen. Der Testbuild ersetzt lokal `.next`; für normalen lokalen Produktionsbetrieb anschliessend `npm run build` ausführen.

Zusätzlich auf Hardware prüfen: Installation/Neustart unter Brave und Chrome, iOS-Standalone-Safe-Areas und Bildschirmtastatur. Automatisierte Chromium-Tests simulieren mobile Viewports, keine native Installation. Die bestehende Vercel-Git-Verknüpfung bleibt unverändert; CI testet PWA zusätzlich, ohne einen separaten Deployment-Mechanismus einzuführen.
