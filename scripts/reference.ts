// Gibt für jedes Szenario den Referenzwert aus (Lauf ohne Maßnahmen mit dem Seed
// des Levels), zum Eintragen in `Level.scoring.reference`: node scripts/reference.ts
import {Simulation} from "../src/simulation/Simulation.ts";
import {planWithoutMeasures} from "../src/game/Scenario.ts";
import {SCENARIOS} from "../src/game/scenarios.ts";

for (const {level} of SCENARIOS) {
    const simulation = new Simulation(level, planWithoutMeasures(level));

    while (!simulation.finished) {
        simulation.update(1 / 60);
    }

    const {elapsed, injured, crowdedSeconds} = simulation.stats;

    console.log(
        `${level.name}: reference: {duration: ${Math.round(elapsed)}, injured: ${injured}, ` +
        `crowdedSeconds: ${Math.round(crowdedSeconds)}}`,
    );
}
