# Crowd Engineer

Eine Simulation zur Evakuierung von Menschenmengen in TypeScript und Phaser 4. Daraus soll ein Spiel werden: Der Spieler lenkt eine große Menge (sie verhält sich ein Stück weit wie Wasser) mit Maßnahmen wie Schildern so, dass sie schnell und mit möglichst wenig Verletzten herauskommt. Ziel ist Min-Maxing, nicht „niemand darf verletzt werden“. Panik-Szenarien sind der Kern, ruhige Räumungen dienen als Gegenbeispiel.

Der Schwerpunkt liegt auf glaubwürdiger Dynamik der Menge, Performance (Ziel: etwa 10.000 Agenten) und Wegfindung, nicht auf Optik.

## Befehle

```sh
npm run dev          # Spiel unter http://localhost:5173
npm run build        # Typprüfung (src + scripts) und Vite-Build; muss vor jedem Commit durchlaufen
npm run typecheck    # nur die Typprüfung
npm run scenarios    # alle Szenarien × Pläne × 3 Seeds parallel, etwa 4 min (-- 2 --seeds=1: nur Szenario 2, 1 Seed)
npm run reference    # Referenzwerte (Lauf ohne Maßnahmen) für Level.scoring.reference, etwa 25 s
npm run fingerprint  # ungerundete Ergebnisse aller Pläne, etwa 50 s; für Refactorings, siehe unten
npm run bench        # ms pro Simulationsschritt (Dauerbetrieb mit Respawn)
```

Die Skripte laufen direkt mit Node 24 (`node scripts/x.ts`, Type-Stripping, kein Build). `scripts/lib/pool.ts` verteilt die Läufe auf alle Kerne (Worker-Threads).

Es gibt keine Unit-Tests. Abgesichert wird über:

- **Determinismus:** Gleicher Seed, gleiches Ergebnis, bis aufs Bit. Ein reines Refactoring muss `npm run fingerprint` unverändert lassen:
  `npm run fingerprint > /tmp/before.txt`, ändern, dann erneut ausführen und mit `diff` vergleichen.
- **Verhalten:** Bei bewusst geänderter Simulation `npm run scenarios` laufen lassen und die Zahlen bewerten, danach `npm run reference` ausführen und die Werte in `scoring.reference` der Level eintragen.
- **Browser:** `scripts/browser.ts` steuert Chrome über das DevTools-Protokoll, in Echtzeit, mit Tasten, Klicks und Screenshots. Der Dev-Server muss dafür laufen:
  ```sh
  npx vite --port 5199 &
  node scripts/browser.ts "http://localhost:5199/?scenario=2" shot:plan click:250:560 enter s s wait:30000 shot:end
  ```
  Die Bilder landen unter `/tmp/crowd-NAME.png`. Klick-Koordinaten sind Bildschirmpixel; die Welt beginnt 34 px unter dem oberen Rand. Chromes eigener Screenshot-Modus (`--screenshot` mit `--virtual-time-budget`) taugt nicht: Phaser rechnet darin nur die ersten Bilder, und ein Lauf bleibt bei etwa 0,1 s stehen.

## Aufbau

```
src/
  main.ts                Phaser-Spiel (1000×700, eine Szene)
  simulation/            reine Simulation: kein Phaser, kein DOM, läuft auch headless
    Simulation.ts        Schrittschleife und Steering; Einstieg zum Verstehen
    Level.ts, Plan.ts    Welt (Level) und Maßnahmen des Spielers (Plan)
    SimulationConfig.ts  alle Verhaltensparameter, dokumentiert
    Agent.ts, AgentSpawner.ts, RunStats.ts, scoring.ts, Sign.ts, Obstacle.ts, random.ts
    geometry/            Collider (alle Hindernisse als Kapseln), Abstände, Sichtlinien
    collision/           Bewegung mit Gleiten an Hindernissen (Sweep)
    crowd/               Nachbarschaft, Dichte, Druck, Panik, Verletzung, Kontakte, Fundamentaldiagramm
    navigation/          Fast Marching → FlowField; Wayfinder (Wegwahl, Schilder); createWayfinder
    spatial/             SpatialGrid für Nachbarschaftssuchen
  game/
    CrowdScene.ts        Phaser-Szene: Phasen Planung → Lauf → Ergebnis, Eingabe, Leisten
    PlanEditor.ts        Schilder, Ordner, Gitter platzieren, auswählen, ziehen, entfernen, mit Vorrat (ohne Phaser)
    bestScores.ts        Bestwerte je Szenario in localStorage
    Scenario.ts          Szenario = Level + Startplan + Beispielpläne + Schilderbudget; scenarioPlans()
    scenarios.ts         Liste aller Szenarien (Tasten 1–4)
    levels/              die Level; behavior.ts (PANIC_BEHAVIOR, CALM_BEHAVIOR), shapes.ts (wall, circle, …)
    view/                Zeichnen: Level, Ausgänge, Wegmarken, Schilder, Personen (Sprites), Ergebnis,
                         Farben (theme.ts), Bildaufteilung (layout.ts), Texturen
scripts/                 headless Auswertung (siehe Befehle)
```

