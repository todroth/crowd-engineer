import type {Vector2} from "../Vector2.ts";

export interface Rect {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}

/** Liegt der Punkt echt im Inneren (Rand zählt nicht dazu)? */
export function isInsideRect(point: Vector2, rect: Rect): boolean {
    return point.x > rect.x &&
        point.x < rect.x + rect.width &&
        point.y > rect.y &&
        point.y < rect.y + rect.height;
}

/** Wie `isInsideRect`, aber der Rand zählt mit. */
export function rectContains(rect: Rect, point: Vector2): boolean {
    return point.x >= rect.x &&
        point.x <= rect.x + rect.width &&
        point.y >= rect.y &&
        point.y <= rect.y + rect.height;
}
