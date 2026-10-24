import type {Agent} from "../Agent.ts";
import type {Collider} from "../geometry/Collider.ts";
import {pointClearance} from "../geometry/clearance.ts";

/*
 * Zwei Einheiten für Dichte:
 *
 *  - Kernel-Dichte: gewichtete Nachbarzahl im Dichteradius (`sampleNeighbors`,
 *    `Agent.localDensity`). In dieser Einheit rechnen Panik und Farbskala.
 *  - Personen pro m²: real vergleichbar. In dieser Einheit rechnen Verletzung,
 *    Fundamentaldiagramm und Wertung.
 */

/**
 * Faktor von Kernel-Dichte zu Personen pro m². Der Kegelkern 1 - d/R hat das
 * Integral πR²/3, daher Anzahl ≈ Dichte · πR²/3, umgerechnet auf einen m².
 */
export function personsPerSquareMeterFactor(pixelsPerMeter: number, densityRadius: number): number {
    return (3 * pixelsPerMeter ** 2) / (Math.PI * densityRadius ** 2);
}

/**
 * Dichte durch Nachbarn, verstärkt, wenn der Agent an einem Hindernis
 * eingeklemmt ist (er kann dort nicht ausweichen). Ein Agent allein an der Wand
 * bleibt bei 0.
 */
export function densityWithWalls(
    agent: Agent,
    neighborDensity: number,
    colliders: readonly Collider[],
    densityRadius: number,
    wallDensityFactor: number,
): number {
    if (neighborDensity === 0 || wallDensityFactor === 0) {
        return neighborDensity;
    }

    return neighborDensity * (1 + wallDensityFactor * wallProximity(agent, colliders, densityRadius));
}

/**
 * Wie dicht steht der Agent an einem Hindernis? 1 = Körper berührt die
 * Oberfläche, 0 = mindestens `range` entfernt.
 */
function wallProximity(agent: Agent, colliders: readonly Collider[], range: number): number {
    const gap = pointClearance(agent.position, colliders) - agent.radius;

    return Math.min(1, Math.max(0, 1 - gap / range));
}
