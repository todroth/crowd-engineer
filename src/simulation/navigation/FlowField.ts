import type {Vector2} from "../Vector2.ts";
import type {Collider} from "../geometry/Collider.ts";
import {type Rect, rectContains} from "../geometry/Rect.ts";
import {pointClearance} from "../geometry/clearance.ts";
import {fastMarching} from "./fastMarching.ts";

/** Wie stark der Randbereich vor Hindernissen die Ausbreitung bremst (0 = gar nicht). */
const WALL_PENALTY = 2;
const MIN_GRADIENT = 1e-6;
/** Faktor, um den die Ausbreitung in Zellen mit beweglichen Hindernissen verlangsamt wird. */
const OBSTRUCTION_SLOWDOWN = 0.1;

export interface FlowFieldOptions {
    /** Seitenlänge einer Rasterzelle (Pixel). */
    readonly cellSize: number;
    /** Agentenradius: Zellen näher an einem Hindernis sind gesperrt. */
    readonly agentRadius: number;
    /** Bis zu dieser Entfernung (über den Agentenradius hinaus) werden Wege vor Hindernissen gemieden. */
    readonly wallAvoidanceDistance: number;
}

/**
 * Richtungsfeld zu einem Zielbereich: Jede Zelle kennt die Richtung des
 * kürzesten Wegs ins Ziel. Beliebig viele Agenten teilen sich ein Feld;
 * die Abfrage kostet pro Agent nur eine bilineare Interpolation.
 *
 * Wege werden nicht durch Zellen nahe Hindernissen geführt und meiden
 * Wände schon vorher leicht, damit Ströme nicht an Ecken kleben.
 */
export class FlowField {
    private readonly cellSize: number;
    private readonly origin: Vector2;
    private readonly columns: number;
    private readonly rows: number;

    /** Ausbreitungsgeschwindigkeit nur aufgrund der Hindernisse. */
    private readonly baseSpeed: Float32Array;
    private readonly goalCells: number[] = [];
    /** Ankunftszeit (≈ Weglänge, in Wandnähe länger) von jeder Zelle bis ins Ziel. */
    private arrival: Float32Array;

    private readonly directionX: Float32Array;
    private readonly directionY: Float32Array;
    /** Hat die Zelle eine gültige Richtung (erreichbar, kein Hindernis)? */
    private readonly hasDirection: Uint8Array;

    /**
     * @param bounds Bereich, den das Raster abdeckt (muss die Ziele enthalten).
     * @param goalAreas Zielbereiche; das Feld führt zum jeweils nächsten.
     */
    constructor(
        colliders: readonly Collider[],
        bounds: Rect,
        goalAreas: readonly Rect[],
        options: FlowFieldOptions,
    ) {
        const {cellSize} = options;

        this.cellSize = cellSize;
        this.origin = {x: bounds.x, y: bounds.y};
        this.columns = Math.ceil(bounds.width / cellSize);
        this.rows = Math.ceil(bounds.height / cellSize);

        const cellCount = this.columns * this.rows;

        this.baseSpeed = this.createSpeedMap(colliders, options);

        for (let cell = 0; cell < cellCount; cell++) {
            const center = this.cellCenter(cell);

            if (
                this.baseSpeed[cell] > 0 &&
                goalAreas.some((goal) => rectContains(goal, center))
            ) {
                this.goalCells.push(cell);
            }
        }

        this.directionX = new Float32Array(cellCount);
        this.directionY = new Float32Array(cellCount);
        this.hasDirection = new Uint8Array(cellCount);
        this.arrival = new Float32Array(cellCount);

        this.rebuild(this.baseSpeed);
    }

    /**
     * Markiert bewegliche Hindernisse (etwa am Boden liegende Menschen) um die
     * Punkte `centers` mit dem Radius `radius`: Wege führen dann bevorzugt
     * daran vorbei. Sie sind nicht gesperrt, sondern sehr teuer, damit es auch
     * dann einen Weg gibt, wenn alles zugestellt ist. Ersetzt frühere Markierungen.
     */
    setObstructions(centers: readonly Vector2[], radius: number): void {
        const speed = this.baseSpeed.slice();
        const reach = Math.ceil(radius / this.cellSize);

        for (const center of centers) {
            const column = Math.floor((center.x - this.origin.x) / this.cellSize);
            const row = Math.floor((center.y - this.origin.y) / this.cellSize);

            for (let r = Math.max(0, row - reach); r <= Math.min(this.rows - 1, row + reach); r++) {
                for (let c = Math.max(0, column - reach); c <= Math.min(this.columns - 1, column + reach); c++) {
                    const cell = r * this.columns + c;
                    const cellCenter = this.cellCenter(cell);

                    if (Math.hypot(cellCenter.x - center.x, cellCenter.y - center.y) <= radius) {
                        speed[cell] *= OBSTRUCTION_SLOWDOWN;
                    }
                }
            }
        }

        this.rebuild(speed);
    }

    private rebuild(speed: Float32Array): void {
        this.arrival = fastMarching(speed, this.columns, this.rows, this.cellSize, this.goalCells);
        this.hasDirection.fill(0);
        this.computeDirections(this.arrival);
    }

