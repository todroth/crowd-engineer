import type {Agent} from "../../Agent.ts";
import type {WallObstacle} from "../../Obstacle.ts";
import type {Vector2} from "../../Vector2.ts";
import {calculateProjectedAvoidance, getTargetBasis,} from "./projectedAvoidance.ts";

export function calculateWallAvoidance(
    agent: Agent,
    obstacle: WallObstacle,
    lookAheadDistance: number,
    strength: number,
    clearanceMargin: number,
): Vector2 {
    const basis = getTargetBasis(agent);

    if (!basis) {
        return {x: 0, y: 0};
    }

    const dx = obstacle.end.x - obstacle.start.x;
    const dy = obstacle.end.y - obstacle.start.y;
    const length = Math.hypot(dx, dy);

    const halfLength = length / 2;
    const halfThickness = obstacle.thickness / 2;

    const tangentX = length === 0 ? 1 : dx / length;
    const tangentY = length === 0 ? 0 : dy / length;
    const wallNormalX = -tangentY;
    const wallNormalY = tangentX;

    const center = {
        x: (obstacle.start.x + obstacle.end.x) / 2,
        y: (obstacle.start.y + obstacle.end.y) / 2,
    };

    const forwardExtent =
        Math.abs(tangentX * basis.forwardX + tangentY * basis.forwardY) * halfLength +
        Math.abs(wallNormalX * basis.forwardX + wallNormalY * basis.forwardY) * halfThickness;

    const lateralExtent =
        Math.abs(tangentX * basis.normalX + tangentY * basis.normalY) * halfLength +
        Math.abs(wallNormalX * basis.normalX + wallNormalY * basis.normalY) * halfThickness;

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
