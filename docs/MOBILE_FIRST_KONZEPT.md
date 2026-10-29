# Velvetia: Mobile-first-Produktkonzept

**Stand:** 29. Oktober 2026 · Arbeitsentwurf

Dieses Dokument ordnet den **nächsten mobilen Arbeitsschritt**. Die langfristigen Ideen bleiben im [Produktvisions- und Ideenregister](PRODUKTVISION_UND_IDEENREGISTER.md) erhalten; spätere Reihenfolge bedeutet keine Streichung.

## Ausgangspunkt

Velvetia soll auf dem Smartphone vom ersten Moment an zum Planen einer Veloroute einladen. Die erste starke Version richtet sich an alle Menschen, die eine eigene Radtour planen möchten: Einsteiger, Sonntagsfahrer, Alltagspendler und ambitionierte Fahrer. Die endgültige Produktvision umfasst Rennrad, Freizeit/Touring, Gravel, Alltag/City sowie Mountainbike und Downhill. Unterschiedliche Ansprüche werden über Fahrradprofil und später sichtbare Optionen bedient, nicht über getrennte Einstiegsseiten. MTB/Downhill erhalten dabei eine eigene fachliche Ausbaustufe; sie sind im aktuellen Produkt noch nicht verfügbar.

Der heutige Funktionsumfang ist für eine Beta beachtlich. Auf kleinen Bildschirmen konkurrieren aber mehrere Ebenen um Platz und Aufmerksamkeit: Kopfzeile, Planungsschalter, Planungs-Sheet, Routenkarte, Routen-Zusammenfassung, Bearbeitungsleiste, Wegpunkt-Sheet, Versorgung und Fahrmodus. Dieses Konzept priorisiert die Wege durch diese Zustände. Die konkreten visuellen Mängel müssen anhand echter Gerätescreens und Nutzertests validiert werden; eine Live-Ansicht war für diese Bestandsaufnahme nicht verfügbar.

### Konkretes Nutzerfeedback, 29. Oktober 2026

- Eine aus „Meine Routen“ geöffnete Route lässt sich in der normalen Ansicht nicht wie das Planungs-Sheet nach unten ziehen. Im aktuellen Code bekommt die Routenzusammenfassung einen `MapSheetHeader` nur während der Bearbeitung; das erklärt diesen Unterschied.
- Ansichten fühlen sich wie Sackgassen an; der Nutzer verlässt sie teils nur durch einen Seiten-Reload. Die vorhandene Zurück-Logik deckt nicht jeden sichtbaren Zustand als klaren, konsistenten Weg ab. Das ist ein zu prüfender UX- und Navigationsfehler, kein gewünschtes Verhalten.
- Der Einstieg zeigt im Wesentlichen eine leere Karte mit Planungsaktion. Es fehlt eine Startansicht, die Velvetia sofort erklärt und den ersten erfolgreichen Schritt anstösst.
- Versorgungspunkte sind technisch funktional, aber Platzierung und Darstellung wirken additiv und unattraktiv.
- Der Gesamteindruck hat den Gründer und erste Personen, denen er die App gezeigt hat, nicht begeistert. Das ist qualitative Rückmeldung, keine quantifizierte Studie. Die bestehende Planungsansicht findet der Gründer jedoch grundsätzlich brauchbar; die Kritik betrifft vor allem Einstieg, Zustandswechsel, gespeicherte Routen und Versorgung.

**Neue Abnahmekriterien:** Jede Hauptansicht hat einen sichtbaren Schliessen-/Zurück-Weg ohne Reload; Planungs- und Routen-Sheets folgen demselben nachvollziehbaren Griff-/Minimierverhalten; der erste Bildschirm zeigt Nutzen und Hauptaktion; POIs erhalten eine kartennah lesbare, visuell integrierte Darstellung. Gezielte Änderungen werden an echten Nutzern und Geräten geprüft.

## Produktversprechen

**Arbeitsfassung:** „Plane eine Veloroute in der Schweiz, die zu deiner Fahrt passt. Sieh den Verlauf sofort auf der Karte und passe ihn einfach an.“

Das Versprechen umfasst eine rasche erste Route, Kontrolle über den Verlauf und verständliche Angaben zu Distanz, Höhenmetern und Einschränkungen. Es behauptet keine geprüfte Sicherheit, Echtzeit-Befahrbarkeit oder profilspezifische Berechnung, wenn der aktive Router diese nicht bietet.

