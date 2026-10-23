import type {Obstacle,} from "../Obstacle.ts";
import type {Vector2} from "../Vector2.ts";
import {
    type CollisionHit,
    CONTACT_EPSILON,
    GEOMETRY_EPSILON,
    type OverlapCorrection,
    removeInwardComponent,
} from "./obstacle-collision/geometry.ts";
import {findCircleObstacleHit, resolveCircleOverlap,} from "./obstacle-collision/circleCollision.ts";
import {findRectangleObstacleHit, resolveRectangleOverlap,} from "./obstacle-collision/rectangleCollision.ts";
import {findWallObstacleHit, resolveWallOverlap,} from "./obstacle-collision/wallCollision.ts";

export interface ResolvedMovement {
    position: Vector2;
    velocity: Vector2;
}

function findObstacleHit(
    start: Vector2,
    movement: Vector2,
    agentRadius: number,
    obstacle: Obstacle,
): CollisionHit | null {
    switch (obstacle.type) {
        case "circle":
            return findCircleObstacleHit(
                start, movement, agentRadius, obstacle,
            );

        case "rectangle":
            return findRectangleObstacleHit(
                start, movement, agentRadius, obstacle,
            );

        case "wall":
            return findWallObstacleHit(
                start, movement, agentRadius, obstacle,
            );
    }
}

function resolveObstacleOverlap(
    position: Vector2,
    movement: Vector2,
    agentRadius: number,
    obstacle: Obstacle,
): OverlapCorrection | null {
    switch (obstacle.type) {
        case "circle":
            return resolveCircleOverlap(
                position, movement, agentRadius, obstacle,
            );

        case "rectangle":
            return resolveRectangleOverlap(
                position, agentRadius, obstacle,
            );

        case "wall":
            return resolveWallOverlap(
                position, movement, agentRadius, obstacle,
            );
    }
}

export function resolveObstacleCollision(
    start: Vector2,
    proposedPosition: Vector2,
    velocity: Vector2,
    agentRadius: number,
    obstacles: readonly Obstacle[],
): ResolvedMovement {
    if (obstacles.length === 0) {
        return {
            position: {
                x: proposedPosition.x,
                y: proposedPosition.y,
            },
            velocity: {...velocity},
        };
    }

    let position = {...start};
    let remaining = {
        x: proposedPosition.x - start.x,
        y: proposedPosition.y - start.y,
    };
    let resolvedVelocity = {...velocity};

    // Mehrere Kontakte in einer Bewegung abarbeiten, etwa an Ecken.
    const maxIterations = Math.max(
        4,
        Math.min(8, obstacles.length * 2 + 2),
    );

    for (let iteration = 0; iteration < maxIterations; iteration++) {
        let correctedOverlap = false;

        // Sicherheitsnetz, falls der Agent bereits in einem
        // Hindernis startet oder durch Korrekturen hineingerät.
        for (const obstacle of obstacles) {
            const correction = resolveObstacleOverlap(
                position,
                remaining,
                agentRadius,
                obstacle,
            );

            if (!correction) {
                continue;
            }

            position = correction.position;
            remaining = removeInwardComponent(
                remaining,
                correction.normal,
            );
            resolvedVelocity = removeInwardComponent(
                resolvedVelocity,
                correction.normal,
            );

            correctedOverlap = true;
        }

        if (
            Math.hypot(remaining.x, remaining.y) <= GEOMETRY_EPSILON
        ) {
            if (correctedOverlap) {
                continue;
            }

            break;
        }

        // Wichtig: Immer den frühesten Kontakt über alle Formen finden.
        let earliestHit: CollisionHit | null = null;

        for (const obstacle of obstacles) {
            const hit = findObstacleHit(
                position,
                remaining,
                agentRadius,
                obstacle,
            );

            if (hit && (!earliestHit || hit.time < earliestHit.time)) {
                earliestHit = hit;
            }
        }

        if (!earliestHit) {
            position.x += remaining.x;
            position.y += remaining.y;
            remaining = {x: 0, y: 0};
            break;
        }

        const hitPoint = {
            x: position.x + remaining.x * earliestHit.time,
            y: position.y + remaining.y * earliestHit.time,
        };

        const leftover = {
            x: remaining.x * (1 - earliestHit.time),
            y: remaining.y * (1 - earliestHit.time),
        };

        // Etwas Abstand zur Oberfläche halten.
        position = {
            x: hitPoint.x + earliestHit.normal.x * CONTACT_EPSILON,
            y: hitPoint.y + earliestHit.normal.y * CONTACT_EPSILON,
        };

        // Bewegung und Geschwindigkeit nur in die Oberfläche
        // hinein entfernen. Tangentiales Gleiten bleibt möglich.
        remaining = removeInwardComponent(
            leftover,
            earliestHit.normal,
        );
        resolvedVelocity = removeInwardComponent(
            resolvedVelocity,
            earliestHit.normal,
        );
    }

    return {
        position,
        velocity: resolvedVelocity,
    };
}
