/**
 * Gleichmäßiges Raster über der Spielwelt für Nachbarschaftssuchen.
 *
 * Gespeichert werden Indizes (0..capacity-1) als verkettete Listen in zwei
 * Int32Arrays, damit pro Frame nichts allokiert wird. Positionen außerhalb
 * der Welt landen in den Randzellen; da das Klemmen monoton ist, findet
 * eine Abfrage trotzdem alle Punkte im Radius.
 */
export class SpatialGrid {
    private readonly cellSize: number;
    private readonly columns: number;
    private readonly rows: number;

    private readonly cellHead: Int32Array;
    private readonly nextInCell: Int32Array;

    constructor(
        worldWidth: number,
        worldHeight: number,
        cellSize: number,
        capacity: number,
    ) {
        if (!Number.isFinite(cellSize) || cellSize <= 0) {
            throw new Error("Cell size must be a positive number");
        }

        this.cellSize = cellSize;
        this.columns = Math.max(1, Math.ceil(worldWidth / cellSize));
        this.rows = Math.max(1, Math.ceil(worldHeight / cellSize));

        this.cellHead = new Int32Array(this.columns * this.rows).fill(-1);
        this.nextInCell = new Int32Array(capacity).fill(-1);
    }

    clear(): void {
        this.cellHead.fill(-1);
    }

    insert(index: number, x: number, y: number): void {
        const cell = this.cellY(y) * this.columns + this.cellX(x);

        this.nextInCell[index] = this.cellHead[cell];
        this.cellHead[cell] = index;
    }

    /**
     * Schreibt alle Indizes aus den Zellen, die den Kreis (x, y, radius)
     * berühren, in `out`. Das sind Kandidaten; den genauen Abstand muss
     * der Aufrufer prüfen.
     */
    query(x: number, y: number, radius: number, out: number[]): void {
        out.length = 0;

        const minX = this.cellX(x - radius);
        const maxX = this.cellX(x + radius);
        const minY = this.cellY(y - radius);
        const maxY = this.cellY(y + radius);

        for (let cellY = minY; cellY <= maxY; cellY++) {
            for (let cellX = minX; cellX <= maxX; cellX++) {
                let index = this.cellHead[cellY * this.columns + cellX];

                while (index !== -1) {
                    out.push(index);
                    index = this.nextInCell[index];
                }
            }
        }
    }

    private cellX(x: number): number {
        return clamp(Math.floor(x / this.cellSize), 0, this.columns - 1);
    }

    private cellY(y: number): number {
        return clamp(Math.floor(y / this.cellSize), 0, this.rows - 1);
    }
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}
