import type {Barrier} from "../simulation/Barrier.ts";
import {distanceToSegment, distanceBetween} from "../simulation/geometry/segments.ts";
import type {Marshal} from "../simulation/Marshal.ts";
import {createPlan, type Plan} from "../simulation/Plan.ts";
import type {Sign} from "../simulation/Sign.ts";
import type {Vector2} from "../simulation/Vector2.ts";
import type {Inventory} from "./Scenario.ts";

/** Wie weit man neben ein Element klicken darf, um es zu treffen (Pixel). */
const PICK_RADIUS = 14;
/** Mindestabstand zwischen zwei Elementen derselben Art (Pixel). */
const MIN_DISTANCE = 20;
/** Überzeugungskraft der Schilder, die der Spieler aufstellt. */
const SIGN_STRENGTH = 0.9;

/** Wie weit man neben ein Gitter klicken darf, um es zu treffen (Pixel). */
const BARRIER_PICK_RADIUS = 8;
/** Kürzeste Länge, die ein neu gezogenes Gitter haben muss (Meter); kürzere werden verworfen. */
const MIN_BARRIER_METERS = 1;

/** Was man platzieren kann. */
export type Tool = "sign" | "marshal" | "barrier";

/** Ein Element des Plans: Art und Index in der jeweiligen Liste. */
export interface Selected {
    readonly kind: Tool;
    readonly index: number;
}

/** Ein Element, das an einer Stelle stünde (für die Vorschau). */
export interface Placement {
    readonly kind: Tool;
    readonly position: Vector2;
    readonly route: number;
}

/**
 * Was ein Zeigerereignis bewirkt hat: nichts, etwas Sichtbares (Auswahl, Ziehen:
 * neu zeichnen) oder eine fertige Änderung des Plans (Simulation neu bauen).
 */
export type Change = "none" | "preview" | "commit";

/** Was der Editor über die Welt wissen muss (die Simulation erfüllt das). */
export interface PlanWorld {
    isWalkable(position: Vector2): boolean;
    routeDistance(route: number, position: Vector2): number;
}

/** Was beim Ziehen eines Gitters bewegt wird. */
type DragPart = "start" | "end" | "whole";

/** Schild und Ordner haben beide Ort und Weg; so lassen sie sich gemeinsam behandeln. */
interface Item {
    readonly position: Vector2;
    readonly route: number;
}

/**
 * Der Plan, den der Spieler gerade baut: Elemente platzieren, auswählen,
 * verschieben, umstellen und entfernen, im Rahmen eines Vorrats. Kennt kein
 * Phaser; die Szene übersetzt Mausereignisse.
 */
export class PlanEditor {
    /** Werkzeug, das ein Klick ins Freie benutzt. */
    tool: Tool = "sign";
    selected: Selected | null = null;
    /** Wurde der Plan seit dem Laden verändert? */
    edited = false;

    readonly inventory: Inventory;
    private readonly routeCount: number;
    private readonly pixelsPerMeter: number;
    private signs: Sign[] = [];
    private marshals: Marshal[] = [];
    private barriers: Barrier[] = [];
    private releaseDelays: readonly number[] = [];
    private dragging: Selected | null = null;
    private dragPart: DragPart = "whole";
    private dragLast: Vector2 = {x: 0, y: 0};
    private moved = false;

    constructor(inventory: Inventory, routeCount: number, pixelsPerMeter: number, plan: Plan = createPlan()) {
        this.inventory = inventory;
        this.routeCount = routeCount;
        this.pixelsPerMeter = pixelsPerMeter;
        this.load(plan);
    }

    get plan(): Plan {
        return createPlan({
            signs: [...this.signs],
            marshals: [...this.marshals],
            barriers: [...this.barriers],
            releaseDelays: this.releaseDelays,
        });
    }

    /** Ersetzt den Plan (etwa durch eine Vorlage). */
    load(plan: Plan): void {
        this.signs = [...plan.signs];
        this.marshals = [...plan.marshals];
        this.barriers = [...plan.barriers];
        this.releaseDelays = plan.releaseDelays;
        this.selected = null;
        this.dragging = null;
        this.edited = false;
    }

    clear(): void {
        this.edited ||= this.signs.length + this.marshals.length + this.barriers.length > 0;
        this.signs = [];
        this.marshals = [];
        this.barriers = [];
        this.selected = null;
    }

    /** Wie viel schon platziert ist: Stück bei Schildern und Ordnern, Meter bei Gittern. */
    used(kind: Tool): number {
        return kind === "barrier"
            ? this.barriers.reduce((sum, barrier) => sum + this.lengthInMeters(barrier), 0)
            : this.itemsOf(kind).length;
    }

