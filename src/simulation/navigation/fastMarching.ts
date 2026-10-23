import {MinHeap} from "./MinHeap.ts";

/**
 * Fast-Marching-Verfahren: löst die Eikonal-Gleichung |∇T| = 1 / speed auf
 * einem Raster. T ist die Ankunftszeit einer Front, die von `sources`
 * ausgeht und sich in Zelle i mit `speed[i]` ausbreitet. Zellen mit
 * Geschwindigkeit 0 sind Hindernisse und bleiben `Infinity`.
 *
 * Im Gegensatz zu Dijkstra mit 8 Nachbarn ergibt das nahezu euklidische
 * Distanzen, ohne Vorzugsrichtungen entlang der Rasterachsen.
 */
export function fastMarching(
    speed: Float32Array,
    columns: number,
    rows: number,
    cellSize: number,
    sources: readonly number[],
): Float32Array {
    const arrival = new Float32Array(columns * rows).fill(Infinity);
    const accepted = new Uint8Array(columns * rows);
    const frontier = new MinHeap();

    for (const cell of sources) {
        arrival[cell] = 0;
        frontier.push(cell, 0);
    }

    // Bereits akzeptierte Nachbarwerte; sonst Infinity.
    const settled = (column: number, row: number): number =>
        column >= 0 && column < columns && row >= 0 && row < rows &&
        accepted[row * columns + column]
            ? arrival[row * columns + column]
            : Infinity;

    while (frontier.size > 0) {
        const cell = frontier.pop();

        if (accepted[cell]) {
            continue;
        }

        accepted[cell] = 1;

        const column = cell % columns;
        const row = (cell - column) / columns;

        for (const [dc, dr] of NEIGHBORS) {
            const nc = column + dc;
            const nr = row + dr;

            if (nc < 0 || nc >= columns || nr < 0 || nr >= rows) {
                continue;
            }

            const neighbor = nr * columns + nc;

            if (accepted[neighbor] || speed[neighbor] <= 0) {
                continue;
            }

            const time = solveUpwind(
                Math.min(settled(nc - 1, nr), settled(nc + 1, nr)),
                Math.min(settled(nc, nr - 1), settled(nc, nr + 1)),
                cellSize / speed[neighbor],
            );

            if (time < arrival[neighbor]) {
                arrival[neighbor] = time;
                frontier.push(neighbor, time);
            }
        }
    }

    return arrival;
}

const NEIGHBORS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/**
 * Löst (T - a)² + (T - b)² = step² nach T (a, b: kleinste bekannte Werte
 * auf der x- bzw. y-Achse). Ist nur eine Achse bekannt oder liegen beide
 * zu weit auseinander, reduziert es sich auf T = min(a, b) + step.
 */
function solveUpwind(a: number, b: number, step: number): number {
    const low = Math.min(a, b);
    const high = Math.max(a, b);

    if (!Number.isFinite(low)) {
        return Infinity;
    }

    if (high - low >= step) {
        return low + step;
    }

    return (low + high + Math.sqrt(2 * step * step - (high - low) ** 2)) / 2;
}