    /**
     * Restlicher Weg von (x, y) bis ins Ziel (bilinear interpoliert), oder
     * `Infinity`, wenn der Punkt das Ziel nicht erreichen kann.
     */
    distanceAt(x: number, y: number): number {
        const u = (x - this.origin.x) / this.cellSize - 0.5;
        const v = (y - this.origin.y) / this.cellSize - 0.5;
        const column = Math.floor(u);
        const row = Math.floor(v);

        let sum = 0;
        let sumWeight = 0;

        for (let dr = 0; dr <= 1; dr++) {
            for (let dc = 0; dc <= 1; dc++) {
                const value = this.arrival[
                    clamp(row + dr, 0, this.rows - 1) * this.columns +
                    clamp(column + dc, 0, this.columns - 1)
                    ];

                // Gesperrte Ecken tragen nichts bei; die übrigen werden neu gewichtet.
                if (!Number.isFinite(value)) {
                    continue;
                }

                const weight =
                    (dc === 0 ? 1 - (u - column) : u - column) *
                    (dr === 0 ? 1 - (v - row) : v - row);

                sum += value * weight;
                sumWeight += weight;
            }
        }

        return sumWeight > 0 ? sum / sumWeight : Infinity;
    }

    /**
     * Schreibt die Laufrichtung (Einheitsvektor) an Position (x, y) nach
     * `out`. Gibt `false` zurück, wenn dort keine Richtung bekannt ist
     * (etwa vollständig von gesperrten Zellen umgeben).
     */
    sampleDirection(x: number, y: number, out: Vector2): boolean {
        // Position relativ zu den Zellmittelpunkten.
        const u = (x - this.origin.x) / this.cellSize - 0.5;
        const v = (y - this.origin.y) / this.cellSize - 0.5;
        const column = Math.floor(u);
        const row = Math.floor(v);
        const fractionX = u - column;
        const fractionY = v - row;

        let sumX = 0;
        let sumY = 0;
        let sumWeight = 0;

        for (let dr = 0; dr <= 1; dr++) {
            for (let dc = 0; dc <= 1; dc++) {
                const c = clamp(column + dc, 0, this.columns - 1);
                const r = clamp(row + dr, 0, this.rows - 1);
                const cell = r * this.columns + c;

                if (!this.hasDirection[cell]) {
                    continue;
                }

                // Gesperrte Ecken tragen nichts bei; die übrigen werden neu gewichtet.
                const weight =
                    (dc === 0 ? 1 - fractionX : fractionX) *
                    (dr === 0 ? 1 - fractionY : fractionY);

                sumX += this.directionX[cell] * weight;
                sumY += this.directionY[cell] * weight;
                sumWeight += weight;
            }
        }

        const length = Math.hypot(sumX, sumY);

        if (sumWeight === 0 || length < MIN_GRADIENT) {
            return false;
        }

        out.x = sumX / length;
        out.y = sumY / length;

        return true;
    }

    /** Für Debug-Anzeigen: besucht jede Zelle mit Richtung. */
    forEachDirection(
        visit: (x: number, y: number, directionX: number, directionY: number) => void,
    ): void {
        for (let cell = 0; cell < this.hasDirection.length; cell++) {
            if (this.hasDirection[cell]) {
                const center = this.cellCenter(cell);

                visit(center.x, center.y, this.directionX[cell], this.directionY[cell]);
            }
        }
    }

    /** 0 in gesperrten Zellen, sonst 1, abgesenkt in Wandnähe. */
    private createSpeedMap(
        colliders: readonly Collider[],
        options: FlowFieldOptions,
    ): Float32Array {
        const speed = new Float32Array(this.columns * this.rows);

        for (let cell = 0; cell < speed.length; cell++) {
            const free =
                pointClearance(this.cellCenter(cell), colliders) - options.agentRadius;

            if (free < 0) {
                continue;
            }

            const nearWall = Math.max(0, 1 - free / options.wallAvoidanceDistance);

            speed[cell] = 1 / (1 + WALL_PENALTY * nearWall);
        }

        return speed;
    }

    /** Richtung = negativer Gradient der Ankunftszeit (einseitige Differenzen an gesperrten Nachbarn). */
    private computeDirections(arrival: Float32Array): void {
        const known = (column: number, row: number): number =>
            column >= 0 && column < this.columns && row >= 0 && row < this.rows
                ? arrival[row * this.columns + column]
                : Infinity;

        const slope = (before: number, here: number, after: number): number => {
            if (Number.isFinite(before) && Number.isFinite(after)) {
                return (after - before) / 2;
            }
            if (Number.isFinite(after)) {
                return after - here;
            }
            if (Number.isFinite(before)) {
                return here - before;
            }
            return 0;
        };

        for (let row = 0; row < this.rows; row++) {
            for (let column = 0; column < this.columns; column++) {
                const cell = row * this.columns + column;
                const here = arrival[cell];

                if (!Number.isFinite(here)) {
                    continue;
                }

                const gradientX = slope(known(column - 1, row), here, known(column + 1, row));
                const gradientY = slope(known(column, row - 1), here, known(column, row + 1));
                const length = Math.hypot(gradientX, gradientY);

                if (length < MIN_GRADIENT) {
                    continue;
                }

                this.directionX[cell] = -gradientX / length;
                this.directionY[cell] = -gradientY / length;
                this.hasDirection[cell] = 1;
            }
        }
    }

    private cellCenter(cell: number): Vector2 {
        const column = cell % this.columns;
        const row = (cell - column) / this.columns;

        return {
            x: this.origin.x + (column + 0.5) * this.cellSize,
            y: this.origin.y + (row + 0.5) * this.cellSize,
        };
    }
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}
