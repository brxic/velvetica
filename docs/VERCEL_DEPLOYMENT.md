# Vercel-Testdeployment

Velvetia kann ohne zusätzliche Infrastruktur als öffentliches Testdeployment auf Vercel laufen. Dabei verwendet die Anwendung bewusst den eingebauten Preview-Router. Karte, Ortssuche, Editor, lokale Routenverwaltung, GPX-Export, Sprachen und Themes funktionieren; die Routengeometrie ist in diesem Modus eine Vorschau und kein strassengenaues OSM-Routing.

## Deployment über GitHub

1. Im Vercel-Dashboard **Add New → Project** wählen.
2. Das GitHub-Repository `brxic/velvetica` importieren.
3. Als Framework wird automatisch **Next.js** erkannt.
4. Root Directory auf `.` belassen.
5. Für das erste Testdeployment sind keine Environment Variables erforderlich.
6. **Deploy** wählen.

Vercel verwendet Node.js 24 und baut das Projekt mit `npm run build`. Neue Commits auf `main` erzeugen anschliessend automatisch neue Production Deployments; andere Branches und Pull Requests erhalten Preview Deployments.

## Kontrolle nach dem Deployment

Folgende Seiten beziehungsweise Abläufe prüfen:

- `/` lädt Karte und Velvetia-Oberfläche.
- `/api/health` antwortet mit HTTP 200 und `status: "healthy"`.
- Im Health-Ergebnis stehen Routing, Datenbank und Cache ohne externe Konfiguration auf `disabled`.
- Ein Startpunkt kann gesucht oder auf der Karte gesetzt werden.
- Eine Preview-Route kann geplant, verändert, gespeichert und als GPX exportiert werden.
- Das Favicon erscheint im Browser-Tab.

## Später echtes Routing aktivieren

Sobald eine öffentlich und geschützt erreichbare Valhalla-Instanz existiert, in **Project Settings → Environment Variables** für Preview und Production setzen:

```dotenv
ROUTING_PROVIDER=valhalla
VALHALLA_URL=https://routing.example.ch
ROUTING_FALLBACK=preview
```

Danach neu deployen. `VALHALLA_URL` ist serverseitig und wird nicht an den Browser ausgeliefert. Die Routinginstanz sollte HTTPS, Zugriffsschutz, Rate Limits und Monitoring besitzen.

Für das Testdeployment nicht die lokalen Adressen `localhost:8002`, `localhost:5432` oder `localhost:6379` eintragen: Auf Vercel bezeichnet `localhost` immer die jeweilige isolierte Function und nicht den Entwicklungsrechner.

## Datenbank und Redis

`DATABASE_URL` und `REDIS_URL` bleiben für das Testdeployment leer. Gespeicherte Routen liegen aktuell im `localStorage` des Browsers. Wenn später serverseitige Konten und geräteübergreifende Speicherung implementiert werden, werden verwaltete, TLS-gesicherte Postgres- und Redis-Dienste verbunden.

## CLI-Alternative

Wenn die Vercel CLI installiert ist:

```powershell
npx vercel@latest link
npx vercel@latest deploy
```

Für ein Production Deployment:

```powershell
npx vercel@latest deploy --prod
```

Lokale Secrets und die Docker-/Valhalla-Daten sind über `.vercelignore` vom CLI-Upload ausgeschlossen.
