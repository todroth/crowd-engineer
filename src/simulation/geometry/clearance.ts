import type {Vector2} from "../Vector2.ts";
import type {Collider} from "./Collider.ts";
import {isInsideRect, type Rect} from "./Rect.ts";
import {distanceToSegment, segmentDistance} from "./segments.ts";

/**
 * Abstand zwischen Punkt und der Oberfläche der Hindernisse. Negativ, wenn
 * der Punkt im Hindernis liegt (nur ungefähr, dient dazu, "blockiert" zu
 * erkennen).
 */
export function pointClearance(
    point: Vector2,
    colliders: readonly Collider[],
): number {
    let clearance = Infinity;

    for (const collider of colliders) {
        // Die Oberfläche liegt nie näher als das umgebende Rechteck: Ist das schon
        // weiter weg als der bisher kleinste Abstand, kann das Hindernis nichts ändern.
        if (distanceToRect(point, collider.bounds) >= clearance) {
            continue;
        }

        let distance = Infinity;

        for (const {a, b} of collider.segments) {
            distance = Math.min(distance, distanceToSegment(point, a, b));
        }

        if (collider.solid && isInsideRect(point, collider.solid)) {
            distance = -distance;
        }

        clearance = Math.min(clearance, distance - collider.radius);
    }

    return clearance;
}

/** Kann man von `from` nach `to` sehen, ohne dass ein Hindernis im Weg steht? */
export function hasLineOfSight(
    from: Vector2,
    to: Vector2,
    colliders: readonly Collider[],
): boolean {
    const minX = Math.min(from.x, to.x);
    const maxX = Math.max(from.x, to.x);
    const minY = Math.min(from.y, to.y);
    const maxY = Math.max(from.y, to.y);

    for (const collider of colliders) {
        const {bounds} = collider;

        // Liegt die Sichtlinie ganz neben dem umgebenden Rechteck, kann das Hindernis sie nicht verdecken.
        if (
            bounds.x > maxX || bounds.x + bounds.width < minX ||
            bounds.y > maxY || bounds.y + bounds.height < minY
        ) {
            continue;
        }

        if (
            collider.solid &&
            (isInsideRect(from, collider.solid) || isInsideRect(to, collider.solid))
        ) {
            return false;
        }

        for (const {a, b} of collider.segments) {
            if (segmentDistance(from, to, a, b) < collider.radius) {
                return false;
            }
        }
    }

    return true;
}

/** Abstand eines Punktes zu einem Rechteck (0, wenn er darin liegt). */
function distanceToRect(point: Vector2, rect: Rect): number {
    const dx = Math.max(rect.x - point.x, 0, point.x - (rect.x + rect.width));
    const dy = Math.max(rect.y - point.y, 0, point.y - (rect.y + rect.height));

    return Math.sqrt(dx * dx + dy * dy);
}
