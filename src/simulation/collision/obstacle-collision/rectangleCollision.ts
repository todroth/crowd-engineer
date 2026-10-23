import type {RectangleObstacle} from "../../Obstacle.ts";
import type {Vector2} from "../../Vector2.ts";
import {type CollisionHit, CONTACT_EPSILON, dot, GEOMETRY_EPSILON, type OverlapCorrection,} from "./geometry.ts";

export function findRectangleObstacleHit(
    start: Vector2,
    movement: Vector2,
    agentRadius: number,
    obstacle: RectangleObstacle,
): CollisionHit | null {
    const minX = obstacle.position.x - agentRadius;
    const maxX = obstacle.position.x + obstacle.width + agentRadius;
    const minY = obstacle.position.y - agentRadius;
    const maxY = obstacle.position.y + obstacle.height + agentRadius;

    let enterTime = -Infinity;
    let exitTime = Infinity;
    let normal: Vector2 | null = null;

    const axes = [
        {
            start: start.x,
            movement: movement.x,
            min: minX,
            max: maxX,
            minNormal: {x: -1, y: 0},
            maxNormal: {x: 1, y: 0},
        },
        {
            start: start.y,
            movement: movement.y,
            min: minY,
            max: maxY,
            minNormal: {x: 0, y: -1},
            maxNormal: {x: 0, y: 1},
        },
    ];

    for (const axis of axes) {
        if (Math.abs(axis.movement) <= GEOMETRY_EPSILON) {
            if (axis.start < axis.min || axis.start > axis.max) {
                return null;
            }

            continue;
        }

        let nearTime: number;
        let farTime: number;
        let nearNormal: Vector2;

        if (axis.movement > 0) {
            nearTime = (axis.min - axis.start) / axis.movement;
            farTime = (axis.max - axis.start) / axis.movement;
            nearNormal = axis.minNormal;
        } else {
            nearTime = (axis.max - axis.start) / axis.movement;
            farTime = (axis.min - axis.start) / axis.movement;
            nearNormal = axis.maxNormal;
        }

        if (nearTime > enterTime) {
            enterTime = nearTime;
            normal = nearNormal;
        }

        exitTime = Math.min(exitTime, farTime);

        if (enterTime > exitTime) {
            return null;
        }
    }

    if (
        normal === null ||
        enterTime < 0 ||
        enterTime > 1 ||
        dot(movement, normal) >= 0
    ) {
        return null;
    }

    return {
        time: enterTime,
        normal,
    };
}

export function resolveRectangleOverlap(
    position: Vector2,
    agentRadius: number,
    obstacle: RectangleObstacle,
): OverlapCorrection | null {
    const minX = obstacle.position.x - agentRadius;
    const maxX = obstacle.position.x + obstacle.width + agentRadius;
    const minY = obstacle.position.y - agentRadius;
    const maxY = obstacle.position.y + obstacle.height + agentRadius;

    if (
        position.x < minX ||
        position.x > maxX ||
        position.y < minY ||
        position.y > maxY
    ) {
        return null;
    }

    const options = [
        {
            distance: position.x - minX,
            normal: {x: -1, y: 0},
            position: {x: minX - CONTACT_EPSILON, y: position.y},
        },
        {
            distance: maxX - position.x,
            normal: {x: 1, y: 0},
            position: {x: maxX + CONTACT_EPSILON, y: position.y},
        },
        {
            distance: position.y - minY,
            normal: {x: 0, y: -1},
            position: {x: position.x, y: minY - CONTACT_EPSILON},
        },
        {
            distance: maxY - position.y,
            normal: {x: 0, y: 1},
            position: {x: position.x, y: maxY + CONTACT_EPSILON},
        },
    ];

    const nearest = options.reduce((best, option) =>
        option.distance < best.distance ? option : best,
    );

    return {
        position: nearest.position,
        normal: nearest.normal,
    };
}