### Leitprinzipien

1. **Route vor Konto:** Planen und Ausprobieren bleiben ohne Anmeldung möglich. Ein Konto erscheint als sinnvolle Option beim dauerhaften Speichern oder Synchronisieren.
2. **Eine Hauptaufgabe pro Ansicht:** Planen, Route ansehen, Bearbeiten, Zwischenstopp auswählen und Fahren haben jeweils eine klare Hauptaktion. Nur eine grosse Arbeitsfläche beziehungsweise ein Sheet ist zugleich offen.
3. **Karte sichtbar lassen:** Die Karte zeigt den Nutzen und das Ergebnis. Sheets bedecken nur so viel wie für die momentane Aufgabe nötig.
4. **Details nach Bedarf:** Der Einstieg zeigt Start, Tourentyp, Profil und gegebenenfalls Distanz. Erweiterte Wünsche, Datenherkunft, Analyse und Versorgung sind zugänglich, ohne den ersten Schritt zu überladen.
5. **Zustand ehrlich benennen:** Entwurf, lokal gespeichert und mit Konto synchronisiert sind unterscheidbar. Fehlende Höhen-, Untergrund- oder Öffnungsdaten bleiben erkennbar unbekannt.
6. **Bedienung vor Dekoration:** Verständliche Texte, grosse Ziele, stabile Positionen, nativer Zurück-Weg, Tastatur und echte Safe Areas gehören zum Design.

## Erweiterte Produktvision: MTB, Downhill und Bikeparks

Die bisherige Entscheidung „Mountainbike ausgeschlossen“ gilt für den lokalen Prototyp und den aktuellen Code. Für das angestrebte Endprodukt ist sie durch den Wunsch nach MTB/Downhill überholt. Die aktuelle App darf diese Fahrarten bis zur technischen und fachlichen Prüfung nicht als funktionierende Profile anbieten.

**MTB-Touren** brauchen ein eigenständiges Routingprofil mit geeigneten Wegen, technischer Schwierigkeit, Untergrund, Anstiegen und rechtlichem Zugang. **Downhill** ist mehr als ein schwieriger MTB-Schalter: Richtung, technische Einstufung, Bikepark-Grenzen, Lifte/Shuttles und aktuelle Öffnung können relevant sein. Ein allgemeiner Fahrradrouter oder ein blosses `bicycle_type: mountain` darf keine verlässliche Trail- oder Parkplanung suggerieren. Valhalla kennt zwar `mountain` als Fahrradtyp, aber der heutige Velvetia-Adapter nutzt nur `road`, `cross` und `hybrid` und wertet Trail-Schwierigkeit nicht aus. Quelle: https://valhalla.github.io/valhalla/api/route/api-reference/.

**Bikeparks auf der Karte** sind als spätere, optional einschaltbare Ebene sinnvoll: zunächst Park und Trails mit Name, Richtung, dokumentierter Schwierigkeit und Quelle. Ein Park-Trail ist erst dann routbar, wenn Geometrie, Zugang, Richtung und Qualitätsregeln geprüft sind. OSM kennt unter anderem `mtb:scale`, `mtb:scale:imba` für angelegte Trails und `mtb:type=downhill`; diese Angaben sind nicht überall vollständig und `mtb:scale` belegt keinen rechtlichen Zugang. Quellen: https://wiki.openstreetmap.org/wiki/Key:mtb:scale, https://wiki.openstreetmap.org/wiki/Key:mtb:scale:imba und https://wiki.openstreetmap.org/wiki/Tag:mtb:type%3Ddownhill. Öffnung, Sperrungen und Liftbetrieb dürfen nicht aus statischen OSM-Daten als aktuell behauptet werden.

**Entscheidungs-Gate:** Für mindestens zwei bis drei Schweizer Testregionen erfassen, wie viele relevante Trails und Parks samt Schwierigkeit, Richtung und Zugang belastbar vorliegen; danach ein MTB-Routingkorpus und echte Feldprüfung. Erst damit wird entschieden, ob MTB-Touren, Parkanzeige und Downhill-Navigation gemeinsam oder in getrennten Releases starten.

## Vorgeschlagener mobiler Kernfluss

