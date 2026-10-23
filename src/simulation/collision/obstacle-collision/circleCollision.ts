import type {CircleObstacle} from "../../Obstacle.ts";
import type {Vector2} from "../../Vector2.ts";
import {
    type CollisionHit,
    CONTACT_EPSILON,
    findCircleHit,
    GEOMETRY_EPSILON,
    type OverlapCorrection,
} from "./geometry.ts";

export function findCircleObstacleHit(
    start: Vector2,
    movement: Vector2,
    agentRadius: number,
    obstacle: CircleObstacle,
): CollisionHit | null {
    return findCircleHit(
        start,
        movement,
        obstacle.center,
        obstacle.radius + agentRadius,
    );
}

export function resolveCircleOverlap(
    position: Vector2,
    movement: Vector2,
    agentRadius: number,
    obstacle: CircleObstacle,
): OverlapCorrection | null {
    const radius = obstacle.radius + agentRadius;
    const dx = position.x - obstacle.center.x;
    const dy = position.y - obstacle.center.y;
    const distance = Math.hypot(dx, dy);

    if (distance >= radius) {
        return null;
    }

    let normal: Vector2;

    if (distance > GEOMETRY_EPSILON) {
        normal = {x: dx / distance, y: dy / distance};
    } else {
        const movementLength = Math.hypot(movement.x, movement.y);

        normal = movementLength > GEOMETRY_EPSILON
            ? {
                x: -movement.x / movementLength,
                y: -movement.y / movementLength,
            }
            : {x: 1, y: 0};
    }

    const targetRadius = radius + CONTACT_EPSILON;

    const corrected = {
        x: obstacle.center.x + normal.x * targetRadius,
        y: obstacle.center.y + normal.y * targetRadius,
    };

    return {
        position: corrected,
        normal,
    };
}
