import type {Vector2} from "../Vector2.ts";
import type {Collider} from "./Collider.ts";
import {isInsideRect} from "./Rect.ts";
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

/**
 * Hält die Strecke mindestens `required` Abstand zur Oberfläche aller
 * Hindernisse? Bricht beim ersten Verstoß ab und überspringt Hindernisse,
 * die schon laut Umgebungsrechteck zu weit weg sind.
 */
export function isSegmentClear(
    start: Vector2,
    end: Vector2,
    colliders: readonly Collider[],
    required: number,
): boolean {
    const minX = Math.min(start.x, end.x) - required;
    const maxX = Math.max(start.x, end.x) + required;
    const minY = Math.min(start.y, end.y) - required;
    const maxY = Math.max(start.y, end.y) + required;

    for (const collider of colliders) {
        const {bounds} = collider;

        if (
            bounds.x > maxX || bounds.x + bounds.width < minX ||
            bounds.y > maxY || bounds.y + bounds.height < minY
        ) {
            continue;
        }

        // Liegt ein Endpunkt im Rechteck, schneidet die Strecke
        // eventuell keine Kante, ist aber trotzdem blockiert.
        if (
            collider.solid &&
            (isInsideRect(start, collider.solid) ||
                isInsideRect(end, collider.solid))
        ) {
            return false;
        }

        for (const {a, b} of collider.segments) {
            if (segmentDistance(start, end, a, b) - collider.radius < required) {
                return false;
            }
        }
    }

    return true;
}
