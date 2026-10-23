export class SpatialGrid<T> {
    private readonly cellSize: number;
    private readonly cells = new Map<string, T[]>();

    constructor(cellSize: number) {
        if (!Number.isFinite(cellSize) || cellSize <= 0) {
            throw new Error("Cell size must be a positive number");
        }
        this.cellSize = cellSize;
    }

    clear(): void {
        this.cells.clear();
    }

    insert(item: T, x: number, y: number): void {
        const cellX = this.toCell(x);
        const cellY = this.toCell(y);
        const key = this.cellKey(cellX, cellY);

        const cell = this.cells.get(key);

        if (cell) {
            cell.push(item);
        } else {
            this.cells.set(key, [item]);
        }
    }

    queryCandidates(x: number, y: number, radius: number): T[] {
        if (radius < 0) {
            throw new Error("Radius must not be negative");
        }

        const minCellX = this.toCell(x - radius);
        const maxCellX = this.toCell(x + radius);
        const minCellY = this.toCell(y - radius);
        const maxCellY = this.toCell(y + radius);

        const candidates: T[] = [];

        for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
            for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
                const cell = this.cells.get(this.cellKey(cellX, cellY));

                if (cell) {
                    candidates.push(...cell);
                }
            }
        }

        return candidates;
    }

    private toCell(coordinate: number): number {
        return Math.floor(coordinate / this.cellSize);
    }

    private cellKey(cellX: number, cellY: number): string {
        return `${cellX},${cellY}`;
    }
}