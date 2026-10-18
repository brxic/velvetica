# Paket C: Versorgung und Zwischenstopps

## Umfang und Bedienung

Nach Planung oder Laden einer Route öffnet das Tropfensymbol neben „Route bearbeiten“ die Versorgung. Die Ebene startet ausgeschaltet und zeigt keine allgemeinen Ausflugsziele.

- Trinkwasser: als Trinkwasser erfasste Stellen sowie ausdrücklich als trinkbar markierte Brunnen, Wasserhähne und Quellen. Private Zugänge und ausdrücklich nicht trinkbare Stellen werden ausgeschlossen. Campingplätze mit allgemeinem Wasserangebot werden nicht als konkrete Wasserstelle ausgegeben.
- Cafés, Restaurants und Imbisse.
- Supermärkte, kleine Lebensmittelgeschäfte, Bäckereien, Gemüse-/Hofläden, Delikatessen und Metzgereien.

Die Liste enthält höchstens 60 der seitlich nächstgelegenen Treffer innerhalb von 500 m der **aktuellen Geometrie**, in Streckenreihenfolge. Kategorien lassen sich filtern. Kartenpunkte werden bei kleinerem Zoom gruppiert; Antippen vergrössert die Gruppe oder öffnet den Ort. Dieselben Orte sind ohne präzisen Kartentreffer über die Liste und Tastatur erreichbar. Verschieben oder Zoomen der Karte löst keine neue Suche aus.

Ein fehlender Treffer beweist keine Versorgungslücke. „Neben der Linie“ bezeichnet den räumlichen Abstand und ist ausdrücklich kein fahrbarer Umweg. Der angezeigte Kilometer entlang der Strecke ist eine Näherung.

Öffnungszeiten werden, soweit vorhanden, als unverarbeitete OSM-Regel angezeigt. Der Öffnungsstatus bleibt **unbekannt**. Es gibt keinen Kalender-/Feiertagsparser und keine „jetzt offen“-Behauptung. Auch erfasste Trinkwasserstellen sind keine Zusage über aktuellen Betrieb oder Wasserqualität.

## Stoppvorschau und Schutz der Route

1. Ort auswählen und „Umweg berechnen“ wählen.
2. Ein etwa 600 m langer Anschlussbereich um die nächstgelegene Stelle wird mit dem bestehenden Routingprovider neu berechnet. Explizite und generierte Anker in diesem Bereich werden mitgenommen. Bei sehr grobem GPX-Sampling darf das Ersetzungsfenster höchstens 5 km lang sein; andernfalls wird die automatische Einfügung abgelehnt.
3. Die übrigen Geometriekoordinaten bleiben unverändert. Nahtstellen dürfen nicht mehr als 25 m versetzt sein; alle angefragten Punkte müssen innerhalb von 100 m des berechneten Abschnitts liegen. Zusätzliche Exkursionen über 20 km werden abgelehnt. Diese Grenzwerte sind Plausibilitätsfilter, keine Zusage für einen Hauseingang oder rechtlichen Zugang.
4. Die Vorschau zeigt den neuen Verlauf und den alten Verlauf gestrichelt. Tatsächliche Streckenänderung und geschätzte Fahrzeitänderung ohne Aufenthalt stehen bei der Übernahmeaktion. Auch eine Verkürzung wird mit negativem Vorzeichen statt als „zusätzlicher Weg“ ausgegeben. Der verbleibende Abstand zum konkreten Ort wird genannt.
5. Erst „Stopp übernehmen“ verändert den Entwurf. Speichern bleibt eine separate Aktion. Verwerfen, Abbrechen, fehlerhafte Berechnung und verspätete Antworten überschreiben keine Route.

Höhenprofile werden an ihren tatsächlichen Distanzstationen zusammengesetzt. Fehlen auf einem der beiden Teile Höhen- oder Untergrunddaten, wird keine vollständige Analyse vorgetäuscht. Importierte GPX-Routen mit bearbeitetem Teilabschnitt werden entsprechend bezeichnet. Ein gemischter Verlauf hat keinen erfundenen einheitlichen Datenstand.

