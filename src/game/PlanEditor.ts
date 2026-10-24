import {createPlan, type Plan} from "../simulation/Plan.ts";
import type {Sign} from "../simulation/Sign.ts";
import type {Vector2} from "../simulation/Vector2.ts";
import type {Inventory} from "./Scenario.ts";

/** Wie weit man neben ein Element klicken darf, um es zu treffen (Pixel). */
const PICK_RADIUS = 14;
/** Mindestabstand zwischen zwei Schildern (Pixel). */
const MIN_SIGN_DISTANCE = 20;
/** Überzeugungskraft der Schilder, die der Spieler aufstellt. */
const SIGN_STRENGTH = 0.9;

/** Was man platzieren kann. */
export type Tool = "sign";

/** Ein Element des Plans: Art und Index in der jeweiligen Liste. */
export interface Selected {
    readonly kind: Tool;
    readonly index: number;
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

    private signs: Sign[] = [];
    private releaseDelays: readonly number[] = [];
    private dragging: Selected | null = null;
    private moved = false;

    readonly inventory: Inventory;
    private readonly routeCount: number;

    constructor(inventory: Inventory, routeCount: number, plan: Plan = createPlan()) {
        this.inventory = inventory;
        this.routeCount = routeCount;
        this.load(plan);
    }

    get plan(): Plan {
        return createPlan({signs: [...this.signs], releaseDelays: this.releaseDelays});
    }

    /** Ersetzt den Plan (etwa durch eine Vorlage). */
    load(plan: Plan): void {
        this.signs = [...plan.signs];
        this.releaseDelays = plan.releaseDelays;
        this.selected = null;
        this.dragging = null;
        this.edited = false;
    }

    clear(): void {
        this.edited ||= this.signs.length > 0;
        this.signs = [];
        this.selected = null;
    }

    /** Wie viele Elemente dieser Art schon platziert sind. */
    used(kind: Tool): number {
        return kind === "sign" ? this.signs.length : 0;
    }

    /** Wie viele Elemente dieser Art noch frei sind (nie negativ). */
    remaining(kind: Tool): number {
        return Math.max(0, this.total(kind) - this.used(kind));
    }

    total(kind: Tool): number {
        return kind === "sign" ? this.inventory.signs : 0;
    }

    /** Das ausgewählte Schild (oder `null`). */
    get selectedSign(): Sign | null {
        return this.selected ? this.signs[this.selected.index] : null;
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

        if (this.canPlace(position, world)) {
            this.signs.push({
                position: {x: position.x, y: position.y},
                route: this.nearestRoute(position, world),
                strength: SIGN_STRENGTH,
            });
            this.selected = {kind: "sign", index: this.signs.length - 1};
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

        const sign = this.signs[this.dragging.index];

        this.signs[this.dragging.index] = {...sign, position: {x: position.x, y: position.y}};
        this.moved = true;
        this.edited = true;
        return "preview";
    }

    pointerUp(): Change {
        const wasMoved = this.dragging !== null && this.moved;

        this.dragging = null;
        return wasMoved ? "commit" : "none";
    }

    /** Stellt das ausgewählte Schild auf einen anderen Weg. */
    setRoute(route: number): Change {
        const sign = this.selectedSign;

        if (!sign || route < 0 || route >= this.routeCount) {
            return "none";
        }

        this.signs[this.selected!.index] = {...sign, route};
        this.edited = true;
        return "commit";
    }

    removeSelected(): Change {
        if (!this.selected) {
            return "none";
        }

        this.signs.splice(this.selected.index, 1);
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

    /** Das Schild, das ein Klick an dieser Stelle aufstellen würde (für die Vorschau), sonst `null`. */
    ghost(position: Vector2, world: PlanWorld): Sign | null {
        if (this.itemAt(position) || !this.canPlace(position, world)) {
            return null;
        }

        return {position, route: this.nearestRoute(position, world), strength: SIGN_STRENGTH};
    }

    /** Dürfte an dieser Stelle ein neues Schild stehen? */
    canPlace(position: Vector2, world: PlanWorld): boolean {
        return (
            this.remaining("sign") > 0 &&
            this.routeCount > 0 &&
            world.isWalkable(position) &&
            this.signs.every((sign) => distance(sign.position, position) >= MIN_SIGN_DISTANCE)
        );
    }

    /** Weg, auf den ein neues Schild an dieser Stelle zeigen würde. */
    private nearestRoute(position: Vector2, world: PlanWorld): number {
        let best = 0;

        for (let route = 1; route < this.routeCount; route++) {
            if (world.routeDistance(route, position) < world.routeDistance(best, position)) {
                best = route;
            }
        }

        return best;
    }

    /** Das Element unter `position` (das nächste im Pickradius). */
    private itemAt(position: Vector2): Selected | null {
        let best: Selected | null = null;
        let bestDistance = PICK_RADIUS;

        this.signs.forEach((sign, index) => {
            const d = distance(sign.position, position);

            if (d <= bestDistance) {
                best = {kind: "sign", index};
                bestDistance = d;
            }
        });

        return best;
    }
}

function distance(a: Vector2, b: Vector2): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
}
