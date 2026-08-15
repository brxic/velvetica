# Lokale Infrastruktur

Velvetia verwendet für die lokale vollständige Umgebung Docker Compose:

- PostgreSQL 17 mit PostGIS
- Redis 7.4
- Valhalla mit einem OSM-Extrakt der Schweiz, Zeitzonen, Administrationsgrenzen und Höhendaten

## Voraussetzungen

1. Docker Desktop mit WSL-2-Backend
2. mindestens 12 GB freier Arbeitsspeicher für Docker empfohlen
3. mindestens 25 GB freier Speicherplatz

Der erste Valhalla-Start lädt den aktuellen Geofabrik-Schweiz-Extrakt und Höhendaten und baut den Routinggraph. Je nach Verbindung und Rechner kann das deutlich länger dauern. Der Ordner `infrastructure/valhalla/data/` ist deshalb bis auf `.gitkeep` von Git ausgeschlossen.

## Start

```powershell
docker compose up -d postgres redis
docker compose up -d valhalla
docker compose ps
```

Die Valhalla-Logs zeigen den Graphaufbau:

```powershell
docker compose logs -f valhalla
```

Nach einem erfolgreichen Aufbau:

```powershell
Copy-Item .env.example .env.local
```

In `.env.local`:

```dotenv
ROUTING_PROVIDER=valhalla
VALHALLA_URL=http://localhost:8002
ROUTING_FALLBACK=preview
DATABASE_URL=postgresql://velvetia:velvetia-local-only@localhost:5432/velvetia
REDIS_URL=redis://localhost:6379
```

Danach `npm run dev` neu starten.

## Datenaktualisierung

Die Routingdaten werden nicht bei jedem Containerstart neu gebaut. Für eine bewusste Aktualisierung zunächst die Valhalla-Dokumentation und das Änderungsdatum des Extrakts prüfen. Die lokalen Daten sind groß und werden nicht committed.

## Quellen

- Routingengine: [Valhalla](https://github.com/valhalla/valhalla)
- OSM-Extrakt: [Geofabrik Switzerland](https://download.geofabrik.de/europe/switzerland.html)
- Kartendaten: © OpenStreetMap contributors, ODbL