    /** Der Vorrat dieser Art (Stück, bei Gittern Meter). */
    total(kind: Tool): number {
        switch (kind) {
            case "sign": return this.inventory.signs;
            case "marshal": return this.inventory.marshals;
            case "barrier": return this.inventory.barrierMeters;
        }
    }

    /** Was von dieser Art noch frei ist (nie negativ). */
    remaining(kind: Tool): number {
        return Math.max(0, this.total(kind) - this.used(kind));
    }

    /** Art und Weg des ausgewählten Elements (Gitter haben keinen Weg), oder `null`. */
    get selectedItem(): {readonly kind: Tool; readonly route?: number} | null {
        if (!this.selected) {
            return null;
        }

        const {kind, index} = this.selected;

        return kind === "barrier" ? {kind} : {kind, route: this.itemsOf(kind)[index].route};
    }

    /** Länge des ausgewählten Gitters in Metern (sonst `null`). */
    get selectedBarrierMeters(): number | null {
        return this.selected?.kind === "barrier"
            ? this.lengthInMeters(this.barriers[this.selected.index])
            : null;
    }

    pointerDown(position: Vector2, world: PlanWorld): Change {
        const before = this.selected;
        const hit = this.itemAt(position);

        this.moved = false;
        this.dragLast = position;

        if (hit) {
            this.selected = hit;
            this.dragging = hit;
            this.dragPart = hit.kind === "barrier" ? this.barrierPart(this.barriers[hit.index], position) : "whole";
            return "preview";
        }

        this.selected = null;

        if (this.canPlace(this.tool, position, world)) {
            this.place(this.tool, position, this.nearestRoute(position, world));
            this.selected = {kind: this.tool, index: this.itemCount(this.tool) - 1};
            this.dragging = this.selected;
            // Ein neues Gitter wird aufgezogen: Der Endpunkt folgt dem Zeiger.
            this.dragPart = "end";
            this.moved = true;
            this.edited = true;
            return "preview";
        }

        return before ? "preview" : "none";
    }

    pointerMove(position: Vector2, world: PlanWorld): Change {
        if (!this.dragging) {
            return "none";
        }

        if (this.dragging.kind === "barrier") {
            return this.dragBarrier(this.dragging.index, position, world);
        }

        if (!world.isWalkable(position)) {
            return "none";
        }

        this.replace(this.dragging, {position: {x: position.x, y: position.y}});
        this.moved = true;
        this.edited = true;
        return "preview";
    }

    pointerUp(): Change {
        const dragged = this.dragging;
        const wasMoved = dragged !== null && this.moved;

        this.dragging = null;

        // Ein zu kurz gezogenes Gitter zählt nicht.
        if (dragged?.kind === "barrier") {
            const barrier = this.barriers[dragged.index];

            if (barrier && this.lengthInMeters(barrier) < MIN_BARRIER_METERS) {
                this.barriers.splice(dragged.index, 1);
                this.selected = null;
                return "preview";
            }
        }

        return wasMoved ? "commit" : "none";
    }

    /** Stellt das ausgewählte Schild oder den Ordner auf einen anderen Weg. */
    setRoute(route: number): Change {
        if (!this.selected || this.selected.kind === "barrier" || route < 0 || route >= this.routeCount) {
            return "none";
        }

        this.replace(this.selected, {route});
        this.edited = true;
        return "commit";
    }

    removeSelected(): Change {
        if (!this.selected) {
            return "none";
        }

        if (this.selected.kind === "barrier") {
            this.barriers.splice(this.selected.index, 1);
        } else {
            this.itemsOf(this.selected.kind).splice(this.selected.index, 1);
        }

        this.selected = null;
        this.edited = true;
        return "commit";
    }

    /** Entfernt das Element unter dem Zeiger. */
    removeAt(position: Vector2): Change {
        const hit = this.itemAt(position);

        if (!hit) {
            return "none";
        }

        this.selected = hit;
        return this.removeSelected();
    }

    /** Das Schild oder der Ordner, den ein Klick hier aufstellen würde (für die Vorschau), sonst `null`. */
    ghost(position: Vector2, world: PlanWorld): Placement | null {
        if (this.tool === "barrier" || this.itemAt(position) || !this.canPlace(this.tool, position, world)) {
            return null;
        }

        return {kind: this.tool, position, route: this.nearestRoute(position, world)};
    }

    /** Dürfte an dieser Stelle ein neues Element dieser Art beginnen? */
    canPlace(kind: Tool, position: Vector2, world: PlanWorld): boolean {
        if (this.remaining(kind) <= 0 || !world.isWalkable(position)) {
            return false;
        }

        if (kind === "barrier") {
            return true;
        }

        return (
            this.routeCount > 0 &&
            this.itemsOf(kind).every((item) => distance(item.position, position) >= MIN_DISTANCE)
        );
    }