In derselben Bearbeitungssitzung stellt Undo die vorherige Geometrie aus einem begrenzten Snapshot-Verlauf **ohne erneute Routeranfrage** exakt wieder her. Redo stellt den eingefügten Stand wieder her. Der Versorgungspanel bietet dafür „Letzten Stopp rückgängig“. Stopps bleiben normale benannte Via-Punkte und werden mit bestehenden Routen-/GPX-Abläufen gespeichert. Über „Stopps über Wegpunkte bearbeiten“ können sie auch nach erneutem Laden entfernt oder versetzt werden; dieser normale Bearbeitungsweg berechnet wie bisher die Route neu. Der Undo-Verlauf selbst wird nicht dauerhaft gespeichert.

## Datenarchitektur

Die App fragt ausschliesslich ihren eigenen PostGIS-Index ab. Es gibt keine laufenden Overpass-/Nominatim-Abfragen und keinen externen Aufruf bei Kartenbewegungen. Eine Versorgungssuche sendet die aktuelle Linie an den eigenen Next.js-Endpunkt, nicht an einen öffentlichen POI-Suchdienst. Für den Umweg nutzt die App denselben konfigurierten Router wie die Planung.

- `app.poi_sources`: Region, Extraktzeitpunkt und Importzeitpunkt.
- `app.supply_pois`: OSM-Typ/ID, Kategorie, geografischer Punkt, wenige erlaubte Tags und Bearbeitungsdatum des Objekts.
- GiST-Index auf `geography(Point,4326)` für den räumlichen Korridor, zusätzlicher Regions-/Kategorieindex.
- Private Tabellen mit RLS, ohne Freigabe für `PUBLIC`, `anon` oder `authenticated`. Keine neuen privilegierten RPC-Funktionen. Nur die serverseitige Verbindung führt die begrenzte Lesesuche aus.
- Keine Schemaänderungen während Nutzeranfragen. Fehlende Migration oder fehlender Datenbestand ergeben einen kontrollierten Ausfall dieser optionalen Funktion.
- Maximal 20'000 Geometriepunkte, 1,5 MB Anfrageinhalt, 600 km geprüfte Geometrielänge, 60 Ergebnisse und vier gleichzeitige Suchen **pro Funktionsinstanz**. Datenbankabfragen haben ein eigenes 4-Sekunden-Limit. Das ist keine verteilte öffentliche Ratenbegrenzung; diese bleibt Teil von Paket E.

Der Import erfolgt offline aus einem regionalen PBF. Punktobjekte werden direkt übernommen; bei Flächen wird in PostGIS ein Punkt auf der Fläche gewählt. Dieser ist kein nachgewiesener Eingang. Einzelne doppelte OSM-Repräsentationen können weiterhin vorkommen. Die Tabellen sind nach Region angelegt, die aktuelle Abfrage und Importvalidierung akzeptieren bewusst nur die Schweizer Abdeckung.

## Einrichtung für die bestehende Supabase-/Vercel-Installation

**Keine neue API und kein neuer API-Key nötig.** Die bestehende serverseitige `DATABASE_URL` muss weiterhin funktionieren. POI-Daten sind nicht Bestandteil eines Git-Pushs. Ohne die folgenden zwei Schritte ist die Versorgung auch nach einem Deployment nicht gefüllt.

### 1. Additive SQL-Migration

1. Im richtigen Supabase-Projekt den **SQL Editor** öffnen.
2. Neue Query erstellen und den vollständigen Inhalt von `supabase/migrations/20261018160701_supply_pois.sql` einfügen.
3. Sicherstellen, dass PostGIS bereits eingerichtet ist, wie für die bestehenden Routen.
4. Query prüfen und ausführen. Sie legt nur die beiden POI-Tabellen und Indizes an, aktiviert RLS und entzieht öffentliche Tabellenrechte. Routen und Konten werden nicht gelöscht.
5. „Succeeded. No rows returned“ ist für diese Strukturänderung erwartbar. Eine generische Warnung wegen `REVOKE` bedeutet nicht, dass Benutzerrouten gelöscht werden; dennoch immer den richtigen Projektkontext kontrollieren.

Mit folgender separater, lesender Query lassen sich Tabellen und Index prüfen:

```sql
select schemaname, tablename, indexname
from pg_indexes
where schemaname = 'app'
  and tablename in ('poi_sources', 'supply_pois');
```

### 2. Daten importieren

