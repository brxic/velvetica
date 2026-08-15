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
- lokaler Betrieb ohne Domain oder produktive Cloud-Abhängigkeit
- Fokus auf Karte, einfacher Bedienung und optionalen „How to use“-Hinweisen
- gespeicherte eigene Routen werden direkt auf der Karte sichtbar

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

