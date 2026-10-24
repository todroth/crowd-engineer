import {BARRIER_THICKNESS, type Barrier} from "./Barrier.ts";
import type {Marshal} from "./Marshal.ts";
import type {Obstacle} from "./Obstacle.ts";
import type {Sign} from "./Sign.ts";

/**
 * Die Entscheidungen des Spielers für einen Durchlauf. Das Level beschreibt
 * die Welt, der Plan, was man darin tut. Später kommen weitere Maßnahmen dazu.
 */
export interface Plan {
    /** Aufgestellte Wegweiser. */
    readonly signs: readonly Sign[];
    /** Eingesetzte Ordner. */
    readonly marshals: readonly Marshal[];
    /** Aufgestellte Absperrgitter. */
    readonly barriers: readonly Barrier[];
    /**
     * Startverzögerung je Block des Startbereichs (Sekunden), in der
     * Reihenfolge von `Level.sectors`. Fehlende Einträge zählen als 0.
     */
    readonly releaseDelays: readonly number[];
}

/** Ein Plan aus den angegebenen Teilen; Fehlendes bleibt leer. */
export function createPlan(parts: Partial<Plan> = {}): Plan {
    return {signs: [], marshals: [], barriers: [], releaseDelays: [], ...parts};
}

/** Hindernisse, die der Plan zur Welt hinzufügt: die Absperrgitter als Wände. */
export function planObstacles(plan: Plan): Obstacle[] {
    return plan.barriers.map(({start, end}) => ({type: "wall", start, end, thickness: BARRIER_THICKNESS}));
}