Der lokal geprüfte Export liegt auf diesem Rechner unter `.data/poi/switzerland-complete.jsonl`. Der zugrunde liegende Extrakt ist vom **14. August 2026**, nicht vom heutigen Importdatum. Die Datei bleibt ausserhalb von Git. Für eine öffentliche Freigabe einen aktuellen Extrakt verwenden und den Import danach wiederholen.

Im Projektterminal kann der vorhandene Pooler-Verbindungsstring verdeckt eingegeben werden. Nicht in den Chat kopieren, nicht unter `NEXT_PUBLIC_` ablegen und keine fremden Datenbankziele verwenden:

```powershell
$poiImportSecret = Read-Host 'Pooler-Verbindungsstring der gewählten Datenbank' -AsSecureString
try {
  $env:POI_IMPORT_DATABASE_URL = [System.Net.NetworkCredential]::new('', $poiImportSecret).Password
  node scripts/import-supply.mjs .data/poi/switzerland-complete.jsonl
} finally {
  Remove-Item Env:POI_IMPORT_DATABASE_URL -ErrorAction SilentlyContinue
  $poiImportSecret.Dispose()
}
```

Der Importer liest **keine `.env`-Dateien**. Das explizite Ziel verhindert, dass ein lokaler Test versehentlich die konfigurierte Produktionsdatenbank verwendet. Falls der Session-Pooler nicht genügend gleichzeitige Verbindungen zulässt, den Import ausserhalb aktiver Tests durchführen. Keine TLS-Prüfung für die echte Supabase-Verbindung deaktivieren.

Der vollständige Datenbestand wird zunächst validiert und in einer temporären Tabelle aufgebaut. Erst danach wird ausschliesslich der POI-Bestand der Region `ch` in einer Transaktion ersetzt. Abbruch, ungültige Datensätze, fehlender Abschlussmarker, ungewöhnlich kleine Exporte oder ein älterer Extrakt lassen den vorherigen Index bestehen. Ein vorhandener, erfolgreicher Import kann mit demselben Extrakt wiederholt werden.

Anschliessend im Supabase SQL Editor prüfen:

```sql
select category, count(*) from app.supply_pois group by category;
select * from app.poi_sources;
select pg_size_pretty(pg_total_relation_size('app.supply_pois')) as index_inklusive_daten;
```

Danach in Velvetia eine Schweizer Route öffnen und das Tropfensymbol wählen. Ein Redeploy ist für einen reinen Datenimport nicht nötig, solange der neue Code bereits deployed ist und dieselbe Datenbank verwendet. „Nicht verfügbar“ weiterhin sichtbar: Migration/Importziel mit der serverseitigen `DATABASE_URL` vergleichen, Runtime-Logs und Datenbankrechte prüfen. Fehlende Treffer sind ein anderer Zustand als ein ausgefallener Index.

### Einen neuen Export erzeugen

Voraussetzungen: Docker Engine, genügend RAM für den Schweizer OSM-Extrakt und ein lokales PBF mit bekanntem Snapshot-Zeitpunkt. Das Importwerkzeug ist ein separates Docker-Image; es wird nicht auf Vercel deployed.

```powershell
docker build -t velvetia-poi-import:local infrastructure/poi
New-Item -ItemType Directory -Path .data/poi -Force | Out-Null
$poiInputDirectory = (Resolve-Path infrastructure/valhalla/data).Path
$poiOutputDirectory = (Resolve-Path .data/poi).Path
docker run --rm --network none `
  --mount "type=bind,source=$poiInputDirectory,target=/input,readonly" `
  --mount "type=bind,source=$poiOutputDirectory,target=/output" `
  velvetia-poi-import:local /input/switzerland-latest.osm.pbf /output/switzerland-neu.jsonl
