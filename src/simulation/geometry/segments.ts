import type {Vector2} from "../Vector2.ts";

export const EPSILON = 1e-9;

export function distanceBetween(a: Vector2, b: Vector2): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;

    return Math.sqrt(dx * dx + dy * dy);
}

export function dot(a: Vector2, b: Vector2): number {
    return a.x * b.x + a.y * b.y;
}

export function closestPointOnSegment(
    point: Vector2,
    start: Vector2,
    end: Vector2,
): Vector2 {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;

    if (lengthSquared <= EPSILON) {
        return {x: start.x, y: start.y};
    }

    const t = Math.max(0, Math.min(1,
        ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared,
    ));

    return {x: start.x + dx * t, y: start.y + dy * t};
}

export function distanceToSegment(
    point: Vector2,
    start: Vector2,
    end: Vector2,
): number {
    return distanceBetween(point, closestPointOnSegment(point, start, end));
}
