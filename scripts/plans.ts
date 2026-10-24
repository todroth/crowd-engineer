// Rechnet mehrere Pläne für das Standardlevel durch: node scripts/plans.ts
// Zeigt Dauer und Verletzte je Plan, um zu prüfen, ob die Hebel einen
// Zielkonflikt erzeugen (und wo die Levelparameter richtig stehen).
import {Simulation} from "../src/simulation/Simulation.ts";
import type {Plan} from "../src/simulation/Plan.ts";
import {DEFAULT_LEVEL} from "../src/game/defaultLevel.ts";

const plans: readonly [string, Plan][] = [
    ["alle gleichzeitig", {releaseDelays: [0, 0, 0]}],
    ["leicht gestaffelt", {releaseDelays: [10, 5, 0]}],
    ["gestaffelt", {releaseDelays: [20, 10, 0]}],
    ["stark gestaffelt", {releaseDelays: [40, 20, 0]}],
    ["sehr stark gestaffelt", {releaseDelays: [80, 40, 0]}],
    ["falsche Reihenfolge", {releaseDelays: [0, 10, 20]}],
];

for (const [name, plan] of plans) {
    const rows: string[] = [];

    for (const seed of [1, 2, 3]) {
        const simulation = new Simulation({...DEFAULT_LEVEL, seed}, plan);

        while (!simulation.finished) {
            simulation.update(1 / 60);
        }

        const {elapsed, injured} = simulation.stats;
        rows.push(`${elapsed.toFixed(0).padStart(3)} s / ${String(injured).padStart(3)} Verl.`);
    }

    console.log(`${name.padEnd(22)} ${rows.join("   |   ")}`);
}