| Zustand | Sichtbar im ersten Blick | Primäre Aktion | Nachgeordnet |
|---|---|---|---|
| Einstieg/Planung | Karte, Startsuche, „Rundtour“ oder „Von A nach B“, Profil, bei Rundtour Distanz | „Route planen“ | Standortwahl, erweiterte Wünsche, GPX-Import |
| Routenergebnis | Verlauf auf möglichst grosser Karte; kompakte Karte mit Distanz, Anstieg und geschätzter Zeit | „Route speichern“ oder, bei Gast, „Route sichern“ mit klarer Speicherwahl | Bearbeiten, Details, GPX, Versorgung, Fahrmodus |
| Bearbeiten | Karte, ausgewählter Punkt/Abschnitt, klarer Bearbeitungsstatus | „Fertig“ | Wegpunktliste, Undo/Redo; Speichern danach weiterhin ausdrücklich |
| Versorgung | Orte entlang der Route, Kategorien, berechneter Umweg erst nach Auswahl | „Stopp übernehmen“ nach Vorschau | Quellen/Öffnungszeiten, Filter |
| Fahrmodus | Karte, Standort- und Fortschrittsanzeige, eindeutiger Beenden-Knopf | „Fahrt beenden“ | Wachhalten, Zentrieren, Pausieren |
| Meine Routen | Suche und erkennbare Routenkarten | Route öffnen | Filter, Versionen, Teilen |

Der genaue Wortlaut und die Entscheidung zwischen „Speichern“ und „Sichern“ werden in Nutzertests geprüft. Wichtig ist ein einziger, durchgehend verständlicher Speichervertrag.

### Einstieg in drei Entscheidungen

1. Startort suchen oder auf der Karte setzen. Standortfreigabe nur nach ausdrücklicher Aktion.
2. Rundtour oder Strecke wählen; bei Strecke Ziel, bei Rundtour Distanz eingeben.
3. Fahrradtyp wählen und Route planen. „Freizeit/Touring“ ist als möglicher neutraler Standard zu testen, nicht ohne Test festgelegt.

Erweiterte Wünsche werden erst nach dem ersten Routenergebnis oder in einer klar bezeichneten optionalen Einstellung gezeigt. Wenn der öffentliche Router nur ein allgemeines Fahrradprofil liefert, muss die Oberfläche das deutlich zeigen; ein Profilknopf darf keinen wirksamen Unterschied suggerieren.

## Informationsarchitektur und visuelle Richtung

### Navigation

Auf Mobile drei beständige Orte: **Planen**, **Meine Routen**, **Konto**. Einstellungen und Hilfe liegen im Konto-/Mehr-Bereich. Während der Planung und Bearbeitung darf die Navigation zugunsten der Aufgabe zurücktreten. Ein kleines Gerät soll nicht gleichzeitig Kopfzeile, Planungsschalter, mehrere Kartenaktionen und zwei Bottom Sheets erklären müssen.

Die Interaktion erhält eine zentrale Zustandsregel: `planning → result → editing | supply | ride`, wobei Bearbeitung und Versorgung nicht gleichzeitig ihre eigenen Steuerflächen zeigen. Native Zurück-Navigation führt eine Ebene zurück und bewahrt den gültigen Entwurf. Der Entwurf wird nie durch blosses Schliessen verworfen.

### Aussehen

Empfehlung nach dem gemeinsamen Mockup-Feedback: **die aktuelle Planungsansicht als Basis erhalten und die mobilen Schwachstellen gezielt beheben.** Logo, Markenrot, Kartendarstellung und die funktionierende Planungsstruktur bleiben Ausgangspunkt. Wir ändern nur dort das visuelle System, wo Lesbarkeit, Hierarchie oder Bedienung erkennbar leiden. Ein neuer Look muss einen konkreten Gewinn gegenüber der Live-Version zeigen.

Feedback zum ersten Kartenfokus-Mockup: Die Grundidee wirkt brauchbar, aber Inter, grosse Rundungen, Standardkarten und rote Primärbuttons erinnern zu stark an eine generische Webapp. Daraus folgt **kein Auftrag, die vorhandene Planung komplett neu zu zeichnen**. Wir bewerten zuerst die echte Live-Ansicht neben konkreten Problemzuständen und ändern nur nachweisbar störende Elemente.

