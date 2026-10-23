import type {Vector2} from "../../Vector2.ts";

export const CONTACT_EPSILON = 0.01;
export const GEOMETRY_EPSILON = 1e-9;

export interface CollisionHit {
    readonly time: number;
    readonly normal: Vector2;
}

export interface OverlapCorrection {
    readonly position: Vector2;
    readonly normal: Vector2;
}

export function dot(a: Vector2, b: Vector2): number {
    return a.x * b.x + a.y * b.y;
}

export function removeInwardComponent(
    vector: Vector2,
    normal: Vector2,
): Vector2 {
    const inward = dot(vector, normal);

    if (inward >= 0) {
        return vector;
    }

    return {
        x: vector.x - normal.x * inward,
        y: vector.y - normal.y * inward,
    };
}

export function closestPointOnSegment(
    point: Vector2,
    start: Vector2,
    end: Vector2,
): Vector2 {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;

    const t = lengthSquared <= GEOMETRY_EPSILON
        ? 0
        : Math.max(
            0,
            Math.min(
                1,
                ((point.x - start.x) * dx +
                    (point.y - start.y) * dy) / lengthSquared,
            ),
        );

    return {
        x: start.x + dx * t,
        y: start.y + dy * t,
    };
}

export function findCircleHit(
    start: Vector2,
    movement: Vector2,
    center: Vector2,
    radius: number,
): CollisionHit | null {
    const a = dot(movement, movement);

    if (a <= GEOMETRY_EPSILON) {
        return null;
    }

    const offset = {
        x: start.x - center.x,
        y: start.y - center.y,
    };

    const c = dot(offset, offset) - radius * radius;

    // Bereits überlappende Positionen werden separat korrigiert.
    if (c < -GEOMETRY_EPSILON) {
        return null;
    }

    const b = 2 * dot(offset, movement);
    const discriminant = b * b - 4 * a * c;

    if (discriminant < 0) {
        return null;
    }

    const time = (-b - Math.sqrt(discriminant)) / (2 * a);

    if (time < -GEOMETRY_EPSILON || time > 1) {
        return null;
    }

    const t = Math.max(0, time);
    const contact = {
        x: start.x + movement.x * t,
        y: start.y + movement.y * t,
    };

    const dx = contact.x - center.x;
    const dy = contact.y - center.y;
    const distance = Math.hypot(dx, dy);

    if (distance <= GEOMETRY_EPSILON) {
        return null;
    }

    const normal = {
        x: dx / distance,
        y: dy / distance,
    };

    // Nur Treffer berücksichtigen, bei denen die Bewegung
    // tatsächlich in die Oberfläche hineinführt.
    if (dot(movement, normal) >= 0) {
        return null;
    }

    return {time: t, normal};
}
