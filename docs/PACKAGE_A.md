# Paket A: Routing, Fehler und Entwurfswiederherstellung

Stand: 18. Oktober 2026. Kein Design-Neubau und keine neuen Produktfeatures aus den Paketen B bis F.

## Routing-Vertrag

- Strukturierte Fehler unterscheiden ungültige Eingaben, Punkte zu weit vom Wegenetz, fehlende Verbindungen, Qualitätsablehnung, Timeout, Ausfall und fehlerhafte Konfiguration. Rohantworten, interne Provideradressen und Koordinaten erscheinen nicht in Fehlermeldungen oder Routinglogs.
- Routing hat ein gemeinsames Zeitbudget von 50 Sekunden. Browseranfragen warten höchstens 55 Sekunden. Abbruchsignale erreichen die Provideranfragen und Analysen. Eine bereits vollständige Route bleibt erhalten, wenn die Neuberechnung scheitert.
- Veraltete Antworten dürfen weder eine neue Planung noch einen anderen Kontostand überschreiben. Eine fehlgeschlagene Bearbeitung setzt die Wegpunkte auf die letzte vollständige Route zurück. Automatische Wiederherstellung sichert ebenfalls nur vollständig geroutete Anker, keine halb berechnete Bearbeitung.
- Die API validiert eindeutige Wegpunkte und ordnet Start, Zwischenpunkte und Ziel vor dem Routing. Providerresultate müssen zusätzlich das vollständige Routenschema erfüllen.
- Fehlkonfigurierte Router werden nicht stillschweigend zur synthetischen Vorschau. In Produktion gibt es keinen automatischen Vorschau-Fallback bei Routingfehlern. Ein ausdrücklich gewählter Preview-Provider bleibt für isolierte QA verfügbar.
- `/api/routing/config` zeigt die aktiven Fähigkeiten ohne Provideradressen oder Zugangsdaten. Bei FOSSGIS steht die Einschränkung auf ein gemeinsames Fahrradprofil bereits im Planer.

## Daten ehrlich anzeigen

Ein unbekannter Datenstand bleibt `null` und wird als «Nicht bekannt» angezeigt. Import- und Abfragezeit sind kein Beleg für aktuelle Quelldaten. Alte FOSSGIS-/GPX-Datumsangaben werden deshalb ebenfalls nicht als Datenfrische dargestellt. Valhalla-Engineversion, Graphzeitstempel und Auswertungszeit sind getrennt.

Valhalla unterscheidet befestigte Oberflächen, nicht ausschliesslich Asphalt. Die Oberfläche heisst deshalb «Befestigt»; der historische JSON-Feldname `asphaltPercent` bleibt zur Datenkompatibilität bestehen. Fehlende oder unplausible Höhenwerte ergeben keine erfundenen Höhenmeter. Der alte feste 80-Meter-Sprungfilter wurde durch einen distanzbezogenen Plausibilitätsfilter ersetzt, damit echte längere Anstiege erhalten bleiben.

## Lokale Wiederherstellung

- `/api/workspace` bestätigt Konto-/Gastidentität unabhängig von der Routendatenbank. Vorhandene, aber nicht verifizierbare Kontozugangsdaten führen nicht zu einer Gastwiederherstellung.
- Ein Entwurf je bestätigtem Speicherbereich, mit versioniertem Schema, begrenzter Grösse und sieben Tagen Gültigkeit seit der letzten Änderung. Abgelaufene Inhalte werden beim nächsten Zugriff auf diesen Bereich verworfen. Das ist keine zeitgesteuerte Löschung aus dem Browser.
- Gesichert werden Route, Name/Beschreibung, Planungspunkte, Profil, Distanz und Wünsche. Keine Live-GPS-Daten, Passwörter oder Tokens. Die Daten bleiben im Browserspeicher und werden nicht an den Identitätsendpunkt übertragen.
- Änderungen werden nach 250 ms geschrieben; `pagehide` und Wechsel in den Hintergrund versuchen zusätzlich die letzte Änderung zu sichern. Ein erzwungener Prozessabbruch kann die letzten Millisekunden verlieren. Browser können den Speicher löschen; GPX/Cloud bleiben die eigentliche Sicherung.
- Wiederherstellung nur nach ausdrücklicher Auswahl. Escape oder Schliessen des Dialogs löscht den Entwurf nicht. Ein Hinweis öffnet die Auswahl erneut. Ein inzwischen neu begonnener Arbeitsbereich wird nur nach Bestätigung ersetzt.
- Erkannte Änderungen eines anderen Fensters stoppen das Überschreiben und zeigen einen Hinweis. Das ersetzt keine transaktionale Mehrfenster-Datenbank.
- Bei ungeklärter Identität im Offline-Kaltstart wird kein kontogebundener Entwurf angezeigt. Nach erneutem Onlinekontakt wird die Identität erneut geprüft. Bereits bestätigte, laufende Sitzungen können weiterhin lokal sichern.
- Speicherfehler und konkurrierende Entwürfe werden sichtbar gemeldet. Die Wiederherstellung behauptet niemals eine erfolgreiche Cloud-Synchronisierung.

## Reale Routingprüfung

