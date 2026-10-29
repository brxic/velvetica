# Velvetia: Produktvision und Ideenregister

**Stand:** 29. Oktober 2026 · lebender Konzeptentwurf

## Zweck dieses Dokuments

Dieses Register bewahrt die bereits geäusserten Produktideen und ergänzt neue. **Eine spätere Umsetzung bedeutet keine Streichung.** Für jede Idee halten wir Nutzen, Reife, Abhängigkeiten und eine begründete Entscheidung fest. Ideen werden nicht stillschweigend aus dem Register gelöscht. Eine Änderung des Ziels wird als neue Entscheidung mit Datum dokumentiert.

Der [ursprüngliche technische Umsetzungsplan](../VELVETIA_UMSETZUNGSPLAN.md) bleibt als ausführliche Quelle erhalten. Seine damaligen MVP-Grenzen und Technologie-Vorschläge sind nicht automatisch die endgültige Produktvision. Der [Mobile-first-Konzeptentwurf](MOBILE_FIRST_KONZEPT.md) beschreibt die priorisierte Bedienung. Der aktuelle Funktionsstand steht in [README](../README.md) sowie den Paketen [A](PACKAGE_A.md), [B](PACKAGE_B.md) und [C](PACKAGE_C.md).

## Endbild

**Velvetia** ist eine mobile-first-Plattform für die Planung eigener Velorouten und Touren. Der Einstieg ist für jede Fahrererfahrung verständlich; vertiefte Werkzeuge bleiben für ambitionierte Nutzer verfügbar. Die erste geografische Stärke ist die Schweiz. Das Produkt soll eines Tages bestehen aus:

1. **Einer öffentlichen Velvetia-Website**, die Produkt und Firma erklärt, Vertrauen schafft und zur Web-App, zum App Store und zu Google Play führt.
2. **Einer Web-App** zum direkten Planen ohne verpflichtenden Login.
3. **Einer iOS-App** und **einer Android-App** als vollwertige, gepflegte Produkte auf den jeweiligen Plattformen. Eine frühe Android-Test-APK ist ein Zwischenschritt und erfüllt dieses Ziel noch nicht.
4. **Einem Instagram- und einem TikTok-Auftritt** für Marke, Inhalte und Werbung; Facebook ist eine spätere Option, falls Zielgruppe und Aufwand dafür sprechen.
5. **Einem kleinen, bezahlbaren Preismodell**, sobald Nutzen, Betriebskosten und Zahlungsbereitschaft bekannt sind. Ein grosszügiger kostenloser Kern bleibt Ziel.

Die Oberfläche, Markenstimme, Routenqualität und Kontodaten sollen über Web, iOS und Android konsistent sein. Das erfordert nicht identische Screens oder von Anfang an drei getrennte Codebasen. Die Architekturentscheidung für native Funktionen folgt auf echte Hardwaretests und Anforderungen an Offline-Karten, GPS und Navigation.

## Gesicherte Ideen und Feature-Familien

