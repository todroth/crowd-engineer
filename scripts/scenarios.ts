// Rechnet Szenarien headless durch: node scripts/scenarios.ts [Szenario-Nummer]
// Je Szenario der Standardplan und, falls es Startblöcke gibt, gestaffelte
// Pläne (hinten zuletzt). Zeigt Dauer und Verletzte für drei Seeds.
import {Simulation} from "../src/simulation/Simulation.ts";
import type {Plan} from "../src/simulation/Plan.ts";
import {calculateCost} from "../src/simulation/scoring.ts";
import {SCENARIOS} from "../src/game/scenarios.ts";

const only = process.argv[2] === undefined ? undefined : Number(process.argv[2]) - 1;

SCENARIOS.forEach(({level, plan}, index) => {
    if (only !== undefined && only !== index) {
        return;
    }

    console.log(`\n${index + 1} ${level.name} (${level.agentCount} Agenten)`);

    const plans: [string, Plan][] = [["Standardplan", plan]];
    const blocks = level.sectors.length;

    if (blocks > 0) {
        for (const step of [5, 10, 20, 40]) {
            plans.push([
                `gestaffelt, ${step} s je Block`,
                {...plan, releaseDelays: level.sectors.map((_, i) => (blocks - 1 - i) * step)},
            ]);
        }
    }

    for (const [name, candidate] of plans) {
        const rows: string[] = [];

        for (const seed of [1, 2, 3]) {
            const simulation = new Simulation({...level, seed}, candidate);

            while (!simulation.finished) {
                simulation.update(1 / 60);
            }

            const stats = simulation.stats;
            rows.push(
                `${stats.elapsed.toFixed(0).padStart(3)} s / ${String(stats.injured).padStart(3)} Verl. ` +
                `/ ${stats.peakDensity.toFixed(1)} P/m² / Kosten ${calculateCost(stats, level.scoring).toFixed(0).padStart(3)}`,
            );
        }

        console.log(`  ${name.padEnd(28)} ${rows.join("  |  ")}`);
    }
});
