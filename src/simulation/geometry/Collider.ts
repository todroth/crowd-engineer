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
    /** Umgebendes Rechteck inklusive Radius: Außerhalb davon kann nichts das Hindernis berühren. */
    readonly bounds: Rect;
}

export function createCollider(obstacle: Obstacle): Collider {
    switch (obstacle.type) {
        case "circle":
            return withBounds([{a: obstacle.center, b: obstacle.center}], obstacle.radius, null);

        case "wall":
            return withBounds([{a: obstacle.start, b: obstacle.end}], obstacle.thickness / 2, null);

        case "rectangle": {
            const left = obstacle.position.x;
            const top = obstacle.position.y;
            const right = left + obstacle.width;
            const bottom = top + obstacle.height;

            const topLeft = {x: left, y: top};
            const topRight = {x: right, y: top};
            const bottomRight = {x: right, y: bottom};
            const bottomLeft = {x: left, y: bottom};

            return withBounds(
                [
                    {a: topLeft, b: topRight},
                    {a: topRight, b: bottomRight},
                    {a: bottomRight, b: bottomLeft},
                    {a: bottomLeft, b: topLeft},
                ],
                0,
                {x: left, y: top, width: obstacle.width, height: obstacle.height},
            );
        }
    }
}

function withBounds(
    segments: readonly Segment[],
    radius: number,
    solid: Rect | null,
): Collider {
    const xs = segments.flatMap(({a, b}) => [a.x, b.x]);
    const ys = segments.flatMap(({a, b}) => [a.y, b.y]);
    const minX = Math.min(...xs) - radius;
    const minY = Math.min(...ys) - radius;

    return {
        segments,
        radius,
        solid,
        bounds: {
            x: minX,
            y: minY,
            width: Math.max(...xs) + radius - minX,
            height: Math.max(...ys) + radius - minY,
        },
    };
}

export function createColliders(
    obstacles: readonly Obstacle[],
): readonly Collider[] {
    return obstacles.map(createCollider);
}
