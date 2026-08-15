# Velvetia

**Plan less. Ride more.**

Velvetia ist eine moderne, leicht verständliche Webanwendung zur Planung individueller Fahrradrouten. Der Name verbindet **Velo** und **Helvetia** und verweist auf den Schweizer Ursprung des Produkts.

## Lokaler Startumfang

- initiale Abdeckung: Schweiz
- technisch für weitere Länder, Europa und weltweite Regionen erweiterbar
- Fahrradprofile: Rennrad, Gravel, Freizeit/Touring und Alltag/City
- Mountainbike ist vorerst ausgeschlossen
- pro Planung ein Routenvorschlag, der interaktiv angepasst werden kann
- Hauptsprache Deutsch, Englisch als zweite Sprache
- vollständig lokalisierte Planung, Anleitung, Analyse, Provenienz und dynamische Warnungen
- lokaler Betrieb ohne Domain oder produktive Cloud-Abhängigkeit
- Fokus auf Karte, einfacher Bedienung und optionalen „How to use“-Hinweisen
- gespeicherte eigene Routen werden direkt auf der Karte sichtbar
- echte Schweizer OSM-Routen über die lokale Valhalla-Instanz
- mit Karte gekoppeltes, per Maus, Touch und Tastatur bedienbares Höhenprofil sowie längengewichtete Oberflächen- und Radwegauswertung
- sichtbare Quelle, Graph-Datenstand und Konfidenz je neu berechneter Route
- längengewichtete Hinweise zu Naturwegen, Tunneln und Schiebeabschnitten aus OSM-Kanten
- Editorverlauf mit 20 Schritten Undo/Redo
- deterministische Rundtour-Kandidaten mit Ausreisser-, Überlappungs- und Distanz-Cleanup
- direktes Ziehen oder Antippen der Route mit persistenten Shaping-Punkten
- lokale Routenverwaltung mit automatischen Namen, Beschreibung, Änderungsstatus, Suche, Sortierung, Favoriten, Kopien und bestätigtem Löschen
- local-first PostGIS-Synchronisierung mit anonymer Besitztrennung und wiederherstellbarer Versionshistorie
- GPX 1.1 mit Wegpunkten und Höhenwerten
- persistenter Light/Dark-Modus mit allen vier unveränderten Velvetia-Logoassets

Der ausführliche Architektur-, Daten- und Phasenplan steht in [VELVETIA_UMSETZUNGSPLAN.md](./VELVETIA_UMSETZUNGSPLAN.md).

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

Dieses Repository wird zunächst lokal entwickelt. Zugangsdaten und `.env`-Dateien dürfen nicht committed werden. Für erforderliche Variablen wird später ausschließlich eine `.env.example` ohne Geheimnisse versioniert.

## Lokal ausführen

Voraussetzung ist Node.js 24 oder neuer.

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Anschließend ist Velvetia unter `http://localhost:3000` erreichbar. Ohne Infrastruktur verwendet die Anwendung den eingebauten Preview-Router. Für echtes Routing auf Schweizer Wegen werden die lokalen Dienste gestartet und Valhalla in `.env.local` aktiviert:

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
