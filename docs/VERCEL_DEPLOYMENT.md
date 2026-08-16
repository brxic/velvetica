# Vercel-Testdeployment

Velvetia kann ohne zusätzliche Infrastruktur als öffentliches Testdeployment auf Vercel laufen. Die Anwendung verwendet dafür den öffentlichen FOSSGIS-OSM-Fahrradrouter und das Höhenprofil des Schweizer Geoportals. Die Geometrie folgt damit dem realen Wegenetz; der synthetische Preview-Router wird im Vercel-Deployment nicht verwendet.

Der öffentliche Router ist ein fair-use Testdienst: maximal eine Anfrage pro Sekunde, kein Scraping und keine starke Nutzung. Velvetia drosselt seine Anfragen innerhalb einer Serverinstanz. Für einen grösseren öffentlichen Betrieb bleibt eine eigene Valhalla-Instanz erforderlich.

## Deployment über GitHub

1. Im Vercel-Dashboard **Add New → Project** wählen.
2. Das GitHub-Repository `brxic/velvetica` importieren.
3. Als Framework wird automatisch **Next.js** erkannt.
4. Root Directory auf `.` belassen.
5. Für das erste Testdeployment sind keine Environment Variables erforderlich.
6. **Deploy** wählen.

Vercel verwendet Node.js 24 und baut das Projekt mit `npm run build`. Neue Commits auf `main` erzeugen anschliessend automatisch neue Production Deployments; andere Branches und Pull Requests erhalten Preview Deployments.

Velvetia verwendet auf Vercel bewusst die native Next.js-Ausgabe. `output: "standalone"` darf nicht aktiviert werden: Diese Ausgabe ist für selbst gehostete Docker-Images gedacht und kollidiert mit Vercels eigener Next.js-Trace- und Function-Erzeugung.

## Kontrolle nach dem Deployment

Folgende Seiten beziehungsweise Abläufe prüfen:

- `/` lädt Karte und Velvetia-Oberfläche.
- `/api/health` antwortet mit HTTP 200 und `status: "healthy"`.
- Im Health-Ergebnis steht Routing auf `up`; Datenbank und Cache bleiben ohne externe Konfiguration `disabled`.
- Ein Startpunkt kann gesucht oder auf der Karte gesetzt werden.
- Eine strassengenaue OSM-Fahrradroute kann geplant, verändert, gespeichert und als GPX exportiert werden.
- Das Favicon erscheint im Browser-Tab.

## Später echtes Routing aktivieren

Sobald eine öffentlich und geschützt erreichbare Valhalla-Instanz existiert, in **Project Settings → Environment Variables** für Preview und Production setzen:

```dotenv
ROUTING_PROVIDER=valhalla
VALHALLA_URL=https://routing.example.ch
ROUTING_FALLBACK=none
```

Danach neu deployen. `VALHALLA_URL` ist serverseitig und wird nicht an den Browser ausgeliefert. Die Routinginstanz sollte HTTPS, Zugriffsschutz, Rate Limits und Monitoring besitzen. Als temporärer Vercel-Standard gelten ohne zusätzliche Variablen bereits `ROUTING_PROVIDER=fossgis` und `ROUTING_FALLBACK=none` aus `.env.production`.

Für das Testdeployment nicht die lokalen Adressen `localhost:8002`, `localhost:5432` oder `localhost:6379` eintragen: Auf Vercel bezeichnet `localhost` immer die jeweilige isolierte Function und nicht den Entwicklungsrechner.

## Datenbank und Redis

Ohne `DATABASE_URL` bleiben gespeicherte Routen sicher im `localStorage` des Browsers. Mit einer TLS-gesicherten, PostGIS-fähigen `DATABASE_URL` aktiviert Velvetia automatisch die serverseitige Synchronisierung und Versionshistorie. Das Schema wird beim ersten Zugriff idempotent eingerichtet. Der Drawer zeigt sichtbar entweder `PostGIS verbunden` oder `Lokaler Speicher`.

Ohne Supabase verwendet die Besitztrennung eine anonyme HttpOnly-Browser-ID. Mit Supabase Auth werden bestehende anonyme Routen beim ersten Login automatisch übernommen und danach geräteübergreifend dem verifizierten Benutzerkonto zugeordnet. Auch der persönliche Home-Punkt wird über die verifizierte Supabase-Benutzer-ID gespeichert. Für den Transaction Pooler muss die `DATABASE_URL` mit `?uselibpqcompat=true&sslmode=require` enden. Die vollständige Einrichtung inklusive PostGIS-Migration, RLS, E-Mail-/Passwort-Templates und Vercel-Variablen steht in [SUPABASE_SETUP.md](./SUPABASE_SETUP.md). `REDIS_URL` bleibt für das Testdeployment optional.

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
