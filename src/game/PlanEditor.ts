import type {Plan} from "../simulation/Plan.ts";
import type {Sign} from "../simulation/Sign.ts";
import type {Vector2} from "../simulation/Vector2.ts";

/** Wie weit man neben ein Schild klicken darf, um es zu treffen (Pixel). */
const PICK_RADIUS = 14;
/** Mindestabstand zwischen zwei Schildern (Pixel). */
const MIN_SIGN_DISTANCE = 20;
/** Überzeugungskraft der Schilder, die der Spieler aufstellt. */
const SIGN_STRENGTH = 0.9;

/** Was der Editor über die Welt wissen muss (die Simulation erfüllt das). */
export interface SignPlacement {
    isWalkable(position: Vector2): boolean;
    routeDistance(route: number, position: Vector2): number;
}

/**
 * Der Plan, den der Spieler gerade baut: Schilder aufstellen, umstellen,
 * entfernen, mit einem Budget. Kennt kein Phaser; die Szene übersetzt Klicks.
 */
export class PlanEditor {
    readonly budget: number;
    private readonly routeCount: number;
    private signs: Sign[];
    private releaseDelays: readonly number[];
    /** Wurde der geladene Plan verändert? */
    edited = false;

    constructor(plan: Plan, routeCount: number, budget: number) {
        this.routeCount = routeCount;
        this.budget = budget;
        this.signs = [...plan.signs];
        this.releaseDelays = plan.releaseDelays;
    }

    get plan(): Plan {
        return {signs: [...this.signs], releaseDelays: this.releaseDelays};
    }

    get signCount(): number {
        return this.signs.length;
    }

    /** Ersetzt den Plan (etwa durch eine Vorlage). Mehr Schilder als das Budget bleiben erhalten. */
    load(plan: Plan): void {
        this.signs = [...plan.signs];
        this.releaseDelays = plan.releaseDelays;
        this.edited = false;
    }

    /**
     * Linksklick: Auf einem Schild stellt er es auf den nächsten Weg um, sonst
     * stellt er ein neues auf (zeigt zunächst auf den nächstgelegenen Weg).
     * Gibt zurück, ob sich der Plan geändert hat.
     */
    click(position: Vector2, world: SignPlacement): boolean {
        const index = this.signAt(position);

        if (index >= 0) {
            const sign = this.signs[index];

            this.signs[index] = {...sign, route: (sign.route + 1) % this.routeCount};
            this.edited = true;
            return true;
        }

        if (!this.canPlace(position, world)) {
            return false;
        }

        this.signs.push({
            position: {x: position.x, y: position.y},
            route: this.nearestRoute(position, world),
            strength: SIGN_STRENGTH,
        });
        this.edited = true;
        return true;
    }

    /** Rechtsklick: entfernt das Schild unter dem Zeiger. */
    remove(position: Vector2): boolean {
        const index = this.signAt(position);

        if (index < 0) {
            return false;
        }

        this.signs.splice(index, 1);
        this.edited = true;
        return true;
    }

    clear(): void {
        this.edited ||= this.signs.length > 0;
        this.signs = [];
    }

    /** Ob an dieser Stelle ein neues Schild stehen dürfte. */
    canPlace(position: Vector2, world: SignPlacement): boolean {
        return (
            this.signs.length < this.budget &&
            this.routeCount > 0 &&
            world.isWalkable(position) &&
            this.signs.every((sign) => distance(sign.position, position) >= MIN_SIGN_DISTANCE)
        );
    }

    /** Weg, auf den ein neues Schild an dieser Stelle zeigen würde. */
    nearestRoute(position: Vector2, world: SignPlacement): number {
        let best = 0;

        for (let route = 1; route < this.routeCount; route++) {
            if (world.routeDistance(route, position) < world.routeDistance(best, position)) {
                best = route;
            }
        }

        return best;
    }

    /** Index des Schildes unter `position` (-1: keines). */
    signAt(position: Vector2): number {
        let best = -1;
        let bestDistance = PICK_RADIUS;

        this.signs.forEach((sign, index) => {
            const d = distance(sign.position, position);

            if (d <= bestDistance) {
                best = index;
                bestDistance = d;
            }
        });

        return best;
    }
}

function distance(a: Vector2, b: Vector2): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
}