### Spielablauf

1. **Planung:** Die Simulation ist gebaut, aber sie steht. Die Menge ist am Start zu sehen, die Eingänge der Wege sind mit A, B, C markiert. Das Werkzeug (Taste 1–3 oder Seitenleiste) bestimmt, was ein Klick ins Freie tut: ein Schild oder Ordner wird aufgestellt und zeigt zunächst auf den nächstgelegenen Weg (Vorschau folgt dem Zeiger); ein Gitter wird mit gedrückter Maustaste aufgezogen. Ein Klick auf ein Element wählt es aus (Weg A/B/C per Knopf), Ziehen verschiebt es (bei Gittern die Enden einzeln oder das ganze), Rechtsklick oder Entf entfernt es. Vorlagen laden fertige Pläne. Nach jeder fertigen Änderung wird die Simulation neu gebaut (etwa 20 ms).
2. **Lauf:** ENTER startet. S ändert das Tempo, F zeigt das Flow-Field.
3. **Ergebnis:** Eine Tafel zeigt die Kosten gegen den Vergleichswert und den Bestwert (`bestScores.ts`). Die Leertaste führt zurück zur Planung mit demselben Plan.

Die Tasten 1–4 wechseln das Szenario (Neustart der Szene). URL: `?scenario=2&plan=1&run`, wobei `run` die Planung überspringt.

Die Statusleiste oben und die Infoleiste unten liegen außerhalb der Welt (`view/layout.ts`). Die Kamera ist um die Höhe der Statusleiste verschoben. Leisten haben `setScrollFactor(0)`.

### Ein Simulationsschritt

Fester Zeitschritt von 1/60 s (höchstens 5 Schritte pro Frame). In jedem Schritt:

1. **Steering** je laufendem Agent: Nachbarn messen (`sampleNeighbors`), Dichte inklusive Wandverstärkung, Verletzung, Panik, Wegwahl (`Wayfinder`), Richtung aus dem Flow-Field, Tempo (Panik-Boost, Fundamentaldiagramm), Abstoßung und Angleichung, Druck und Beweglichkeit, begrenzte Beschleunigung. Alle neuen Geschwindigkeiten werden erst gesammelt und dann angewendet, damit die Reihenfolge der Agenten keine Rolle spielt.
2. **Bewegung** mit `moveWithCollisions` (Agenten gleiten an Hindernissen entlang und dringen nie ein).
3. **Verletzte:** Nach `rescueTime` werden sie abtransportiert (`arrived && rescued`, bleiben blass sichtbar). Liegende Verletzte werden als Hindernisse in die Flow-Fields eingetragen.
4. **Harte Kontakte** zwischen Agenten (`resolveAgentContacts`). Dadurch haben Engstellen eine echte Kapazität. Verletzte sind schwer (`injuredWeight`).
5. **Ankunft** in einem `goalArea` und **Ende** (alle angekommen oder verletzt, oder `timeLimit`).

### Wegwahl

Jedes `Level.routes[i]` ist ein Eingangsbereich. Je Weg gibt es ein Flow-Field zum Eingang (`toEntrance`) und eines danach (`afterEntrance`). Ein Weg mit `exit` führt zu einem Ausgang, den die Menge nicht kennt. Dieser fehlt im Hauptfeld und wird nur über Sicht oder Schilder entdeckt. Der Wayfinder bewertet die sichtbaren oder per Schild bekannten Wege nach Länge, gesehenem Gedränge, Schildern, Panik und Hysterese. Wer den Eingang passiert hat, legt sich fest (`committed`).

### Maßnahmen des Spielers (`Plan`)

- **Schild** (`Sign`): macht einen Weg bekannt und senkt dessen Kosten leicht (`signInfluence`); Panik lässt es untergehen. Gesehene Schilder werden 30 s gemerkt (`Agent.signMemory`).
- **Ordner** (`Marshal`, Reichweite `MarshalConfig.range`, mit Sichtlinie): beruhigt (bremst den Panikanstieg, baut Panik ab, `Simulation.marshalCalming`) und weist einen Weg (`guidance`, von Panik **nicht** abgeschwächt, gemerkt in `Agent.marshalMemory`). Er ist **kein Hindernis**: Ein Körper mitten im Strom ließ in Tests die Menge vor dem Ausgang verstopfen.
- **Absperrgitter** (`Barrier`, Vorrat in Metern): eine Strecke, die `planObstacles` als Wand zu den Hindernissen des Levels hinzufügt. Kollision, Sicht und Flow-Fields brauchen keinen eigenen Code. Der Plan wird beim Ändern neu gebaut. `Simulation.unreachableCount()` zählt Agenten, die keinen Ausgang mehr erreichen; dann ist der Start gesperrt. Gitter sind riskant: Ein halb zugestellter Mitteltunnel in der Halle spart etwa 20 %, ein Trichter vor der Tür verstopft alles.
- Ein leerer Plan verändert nichts: Läufe ohne Maßnahmen bleiben bit-identisch (`npm run fingerprint`).
- Der Vorrat je Level steht in `Scenario.inventory`; `PlanEditor` setzt ihn durch.

