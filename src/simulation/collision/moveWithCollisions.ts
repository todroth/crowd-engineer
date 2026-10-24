import type {Vector2} from "../Vector2.ts";
import type {Collider} from "../geometry/Collider.ts";
import {isInsideRect} from "../geometry/Rect.ts";
import {closestPointOnSegment, dot, EPSILON} from "../geometry/segments.ts";
import {earliestHit, sweepPointVsCapsule, type SweepHit} from "./sweep.ts";

/** Abstand, den ein Agent nach einem Kontakt zur Oberfläche behält. */
const CONTACT_EPSILON = 0.01;
const MAX_ITERATIONS = 6;
/** Zusätzlicher Spielraum um die Bewegung, in dem Hindernisse noch berücksichtigt werden (Pixel). */
const NEARBY_MARGIN = 8;

/** Wiederverwendeter Puffer für die nahen Hindernisse (kein Zustand zwischen Aufrufen). */
const nearbyBuffer: Collider[] = [];

interface Overlap {
    readonly position: Vector2;
    readonly normal: Vector2;
    readonly depth: number;
}

export interface MoveResult {
    position: Vector2;
    velocity: Vector2;
}

/**
 * Bewegt einen Kreis (Radius `radius`) um `displacement`. An Hindernissen
 * wird nur die Komponente in die Oberfläche hinein entfernt, tangentiales
 * Gleiten bleibt erhalten. Steckt der Agent bereits in einem Hindernis,
 * wird er zuerst herausgeschoben.
 *
 * Mit `displacement = 0` wirkt die Funktion als reine Überlappungskorrektur.
 */
export function moveWithCollisions(
    start: Vector2,
    displacement: Vector2,
    velocity: Vector2,
    radius: number,
    allColliders: readonly Collider[],
): MoveResult {
    // Nur Hindernisse, die der Bewegung überhaupt nahe kommen können.
    const colliders = nearbyColliders(allColliders, start, displacement, radius);
    let position = {x: start.x, y: start.y};
    let remaining = displacement;
    let resolvedVelocity = velocity;

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
        const overlap = deepestOverlap(position, remaining, radius, colliders);

        if (overlap) {
            position = {x: overlap.position.x, y: overlap.position.y};
            remaining = removeInwardComponent(remaining, overlap.normal);
            resolvedVelocity = removeInwardComponent(
                resolvedVelocity,
                overlap.normal,
            );
            continue;
        }

        if (Math.hypot(remaining.x, remaining.y) <= EPSILON) {
            break;
        }

        let hit: SweepHit | null = null;

        for (const collider of colliders) {
            for (const segment of collider.segments) {
                hit = earliestHit(hit, sweepPointVsCapsule(
                    position,
                    remaining,
                    segment,
                    collider.radius + radius,
                ));
            }
        }

        if (!hit) {
            position = {
                x: position.x + remaining.x,
                y: position.y + remaining.y,
            };
            remaining = {x: 0, y: 0};
            break;
        }

        position = {
            x: position.x + remaining.x * hit.time + hit.normal.x * CONTACT_EPSILON,
            y: position.y + remaining.y * hit.time + hit.normal.y * CONTACT_EPSILON,
        };

        remaining = removeInwardComponent(
            {
                x: remaining.x * (1 - hit.time),
                y: remaining.y * (1 - hit.time),
            },
            hit.normal,
        );
        resolvedVelocity = removeInwardComponent(resolvedVelocity, hit.normal);
    }

    return {
        position,
        velocity: {x: resolvedVelocity.x, y: resolvedVelocity.y},
    };
}

function nearbyColliders(
    colliders: readonly Collider[],
    start: Vector2,
    displacement: Vector2,
    radius: number,
): readonly Collider[] {
    const reach = radius + NEARBY_MARGIN;
    const minX = Math.min(start.x, start.x + displacement.x) - reach;
    const maxX = Math.max(start.x, start.x + displacement.x) + reach;
    const minY = Math.min(start.y, start.y + displacement.y) - reach;
    const maxY = Math.max(start.y, start.y + displacement.y) + reach;

    nearbyBuffer.length = 0;

    for (const collider of colliders) {
        const {bounds} = collider;

        if (
            bounds.x <= maxX && bounds.x + bounds.width >= minX &&
            bounds.y <= maxY && bounds.y + bounds.height >= minY
        ) {
            nearbyBuffer.push(collider);
        }
    }

    return nearbyBuffer;
}

