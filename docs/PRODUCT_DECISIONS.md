# Produktentscheidungen

**Stand:** 15. August 2026

## Verbindlich für den lokalen Prototyp

1. Das Produkt heißt **Velvetia**.
2. Der Claim lautet **Plan less. Ride more.**
3. Die erste Abdeckung ist die Schweiz.
4. Ländergrenzen sind Konfiguration und Datenabdeckung, keine fest im Code verdrahtete Geschäftslogik.
5. Spätere Ausbaustufen können einzelne weitere Länder, Europa oder weltweite Regionen aktivieren.
6. Unterstützte Profile sind Rennrad, Gravel, Freizeit/Touring und Alltag/City.
7. Mountainbike ist bis auf Weiteres ausgeschlossen.
8. Eine Planung liefert genau einen Routenvorschlag.
9. Der Nutzer kann diesen Vorschlag anschließend auf der Karte bearbeiten.
10. Hauptsprache ist Deutsch; Englisch wird als zweite Sprache strukturell vorbereitet.
11. Alle vier vorhandenen Logos werden ohne grafische Veränderung verwendet.
12. Foundry Context Medium und Bold werden aus `fonts/` eingebunden; die mitgelieferte Attribution wird sichtbar ausgegeben.
13. Die erste Version läuft vollständig lokal. Domain, produktives Hosting und Bezahlmodell sind nicht Teil des aktuellen Schritts.
14. Der Stil ist modern, simpel und leicht verständlich.
15. Die Karte ist der primäre Arbeitsbereich.
16. Kontextuelle Pop-ups beziehungsweise eine freiwillige „How to use“-Tour erklären die wichtigsten Interaktionen.
17. Gespeicherte Routen des Nutzers erscheinen als ein-/ausblendbare Ebene auf der Planungskarte.

## Architekturfolgen

- Eine `RegionProvider`-/`CoverageRegion`-Abstraktion kapselt Bounding-Geometrie, Sprache, Zeitzone, Projektion, Datenquellen, Routinggraph und rechtliche Attribution.
- Fahrradprofile sind versionierte Konfigurationen und keine Bedingungen in UI-Komponenten.
- Texte werden ab dem ersten Commit über Übersetzungsschlüssel geführt; `de` ist Standard und `en` Fallback.
- Die API bleibt unabhängig von Kartenstil und Tile-Anbieter.
- Routengenerierung und Routeneditor sind getrennte Anwendungsfälle.
- Gespeicherte Routen werden räumlich über PostGIS-Bounding-Box-Abfragen für den sichtbaren Kartenausschnitt geladen.

## Später zu entscheiden

- Benutzerkonten bereits im ersten lokalen Prototyp oder erst nach Routingnachweis
- genaue Rundtour-Distanztoleranz
- Karten-/Tile-Stack für Produktion
- Hosting- und Datenresidenzmodell
- öffentlich teilbare Routen
- Preismodell
- Analytics und Einwilligungsmodell

