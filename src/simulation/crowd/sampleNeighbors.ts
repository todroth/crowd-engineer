import type {Agent} from "../Agent.ts";
import type {SimulationConfig} from "../SimulationConfig.ts";

export interface NeighborSample {
    /** Gewichtete Nachbarzahl im Dichteradius. */
    density: number;
    /** Summe der Abstoßungen (Einheitsrichtung, gewichtet nach Nähe). */
    separationX: number;
    separationY: number;
    /** Differenz zwischen mittlerer Nachbargeschwindigkeit und eigener. */
    alignmentX: number;
    alignmentY: number;
    /** Mittlere Panik der Nachbarn in Reichweite (nach Nähe gewichtet). */
    neighborPanic: number;
    /** Mittlerer Druck der Nachbarn in Reichweite (nach Nähe gewichtet). */
    neighborPressure: number;
}

export function createNeighborSample(): NeighborSample {
    return {density: 0, separationX: 0, separationY: 0, alignmentX: 0, alignmentY: 0, neighborPanic: 0, neighborPressure: 0};
}

/** Goldener Winkel: verteilt Ausweichrichtungen gleichmäßig über die Ids. */
const GOLDEN_ANGLE = 2.399963229728653;
const COINCIDENT_DISTANCE = 1e-6;

/**
 * Misst in einem einzigen Durchlauf über die Nachbarn: Dichte, Abstoßung
 * und Geschwindigkeitsangleichung. Nachbarn sind Indizes in `agents`.
 */
export function sampleNeighbors(
    agent: Agent,
    agents: readonly Agent[],
    neighbors: readonly number[],
    config: SimulationConfig,
    out: NeighborSample,
): void {
    const {separationRadius, densityRadius} = config;

    let density = 0;
    let separationX = 0;
    let separationY = 0;
    let weightSum = 0;
    let neighborVelocityX = 0;
    let neighborVelocityY = 0;
    let neighborPanic = 0;
    let neighborPressure = 0;

    for (const index of neighbors) {
        const other = agents[index];

        if (other === agent) {
            continue;
        }

        let dx = agent.position.x - other.position.x;
        let dy = agent.position.y - other.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Nähe zählt stärker als Ferne.
        if (distance < densityRadius) {
            density += 1 - distance / densityRadius;
        }

        if (distance >= separationRadius) {
            continue;
        }

        if (distance < COINCIDENT_DISTANCE) {
            // Exakt übereinander: deterministisch in eine id-abhängige Richtung trennen.
            dx = Math.cos(agent.id * GOLDEN_ANGLE);
            dy = Math.sin(agent.id * GOLDEN_ANGLE);
        } else {
            dx /= distance;
            dy /= distance;
        }

        const weight = 1 - distance / separationRadius;

        separationX += dx * weight;
        separationY += dy * weight;

        weightSum += weight;
        neighborVelocityX += other.velocity.x * weight;
        neighborVelocityY += other.velocity.y * weight;
        neighborPanic += other.panic * weight;
        neighborPressure += other.pressure * weight;
    }

    out.density = density;
    out.separationX = separationX;
    out.separationY = separationY;

    if (weightSum > 0) {
        // Mit wenigen/fernen Nachbarn nur schwach angleichen.
        const influence = Math.min(1, weightSum);

        out.neighborPanic = neighborPanic / weightSum;
        out.neighborPressure = neighborPressure / weightSum;
        out.alignmentX = (neighborVelocityX / weightSum - agent.velocity.x) * influence;
        out.alignmentY = (neighborVelocityY / weightSum - agent.velocity.y) * influence;
    } else {
        out.neighborPanic = 0;
        out.neighborPressure = 0;
        out.alignmentX = 0;
        out.alignmentY = 0;
    }
}
