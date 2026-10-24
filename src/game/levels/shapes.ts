import type {Obstacle} from "../../simulation/Obstacle.ts";

/** Dicke aller Wände (Pixel). */
const WALL_THICKNESS = 12;

export function wall(x1: number, y1: number, x2: number, y2: number): Obstacle {
    return {
        type: "wall",
        start: {x: x1, y: y1},
        end: {x: x2, y: y2},
        thickness: WALL_THICKNESS,
    };
}

/** Geschlossener Linienzug aus Wänden durch die Punkte (das Ende führt zum Anfang zurück). */
export function closedWalls(...points: [number, number][]): Obstacle[] {
    return points.map(([x, y], i) => {
        const [nextX, nextY] = points[(i + 1) % points.length];

        return wall(x, y, nextX, nextY);
    });
}

export function circle(x: number, y: number, radius: number): Obstacle {
    return {type: "circle", center: {x, y}, radius};
}

export function rectangle(x: number, y: number, width: number, height: number): Obstacle {
    return {type: "rectangle", position: {x, y}, width, height};
}
