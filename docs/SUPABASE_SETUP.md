# Supabase für Velvetia einrichten

Dieser Guide beginnt bei einem bereits erstellten Supabase-Projekt. Velvetia ist für Supabase Auth, PostgreSQL/PostGIS und Vercel vorbereitet. Ohne Supabase-Variablen bleibt die App im lokalen beziehungsweise anonymen Modus.

> Niemals `sb_secret_...`, `service_role`, das JWT Secret oder das Datenbankpasswort committen oder in einen öffentlichen Chat kopieren. Velvetia benötigt keinen Service-Role-Key.

## Checkliste

- [ ] Datenbankschema installiert und geprüft
- [ ] Project URL und Publishable Key gefunden
- [ ] Transaction-Pooler-URL gefunden
- [ ] lokale Variablen eingetragen
- [ ] Auth-Redirects konfiguriert
- [ ] zwei E-Mail-Templates angepasst
- [ ] lokaler Registrierungs-, Login- und Passwort-Reset-Test bestanden
- [ ] Vercel-Variablen gesetzt und neu deployed

## 1. Velvetia-Schema installieren

1. Das erstellte Projekt im [Supabase Dashboard](https://supabase.com/dashboard) öffnen.
2. Links **SQL Editor** wählen.
3. **New query** beziehungsweise **New SQL snippet** wählen.
4. Die lokale Datei [`supabase/migrations/202608160001_velvetia_routes_auth.sql`](../supabase/migrations/202608160001_velvetia_routes_auth.sql) öffnen.
5. Den **gesamten** Dateiinhalt in den SQL Editor kopieren und unten rechts **Run** wählen.
6. Danach [`supabase/migrations/202608160002_account_home.sql`](../supabase/migrations/202608160002_account_home.sql) auf dieselbe Weise vollständig ausführen.

Die Migrationen dürfen erneut ausgeführt werden. Sie aktivieren PostGIS, erstellen `app.routes`, `app.route_versions` sowie `app.user_preferences`, verbinden Kontodaten mit `auth.users`, aktivieren Row Level Security und erlauben angemeldeten Benutzern nur das Lesen ihrer eigenen Daten. Schreibzugriffe laufen weiterhin durch die validierten Velvetia-API-Routen.

### Installation kontrollieren

Im SQL Editor eine neue Query mit folgendem Inhalt ausführen:

```sql
select extname, extnamespace::regnamespace as schema
from pg_extension
where extname in ('postgis', 'pg_trgm', 'unaccent')
order by extname;

select table_schema, table_name
from information_schema.tables
where table_schema = 'app'
order by table_name;

select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'app'
order by tablename;

select schemaname, tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'app'
order by tablename, policyname;
```

Erwartet werden:

- `postgis`, `pg_trgm` und `unaccent`
- `app.routes`, `app.route_versions` und `app.user_preferences`
- `rowsecurity = true` für alle drei Tabellen
- die Policies `routes_select_own`, `route_versions_select_own` und `user_preferences_select_own`

## 2. Project URL und Publishable Key holen

1. Im Dashboard oben **Connect** öffnen. Falls die API-Werte dort nicht sichtbar sind: links unten **Project Settings** beziehungsweise das Zahnrad öffnen und **API Keys** wählen.
2. **Project URL** kopieren. Sie sieht ungefähr so aus:

   ```text
   https://abcdefghijklmnopqrst.supabase.co
   ```

3. Unter **Publishable key** den Wert kopieren, der mit `sb_publishable_` beginnt.
4. Falls nur Legacy Keys angezeigt werden, im Tab für neue API Keys einen Publishable Key erstellen. Für Velvetia nicht den Legacy-`service_role`-Key verwenden.

Die Project URL und der Publishable Key dürfen im Browser verwendet werden. Der Datenschutz entsteht durch Authentifizierung, API-Autorisierung und RLS – nicht durch das Verstecken des Publishable Keys.

## 3. Gepoolte Datenbank-URL holen

1. Oben im Projekt **Connect** wählen.
2. Zum Bereich **Connection string** wechseln.
3. **Transaction pooler** auswählen – nicht Direct Connection und nicht Session Pooler.
4. Als Format **URI** wählen und den String kopieren. Er muss den Port `6543` enthalten und sieht ungefähr so aus:

   ```text
   postgresql://postgres.PROJECT_REF:[YOUR-PASSWORD]@aws-0-REGION.pooler.supabase.com:6543/postgres
   ```

5. `[YOUR-PASSWORD]` inklusive eckiger Klammern durch das beim Erstellen des Projekts gewählte Datenbankpasswort ersetzen.
6. Falls noch keine TLS-Option vorhanden ist, `?uselibpqcompat=true&sslmode=require` anhängen. Existiert bereits ein `?`, stattdessen `&uselibpqcompat=true&sslmode=require` anhängen.

Endform:

```text
postgresql://postgres.PROJECT_REF:URL_ENCODED_PASSWORD@POOLER_HOST:6543/postgres?uselibpqcompat=true&sslmode=require
```

Enthält das Passwort Zeichen wie `@`, `:`, `/`, `?`, `#` oder `%`, müssen diese im URI URL-kodiert sein. Den fertigen String nicht in Git, Screenshots oder Chatnachrichten einfügen. Bei verlorenem Passwort unter **Project Settings → Database** ein neues Datenbankpasswort setzen.

## 4. Lokal konfigurieren

Im Projektroot eine Datei `.env.development.local` anlegen. Diese Datei ist gitignored und überschreibt beim lokalen Development-Server die bisherige lokale Docker-Datenbank:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
DATABASE_URL=postgresql://postgres.PROJECT_REF:URL_ENCODED_PASSWORD@POOLER_HOST:6543/postgres?uselibpqcompat=true&sslmode=require
```

Danach einen eventuell laufenden Dev-Server vollständig beenden und neu starten:

```powershell
npm run dev
```

Kontrolle:

- `http://localhost:3000/api/health` öffnen.
- `checks.database.status` muss `up` sein.
- `checks.database.version` sollte eine PostGIS-Version enthalten.
- Falls `database` auf `down` steht, zuerst Port `6543`, Passwortkodierung und `uselibpqcompat=true&sslmode=require` prüfen. Der Kompatibilitätsparameter verhindert, dass aktuelle `pg`-Versionen `require` unerwartet wie `verify-full` behandeln.

## 5. E-Mail-Login aktivieren

Unter **Authentication → Providers → Email** prüfen:

- Email Provider: aktiviert
- Confirm email: aktiviert
- Secure email change: für später aktiviert lassen

Für Entwicklung genügt der integrierte Supabase-Mailversand. Er ist limitiert und nicht für einen öffentlichen Produktivstart gedacht. Vor Veröffentlichung wird ein eigener SMTP-Anbieter benötigt.

## 6. Redirect URLs eintragen

1. **Authentication → URL Configuration** öffnen.
2. Solange lokal getestet wird, als **Site URL** eintragen:

   ```text
   http://localhost:3000
   ```

3. Unter **Redirect URLs** hinzufügen:

   ```text
   http://localhost:3000/auth/confirm
   http://localhost:3000/**
   ```

4. Speichern.

Nach dem Vercel-Deployment wird die Site URL durch die feste Production URL ersetzt. Localhost bleibt als zusätzliche Redirect URL erhalten. Zusätzlich werden später eingetragen:

```text
https://DEINE-PRODUCTION-DOMAIN/auth/confirm
https://*-DEIN-VERCEL-ACCOUNT-SLUG.vercel.app/**
```

Für Production immer die exakte URL verwenden. Das Wildcard-Muster ist nur für Vercel Preview Deployments gedacht.

## 7. SMTP aktivieren und Auth-E-Mail-Templates ändern

Velvetia prüft den E-Mail-Token serverseitig in `/auth/confirm`. Deshalb muss der Token-Hash an diese Route gesendet werden. Bei aktuellen gehosteten Supabase-Projekten lassen sich die Templates im Dashboard erst bearbeiten, nachdem **Custom SMTP** aktiviert wurde.

### Einfacher Test ohne eigene Domain: Resend

Für den ersten lokalen Test kann Resends Testabsender verwendet werden. Er kann nur E-Mails an die Adresse senden, mit der das Resend-Konto registriert wurde. Für weitere Tester oder Production muss später eine eigene Absenderdomain verifiziert werden.

1. Unter [resend.com](https://resend.com) ein Konto mit der E-Mail-Adresse erstellen, die auch für den Velvetia-Test verwendet wird.
2. In Resend **API Keys → Create API Key** öffnen und einen Schlüssel erstellen.
3. Den Schlüssel einmal kopieren. Er beginnt üblicherweise mit `re_` und darf weder committed noch weitergegeben werden.
4. In Supabase **Authentication → Emails → SMTP Settings** öffnen.
5. **Enable custom SMTP** aktivieren und eintragen:

   | Feld | Wert |
   | --- | --- |
   | Sender email address | `onboarding@resend.dev` |
   | Sender name | `Velvetia` |
   | Host | `smtp.resend.com` |
   | Port number | `465` |
   | Minimum interval per user | `60` |
   | Username | `resend` |
   | Password | der Resend-API-Key `re_...` |

6. **Save changes** wählen.
7. Zurück zum Tab **Templates** wechseln. Die Templates sollten jetzt bearbeitbar sein.

Für Production wird `onboarding@resend.dev` durch eine Adresse der verifizierten Domain ersetzt, zum Beispiel `login@velvetia.ch`. SPF, DKIM und DMARC werden dann nach den Vorgaben des Mailanbieters eingerichtet.

### Confirm signup

1. **Authentication → Emails → Templates** öffnen.
2. **Confirm signup** auswählen.
3. Als Subject beispielsweise `Bestätige dein Velvetia-Konto` eintragen.
4. Im Body den bestehenden Bestätigungslink durch folgenden Link ersetzen:

   ```html
   <a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email">Velvetia-Konto bestätigen</a>
   ```

5. Speichern.

### Reset password

Damit „Passwort vergessen“ und die Umstellung eines bestehenden Magic-Link-Kontos funktionieren:

1. Im selben Bereich **Reset password** auswählen.
2. Als Subject beispielsweise `Velvetia-Passwort zurücksetzen` eintragen.
3. Den bestehenden Link ersetzen durch:

   ```html
   <a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery">Neues Passwort festlegen</a>
   ```

4. Speichern.

Beim Reset enthält `.RedirectTo` bereits `?flow=recovery`; deshalb beginnt der angehängte Token dort mit `&`. Beim Signup enthält `.RedirectTo` noch keine Query und der Token beginnt mit `?`.

## 8. Lokalen End-to-End-Test durchführen

Für die automatische Übernahme einer anonymen Route muss der Bestätigungslink im selben Browserprofil geöffnet werden:

1. Ein privates Browserfenster öffnen und `http://localhost:3000` aufrufen.
2. Vor dem Login eine kleine Route planen und speichern.
3. Oben **Anmelden → Konto erstellen** wählen, E-Mail und Passwort eingeben.
4. Bestätigungs-E-Mail öffnen. Falls der Mailclient einen anderen Browser öffnet, den Link kopieren und im ursprünglichen privaten Browserfenster einfügen.
5. Nach dem Redirect muss Velvetia **Konto** statt **Anmelden** anzeigen.
6. **Meine Routen** öffnen. Die vorher anonym gespeicherte Route muss vorhanden sein.
7. Route verändern und speichern; der Versionszähler muss steigen.
8. Abmelden. Die Kontoroute darf anonym nicht sichtbar bleiben.
9. Mit E-Mail und Passwort erneut anmelden. Die Kontoroute muss wieder erscheinen.

Zusätzliche Kontrolle im Supabase Dashboard:

- **Authentication → Users** enthält die E-Mail-Adresse.
- Im SQL Editor zeigt folgende Query die übernommene Route mit gesetzter `user_id`:

  ```sql
  select id, name, user_id, current_version, created_at, updated_at, deleted_at
  from app.routes
  order by updated_at desc
  limit 20;
  ```

## 9. Vercel konfigurieren

1. Vercel öffnen und das Velvetia-Projekt wählen.
2. **Settings → Environment Variables** öffnen.
3. Folgende drei Variablen einzeln anlegen:

   | Name | Wert | Umgebung |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL | Production, optional Preview |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` | Production, optional Preview |
   | `DATABASE_URL` | Transaction-Pooler-URI | Production, optional Preview |

4. `DATABASE_URL` als **Sensitive** markieren, falls Vercel diese Option anbietet.
5. Änderungen speichern und danach unter **Deployments** beim letzten Deployment **Redeploy** auslösen. `NEXT_PUBLIC_`-Werte werden beim Build eingebunden und benötigen deshalb ein neues Deployment.

Für die frühe Testphase kann Preview dieselbe Supabase-Datenbank verwenden. Vor einem öffentlichen Launch sollte Preview/Staging eine separate Supabase-Datenbank erhalten, damit Testdeployments keine Produktionsdaten verändern.

## 10. Production URLs ergänzen

Nach erfolgreichem Vercel-Deployment:

1. Die feste Production URL kopieren.
2. In Supabase unter **Authentication → URL Configuration** als Site URL setzen.
3. `${PRODUCTION_URL}/auth/confirm` als exakte Redirect URL ergänzen.
4. Falls Preview Logins benötigt werden, das Vercel-Wildcard-Muster ergänzen.
5. Auf der Production URL denselben Login-, Routen- und Abmeldetest wiederholen.

## Vor dem öffentlichen Launch

- eigener SMTP-Anbieter und deaktiviertes E-Mail-Tracking
- Backup- und Restore-Test; je nach Tarif Point-in-Time Recovery
- Rate Limiting für Auth-, Speicher- und Routingendpunkte
- Monitoring und Fehleralarme
- Datenschutzerklärung, Account-Löschung und Datenexport
- getrennte Production- und Preview-Datenbanken
- Font-, OSM- und swisstopo-Lizenzprüfung
