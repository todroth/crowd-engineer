import type {Obstacle} from "../Obstacle.ts";
import type {Vector2} from "../Vector2.ts";

const CIRCLE_SAMPLES = 16;
const WALL_ARC_SEGMENTS = 8;

/**
 * Kandidatenpunkte für den Sichtbarkeitsgraphen: Ecken bzw. Ringe um jedes
 * Hindernis, mit `margin` Abstand zur Oberfläche. Der Aufrufer filtert
 * Punkte, die blockiert sind oder außerhalb der Welt liegen.
 */
export function createRouteNodeCandidates(
    obstacles: readonly Obstacle[],
    margin: number,
): Vector2[] {
    return obstacles.flatMap((obstacle) => {
        switch (obstacle.type) {
            case "circle":
                return ringAround(
                    obstacle.center,
                    obstacle.radius + margin,
                    CIRCLE_SAMPLES,
                );

            case "rectangle":
                return rectangleCorners(obstacle, margin);

            case "wall":
                return wallEndCaps(obstacle, margin);
        }
    });
}

/**
 * Regelmäßiges Vieleck um `center`, dessen Kanten (nicht Ecken) mindestens
 * `radius` Abstand haben, damit gerade Verbindungen zwischen den Ecken die
 * Kreisfläche sicher meiden.
 */
function ringAround(center: Vector2, radius: number, samples: number): Vector2[] {
    const cornerRadius = radius / Math.cos(Math.PI / samples);

    return Array.from({length: samples}, (_, i) => {
        const angle = (2 * Math.PI * i) / samples;

        return {
            x: center.x + Math.cos(angle) * cornerRadius,
            y: center.y + Math.sin(angle) * cornerRadius,
        };
    });
}

function rectangleCorners(
    obstacle: Extract<Obstacle, { type: "rectangle" }>,
    margin: number,
): Vector2[] {
    const left = obstacle.position.x - margin;
    const top = obstacle.position.y - margin;
    const right = obstacle.position.x + obstacle.width + margin;
    const bottom = obstacle.position.y + obstacle.height + margin;

    return [
        {x: left, y: top},
        {x: right, y: top},
        {x: right, y: bottom},
        {x: left, y: bottom},
    ];
}

/** Halbkreisbögen um beide Enden einer Wand, nach außen gerichtet. */
function wallEndCaps(
    obstacle: Extract<Obstacle, { type: "wall" }>,
    margin: number,
): Vector2[] {
    const direction = Math.atan2(
        obstacle.end.y - obstacle.start.y,
        obstacle.end.x - obstacle.start.x,
    );
    const radius = obstacle.thickness / 2 + margin;
    const cornerRadius = radius / Math.cos(Math.PI / (2 * WALL_ARC_SEGMENTS));

    const cap = (center: Vector2, firstAngle: number): Vector2[] =>
        Array.from({length: WALL_ARC_SEGMENTS + 1}, (_, i) => {
            const angle = firstAngle + (Math.PI * i) / WALL_ARC_SEGMENTS;

            return {
                x: center.x + Math.cos(angle) * cornerRadius,
                y: center.y + Math.sin(angle) * cornerRadius,
            };
        });

    return [
        ...cap(obstacle.start, direction + Math.PI / 2),
        ...cap(obstacle.end, direction - Math.PI / 2),
    ];
}
