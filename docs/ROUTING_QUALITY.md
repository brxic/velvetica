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

Beim Ziehen oder Antippen der roten Route entsteht ein sichtbarer `shaping`-Punkt an der passenden Position zwischen den bestehenden Ankern. Valhalla berechnet die angrenzenden Verbindungen neu; Name, Beschreibung und Identität der Route bleiben erhalten. Shaping-Punkte können verschoben, gelöscht sowie über Undo und Redo wiederhergestellt werden.

## Aktuelle Grenzwerte

- Distanzabweichung: höchstens 18 % für einen regulären Kandidaten
- wiederholte Kanten: höchstens 16 %
- radiale Überschreitung: höchstens 12 % über dem distanzabhängigen Korridor

Wenn kein Kandidat alle Grenzen erfüllt, wird der Kandidat mit dem besten Gesamtscore geliefert und transparent mit einem Qualitätshinweis versehen.