Nach der zweiten Entwurfsrunde hat der Nutzer die gewünschte Richtung präzisiert: **einfach und modern, eher eckig, wenig Text, keine Slogans und keine auffällige Schriftmischung.** Auch der anschliessende stark vereinfachte Entwurf wirkte schwächer als die Live-Planung. Die stilisierten Richtungen „Atlas“ und „Terrain“ sowie der Minimalentwurf sind kein Zielbild. Nächste Mockups müssen auf echten Screens der aktuellen App aufbauen, nicht auf neu erfundenen Oberflächen.

Nächster Designschritt: Live-Planung als Referenz festhalten; dann nur die Startansicht, geöffnete gespeicherte Route, Zurück-/Schliessen-Wege und Versorgung im direkten Vorher-nachher-Vergleich überarbeiten. Desktop leitet sich aus denselben Zuständen ab und kann mehr Raum für Details nutzen.

### Marketing und erster Eindruck

Die geplante öffentliche Website erklärt Velvetia als Produkt und Firma und führt zur Web-App sowie später zu App Store und Google Play. Ihr erster Smartphone-Screen sollte einen echten, gut lesbaren Velvetia-Routenbildschirm, einen klaren Satz und „Route planen“ zeigen. Drei belegbare Nutzenpunkte reichen im ersten Bildschirm zunächst: rasch planen, Verlauf anpassen, Route wiederfinden/GPX mitnehmen. Weitere Funktionen erhalten auf der Website Platz, sobald sie verfügbar und belegbar sind. Echte Schweizer Routenausschnitte sind glaubwürdiger als erfundene Vorschläge. Screenshots erst mit dem überarbeiteten Produktdesign erstellen; Marketing und App dürfen nicht zwei verschiedene Produkte versprechen.

## Google-Anmeldung

Google-Anmeldung ist ein sinnvoller Komfortschritt **nach** dem einfachen Planungsfluss. E-Mail/Passwort bleibt als Alternative. Die Anmeldung wird beim dauerhaften Speichern, Synchronisieren oder Öffnen eigener Routen angeboten; sie blockiert die erste Routenplanung nicht. Kein automatisches Google-Popup beim ersten Besuch.

Vor Umsetzung: Google-Provider und erlaubte Redirects in Supabase konfigurieren, vorhandenen PKCE-Callback nutzen oder gezielt erweitern, Gastentwürfe beim ersten Login korrekt zuordnen und die Verknüpfung vorhandener E-Mail-Konten testen. Nur die für die Anmeldung nötigen Scopes anfordern. Der Login-Knopf und der Zustimmungsbildschirm folgen den aktuellen Google-Vorgaben; ein eigener Markenbutton darf Googles Logo nicht umgestalten. Supabase dokumentiert die Google-OAuth-Einrichtung und die Verknüpfung gleicher verifizierter E-Mail-Adressen: https://supabase.com/docs/guides/auth/social-sign-in/auth-google und https://supabase.com/docs/guides/auth/auth-identity-linking. Google dokumentiert die Button-Gestaltung: https://developers.google.com/identity/branding-guidelines.

## Android-Installation und spätere APK

Die App besitzt bereits ein Web-Manifest und einen Service Worker; eine installierte PWA kann daher zuerst für echte Android-Tests dienen. Das löst ihre heutigen Online- und Hintergrund-Grenzen nicht. Eine **APK für eigene Testgeräte** kann danach als Trusted Web Activity mit Bubblewrap gebaut werden. Sie zeigt die gehostete PWA in einem Android-Container; für eine vollflächige vertrauenswürdige Darstellung braucht sie eine zugeordnete Domain mit Digital Asset Links. Der offizielle Leitfaden beschreibt den APK-Build: https://developer.chrome.com/docs/android/trusted-web-activity/quick-start. Die Android-Dokumentation erklärt, dass eine Trusted Web Activity Webinhalt aus dem Browser rendert: https://developer.android.com/develop/ui/views/layout/webapps/trusted-web-activities.

Für den ersten APK-Test ist diese schmale Verpackung plausibel. Wenn Velvetia später verlässliche Hintergrundnavigation, native GPS-Funktionen oder umfangreiche Offline-Karten verspricht, muss eine echte Android-Architektur gesondert geprüft werden. Ein Capacitor- oder anderer nativer Container wäre dann eine mögliche Option, aber kein automatischer Ersatz für die bestehende Next.js-Server- und API-Architektur. Die APK-Entscheidung folgt deshalb auf mobile UX- und Hardwaretests sowie eine stabile öffentliche Domain; sie wird nicht als heutige Produktreife gewertet.

