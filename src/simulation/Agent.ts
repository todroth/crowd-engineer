import type {Vector2} from "./Vector2.ts";

export interface Agent {
    /** Entspricht dem Index in `Simulation.agents`. */
    readonly id: number;

    position: Vector2;
    velocity: Vector2;

    readonly desiredSpeed: number;
    readonly radius: number;

    /** Gewichtete Zahl der Nachbarn im Dichteradius. */
    localDensity: number;
}
