import type {Vector2} from "../Vector2.ts";
import type {Segment} from "../geometry/Collider.ts";
import {dot, EPSILON} from "../geometry/segments.ts";

/** Erster Kontakt einer Bewegung; `time` ist der Anteil (0..1) der Bewegung. */
export interface SweepHit {
    readonly time: number;
    readonly normal: Vector2;
}

/**
 * Bewegt einen Punkt entlang `movement` gegen einen Kreis um `center`.
 * (Der Agent ist als Punkt modelliert, der Hindernisradius um seinen
 * eigenen Radius vergrößert.)
 */
function sweepPointVsCircle(
    start: Vector2,
    movement: Vector2,
    center: Vector2,
    radius: number,
): SweepHit | null {
    const a = dot(movement, movement);

    if (a <= EPSILON) {
        return null;
    }

    const offset = {x: start.x - center.x, y: start.y - center.y};
    const c = dot(offset, offset) - radius * radius;

    // Bereits überlappende Positionen werden separat herausgeschoben.
    if (c < -EPSILON) {
        return null;
    }

    const b = 2 * dot(offset, movement);
    const discriminant = b * b - 4 * a * c;

    if (discriminant < 0) {
        return null;
    }

    const time = Math.max(0, (-b - Math.sqrt(discriminant)) / (2 * a));

    if (time > 1) {
        return null;
    }

    const normal = {
        x: offset.x + movement.x * time,
        y: offset.y + movement.y * time,
    };
    const length = Math.hypot(normal.x, normal.y);

    if (length <= EPSILON) {
        return null;
    }

    normal.x /= length;
    normal.y /= length;

    // Nur Treffer, bei denen die Bewegung in die Oberfläche hineinführt.
    return dot(movement, normal) < 0 ? {time, normal} : null;
}

/** Bewegt einen Punkt gegen die Kapsel um `segment` mit dem Radius `radius`. */
export function sweepPointVsCapsule(
    start: Vector2,
    movement: Vector2,
    segment: Segment,
    radius: number,
): SweepHit | null {
    let best = earliestHit(
        sweepPointVsCircle(start, movement, segment.a, radius),
        sweepPointVsCircle(start, movement, segment.b, radius),
    );

    const dx = segment.b.x - segment.a.x;
    const dy = segment.b.y - segment.a.y;
    const length = Math.hypot(dx, dy);

    if (length <= EPSILON) {
        return best;
    }

    const tangent = {x: dx / length, y: dy / length};
    const sideNormal = {x: -tangent.y, y: tangent.x};

    const signedStart =
        (start.x - segment.a.x) * sideNormal.x +
        (start.y - segment.a.y) * sideNormal.y;
    const signedMovement = dot(movement, sideNormal);

    if (Math.abs(signedMovement) <= EPSILON) {
        return best;
    }

    // Die beiden geraden Flanken der Kapsel.
    for (const side of [-1, 1]) {
        const time = (side * radius - signedStart) / signedMovement;

        if (time < -EPSILON || time > 1) {
            continue;
        }

        const normal = {x: sideNormal.x * side, y: sideNormal.y * side};

        if (dot(movement, normal) >= 0) {
            continue;
        }

        const alongSegment =
            (start.x + movement.x * time - segment.a.x) * tangent.x +
            (start.y + movement.y * time - segment.a.y) * tangent.y;

        if (alongSegment < 0 || alongSegment > length) {
            continue;
        }

        best = earliestHit(best, {time: Math.max(0, time), normal});
    }

    return best;
}

export function earliestHit(
    first: SweepHit | null,
    second: SweepHit | null,
): SweepHit | null {
    if (!first) return second;
    if (!second) return first;
    return second.time < first.time ? second : first;
}
