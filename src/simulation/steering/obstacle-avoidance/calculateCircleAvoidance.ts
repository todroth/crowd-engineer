import type {Agent} from "../../Agent.ts";
import type {CircleObstacle} from "../../Obstacle.ts";
import type {Vector2} from "../../Vector2.ts";
import {calculateProjectedAvoidance, getTargetBasis,} from "./projectedAvoidance.ts";

export function calculateCircleAvoidance(
    agent: Agent,
    obstacle: CircleObstacle,
    lookAheadDistance: number,
    strength: number,
    clearanceMargin: number,
): Vector2 {
    const basis = getTargetBasis(agent);

    if (!basis) {
        return {x: 0, y: 0};
    }

    return calculateProjectedAvoidance(
        agent,
        obstacle.center,
        obstacle.radius,
        obstacle.radius,
        basis,
        lookAheadDistance,
        strength,
        clearanceMargin,
    );
}
