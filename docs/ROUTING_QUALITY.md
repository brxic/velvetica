# Routenqualität und Bearbeitung

## Automatische Rundtouren

Velvetia erzeugt für eine Rundtour ohne manuelle Zwischenpunkte mehrere deterministische Dreiecksanker in verschiedenen Fahrtrichtungen. Jeder Ankersatz wird vom lokalen Valhalla gegen das reale Schweizer OSM-Wegenetz geroutet.

Die Kandidaten werden anschliessend nach folgenden messbaren Kriterien bewertet:

- relative Abweichung von der gewünschten Distanz
- mehrfach befahrene beziehungsweise zurückverfolgte Kanten
- unplausibel grosse radiale Entfernung vom Startpunkt

Ein Kandidat gilt nur innerhalb definierter Grenzwerte als regulär. Ist der erste Durchlauf unzureichend, kalibriert Velvetia den Ankerabstand anhand der tatsächlich erreichten Distanz und probiert mehrere kleinere und grössere Radien. Schlechte Geometrien werden nicht nachträglich abgeschnitten, weil dadurch Verbindungen abseits des Wegenetzes entstehen könnten.

Gleiche Eingaben und derselbe Valhalla-Graph ergeben dieselben Kandidaten und dieselbe Auswahl. Bewusst gesetzte Via- oder Shaping-Punkte werden niemals vom Cleanup entfernt.

## Editierbare Routen

Die ausgewählten automatischen Anker werden als unsichtbare `generated`-Wegpunkte in der Route gespeichert. Dadurch bleibt die ursprüngliche Runde beim späteren Bearbeiten erhalten. Bereits lokal gespeicherte Routen aus älteren Versionen erhalten beim Öffnen kompatible Anker aus ihrem vorhandenen Verlauf.

Beim Ziehen oder Antippen der Routenlinie entsteht ein sichtbarer `shaping`-Punkt zwischen den bestehenden Ankern. Valhalla berechnet die angrenzenden Verbindungen neu; Name, Beschreibung und Identität der Route bleiben erhalten. Shaping-Punkte können verschoben, gelöscht sowie über Undo und Redo wiederhergestellt werden.

## Aktuelle Grenzwerte

- Distanzabweichung: höchstens 18 % für einen regulären Kandidaten
- wiederholte Kanten: höchstens 16 %
- radiale Überschreitung: höchstens 12 % über dem distanzabhängigen Korridor

Reguläre Kandidaten haben Vorrang vor nicht regulären Kandidaten, auch wenn ein einzelner Gesamtscore niedriger wäre. Ein mässig abweichender Vorschlag erhält einen Qualitätshinweis. Beide Adapter lehnen extreme Ausreisser ab: mehr als 45 % zurückverfolgte Strecke, mehr als 50 % radiale Überschreitung oder mehr als 55 % Distanzabweichung.

Die Wiederholungserkennung vergleicht räumliche Abtastpunkte und Fahrtrichtung, nicht nur identische Segment-Endpunkte. Unterschiedliche Punktdichten auf Hin- und Rückweg werden damit erkannt. Ein lokaler Abstandspuffer verhindert, dass benachbarte Punkte als Wiederholung gelten; räumlich getrennte Parallelstrassen und einzelne Kreuzungen werden nicht pauschal als doppelt gefahren gewertet. Die Abtastung ist begrenzt, damit problematische Geometrien nicht unbegrenzt Speicher belegen.

Nach der Auswahl prüfen beide Adapter für Rundtouren und One-Way Geometriegrenzen, Start/Ziel-Abstand, plausible Längenverhältnisse und auffällige Lücken in dichten Geometrien. Fehlerhafte Ergebnisse werden abgelehnt, nicht durch Luftlinien ergänzt. Ein fehlgeschlagener Verfeinerungsversuch bei FOSSGIS verwirft einen bereits vollständigen Kandidaten nicht.

Neue Routen führen einen optionalen `surfaceAnalyzed`-Status. Eine ausgefallene Belagsanalyse ist damit von tatsächlich analysierten 0 % Asphalt unterscheidbar. GPX-Tracks ohne Höhenwerte markieren auch die Höhendaten als nicht verfügbar. Die optionalen Felder sind mit bestehenden gespeicherten Routen kompatibel; eine Datenbankmigration ist nicht erforderlich.

## Schweizer Referenzfälle

Die zwölf festen Fälle in `test-fixtures/routing-reference-cases.json` decken Basel, Aargau, Jura, Bern, Zürich, Alpen, Tessin und Genf ab. Unit-Tests verwenden bewusst synthetische Geometrien und prüfen keine reale Strasseneignung. Zusätzlich gibt es Regressionen für unterschiedlich abgetastete Rückwege, Parallelstrassen, ungültige Koordinaten, offene Runden und Geometriesprünge.

Für einen laufenden lokalen Entwicklungsserver mit echtem Routingprovider:

```powershell
npm run test:routing:live -- --case=basel-rhein
# Standardmässig vier regionale Fälle; alle zwölf ausdrücklich mit --all.
npm run test:routing:live -- --all
```

Der Prüfaufruf akzeptiert nur Loopback-Server. Ein abweichender lokaler Port lässt sich über `ROUTING_QA_URL` setzen. Simulierte Vorschauen gelten nicht als erfolgreiche Prüfung. Für den gemeinsam genutzten öffentlichen FOSSGIS-Dienst ist `--public` ausdrücklich nötig; für wiederholte Korpustests den eigenen Valhalla-Dienst verwenden. Auch eine technisch gültige Geometrie belegt weder aktuelle Befahrbarkeit noch legales Radfahren. Die resultierenden Verläufe im Gelände- und Strassenkontext manuell beurteilen.