### Einheiten

- Positionen in Pixeln, 16 px = 1 m (`Level.pixelsPerMeter`). Agentenradius 4 px.
- Tempo in Pixel/s: Rennen 40–60, Gehen 22–32 (`levels/behavior.ts`).
- **Zwei Dichte-Einheiten** (siehe `crowd/density.ts`):
  - Kernel-Dichte (`Agent.localDensity`, gewichtete Nachbarzahl): Panik-Schwellen, Farbskala.
  - Personen/m² (Kernel-Dichte × `personsPerSquareMeterFactor`, ≈ 0,39): Verletzung, Fundamentaldiagramm, Wertung.

### Wertung

Kosten = Dauer + `injuryPenalty` × (Verletzte + nicht Herausgekommene) + `crowdingPenalty` × Personensekunden über `crowdingThreshold`. Das Ergebnis wird mit `scoring.reference` verglichen, dem Lauf ohne Maßnahmen (`planWithoutMeasures`). Wer die Simulation oder ein Level ändert, muss die Referenz neu eintragen (`npm run reference`).

## Konventionen

- **Sprache:** Kommentare, Bezeichnungen im UI und Level-Texte sind deutsch, Bezeichner englisch. Commit-Nachrichten sind englisch, im Imperativ und kurz („Add …“, „Fix …“).
- **Kommentare** erklären das Warum und das Modell, nicht den Code. Jede Konstante hat einen Doc-Kommentar mit Einheit.
- **Kein Allokieren im Schritt:** Puffer werden wiederverwendet, `out`-Parameter statt neuer Objekte, wo es heiß ist.
- **Determinismus:** Zufall nur über das `Random` der Simulation (`random.ts`, gesät mit `Level.seed`). Kein `Math.random`, keine Zeit, keine Iteration über unsortierte Strukturen mit wechselnder Reihenfolge. Die Reihenfolge der Zufallsziehungen gehört zum Ergebnis: Erst werden die Agenten erzeugt, dann kommt die Wegwahl.
- **Persönliche Eigenschaften** ohne Zustand über `personal(agentId, trait)` im Wayfinder.
- **Simulation bleibt frei von Phaser und DOM.** `scripts/tsconfig.json` prüft sie ohne die DOM-Bibliothek.
- TypeScript ist streng mit `erasableSyntaxOnly`: keine Enums, keine Parameter-Properties, keine Namespaces. Importe tragen die Endung `.ts`, Typen werden mit `import type` importiert.
- Neue Level: Datei in `game/levels/`, Verhalten aus `behavior.ts`, Formen aus `shapes.ts`, in `scenarios.ts` eintragen, dann `npm run reference` und die Referenz eintragen.
- `.mcp.json` gehört dem Nutzer und wird nicht committet.

## Stand und offene Punkte

- „Faster is slower“ wird nicht wirklich reproduziert. Die Druckkopplung ist absichtlich mild, weil eine starke Kopplung die Schlange komplett blockiert.
- Schilder informieren mehr, als dass sie befehlen (`signInfluence` 0,1). Ein großer Bonus ließ die ganze Menge auf den beschilderten Weg kippen. Startpläne sparen 10–27 % in den Panik-Szenarien und 7–10 % in den ruhigen. Gestaffeltes Starten wirkt in den ruhigen Szenarien stärker, ist im Spiel aber noch nicht einstellbar.
- Wartende Agenten (`releaseTime` noch nicht erreicht) werden nicht gesteuert. Ihre Dichte und Verletzung werden in dieser Zeit nicht berechnet.
- Ordner: Der große Effekt im Nachtclub (ein Ordner oben am Rand, Kosten 258 → 170) kommt von der Beruhigung, nicht von der Weisung (mit `guidance` 0 fast identisch): Ruhigere Leute rennen langsamer und kommen gestaffelt an der Tür an. In der Halle hilft dagegen die Weisung. Die Planung zeigt die Menge in Grün, weil die Dichte vor dem ersten Schritt nicht gemessen ist.
- Als Nächstes geplant: Wärmekarte des letzten Laufs, Staffelung der Startblöcke in der Planung (`releaseDelays` gibt es schon), Levelauswahl mit Medaillen. Später: Rettungskräfte, Bau-Modus mit Budget, Eingriffe live, Skalierung auf 10.000 Agenten (Rendering, Datenlayout).