| ID | Idee / Nutzen | Heute | Ziel und nächste Klärung |
|---|---|---|---|
| F01 | Rundtour und Strecke mit Start/Ziel, Fahrradtyp, Distanz und einem bearbeitbaren Vorschlag | Beta vorhanden | Bestehende Planung als Basis erhalten; mobile Zustandswechsel verbessern sowie Routenqualität und Profile real prüfen. |
| F02 | Rennrad, Gravel, Freizeit/Touring und Alltag/City | In UI und Domänenmodell vorhanden; öffentlicher Router nutzt ein allgemeines Profil | Verlässliche Profilunterschiede mit geeignetem Produktionsrouter nachweisen. |
| F03 | MTB-Touren, Downhill, Bikeparks und sichtbare Trails | Noch nicht implementiert | Eigene Daten- und Routingprüfung; Schwierigkeit, Richtung, Zugang, Parks und Datenfrische getrennt untersuchen. |
| F04 | Wegpunkte, Kartenbearbeitung, Undo/Redo, Alternativen und klarer Routenvergleich | Editor vorhanden; Alternativen und Vergleich sind Ausbaustufen | Mobile Bearbeitung vereinfachen; Alternativen erst mit nachvollziehbaren Unterschieden. |
| F05 | Höhenprofil, Untergrund, Wegtypen, Steigungen, Warnungen und Datenherkunft | Teilweise vorhanden, providerabhängig | Fehlende Daten ehrlich zeigen; segmentgenaue, belegbare Analyse erweitern. |
| F06 | GPX-Import/Export und Nutzung auf Geräten | Vorhanden | Kompatibilität und verlässliche Übergabe an Geräte weiter prüfen. |
| F07 | Lokale Entwürfe, Konto, Sync, Routenversionen, Bibliothek, Freigabelinks | Beta vorhanden | Mobile Speicherlogik verständlich machen; Google-Login ergänzen und iOS-Login-Regeln einplanen. |
| F08 | Versorgung: Wasser, Gastronomie, Läden, Umweg und Zwischenstopp | Code vorhanden; produktiver POI-Import offen | Daten aktuell halten; später Öffnungszeiten, Feiertage, Versorgungslücken und Zeitbezug ergänzen. |
| F09 | Fahrmodus, Standort und Fortschritt; spätere Navigation/Offline-Nutzung | Erste Ausbaustufe vorhanden | Hardwaretests; Abbiegehinweise, Hintergrundverhalten und Offline-Karten als eigene Zukunftsentscheidungen. |
| F10 | Wetter entlang der geplanten Fahrt und verlässliche Hinweise | Im ursprünglichen Plan, nicht implementiert | Datenqualität, Prognosehorizont und Unsicherheit prüfen; später integrieren. |
| F11 | Sicherheits-/Eignungshinweise mit Gründen statt irreführender Sicherheitszahl | Grundwarnungen vorhanden | Fachlich geprüfte Segmenthinweise, Datenstand, Konfidenz und mögliche Alternativen. |
| F12 | KI für natürlichsprachige Wünsche, Rückfragen, Erklärungen und kontrollierte Änderungen | Im ursprünglichen Plan, nicht implementiert | Nach stabilem Kernfluss als überprüfbare Assistenz, nie als Quelle erfundener Wege oder Fakten. |
| F13 | Route Art: Formen zeichnen und auf fahrbare Wege übertragen | Forschungsidee im ursprünglichen Plan | Experiment und Nachfrage prüfen; als eigenständige kreative Funktion erhalten. |
| F14 | Weitere Regionen und Länder | Architekturidee, Schweiz aktiv | Abdeckung, Lizenz, Karten-/Routingdaten und Qualität pro Region freigeben. |
| F15 | Entdecken, Community, Social Feed, Trainingsdaten | Teilweise als spätere Ideen/Nichtziele des MVP erwähnt | Im Register behalten; genauer Nutzen und Verhältnis zum Planungsversprechen erst mit Nutzern klären. |

„Heute“ beschreibt den dokumentierten Stand, keine vollständige Live-Abnahme. Die Einträge F09, F10, F11 und F15 sind bewusst offen: Aus einer Zukunftsidee folgt noch kein konkretes Releaseversprechen.

## Kanäle und Marke

### Website

Die öffentliche Website hat zwei Aufgaben: **Velvetia als Firma und Produkt glaubwürdig erklären** und eine klare Wahl zwischen sofortiger Web-App und den App-Downloads bieten. Geplante Inhalte: Nutzen in einem Satz, reale App-Ansichten und Schweizer Beispielrouten, Funktionsüberblick, Unternehmen/Über uns, Datenschutz und Datenquellen, Hilfe/Kontakt sowie später transparente Preise. Die Links zu iOS und Android erscheinen erst, wenn die Apps tatsächlich verfügbar sind; bis dahin kann die Web-App im Mittelpunkt stehen.

