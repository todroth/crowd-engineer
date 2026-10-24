// Headless-Messung der Simulation im Dauerbetrieb: node scripts/benchmark.ts [Sekunden] [Szenario-Nummer]
import {Simulation} from "../src/simulation/Simulation.ts";
import {SCENARIOS} from "../src/game/scenarios.ts";
import {createColliders} from "../src/simulation/geometry/Collider.ts";
import {pointClearance} from "../src/simulation/geometry/clearance.ts";

const seconds = Number(process.argv[2] ?? 60);
const scenario = SCENARIOS[Number(process.argv[3] ?? 1) - 1];
const step = 1 / 60;

const simulation = new Simulation(
    {...scenario.level, respawn: true, entryArea: scenario.level.spawnArea},
    scenario.plan,
);
const colliders = createColliders(scenario.level.obstacles);
const agents = simulation.agents;

function report(time: number, arrivedSinceLast: number): void {
    let speedSum = 0;
    let slow = 0;
    let insideObstacle = 0;
    let overlaps = 0;

    for (const agent of agents) {
        const speed = Math.hypot(agent.velocity.x, agent.velocity.y);
        speedSum += speed;
        slow += speed < 8 ? 1 : 0;

        if (pointClearance(agent.position, colliders) < agent.radius - 0.05) {
            insideObstacle++;
        }
    }

    for (let i = 0; i < agents.length; i++) {
        for (let j = i + 1; j < agents.length; j++) {
            const distance = Math.hypot(
                agents[i].position.x - agents[j].position.x,
                agents[i].position.y - agents[j].position.y,
            );

            if (distance < agents[i].radius + agents[j].radius - 1) {
                overlaps++;
            }
        }
    }

    console.log(
        `t=${String(time).padStart(3)}s  avgSpeed=${(speedSum / agents.length).toFixed(1).padStart(5)}` +
        `  slow=${String(slow).padStart(4)}` +
        `  overlaps=${String(overlaps).padStart(4)}  inObstacle=${insideObstacle}` +
        `  arrived/10s=${arrivedSinceLast}`,
    );
}

const started = performance.now();
let lastArrived = 0;

for (let frame = 1; frame <= seconds * 60; frame++) {
    simulation.update(step);

    if (frame % 600 === 0) {
        report(frame / 60, simulation.arrivedCount - lastArrived);
        lastArrived = simulation.arrivedCount;
    }
}

const elapsed = performance.now() - started;
console.log(`${(elapsed / (seconds * 60)).toFixed(2)} ms pro Schritt (${agents.length} Agenten)`);
