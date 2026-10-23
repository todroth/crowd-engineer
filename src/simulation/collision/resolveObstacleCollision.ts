import type {Obstacle} from "../Obstacle.ts";
import type {Vector2} from "../Vector2.ts";

export interface ResolvedMovement {
    position: Vector2;
    velocity: Vector2;
}

const CONTACT_EPSILON = 0.01;

function removeInwardVelocity(
    velocity: Vector2,
    normalX: number,
    normalY: number,
): Vector2 {
    const normalVelocity = velocity.x * normalX + velocity.y * normalY;

    // Geschwindigkeit beibehalten, wenn sie nicht in das
    // Hindernis hineinführt.
    if (normalVelocity >= 0) {
        return velocity;
    }

    return {
        x: velocity.x - normalX * normalVelocity,
        y: velocity.y - normalY * normalVelocity,
    };
}

export function resolveObstacleCollision(
    start: Vector2,
    proposedPosition: Vector2,
    velocity: Vector2,
    agentRadius: number,
    obstacles: readonly Obstacle[],
): ResolvedMovement {
    let segmentStart = {x: start.x, y: start.y};
    let position = {
        x: proposedPosition.x,
        y: proposedPosition.y,
    };
    let resolvedVelocity = {
        x: velocity.x,
        y: velocity.y,
    };

    for (const obstacle of obstacles) {
        const centerX = obstacle.position.x;
        const centerY = obstacle.position.y;
        const radius = obstacle.radius + agentRadius;

        const offsetX = segmentStart.x - centerX;
        const offsetY = segmentStart.y - centerY;
        const startDistanceSquared =
            offsetX * offsetX + offsetY * offsetY;

        // Sicherheitsnetz für den Fall, dass ein Agent bereits
        // innerhalb des Hindernisses startet.
        if (startDistanceSquared < radius * radius) {
            const distance = Math.sqrt(startDistanceSquared);

            let normalX: number;
            let normalY: number;

            if (distance > 0) {
                normalX = offsetX / distance;
                normalY = offsetY / distance;
            } else {
                normalX = 1;
                normalY = 0;
            }

            position = {
                x: centerX + normalX * (radius + CONTACT_EPSILON),
                y: centerY + normalY * (radius + CONTACT_EPSILON),
            };

            resolvedVelocity = removeInwardVelocity(
                resolvedVelocity,
                normalX,
                normalY,
            );

            segmentStart = position;
            continue;
        }

        // Bewegung von der aktuellen zur geplanten Position.
        const movementX = position.x - segmentStart.x;
        const movementY = position.y - segmentStart.y;

        const a =
            movementX * movementX + movementY * movementY;

        if (a === 0) {
            continue;
        }

        // Schnitt der Bewegungsstrecke mit dem erweiterten Kreis.
        const b = 2 * (
            offsetX * movementX + offsetY * movementY
        );

        const c = startDistanceSquared - radius * radius;
        const discriminant = b * b - 4 * a * c;

        if (discriminant < 0) {
            continue;
        }

        const impactTime = (-b - Math.sqrt(discriminant)) / (2 * a);

        if (impactTime < 0 || impactTime > 1) {
            continue;
        }

        // Ersten Kontaktpunkt auf der Strecke finden.
        const hitX = segmentStart.x + movementX * impactTime;
        const hitY = segmentStart.y + movementY * impactTime;

        const normalOffsetX = hitX - centerX;
        const normalOffsetY = hitY - centerY;
        const normalLength = Math.hypot(
            normalOffsetX,
            normalOffsetY,
        );

        const normalX = normalOffsetX / normalLength;
        const normalY = normalOffsetY / normalLength;

        // Den verbleibenden Bewegungsanteil in die Wand
        // entfernen, den tangentialen Anteil aber beibehalten.
        const remainingX = position.x - hitX;
        const remainingY = position.y - hitY;

        const inwardMovement = remainingX * normalX + remainingY * normalY;

        const slideX = inwardMovement < 0
            ? remainingX - normalX * inwardMovement
            : remainingX;

        const slideY = inwardMovement < 0
            ? remainingY - normalY * inwardMovement
            : remainingY;

        position = {
            x: hitX + slideX + normalX * CONTACT_EPSILON,
            y: hitY + slideY + normalY * CONTACT_EPSILON,
        };

        // Auch die Geschwindigkeit darf nicht weiter in das
        // Hindernis hineinzeigen.
        resolvedVelocity = removeInwardVelocity(
            resolvedVelocity,
            normalX,
            normalY,
        );

        // Bei weiteren Hindernissen den verbleibenden Weg prüfen.
        segmentStart = {x: hitX, y: hitY};
    }

    return {
        position,
        velocity: resolvedVelocity,
    };
}
