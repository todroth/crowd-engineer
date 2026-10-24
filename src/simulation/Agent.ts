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

    /** Hat die Simulation verlassen (angekommen oder als Verletzter abtransportiert). */
    arrived: boolean;

    /** Quetschungsschaden 0..1; bei 1 gilt der Agent als verletzt. */
    injury: number;
    /** Hat sich verletzt (bleibt gesetzt, auch wenn sich der Wert erholt). */
    injured: boolean;
    /** Seit wann der Agent verletzt am Boden liegt (Sekunden). */
    injuredFor: number;
    /** Wurde abtransportiert: liegt noch sichtbar da, beeinflusst die Simulation aber nicht mehr. */
    rescued: boolean;

    /** Block des Startbereichs, in dem der Agent gestartet ist (-1 = keiner). */
    sector: number;
    /** Simulationszeit (Sekunden), ab der der Agent loslaufen darf. */
    releaseTime: number;

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
