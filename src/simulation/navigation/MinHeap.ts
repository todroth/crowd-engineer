/** Binärer Min-Heap über Knoten-IDs, sortiert nach einem externen Schlüssel. */
export class MinHeap {
    private readonly items: number[] = [];
    private readonly keyOf: (id: number) => number;

    constructor(keyOf: (id: number) => number) {
        this.keyOf = keyOf;
    }

    get size(): number {
        return this.items.length;
    }

    push(id: number): void {
        this.items.push(id);
        this.siftUp(this.items.length - 1);
    }

    pop(): number {
        const top = this.items[0];
        const last = this.items.pop()!;

        if (this.items.length > 0) {
            this.items[0] = last;
            this.siftDown(0);
        }

        return top;
    }

    private siftUp(index: number): void {
        while (index > 0) {
            const parent = (index - 1) >> 1;

            if (this.keyOf(this.items[parent]) <= this.keyOf(this.items[index])) {
                return;
            }

            this.swap(parent, index);
            index = parent;
        }
    }

    private siftDown(index: number): void {
        for (; ;) {
            let smallest = index;

            for (const child of [2 * index + 1, 2 * index + 2]) {
                if (
                    child < this.items.length &&
                    this.keyOf(this.items[child]) < this.keyOf(this.items[smallest])
                ) {
                    smallest = child;
                }
            }

            if (smallest === index) {
                return;
            }

            this.swap(smallest, index);
            index = smallest;
        }
    }

    private swap(i: number, j: number): void {
        [this.items[i], this.items[j]] = [this.items[j], this.items[i]];
    }
}
