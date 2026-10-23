import type {Vector2} from "../Vector2.ts";
import type {Collider} from "./Collider.ts";
import {isInsideRect} from "./Rect.ts";
import {distanceToSegment} from "./segments.ts";

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