function removeInwardComponent(vector: Vector2, normal: Vector2): Vector2 {
    const inward = dot(vector, normal);

    if (inward >= 0) {
        return vector;
    }

    return {
        x: vector.x - normal.x * inward,
        y: vector.y - normal.y * inward,
    };
}

/** Die tiefste Überlappung über alle Hindernisse (oder `null`). */
function deepestOverlap(
    position: Vector2,
    movement: Vector2,
    radius: number,
    colliders: readonly Collider[],
): Overlap | null {
    let deepest: Overlap | null = null;

    for (const collider of colliders) {
        const overlap = colliderOverlap(position, movement, radius, collider);

        if (overlap && (!deepest || overlap.depth > deepest.depth)) {
            deepest = overlap;
        }
    }

    return deepest;
}

function colliderOverlap(
    position: Vector2,
    movement: Vector2,
    radius: number,
    collider: Collider,
): Overlap | null {
    if (collider.solid && isInsideRect(position, collider.solid)) {
        return pushOutOfSolid(position, radius, collider.solid);
    }

    const reach = collider.radius + radius;
    let deepest: Overlap | null = null;

    for (const segment of collider.segments) {
        const closest = closestPointOnSegment(position, segment.a, segment.b);
        const dx = position.x - closest.x;
        const dy = position.y - closest.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance >= reach || (deepest && reach - distance <= deepest.depth)) {
            continue;
        }

        const normal = distance > EPSILON
            ? {x: dx / distance, y: dy / distance}
            : fallbackNormal(segment.a, segment.b, movement);

        deepest = {
            position: {
                x: closest.x + normal.x * (reach + CONTACT_EPSILON),
                y: closest.y + normal.y * (reach + CONTACT_EPSILON),
            },
            normal,
            depth: reach - distance,
        };
    }

    return deepest;
}

/** Normale, wenn der Agent exakt auf der Mittellinie des Hindernisses steht. */
function fallbackNormal(a: Vector2, b: Vector2, movement: Vector2): Vector2 {
    const movementLength = Math.hypot(movement.x, movement.y);
    const against = movementLength > EPSILON
        ? {x: -movement.x / movementLength, y: -movement.y / movementLength}
        : {x: 1, y: 0};

    const length = Math.hypot(b.x - a.x, b.y - a.y);

    if (length <= EPSILON) {
        return against;
    }

    // Senkrecht zur Strecke, auf die Seite, von der der Agent kam.
    const normal = {x: -(b.y - a.y) / length, y: (b.x - a.x) / length};

    return dot(against, normal) < 0
        ? {x: -normal.x, y: -normal.y}
        : normal;
}

/** Schiebt einen Punkt im Inneren eines Rechtecks über die nächste Kante hinaus. */
function pushOutOfSolid(
    position: Vector2,
    radius: number,
    solid: {x: number; y: number; width: number; height: number},
): Overlap {
    const right = solid.x + solid.width;
    const bottom = solid.y + solid.height;
    const margin = radius + CONTACT_EPSILON;

    const exits = [
        {
            depth: position.x - solid.x,
            normal: {x: -1, y: 0},
            position: {x: solid.x - margin, y: position.y},
        },
        {
            depth: right - position.x,
            normal: {x: 1, y: 0},
            position: {x: right + margin, y: position.y},
        },
        {
            depth: position.y - solid.y,
            normal: {x: 0, y: -1},
            position: {x: position.x, y: solid.y - margin},
        },
        {
            depth: bottom - position.y,
            normal: {x: 0, y: 1},
            position: {x: position.x, y: bottom + margin},
        },
    ];

    const nearest = exits.reduce((best, exit) =>
        exit.depth < best.depth ? exit : best,
    );

    return {
        position: nearest.position,
        normal: nearest.normal,
        depth: nearest.depth + radius,
    };
}