## Einheitlicher Name

**Kanonischer Markenname: Velvetia** in App, Logo, Manifest, Seitentiteln, Dokumentation, Marketing, Paketnamen und späteren Stores. `velvetica` ist kein zweiter Produktname.

Die Bestandsaufnahme zeigt: `package.json`, App-Metadaten und Web-Manifest verwenden bereits `Velvetia`. `velvetica` kommt im lokalen Ordner, GitHub-Repository `brxic/velvetica`, im Vercel-Projektnamen und in der aktiven Adresse `velvetica.vercel.app` vor; im Code überwiegend als Repository-Link im User-Agent und in Test-URLs. Das ist eine **Infrastruktur-/Adressmigration**, keine reine Textsuche mit globalem Ersetzen.

Vor einem öffentlichen Markenauftritt eine gewünschte kanonische Domain wählen und Verfügbarkeit/Rechte prüfen. Danach GitHub- und Vercel-Namen, Domains/Weiterleitungen, Supabase-Auth-Redirects, E-Mail-Links, PWA-Identität, Android Digital Asset Links, Tests und Dokumentation in einer geordneten Migration aktualisieren. Bestehende Links und Logins müssen danach noch funktionieren. Rein lokale Routen im Browserspeicher der alten Domain wandern nicht automatisch zur neuen Domain; dafür braucht es einen Export-/Import- oder anderen expliziten Übergang. Bis dahin bleiben aktuelle technische URLs korrekt dokumentiert, während alle nutzerseitigen Texte ausschliesslich „Velvetia“ sagen.

## Schwachstellen und Chancen

| Befund aus dem aktuellen Code/Konzept | Wirkung auf Mobile | Konzeptionelle Antwort |
|---|---|---|
| Der Einstieg zeigt eine fast leere Karte; die bestehende Planung wird dagegen grundsätzlich als brauchbar empfunden. | Der erste Blick erklärt Velvetia zu wenig. | Einstieg gezielt ergänzen und die Live-Planung als Referenz behalten. |
| Route bietet Speichern, Fahrmodus, GPX, Bearbeiten, Versorgung und Details gleichzeitig. | Keine eindeutige Handlungspriorität. | Kompakte Ergebnisansicht mit einer Hauptaktion und einer klaren sekundären Aktion; weitere Werkzeuge in einem konsistenten Aktionsbereich. |
| Mehrere minimierbare Sheets und unterschiedliche mobile Dialoge bilden ein komplexes räumliches Modell. | Schliessen, Zurück und Kartenraum können unvorhersehbar wirken. | Einheitliche Sheet-Höhen und ein zentraler Zustandsvertrag; pro Aufgabe genau eine Steuerfläche. |
| Produktplan enthält KI, Wetter, Unfallanalyse und Route Art. | Breite Roadmap verwässert den Kernnutzen. | Bis zur klaren mobilen Kernreise und Routingqualität zurückstellen. Danach anhand echter Nutzersignale neu priorisieren. |
| FOSSGIS liefert ein allgemeines Fahrradprofil; vier Profile sind sichtbar. | Versprochenes und tatsächliches Ergebnis können auseinanderfallen. | Profilwirksamkeit vor breiter Vermarktung technisch sichern oder die Einschränkung im Auswahlmoment klar zeigen. |
| Realer Fahrmodus hat bewusst keine Abbiegehinweise und keine Hintergrundnavigation. | Nutzer könnten vollwertige Navigation erwarten. | „Route folgen“ als präzise Bezeichnung prüfen und Grenzen vor dem Start sichtbar machen. |

## Für spätere Etappen reserviert

Die folgenden Ideen bleiben Teil des Ideenregisters und werden nicht verworfen. Ihre Ausgestaltung und Reihenfolge werden nach dem mobilen Kernfluss mit Nutzern, Datenlage und technischem Aufwand geprüft.

