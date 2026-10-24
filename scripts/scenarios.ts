// Rechnet Szenarien headless und parallel durch:
//   node scripts/scenarios.ts [Szenario-Nummer] [--seeds=N]
// Je Szenario alle Pläne wie im Spiel (Nummer = URL-Parameter `plan`) und, falls es
// Startblöcke gibt, gestaffelte Pläne (hinten zuletzt). Zeigt Dauer, Verletzte,
// Gedränge und Kosten je Seed (Standard: 3 Seeds, `--seeds=1` geht am schnellsten).
import type {Plan} from "../src/simulation/Plan.ts";
import {scenarioPlans} from "../src/game/Scenario.ts";
import {SCENARIOS} from "../src/game/scenarios.ts";
import {type Job, runJobs} from "./lib/pool.ts";

const args = process.argv.slice(2);
const seedCount = Number(args.find((arg) => arg.startsWith("--seeds="))?.slice(8) ?? 3);
const onlyArg = args.find((arg) => !arg.startsWith("--"));
const only = onlyArg === undefined ? undefined : Number(onlyArg) - 1;
const seeds = Array.from({length: seedCount}, (_, i) => i + 1);

interface Row {
    readonly scenario: number;
    readonly name: string;
    readonly jobs: readonly Job[];
}

const rows: Row[] = [];

SCENARIOS.forEach((entry, scenario) => {
    const {level, plan} = entry;

    if (only !== undefined && only !== scenario) {
        return;
    }

    const plans: [string, Plan][] = scenarioPlans(entry).map(
        ({name, plan: candidate}, index): [string, Plan] => [`${index} ${name}`, candidate],
    );
    const blocks = level.sectors.length;

    for (const step of blocks > 0 ? [5, 10, 20, 40] : []) {
        plans.push([
            `gestaffelt, ${step} s je Block`,
            {...plan, releaseDelays: level.sectors.map((_, i) => (blocks - 1 - i) * step)},
        ]);
    }

    for (const [name, candidate] of plans) {
        rows.push({
            scenario,
            name,
            jobs: seeds.map((seed) => ({scenario, plan: candidate, seed})),
        });
    }
});

const started = performance.now();
const results = await runJobs(rows.flatMap((row) => row.jobs));
let cursor = 0;
let lastScenario = -1;

for (const row of rows) {
    if (row.scenario !== lastScenario) {
        const {level} = SCENARIOS[row.scenario];

        console.log(`\n${row.scenario + 1} ${level.name} (${level.agentCount} Agenten)`);
        lastScenario = row.scenario;
    }

    const cells = row.jobs.map(() => {
        const {stats, cost} = results[cursor++];

        return (
            `${stats.elapsed.toFixed(0).padStart(3)} s / ${String(stats.injured).padStart(3)} Verl. ` +
            `/ Gedr. ${(stats.crowdedSeconds / 60).toFixed(0).padStart(4)} P-Min / Kosten ${cost.total.toFixed(0).padStart(4)}`
        );
    });

    console.log(`  ${row.name.padEnd(44)} ${cells.join("  |  ")}`);
}

console.log(`\n${results.length} Läufe in ${((performance.now() - started) / 1000).toFixed(0)} s`);
