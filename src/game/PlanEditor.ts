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

/** Was man platzieren kann. */
export type Tool = "sign" | "marshal";

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
    private signs: Sign[] = [];
    private marshals: Marshal[] = [];
    private releaseDelays: readonly number[] = [];
    private dragging: Selected | null = null;
    private moved = false;

    constructor(inventory: Inventory, routeCount: number, plan: Plan = createPlan()) {
        this.inventory = inventory;
        this.routeCount = routeCount;
        this.load(plan);
    }

    get plan(): Plan {
        return createPlan({
            signs: [...this.signs],
            marshals: [...this.marshals],
            releaseDelays: this.releaseDelays,
        });
    }

    /** Ersetzt den Plan (etwa durch eine Vorlage). */
    load(plan: Plan): void {
        this.signs = [...plan.signs];
        this.marshals = [...plan.marshals];
        this.releaseDelays = plan.releaseDelays;
        this.selected = null;
        this.dragging = null;
        this.edited = false;
    }

    clear(): void {
        this.edited ||= this.signs.length + this.marshals.length > 0;
        this.signs = [];
        this.marshals = [];
        this.selected = null;
    }

    /** Wie viele Elemente dieser Art schon platziert sind. */
    used(kind: Tool): number {
        return this.itemsOf(kind).length;
    }

    total(kind: Tool): number {
        return kind === "sign" ? this.inventory.signs : this.inventory.marshals;
    }

    /** Wie viele Elemente dieser Art noch frei sind (nie negativ). */
    remaining(kind: Tool): number {
        return Math.max(0, this.total(kind) - this.used(kind));
    }

    /** Art und Weg des ausgewählten Elements (oder `null`). */
    get selectedItem(): {readonly kind: Tool; readonly route: number} | null {
        return this.selected
            ? {kind: this.selected.kind, route: this.itemsOf(this.selected.kind)[this.selected.index].route}
            : null;
    }

    pointerDown(position: Vector2, world: PlanWorld): Change {
        const before = this.selected;
        const hit = this.itemAt(position);

        this.moved = false;

        if (hit) {
            this.selected = hit;
            this.dragging = hit;
            return "preview";
        }

        this.selected = null;

        if (this.canPlace(this.tool, position, world)) {
            this.place(this.tool, position, this.nearestRoute(position, world));
            this.selected = {kind: this.tool, index: this.used(this.tool) - 1};
            this.dragging = this.selected;
            this.moved = true;
            this.edited = true;
            return "preview";
        }

        return before ? "preview" : "none";
    }

    pointerMove(position: Vector2, world: PlanWorld): Change {
        if (!this.dragging || !world.isWalkable(position)) {
            return "none";
        }

        this.replace(this.dragging, {position: {x: position.x, y: position.y}});
        this.moved = true;
        this.edited = true;
        return "preview";
    }

    pointerUp(): Change {
        const wasMoved = this.dragging !== null && this.moved;

        this.dragging = null;
        return wasMoved ? "commit" : "none";
    }

    /** Stellt das ausgewählte Element auf einen anderen Weg. */
    setRoute(route: number): Change {
        if (!this.selected || route < 0 || route >= this.routeCount) {
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

        this.itemsOf(this.selected.kind).splice(this.selected.index, 1);
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

    /** Das Element des gewählten Werkzeugs, das ein Klick hier aufstellen würde (für die Vorschau), sonst `null`. */
    ghost(position: Vector2, world: PlanWorld): Placement | null {
        if (this.itemAt(position) || !this.canPlace(this.tool, position, world)) {
            return null;
        }

        return {kind: this.tool, position, route: this.nearestRoute(position, world)};
    }

    /** Dürfte an dieser Stelle ein neues Element dieser Art stehen? */
    canPlace(kind: Tool, position: Vector2, world: PlanWorld): boolean {
        return (
            this.remaining(kind) > 0 &&
            this.routeCount > 0 &&
            world.isWalkable(position) &&
            this.itemsOf(kind).every((item) => distance(item.position, position) >= MIN_DISTANCE)
        );
    }

    /** Die Liste der Elemente einer Art (veränderbar). */
    private itemsOf(kind: Tool): Item[] {
        return kind === "sign" ? this.signs : this.marshals;
    }

    private place(kind: Tool, position: Vector2, route: number): void {
        const at = {x: position.x, y: position.y};

        if (kind === "sign") {
            this.signs.push({position: at, route, strength: SIGN_STRENGTH});
        } else {
            this.marshals.push({position: at, route});
        }
    }

    /** Ändert Ort oder Weg eines Elements; alles andere (etwa die Stärke) bleibt. */
    private replace(selected: Selected, patch: Partial<Item>): void {
        const items = this.itemsOf(selected.kind);

        items[selected.index] = {...items[selected.index], ...patch};
    }

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

    /** Das Element unter `position` (das nächste im Pickradius; Ordner vor Schildern). */
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

        return best;
    }
}

function distance(a: Vector2, b: Vector2): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
}
