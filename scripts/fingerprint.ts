// Exakte Ergebnisse aller Pläne aller Szenarien (Seed des Levels), ungerundet:
//   node scripts/fingerprint.ts > /tmp/before.txt
// Für Refactorings: Vorher und nachher ausführen und vergleichen (diff). Ist die
// Ausgabe identisch, hat sich das Verhalten der Simulation nicht geändert.
import {SCENARIOS} from "../src/game/scenarios.ts";
import {scenarioPlans} from "../src/game/Scenario.ts";
import {runJobs} from "./lib/pool.ts";

const rows = SCENARIOS.flatMap((scenario, index) =>
    scenarioPlans(scenario).map(({name, plan}, planIndex) => ({
        label: `${index + 1}.${planIndex} ${scenario.level.name} / ${name}`,
        job: {scenario: index, plan, seed: scenario.level.seed},
    })),
);

const results = await runJobs(rows.map((row) => row.job));

rows.forEach(({label}, index) => {
    const {elapsed, arrived, injured, crowdedSeconds, peakDensity} = results[index].stats;

    console.log(
        `${label}: elapsed=${elapsed} arrived=${arrived} injured=${injured} ` +
        `crowdedSeconds=${crowdedSeconds} peakDensity=${peakDensity}`,
    );
});
