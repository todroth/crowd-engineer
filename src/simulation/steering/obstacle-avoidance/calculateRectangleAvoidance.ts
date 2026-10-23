import type {Agent} from "../../Agent.ts";
import type {RectangleObstacle} from "../../Obstacle.ts";
import type {Vector2} from "../../Vector2.ts";
import {calculateProjectedAvoidance, getTargetBasis,} from "./projectedAvoidance.ts";

export function calculateRectangleAvoidance(
    agent: Agent,
    obstacle: RectangleObstacle,
    lookAheadDistance: number,
    strength: number,
    clearanceMargin: number,
): Vector2 {
    const basis = getTargetBasis(agent);

    if (!basis) {
        return {x: 0, y: 0};
    }

    const halfWidth = obstacle.width / 2;
    const halfHeight = obstacle.height / 2;

    const center = {
        x: obstacle.position.x + halfWidth,
        y: obstacle.position.y + halfHeight,
    };

    const forwardExtent =
        Math.abs(basis.forwardX) * halfWidth +
        Math.abs(basis.forwardY) * halfHeight;

    const lateralExtent =
        Math.abs(basis.normalX) * halfWidth +
        Math.abs(basis.normalY) * halfHeight;

    return calculateProjectedAvoidance(
        agent,
        center,
        forwardExtent,
        lateralExtent,
        basis,
        lookAheadDistance,
        strength,
        clearanceMargin,
    );
}
