/**
 * Binärer Min-Heap über Knoten-IDs. Der Schlüssel wird beim Einfügen
 * festgehalten; veraltete Einträge einer ID werden vom Aufrufer beim
 * Entnehmen übersprungen ("lazy deletion").
 */
export class MinHeap {
    private readonly ids: number[] = [];
    private readonly keys: number[] = [];

    get size(): number {
        return this.ids.length;
    }

    push(id: number, key: number): void {
        this.ids.push(id);
        this.keys.push(key);
        this.siftUp(this.ids.length - 1);
    }

    /** Entnimmt die ID mit dem kleinsten Schlüssel. */
    pop(): number {
        const top = this.ids[0];
        const lastId = this.ids.pop()!;
        const lastKey = this.keys.pop()!;

        if (this.ids.length > 0) {
            this.ids[0] = lastId;
            this.keys[0] = lastKey;
            this.siftDown(0);
        }

        return top;
    }

    private siftUp(index: number): void {
        while (index > 0) {
            const parent = (index - 1) >> 1;

            if (this.keys[parent] <= this.keys[index]) {
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
                if (child < this.ids.length && this.keys[child] < this.keys[smallest]) {
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
        [this.ids[i], this.ids[j]] = [this.ids[j], this.ids[i]];
        [this.keys[i], this.keys[j]] = [this.keys[j], this.keys[i]];
    }
}
