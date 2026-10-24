import type {Sign} from "./Sign.ts";

/**
 * Die Entscheidungen des Spielers für einen Durchlauf. Das Level beschreibt
 * die Welt, der Plan, was man darin tut. Später kommen Ordner usw. dazu.
 */
export interface Plan {
    /** Aufgestellte Wegweiser. */
    readonly signs: readonly Sign[];
    /**
     * Startverzögerung je Block des Startbereichs (Sekunden), in der
     * Reihenfolge von `Level.sectors`. Fehlende Einträge zählen als 0.
     */
    readonly releaseDelays: readonly number[];
}

/** Ein Plan aus den angegebenen Teilen; Fehlendes bleibt leer. */
export function createPlan(parts: Partial<Plan> = {}): Plan {
    return {signs: [], releaseDelays: [], ...parts};
}
