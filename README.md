# Velvetia

**Plan less. Ride more.**

Mit Velvetia planst du Fahrradrouten in der Schweiz und bearbeitest ihren Verlauf auf der Karte. Der Name setzt sich aus Velo und Helvetia zusammen.

## Funktionen

- Rundtouren und Strecken mit Start und Ziel. Jede Planung liefert einen Vorschlag.
- Verlauf durch Ziehen oder Antippen der Routenlinie ändern; bis zu 20 Bearbeitungsschritte rückgängig machen.
- Höhenprofil mit markierter Position auf der Karte. Untergrund, Radweganteil und Warnungen sind vom verwendeten Router und den verfügbaren Daten abhängig.
- Routen benennen, beschreiben, suchen, filtern, als Favoriten markieren und als GPX importieren oder exportieren.
- Routen lokal speichern oder mit eingerichtetem Supabase-Konto synchronisieren. Gespeicherte Routen erscheinen auch auf der Karte.
- Frühere Versionen wiederherstellen und Routen über widerrufbare Links teilen.
- Deutsche und englische Oberfläche, helles und dunkles Design sowie PWA-Installation.
- Optionale Versorgungsebene mit Trinkwasser, Verpflegung und Lebensmittelgeschäften im Routenkorridor. Stopps werden mit berechnetem Umweg vorgeschlagen und erst nach Bestätigung eingefügt; der übrige Verlauf bleibt erhalten.

Zur Auswahl stehen Rennrad, Gravel, Freizeit/Touring und Alltag/City. Mountainbike wird nicht unterstützt. Der öffentliche FOSSGIS-Router verwendet für alle Fahrradtypen dasselbe Profil; die Unterscheidung und zusätzliche Routenwünsche benötigen Valhalla. Die Länderabdeckung ist konfigurierbar, aktuell ist die Schweiz eingerichtet.

Der ursprüngliche [Umsetzungsplan](./VELVETIA_UMSETZUNGSPLAN.md) beschreibt auch noch nicht implementierte Ausbaustufen.

Lokale Entwurfswiederherstellung, konkrete Routingfehler und die Ergebnisse der realen Schweizer Routingprüfung sind in [docs/PACKAGE_A.md](./docs/PACKAGE_A.md) dokumentiert. Die dort aufgeführten offenen Live-Fälle sind keine bestandene Feldabnahme.

Die Versorgung benötigt den eigenen OSM-/PostGIS-Index. Ohne Einrichtung bleibt sie ausdrücklich nicht verfügbar, während Planung, Speicherung und Export weiter funktionieren. Einrichtung, Datenstand und Grenzen: [docs/PACKAGE_C.md](./docs/PACKAGE_C.md).

## Marke

Die vorhandenen Logos werden unverändert verwendet:

- `velvetia-dark.png`
- `velvetia-light.png`
- `velvetia-full-dark.png`
- `velvetia-full-light.png`

Farben:

- Dark: `#D1D1D6` und `#FD0002`
- Light: `#1E2025` und `#E00112`

## Fonts und Attribution

Im Ordner `fonts/` liegen Foundry Context Medium und Bold inklusive der mitgelieferten Lizenzhinweise. Die Webanwendung muss die geforderte Attribution sichtbar, beispielsweise im Footer oder in der Legal-/Credits-Ansicht, ausgeben:

```html
<div>
  Fonts made from
  <a href="http://www.onlinewebfonts.com">Web Fonts</a>
  is licensed by CC BY 4.0
</div>
```

Die mitgelieferten `License.txt`-Dateien bleiben gemeinsam mit den Fonts im Repository. Vor einer öffentlichen oder kommerziellen Veröffentlichung ist zusätzlich zu prüfen, ob die ursprünglichen Foundry-Lizenzrechte die konkrete Web-Einbettung vollständig abdecken.

## Repository

Zugangsdaten gehören nicht ins Repository. `.env.example` dokumentiert die Konfiguration; die versionierte `.env.production` enthält nur die Routing-Vorgaben ohne Zugangsdaten. Persönliche Konfiguration liegt in den von Git ausgeschlossenen lokalen `.env`-Dateien.

## Lokal ausführen

Voraussetzung ist Node.js 24, entsprechend `engines` in `package.json`.

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Danach ist Velvetia unter `http://localhost:3000` erreichbar. Die Beispielkonfiguration verwendet einen Testrouter mit erfundenen Wegen und Höhenwerten. Diese Vorschau ist nicht zum Nachfahren geeignet. Für Routen auf dem Schweizer Wegenetz die lokalen Dienste starten und Valhalla in `.env.local` aktivieren:

```powershell
docker compose up -d
```

```dotenv
ROUTING_PROVIDER=valhalla
VALHALLA_URL=http://localhost:8002
ROUTING_FALLBACK=preview
```

Qualitätsprüfungen:

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

Die vollständige lokale Routing- und Datenumgebung ist in [docs/LOCAL_INFRASTRUCTURE.md](./docs/LOCAL_INFRASTRUCTURE.md) beschrieben und wird über `compose.yaml` gestartet.

## Testdeployment auf Vercel

Das Repository ist für einen Vercel-Import über GitHub vorbereitet. Ohne zusätzliche Environment Variables verwendet es den fair-use FOSSGIS-OSM-Fahrradrouter und die offizielle swisstopo-Höhenprofil-API; lokale Docker-Dienste werden nicht vorausgesetzt oder hochgeladen. Für grössere Nutzung wird Valhalla separat gehostet.

Die vollständige Anleitung und die spätere Umschaltung auf eine externe Valhalla-Instanz stehen in [docs/VERCEL_DEPLOYMENT.md](./docs/VERCEL_DEPLOYMENT.md).

Supabase Auth, PostGIS, Row Level Security und die drei erforderlichen Deployment-Variablen werden in [docs/SUPABASE_SETUP.md](./docs/SUPABASE_SETUP.md) eingerichtet.

## Beta-Workspace

Design-Tokens, gemeinsame UI-Primitives und die responsiven Karten-/Panel-Zustände sind in [docs/FRONTEND_SYSTEM.md](./docs/FRONTEND_SYSTEM.md) dokumentiert.

PWA-Updates, Offline-Grenzen und der echte Produktions-Service-Worker-Test (`npm run test:pwa`) stehen in [docs/PWA_RELIABILITY.md](./docs/PWA_RELIABILITY.md).

Konten unterstützen Planungsstandards, die Verwaltung des Home-Punkts, Datenexport und bestätigte Kontolöschung. Die Routenbibliothek bietet Filter, wiederherstellbare Versionen, Konflikterkennung bei Änderungen auf mehreren Geräten und widerrufbare Freigabelinks. Die App-Oberfläche wurde für Desktop und Mobile überarbeitet.

Implementierung, Datenbankmigration, Testbefehle und die Grenzen der jeweiligen Prüfungen sind in [docs/BETA_WORKSPACE.md](./docs/BETA_WORKSPACE.md) beschrieben. Browserprüfungen starten mit `npm run test:e2e`; isolierte PostGIS- und Backup/Restore-Prüfungen mit `npm run test:integration` bei laufender Docker-Engine.
