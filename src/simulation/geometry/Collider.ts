import type {Obstacle} from "../Obstacle.ts";
import type {Vector2} from "../Vector2.ts";
import type {Rect} from "./Rect.ts";

export interface Segment {
    readonly a: Readonly<Vector2>;
    readonly b: Readonly<Vector2>;
}

/**
 * Einheitliche Darstellung aller Hindernisse: die Menge aller Punkte, die
 * höchstens `radius` von einer der Strecken entfernt liegen ("Kapseln").
 *
 *  - Kreis:    eine entartete Strecke (a == b) mit dem Kreisradius
 *  - Wand:     eine Strecke mit halber Wanddicke als Radius
 *  - Rechteck: vier Kanten mit Radius 0; zusätzlich `solid` für das Innere
 *
 * Kollision, Routing und Abstandsmessung kennen nur diese Form.
 */
export interface Collider {
    readonly segments: readonly Segment[];
    readonly radius: number;
    readonly solid: Rect | null;
}

export function createCollider(obstacle: Obstacle): Collider {
    switch (obstacle.type) {
        case "circle":
            return {
                segments: [{a: obstacle.center, b: obstacle.center}],
                radius: obstacle.radius,
                solid: null,
            };

        case "wall":
            return {
                segments: [{a: obstacle.start, b: obstacle.end}],
                radius: obstacle.thickness / 2,
                solid: null,
            };

        case "rectangle": {
            const left = obstacle.position.x;
            const top = obstacle.position.y;
            const right = left + obstacle.width;
            const bottom = top + obstacle.height;

            const topLeft = {x: left, y: top};
            const topRight = {x: right, y: top};
            const bottomRight = {x: right, y: bottom};
            const bottomLeft = {x: left, y: bottom};

            return {
                segments: [
                    {a: topLeft, b: topRight},
                    {a: topRight, b: bottomRight},
                    {a: bottomRight, b: bottomLeft},
                    {a: bottomLeft, b: topLeft},
                ],
                radius: 0,
                solid: {x: left, y: top, width: obstacle.width, height: obstacle.height},
            };
        }
    }
}

export function createColliders(
    obstacles: readonly Obstacle[],
): readonly Collider[] {
    return obstacles.map(createCollider);
}
