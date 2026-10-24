// Arbeitet Läufe für den Pool ab (siehe pool.ts). Läuft in einem Worker-Thread.
import {parentPort} from "node:worker_threads";
import {Simulation} from "../../src/simulation/Simulation.ts";
import {calculateCost} from "../../src/simulation/scoring.ts";
import {SCENARIOS} from "../../src/game/scenarios.ts";
import type {Job, JobResult} from "./pool.ts";

parentPort!.on("message", (job: Job) => {
    const {level} = SCENARIOS[job.scenario];
    const simulation = new Simulation({...level, seed: job.seed}, job.plan);

    while (!simulation.finished) {
        simulation.update(1 / 60);
    }

    const stats = simulation.stats;
    const result: JobResult = {stats, cost: calculateCost(stats, level.scoring)};

    parentPort!.postMessage(result);
});