Die Produktion wurde ausschliesslich lesend geprüft: `/api/health` meldete am 18. Oktober FOSSGIS und eine erreichbare PostGIS-Datenbank. Vercel-Einstellungen wurden nicht geändert. Eine öffentlich erreichbare, profilfähige Valhalla-Instanz ist weiterhin Voraussetzung für echte Profilunterschiede in Produktion. Der lokale Docker-Dienst wird durch einen Git-Push nicht auf Vercel verfügbar.

Lokal geprüft: Valhalla `3.9.1-7fd2228e5`, vorhandener Schweizer Graph mit Zeitstempel `1786804637`. Keine Aktualisierung der OSM-Daten im Rahmen dieses Pakets.

Der Korpus enthält zwölf regionale Eingaben, jeweils als Rundtour und One-Way:

| Ergebnis | Anzahl | Einordnung |
|---|---:|---|
| Vollständiges technisches Ergebnis | 20 | Schema und Geometrieprüfungen bestanden; aktuelle Befahrbarkeit nicht zertifiziert |
| Abgelehnte Rundtour | 2 | `alps-road` und `alps-touring`: kein Kandidat innerhalb der bestehenden harten Qualitätsgrenzen |
| Abgelehntes One-Way-Ziel | 2 | `alps-road`: ca. 545 m; `geneva-city`: ca. 663 m Abstand zum gerouteten Ziel, über der unveränderten 500-m-Grenze |

Die vier Ablehnungen sind **kein bestandener positiver Routengenerierungstest**. Der Korpus beendet sich deshalb weiterhin mit einem Fehlerstatus. Diese Fälle bleiben offen für eine gezielte Punkt-/Kandidatenprüfung; die Grenzwerte wurden nicht abgeschwächt und die Referenzdaten nicht nachträglich passend gemacht.

Profilvergleich derselben Jura-One-Way-Verbindung:

| Profil | Distanz | Befestigt | Verläufe |
|---|---:|---:|---|
| Rennrad | 27,9 km | 99 % | eigener Verlauf |
| Gravel | 27,8 km | 84 % | eigener Verlauf |
| Touring | 27,6 km | 83 % | Hybridprofil |
| City | 27,6 km | 83 % | auf diesem Fall identisch zu Touring |

Desktop und Mobile wurden zusätzlich über die gerenderte App mit realem Valhalla-Routing, Höhenwerten und Kartenkacheln geprüft. Screenshots und maschinenlesbare Routenberichte liegen lokal, nicht im Git, unter `.data/routing-qa/`. Eine Vor-Ort-Fahrt und Prüfung von Zugang, Beschilderung, Sperrungen und Profileignung bleibt ausstehend.

## Reproduzieren

```powershell
docker compose up -d valhalla
node scripts/routing-qa-server.mjs
# Zweites Terminal:
$env:ROUTING_QA_URL='http://127.0.0.1:3028'
npm run test:routing:live -- --all
npm run test:routing:live -- --case=jura-gravel --profiles
node scripts/routing-visual-qa.mjs
```

Der Prüfserver setzt Datenbank-, Redis- und Supabase-Verbindungen ausdrücklich ausser Kraft. Öffentliche Routingdienste sind nicht für den Gesamtkorpus vorgesehen: dort höchstens einen bewusst gewählten Fall mit `--case=... --public` ausführen.

Die Datenbank-QA unterstützt bei gesperrtem Windows-Port eine alternative Loopback-Portnummer:

```powershell
$env:VELVETIA_QA_DATABASE_PORT='15432'
npm run test:integration
```

Das verändert keine Produktionsverbindung. QA-Container und Netzwerk werden nach dem Test entfernt.

## Grenzen des Abschlusses

Keine neue Datenbankmigration, keine neuen API-Keys, keine kostenpflichtige Infrastruktur eingerichtet. Der Code- und Regressionsteil ist separat von den noch offenen vier Live-Korpusfällen, der Feldabnahme und dem produktiven Valhalla-Hosting zu bewerten.

## Prüfprotokoll

- 146 Unit-, Komponenten- und API-Tests bestanden.
- 46 Desktop-/Mobile-Browserprüfungen bestanden, darunter Wiederherstellung, bewusstes Verwerfen, Erhalt der letzten vollständigen Route und verspätete Routingantworten.
- Acht echte Produktions-Service-Worker-/PWA-Prüfungen bestanden, einschliesslich Wiederherstellung nach Offline-Kaltstart und Update.
- Sechs isolierte PostGIS-Integrationstests und vollständiger Backup/Restore-Vergleich bestanden. Windows blockierte den Standardport; die erfolgreiche Prüfung nutzte ausschliesslich Loopback-Port 15432.
- TypeScript und ESLint bestanden. Sowohl der isolierte Produktions-PWA-Build als auch der abschliessende normale Produktionsbuild waren erfolgreich.
- Reales Valhalla-Routing und visuelle Desktop-/Mobile-Prüfung wie oben dokumentiert. Die vier abgelehnten Korpusfälle bleiben ausdrücklich offen.

Grundlagen: [Valhalla-Routingvertrag](https://valhalla.github.io/valhalla/api/route/api-reference/), [Supabase: serverseitige Benutzerprüfung](https://supabase.com/docs/reference/javascript/auth-getuser).
