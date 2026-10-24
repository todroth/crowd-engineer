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

    /** 0 = ruhig, 1 = panisch. */
    panic: number;

    /**
     * Druck durch blockierten Schub: wie stark der Agent (und über die
     * Menge die Leute hinter ihm) gegen ein Hindernis drückt. 0 im freien Fluss.
     */
    pressure: number;

    /** Index des gewählten Weges, -1 = noch keiner (geradeaus zum Ziel). */
    routeChoice: number;
    /** Hat den Eingang eines Weges durchquert und folgt nun dem Hauptfeld. */
    committed: boolean;
    /** Zeit (s) bis zur nächsten Überlegung. */
    decisionTimer: number;
}
