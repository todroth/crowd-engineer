// Rechnet unabhängige Simulationsläufe parallel auf allen Kernen (Worker-Threads).
import {availableParallelism} from "node:os";
import {Worker} from "node:worker_threads";
import type {Plan} from "../../src/simulation/Plan.ts";
import type {RunStats} from "../../src/simulation/Simulation.ts";
import type {CostBreakdown} from "../../src/simulation/scoring.ts";

export interface Job {
    /** Index in `SCENARIOS`. */
    readonly scenario: number;
    readonly plan: Plan;
    readonly seed: number;
}

export interface JobResult {
    readonly stats: RunStats;
    readonly cost: CostBreakdown;
}

/** Führt alle Läufe aus; die Ergebnisse stehen in derselben Reihenfolge wie die Aufträge. */
export function runJobs(jobs: readonly Job[]): Promise<JobResult[]> {
    const results = new Array<JobResult>(jobs.length);
    const workerCount = Math.min(availableParallelism(), jobs.length);

    return new Promise((resolve, reject) => {
        let next = 0;
        let finished = 0;

        if (jobs.length === 0) {
            resolve(results);
            return;
        }

        const start = (worker: Worker): void => {
            if (next >= jobs.length) {
                void worker.terminate();
                return;
            }

            const index = next++;

            worker.once("message", (result: JobResult) => {
                results[index] = result;
                finished++;

                if (finished === jobs.length) {
                    resolve(results);
                }

                start(worker);
            });
            worker.postMessage(jobs[index]);
        };

        for (let i = 0; i < workerCount; i++) {
            const worker = new Worker(new URL("./worker.ts", import.meta.url));

            worker.once("error", reject);
            start(worker);
        }
    });
}
