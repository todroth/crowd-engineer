import type {WallObstacle} from "../../Obstacle.ts";
import type {Vector2} from "../../Vector2.ts";
import {
    closestPointOnSegment,
    type CollisionHit,
    CONTACT_EPSILON,
    dot,
    findCircleHit,
    GEOMETRY_EPSILON,
    type OverlapCorrection,
} from "./geometry.ts";

export function findWallObstacleHit(
    start: Vector2,
    movement: Vector2,
    agentRadius: number,
    obstacle: WallObstacle,
): CollisionHit | null {
    const radius = obstacle.thickness / 2 + agentRadius;
    const dx = obstacle.end.x - obstacle.start.x;
    const dy = obstacle.end.y - obstacle.start.y;
    const length = Math.hypot(dx, dy);

    let bestHit: CollisionHit | null = null;

    // Die Enden einer dicken Wand sind ebenfalls kollidierbar.
    for (const endpoint of [obstacle.start, obstacle.end]) {
        const hit = findCircleHit(start, movement, endpoint, radius);

        if (hit && (!bestHit || hit.time < bestHit.time)) {
            bestHit = hit;
        }
    }

    if (length <= GEOMETRY_EPSILON) {
        return bestHit;
    }

    const tangent = {x: dx / length, y: dy / length};
    const wallNormal = {x: -tangent.y, y: tangent.x};

    const offset = {
        x: start.x - obstacle.start.x,
        y: start.y - obstacle.start.y,
    };

    const signedStart = dot(offset, wallNormal);
    const signedMovement = dot(movement, wallNormal);

    if (Math.abs(signedMovement) <= GEOMETRY_EPSILON) {
        return bestHit;
    }

    // Beide Seiten des Wandsegments prüfen.
    for (const side of [-1, 1]) {
        const time = (side * radius - signedStart) / signedMovement;

        if (time < 0 || time > 1) {
            continue;
        }

        const normal = {
            x: wallNormal.x * side,
            y: wallNormal.y * side,
        };

        if (dot(movement, normal) >= 0) {
            continue;
        }

        const hitPoint = {
            x: start.x + movement.x * time,
            y: start.y + movement.y * time,
        };

        const alongWall = dot(
            {
                x: hitPoint.x - obstacle.start.x,
                y: hitPoint.y - obstacle.start.y,
            },
            tangent,
        );

        if (alongWall < 0 || alongWall > length) {
            continue;
        }

        if (!bestHit || time < bestHit.time) {
            bestHit = {time, normal};
        }
    }

    return bestHit;
}

export function resolveWallOverlap(
    position: Vector2,
    movement: Vector2,
    agentRadius: number,
    obstacle: WallObstacle,
): OverlapCorrection | null {
    const radius = obstacle.thickness / 2 + agentRadius;

    const closest = closestPointOnSegment(
        position,
        obstacle.start,
        obstacle.end,
    );

    const dx = position.x - closest.x;
    const dy = position.y - closest.y;
    const distance = Math.hypot(dx, dy);

    if (distance >= radius) {
        return null;
    }

    let normal: Vector2;

    if (distance > GEOMETRY_EPSILON) {
        normal = {x: dx / distance, y: dy / distance};
    } else {
        const wallX = obstacle.end.x - obstacle.start.x;
        const wallY = obstacle.end.y - obstacle.start.y;
        const wallLength = Math.hypot(wallX, wallY);

        if (wallLength > GEOMETRY_EPSILON) {
            normal = {
                x: -wallY / wallLength,
                y: wallX / wallLength,
            };
        } else {
            const movementLength = Math.hypot(
                movement.x,
                movement.y,
            );

            normal = movementLength > GEOMETRY_EPSILON
                ? {
                    x: -movement.x / movementLength,
                    y: -movement.y / movementLength,
                }
                : {x: 1, y: 0};
        }

        if (dot(movement, normal) > 0) {
            normal = {x: -normal.x, y: -normal.y};
        }
    }

    return {
        position: {
            x: closest.x + normal.x * (radius + CONTACT_EPSILON),
            y: closest.y + normal.y * (radius + CONTACT_EPSILON),
        },
        normal,
    };
}
