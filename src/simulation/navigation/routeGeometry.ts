import type {Obstacle} from "../Obstacle.ts";
import type {Vector2} from "../Vector2.ts";

const EPSILON = 1e-7;

export function distanceBetween(a: Vector2, b: Vector2): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function pointSegmentDistanceSquared(
    point: Vector2,
    start: Vector2,
    end: Vector2,
): number {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;

    const t = lengthSquared <= EPSILON
        ? 0
        : Math.max(
            0,
            Math.min(
                1,
                ((point.x - start.x) * dx +
                    (point.y - start.y) * dy) / lengthSquared,
            ),
        );

    const x = start.x + t * dx;
    const y = start.y + t * dy;

    return (point.x - x) ** 2 + (point.y - y) ** 2;
}

function cross(a: Vector2, b: Vector2, c: Vector2): number {
    return (b.x - a.x) * (c.y - a.y) -
        (b.y - a.y) * (c.x - a.x);
}

function onSegment(a: Vector2, b: Vector2, p: Vector2): boolean {
    return p.x >= Math.min(a.x, b.x) - EPSILON &&
        p.x <= Math.max(a.x, b.x) + EPSILON &&
        p.y >= Math.min(a.y, b.y) - EPSILON &&
        p.y <= Math.max(a.y, b.y) + EPSILON;
}

function segmentsIntersect(
    a: Vector2,
    b: Vector2,
    c: Vector2,
    d: Vector2,
): boolean {
    const abC = cross(a, b, c);
    const abD = cross(a, b, d);
    const cdA = cross(c, d, a);
    const cdB = cross(c, d, b);

    if (
        ((abC > EPSILON && abD < -EPSILON) ||
            (abC < -EPSILON && abD > EPSILON)) &&
        ((cdA > EPSILON && cdB < -EPSILON) ||
            (cdA < -EPSILON && cdB > EPSILON))
    ) {
        return true;
    }

    if (Math.abs(abC) <= EPSILON && onSegment(a, b, c)) return true;
    if (Math.abs(abD) <= EPSILON && onSegment(a, b, d)) return true;
    if (Math.abs(cdA) <= EPSILON && onSegment(c, d, a)) return true;
    if (Math.abs(cdB) <= EPSILON && onSegment(c, d, b)) return true;

    return false;
}

function segmentSegmentDistanceSquared(
    a: Vector2,
    b: Vector2,
    c: Vector2,
    d: Vector2,
): number {
    if (segmentsIntersect(a, b, c, d)) {
        return 0;
    }

    return Math.min(
        pointSegmentDistanceSquared(a, c, d),
        pointSegmentDistanceSquared(b, c, d),
        pointSegmentDistanceSquared(c, a, b),
        pointSegmentDistanceSquared(d, a, b),
    );
}

function segmentCrossesRectangleInterior(
    start: Vector2,
    end: Vector2,
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
): boolean {
    let enter = 0;
    let exit = 1;

    const axes = [
        {origin: start.x, delta: end.x - start.x, min: minX, max: maxX},
        {origin: start.y, delta: end.y - start.y, min: minY, max: maxY},
    ];

    for (const axis of axes) {
        if (Math.abs(axis.delta) <= EPSILON) {
            // Eine Strecke entlang der Außenkante ist kein Durchdringen.
            if (
                axis.origin <= axis.min + EPSILON ||
                axis.origin >= axis.max - EPSILON
            ) {
                return false;
            }

            continue;
        }

        const t1 = (axis.min - axis.origin) / axis.delta;
        const t2 = (axis.max - axis.origin) / axis.delta;

        enter = Math.max(enter, Math.min(t1, t2));
        exit = Math.min(exit, Math.max(t1, t2));

        if (enter >= exit - EPSILON) {
            return false;
        }
    }

    return Math.max(enter, 0) < Math.min(exit, 1) - EPSILON;
}

export function isPointBlocked(
    point: Vector2,
    obstacles: readonly Obstacle[],
    agentRadius: number,
    clearance: number,
): boolean {
    for (const obstacle of obstacles) {
        switch (obstacle.type) {
            case "circle": {
                const required = obstacle.radius + agentRadius + clearance;
                const dx = point.x - obstacle.center.x;
                const dy = point.y - obstacle.center.y;

                if (dx * dx + dy * dy < required * required - EPSILON) {
                    return true;
                }
                break;
            }

            case "rectangle": {
                const required = agentRadius + clearance;
                const minX = obstacle.position.x - required;
                const maxX = obstacle.position.x + obstacle.width + required;
                const minY = obstacle.position.y - required;
                const maxY = obstacle.position.y + obstacle.height + required;

                if (
                    point.x > minX + EPSILON &&
                    point.x < maxX - EPSILON &&
                    point.y > minY + EPSILON &&
                    point.y < maxY - EPSILON
                ) {
                    return true;
                }
                break;
            }

            case "wall": {
                const required =
                    obstacle.thickness / 2 + agentRadius + clearance;

                if (
                    pointSegmentDistanceSquared(
                        point,
                        obstacle.start,
                        obstacle.end,
                    ) < required * required - EPSILON
                ) {
                    return true;
                }
                break;
            }
        }
    }

    return false;
}

export function isRouteSegmentClear(
    start: Vector2,
    end: Vector2,
    obstacles: readonly Obstacle[],
    agentRadius: number,
    clearance: number,
): boolean {
    for (const obstacle of obstacles) {
        switch (obstacle.type) {
            case "circle": {
                const required = obstacle.radius + agentRadius + clearance;

                if (
                    pointSegmentDistanceSquared(
                        obstacle.center,
                        start,
                        end,
                    ) < required * required - EPSILON
                ) {
                    return false;
                }
                break;
            }

            case "rectangle": {
                const required = agentRadius + clearance;

                if (
                    segmentCrossesRectangleInterior(
                        start,
                        end,
                        obstacle.position.x - required,
                        obstacle.position.y - required,
                        obstacle.position.x + obstacle.width + required,
                        obstacle.position.y + obstacle.height + required,
                    )
                ) {
                    return false;
                }
                break;
            }

            case "wall": {
                const required =
                    obstacle.thickness / 2 + agentRadius + clearance;

                if (
                    segmentSegmentDistanceSquared(
                        start,
                        end,
                        obstacle.start,
                        obstacle.end,
                    ) < required * required - EPSILON
                ) {
                    return false;
                }
                break;
            }
        }
    }

    return true;
}