- KI-Freitextplanung erst, wenn der klassische Drei-Schritt-Flow und die Routengüte zuverlässig sind.
- Wetter- und Unfallrisiko-Aussagen erst mit belastbaren Daten, verständlicher Unsicherheit und fachlicher Prüfung.
- Route Art, Social Feed und breite Touren-Discovery erst nach Nachweis, dass sie zum Kernversprechen passen.
- Öffnungsstatus von Versorgungspunkten erst mit korrektem Parser, Feiertagsdaten und Datenfrische.
- Weitere Login-Anbieter erst nach Beobachtung eines konkreten Bedarfs.
- MTB/Downhill erst nach Daten- und Routing-Gate; eine Bikepark-Ebene kann separat vor einem routbaren Trailprofil erprobt werden.

## Vorgehen zur Entscheidung und Umsetzung

1. **Live-Ansichten als Referenz:** echte Screens und kurze Aufnahmen auf iPhone und Android für Einstieg, Planung, gespeicherte Route, Bearbeiten, Speichern, Versorgung und Fahrmodus festhalten. Probleme nach Schwere und Häufigkeit ordnen; die funktionierende Planung bleibt Vergleichsbasis.
2. **Bedienblocker beheben:** Eine gespeicherte Route erhält dasselbe verständliche Minimier- und Öffnungsverhalten wie das Planungs-Sheet. Alle Hauptansichten bieten sichtbares Zurück/Schliessen ohne Reload; Entwürfe bleiben erhalten.
3. **Einstieg und Versorgung gezielt verbessern:** Den leeren Erstzustand um einen klaren Start ergänzen. POIs, Trefferliste und Stoppvorschau im direkten Vergleich zur Live-Version neu platzieren; keine neue generische App-Oberfläche entwerfen.
4. **Mit Menschen und Geräten prüfen:** Fünf bis acht Personen unterschiedlicher Fahrerfahrung planen, öffnen, ändern und speichern eine Route ohne Anleitung. Erfolg, Fehlgriffe und Abbrüche notieren; auf iPhone und Android prüfen. Das ist ein qualitativer Test, kein statistischer Beweis.
5. **Freigabe-Gate:** Routingfälle, produktives Profilrouting, POI-Daten, Datenschutz/Lizenzen und Geräteabnahme aus den bestehenden Paketen A bis C abschliessen.

### Erfolgskriterien als zu prüfende Ziele

- Eine neue Person erkennt ohne Einführung, wie sie eine Route plant.
- Eine Route lässt sich ohne Konto planen und ansehen.
- Nutzer unterscheiden Entwurf, lokale Sicherung und Kontosynchronisierung.
- Nutzer finden Bearbeiten, Rückgängig und Speichern, ohne eine Route versehentlich zu verlieren.
- Auf kleinen iPhones und Android-Geräten bleibt die Karte in jedem Kernzustand sinnvoll sichtbar; Eingaben funktionieren mit Bildschirmtastatur und Safe Areas.
- Die erste Marketingansicht zeigt denselben Nutzen und dieselbe Gestaltung wie die echte App.

## Zur gemeinsamen Entscheidung

1. Soll Velvetia zuerst als **Planungswerkzeug für eigene Routen** positioniert werden, oder sollen fertige Tourenvorschläge/Entdeckung früh ein zweites gleichwertiges Produktversprechen werden? Empfehlung: zunächst Planungswerkzeug.
2. Soll „Route speichern“ auf dem Smartphone primär **lokal ohne Konto** funktionieren oder nach einem Gastentwurf gezielt zur **Cloud-Sicherung mit Konto** führen? Das beeinflusst Text, Onboarding und Vertrauen.
3. Soll der Fahrmodus als Teil des ersten öffentlichen Produkts erscheinen oder erst nach echten Gerätetests prominent werden? Empfehlung: erst nach Hardware-Abnahme prominent vermarkten.
4. Welche konkreten Elemente der Live-Planung sollen unverändert bleiben? Diese Antwort wird anhand echter Screens und der gezielten Vorher-nachher-Vergleiche festgehalten.
5. Für die erste MTB-Ausbaustufe: zuerst **Touren auf natürlichen Wegen**, zuerst **Bikeparks und ihre Trails anzeigen**, oder beides als zusammenhängende, aber getrennt freizugebende Funktionen? Empfehlung: Parkanzeige und MTB-Routing getrennt prüfen.
6. Für die erste Android-APK: genügt eine **installierbare Testversion der PWA** auf dem eigenen Gerät, oder sind schon native Funktionen nötig? Empfehlung: zuerst PWA auf Hardware, dann kleine TWA-APK.