```

Die Ausgabedatei darf noch nicht existieren. Beim nächsten Lauf einen neuen Namen verwenden. Der vorhandene Routing-PBF wird nur gelesen und der Routinggraph nicht verändert. Der Header-Zeitpunkt des PBF wird übernommen; Dateidatum und Importdatum werden nicht als Quellaktualität ausgegeben. Erst der erfolgreiche Import ersetzt den vorherigen POI-Index. Es gibt bewusst noch keinen automatisch geplanten Importjob.

## Prüfung und verbleibende Abnahme

Abschlussprüfung vom 18. Oktober 2026: Typecheck, ESLint und Produktionsbuild erfolgreich; 159 Unit-Tests, 67 Browserprüfungen, acht PWA-Prüfungen und acht Datenbank-Integrationstests erfolgreich. Ein ausschliesslich mobiler Tastaturtest wird auf Desktop absichtlich übersprungen. Der bestehende Datenbank-Backup-/Restore-Test mit sechs Tabellen ist ebenfalls erfolgreich.

Der vollständige, lokal importierte Schweizer Index enthält 55'379 Orte: 17'441 Wasserstellen, 25'603 Gastronomiebetriebe und 12'335 Lebensmittelgeschäfte. Daten und Indizes belegen in der QA-Datenbank rund 29 MB. Das sind Bestandszahlen des Extrakts vom 14. August 2026, keine Aussage über aktuell verfügbare Versorgung.

Automatisierte Prüfungen: Korridor/Kategorien, sichere Fehler, begrenzte Anfragen, Index und RLS, atomarer Import samt Abbruchschutz, Erhalt der Geometrie ausserhalb des Stoppbereichs, explizite Bestätigung, exaktes Undo/Redo, Entfernen über Wegpunkte, verspätete Antworten, Suche ohne Kartenbewegungsabfragen und native Zurück-Navigation. Zusätzlich wurde die echte Strecke UI → Next.js → lokaler POI-Index → lokaler Valhalla → Vorschau geprüft, mit echten Kartenkacheln und beiden Themes auf Desktop, kleinem Smartphone und im Querformat.

Die vollständigen Supabase-Advisors liessen sich auf der isolierten normalen PostGIS-Instanz nicht ausführen: zuerst erforderliche lokale TLS-Einstellung, danach fehlende Supabase-Rolle `anon`. RLS, fehlende öffentliche Grants und räumlicher Index werden direkt im Integrationstest geprüft. Die Advisor-Prüfung des tatsächlichen Supabase-Projekts bleibt vor öffentlicher Freigabe offen. Es wurden keine Produktionsdaten oder Produktionskonten verändert.

Noch offen: Migration und Import im tatsächlich verwendeten Supabase-Projekt, neue Extraktversion für den öffentlichen Start, reale Zugangs-/Versorgungsprüfung und Geräte-/Nutzertests. Die offenen Routing-/Hostingpunkte aus Paket A bleiben bestehen.

Reproduzierbare Befehle:

```powershell
npm run typecheck
npm run lint
npm test
$env:PLAYWRIGHT_CHANNEL='chrome'
npm run test:e2e
npm run test:pwa
npm run build
$env:VELVETIA_QA_DATABASE_PORT='15432'
npm run test:integration
```

Für die echte visuelle Prüfung separat die isolierte QA-Datenbank starten, Migration und Export **nur dort** importieren und `node scripts/qa-server.mjs --supply` verwenden. Dieser Modus verwendet fest den Loopback-QA-Datenbanknamen und Valhalla auf `127.0.0.1:8002`; er übernimmt keine Cloud-Verbindung. `node scripts/supply-visual-qa.mjs` benötigt ausserdem die lokale Bern-Referenzroute aus Paket A. Screenshots liegen im ignorierten Ordner `.data/supply-qa`. Testserver vor Builds stoppen.

## Quellen und Nutzungsbedingungen

Die Oberfläche verlinkt OSM-Eintrag und [OSM/ODbL-Attribution](https://www.openstreetmap.org/copyright). Ursprung des regionalen Datenbestands: [Geofabrik Schweiz](https://download.geofabrik.de/europe/switzerland.html). Extrakte sind keine Echtzeit-Verfügbarkeitsdaten. Vor Veröffentlichung die Pflichten für eine öffentlich genutzte abgeleitete OSM-Datenbank prüfen und einen Zugang beziehungsweise ein geeignetes Angebot für den gefilterten Datenexport samt ODbL und Attribution bereitstellen. Das ist nicht durch einen blossen Logo-/Copyright-Hinweis erledigt.

Technische Grundlagen: [PyOsmium](https://docs.osmcode.org/pyosmium/latest/reference/Handler-Processing/), [PostGIS-Korridorsuche](https://postgis.net/docs/ST_DWithin.html), [Supabase/PostGIS](https://supabase.com/docs/guides/database/extensions/postgis).
