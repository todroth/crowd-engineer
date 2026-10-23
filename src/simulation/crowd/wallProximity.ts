import type {Agent} from "../Agent.ts";
import type {Collider} from "../geometry/Collider.ts";
import {pointClearance} from "../geometry/clearance.ts";

/**
 * Wie dicht steht der Agent an einem Hindernis? 1 = Körper berührt die
 * Oberfläche, 0 = mindestens `range` entfernt.
 */
export function calculateWallProximity(
    agent: Agent,
    colliders: readonly Collider[],
    range: number,
): number {
    const gap = pointClearance(agent.position, colliders) - agent.radius;

    return Math.min(1, Math.max(0, 1 - gap / range));
}