    /** Schilder oder Ordner (Gitter haben keinen Weg und sind eine eigene Liste). */
    private itemsOf(kind: Tool): Item[] {
        return kind === "sign" ? this.signs : kind === "marshal" ? this.marshals : [];
    }

    private itemCount(kind: Tool): number {
        return kind === "barrier" ? this.barriers.length : this.itemsOf(kind).length;
    }

    private place(kind: Tool, position: Vector2, route: number): void {
        const at = {x: position.x, y: position.y};

        if (kind === "sign") {
            this.signs.push({position: at, route, strength: SIGN_STRENGTH});
        } else if (kind === "marshal") {
            this.marshals.push({position: at, route});
        } else {
            this.barriers.push({start: at, end: at});
        }
    }

    /** Ändert Ort oder Weg eines Schildes oder Ordners; alles andere (etwa die Stärke) bleibt. */
    private replace(selected: Selected, patch: Partial<Item>): void {
        const items = this.itemsOf(selected.kind);

        items[selected.index] = {...items[selected.index], ...patch};
    }

    // --- Gitter ---------------------------------------------------------------

    private lengthInMeters(barrier: Barrier): number {
        return distanceBetween(barrier.start, barrier.end) / this.pixelsPerMeter;
    }

    /** Welchen Teil eines Gitters greift der Klick: einen Endpunkt oder die Mitte? */
    private barrierPart(barrier: Barrier, position: Vector2): DragPart {
        if (distance(barrier.start, position) <= PICK_RADIUS) return "start";
        if (distance(barrier.end, position) <= PICK_RADIUS) return "end";
        return "whole";
    }

    /** Zieht an einem Gitter: ein Endpunkt folgt dem Zeiger (Länge begrenzt durch den Vorrat), oder das ganze Gitter verschiebt sich. */
    private dragBarrier(index: number, position: Vector2, world: PlanWorld): Change {
        const barrier = this.barriers[index];

        if (this.dragPart === "whole") {
            const dx = position.x - this.dragLast.x;
            const dy = position.y - this.dragLast.y;
            const moved = {
                start: {x: barrier.start.x + dx, y: barrier.start.y + dy},
                end: {x: barrier.end.x + dx, y: barrier.end.y + dy},
            };

            if (!world.isWalkable(moved.start) || !world.isWalkable(moved.end)) {
                return "none";
            }

            this.barriers[index] = moved;
            this.dragLast = position;
        } else {
            const fixed = this.dragPart === "end" ? barrier.start : barrier.end;
            const others = this.used("barrier") - this.lengthInMeters(barrier);
            const maxPixels = Math.max(0, this.total("barrier") - others) * this.pixelsPerMeter;
            const target = world.isWalkable(position) ? limitLength(fixed, position, maxPixels) : null;

            if (!target) {
                return "none";
            }

            this.barriers[index] =
                this.dragPart === "end" ? {start: fixed, end: target} : {start: target, end: fixed};
        }

        this.moved = true;
        this.edited = true;
        return "preview";
    }

    // --- Suchen ---------------------------------------------------------------

    /** Weg, auf den ein neues Element an dieser Stelle zeigen würde: der nächstgelegene. */
    private nearestRoute(position: Vector2, world: PlanWorld): number {
        let best = 0;

        for (let route = 1; route < this.routeCount; route++) {
            if (world.routeDistance(route, position) < world.routeDistance(best, position)) {
                best = route;
            }
        }

        return best;
    }

    /** Das Element unter `position` (Ordner vor Schildern vor Gittern; jeweils das nächste). */
    private itemAt(position: Vector2): Selected | null {
        let best: Selected | null = null;
        let bestDistance = PICK_RADIUS;

        for (const kind of ["marshal", "sign"] as const) {
            this.itemsOf(kind).forEach((item, index) => {
                const d = distance(item.position, position);

                if (d <= bestDistance) {
                    best = {kind, index};
                    bestDistance = d;
                }
            });
        }

        if (best) {
            return best;
        }

        bestDistance = BARRIER_PICK_RADIUS;
        this.barriers.forEach((barrier, index) => {
            const d = distanceToSegment(position, barrier.start, barrier.end);

            if (d <= bestDistance) {
                best = {kind: "barrier", index};
                bestDistance = d;
            }
        });

        return best;
    }
}

function distance(a: Vector2, b: Vector2): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Der Punkt `to`, nötigenfalls auf der Strecke von `from` aus gekürzt auf `maxLength`. */
function limitLength(from: Vector2, to: Vector2, maxLength: number): Vector2 {
    const length = distance(from, to);

    if (length <= maxLength) {
        return {x: to.x, y: to.y};
    }

    return {x: from.x + ((to.x - from.x) * maxLength) / length, y: from.y + ((to.y - from.y) * maxLength) / length};
}