Die Domain und das Naming werden vor Store-Einträgen und Marketingkanälen vereinheitlicht: **Velvetia** ist der einzige Markenname. Für die technische Namensmigration siehe [Mobile-first-Konzept](MOBILE_FIRST_KONZEPT.md#einheitlicher-name).

### Instagram, TikTok und eventuell Facebook

Instagram und TikTok sind vorgesehene Markenkanäle, keine Produktersatzfunktionen. Mögliche Inhaltslinien: echte Touren und Kartenansichten, kurze Vorher-/Nachher-Beispiele der Routenbearbeitung, Velowissen zur Schweiz, Einblicke in Entwicklung und Tests. Beiträge sollen mit dem wirklichen Produkt übereinstimmen und keine ungeprüfte Sicherheit oder Echtzeit-Öffnung versprechen. Kanalname, Profilbild, Ton und Website-Link werden gemeinsam festgelegt. Facebook wird erst anhand tatsächlicher Zielgruppe und Wiederverwendbarkeit von Inhalten entschieden. Es werden jetzt keine Accounts erstellt und keine Werbung geschaltet.

## Bezahlbares Preismodell als Hypothese

Eine **grosszügige kostenlose Planung** soll Velvetia für Gelegenheitsfahrer nutzbar halten. Ein späterer kleiner Bezahlbereich kann zusätzliche, nachweislich kostenintensive oder besonders wertvolle Leistungen finanzieren, etwa erweiterte Offline-Funktionen, aufwendige Spezialanalysen oder Komfort für Vielnutzer. Welche Funktionen dazugehören, ist offen; essenzielle Warnungen, Datenherkunft und klare Einschränkungen dürfen nicht hinter einem Preis verschwinden.

Kein Preis und kein Abo-Modell wird jetzt festgelegt. Zuerst Betriebskosten je aktivem Nutzer, Zahlungsbereitschaft, Nutzen des kostenlosen Kerns und die Regeln der Stores prüfen. Digitale Freischaltungen und Abos in App-Store- beziehungsweise Play-Store-Apps unterliegen deren Zahlungsregeln und müssen in Web-/App-Architektur und Preisgestaltung eingeplant werden. Quellen: https://developer.apple.com/app-store/review/guidelines/ und https://support.google.com/googleplay/android-developer/answer/9858738.

Wenn Google als Login für eine iOS-App angeboten wird, muss die jeweils geltende Apple-Regel zu gleichwertigen Login-Optionen geprüft und eine passende Alternative eingeplant werden. Das heutige Web-Konzept für Google-Login allein ist noch kein iOS-Store-Konzept. Quelle: https://developer.apple.com/app-store/review/guidelines/ (Abschnitt 4.8).

## Reihenfolge ohne Ideenverlust

1. **Produktkern belegen:** Mobile UX, verständlicher erster Planungsfluss, tatsächliche Routingqualität, echte Geräte- und Nutzertests.
2. **Marke und Zugang ordnen:** Velvetia-Naming, Domain, öffentliche Website, Speicher-/Loginfluss, Android-Testinstallation.
3. **Plattformen ausbauen:** Android- und iOS-Produktarchitektur anhand der benötigten nativen Funktionen wählen; Store-Versionen mit eigener Qualitätssicherung entwickeln.
4. **Fachliche Tiefe ergänzen:** MTB/Downhill/Bikeparks, Versorgungsausbau, Wetter, Risikoanalyse, KI und Route Art jeweils mit eigenem Daten- und Qualitäts-Gate.
5. **Wachstum und Geschäft:** Instagram/TikTok mit echten Produktbeispielen starten; Facebook bei Bedarf; Preis erst nach Kosten- und Nutzertests.

Die Reihenfolge ist ein Arbeitsvorschlag, keine Festlegung, welche Idee am Ende wegfällt. Einzelne Stränge können parallel vorbereitet werden. Ein Feature wechselt erst mit klarer Begründung von „Idee“ zu „geplant“, „in Arbeit“, „verfügbar“ oder „bewusst verworfen“; letzterer Status verlangt eine ausdrücklich dokumentierte Produktentscheidung.

## Offene Richtungsentscheidungen

- Welche Leistungen müssen für alle kostenlos bleiben, damit Velvetia seinem Versprechen gerecht wird?
- Welche nativen Eigenschaften sind für die erste iOS-/Android-Veröffentlichung zwingend: Installation und flüssige Bedienung, Offline-Karten, Hintergrund-GPS oder Abbiegehinweise?
- Soll die Website zuerst persönlich und gründergeführt oder bereits als eigenständige Firmenmarke auftreten?
- Welche konkrete Zielgruppe und welcher Nutzen tragen später einen kleinen Bezahlbereich, ohne Gelegenheitsfahrer auszuschliessen?
