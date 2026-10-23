import type {Vector2} from "./Vector2.ts";

export interface Agent {
    /** Entspricht dem Index in `Simulation.agents`. */
    readonly id: number;

    position: Vector2;
    velocity: Vector2;

    readonly desiredSpeed: number;
    readonly radius: number;

    /** Zielpunkt innerhalb des Zielbereichs. */
    goal: Vector2;

    /** Geplante Route; der letzte Punkt ist `goal`. */
    route: Vector2[];
    routeIndex: number;
    /** Verbleibende Sperrzeit (s), bis erneut geplant werden darf. */
    replanCooldown: number;

    /** Gewichtete Zahl der Nachbarn im Dichteradius. */
    localDensity: number;
}
