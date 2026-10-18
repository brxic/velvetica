# Fahrmodus: erste Ausbaustufe

## Bedienung

Eine berechnete Route oder einen GPX-Track öffnen, **Fahrmodus** wählen und den Standort erst im Vorbereitungsdialog freigeben. Simulierte Routingvorschauen haben keinen Fahrmodus. Live-Positionen bleiben im Arbeitsspeicher dieser Sitzung; Velvetia speichert oder überträgt keinen GPS-Track.

Die Karte folgt zunächst der Position auf Strassen-Zoomstufe. Manuelles Verschieben oder Zoomen löst die Verfolgung, **Zentrieren** aktiviert sie wieder. **Pausieren** beendet die laufende Standortabfrage. **Fahrmodus beenden** gibt Standortabfrage und Bildschirm-Wachhaltesperre frei und kehrt zum unveränderten Routenentwurf zurück. Ein Kontowechsel beendet den Fahrmodus ebenfalls.

Reststrecke basiert auf der Projektion auf die Routensegmente, nicht auf der nächsten Geometrie-Ecke. Der Restanstieg stammt aus dem vorhandenen Höhenprofil; ohne Höhendaten bleibt er unbekannt. Die Restzeit ist eine proportionale Schätzung aus der geplanten Routendauer, keine Live-Ankunftsprognose.

## Bewusste Grenzen

- Keine Abbiegehinweise, Sprachnavigation, automatische Neuberechnung, Tourenaufzeichnung oder Hintergrundnavigation.
- Standort nur über HTTPS oder localhost und nach Browserfreigabe.
- Positionen älter als 15 Sekunden, mit mehr als 80 m Genauigkeitsradius oder unplausiblen Sprüngen aktualisieren den Fortschritt nicht. Verspätete Meldungen werden ignoriert.
- Ein Routenabstand über dem grösseren Wert aus 40 m und dem doppelten Genauigkeitsradius erzeugt einen Hinweis. Der letzte Routenfortschritt bleibt erhalten, bis eine neue Zuordnung möglich ist.
- Rundtouren beginnen am gemeinsamen Start/Ziel bei null. Kontinuität verhindert Sprünge an Kreuzungen und auf wiederholt befahrenen Abschnitten; sie ersetzt keinen spezialisierten Navigationsrouter.
- Im Hintergrund wird die Standortabfrage beendet und beim Sichtbarwerden neu gestartet. Browser, Betriebssystem und Energiesparen können GPS zusätzlich aussetzen.
- **Bildschirm wach halten** ist optional und hängt von der Screen Wake Lock API ab. Der sichtbare Zustand meldet, ob die Sperre tatsächlich aktiv ist. Sie garantiert keine Hintergrundausführung.
- PWA-Updates werden während eines aktiven Fahrmodus zurückgehalten. Nach dem Beenden gelten weiterhin die bestehenden Schutzregeln für offene Entwürfe.

Technische Grundlagen: [Geolocation-Spezifikation](https://www.w3.org/TR/geolocation/) und [Screen Wake Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API).

## Prüfung vor öffentlicher Freigabe

Automatisiert: Segmentprojektion, Rundtour-Start/Ziel, Kreuzungen, Rückwärtsfahrt, Verlassen/Wiederfinden der Route, ungenaue/veraltete Positionen, Berechtigungsfehler, Aufräumen von GPS/Wake Lock und PWA-Updateschutz. Browserprüfungen verwenden ausschliesslich simulierte GPS-Daten.

Auf echten Zielgeräten noch manuell prüfen: Android Chrome/Brave und iOS Safari als Browser sowie installierte PWA; GPS-Freigabe und Widerruf, Energiesparmodus, Bildschirmsperre, App-Wechsel, Screen-Wake-Lock, längere Fahrt und Netzverlust. Diese Geräteprüfung ist nicht durch Browser-Simulationen ersetzt. Zum Bedienen anhalten.
