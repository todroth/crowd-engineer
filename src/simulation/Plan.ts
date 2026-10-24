/**
 * Die Entscheidungen des Spielers für einen Durchlauf. Das Level beschreibt
 * die Welt, der Plan, was man darin tut. Später kommen Schilder, Ordner usw. dazu.
 */
export interface Plan {
    /**
     * Startverzögerung je Block des Startbereichs (Sekunden), in der
     * Reihenfolge von `Level.sectors`. Fehlende Einträge zählen als 0.
     */
    readonly releaseDelays: readonly number[];
}
