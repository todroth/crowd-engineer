// Gibt für jedes Szenario den Referenzwert aus (Lauf ohne Maßnahmen mit dem Seed
// des Levels), zum Eintragen in `Level.scoring.reference`: node scripts/reference.ts
import {planWithoutMeasures} from "../src/game/Scenario.ts";
import {SCENARIOS} from "../src/game/scenarios.ts";
import {runJobs} from "./lib/pool.ts";

const results = await runJobs(
    SCENARIOS.map(({level}, scenario) => ({
        scenario,
        plan: planWithoutMeasures(level),
        seed: level.seed,
    })),
);

SCENARIOS.forEach(({level}, index) => {
    const {elapsed, injured, crowdedSeconds} = results[index].stats;

    console.log(
        `${level.name}: reference: {duration: ${Math.round(elapsed)}, injured: ${injured}, ` +
        `crowdedSeconds: ${Math.round(crowdedSeconds)}}`,
    );
});
