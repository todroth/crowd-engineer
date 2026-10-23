export interface SimulationConfig {
    /** Reichweite der weichen Abstoßung zwischen Agenten (Pixel). */
    readonly separationRadius: number;
    /** Geschwindigkeit (Pixel/s), mit der sich Agenten bei Überlappung abstoßen. */
    readonly separationStrength: number;
    /**
     * Wie stark sich Agenten der mittleren Geschwindigkeit ihrer Nachbarn
     * angleichen (0..1). Sorgt für das zähflüssige, wasserartige Fließen.
     */
    readonly alignmentStrength: number;
    /** Maximale Beschleunigung (Pixel/s²). */
    readonly maxAcceleration: number;

    /** Radius, in dem die lokale Dichte gemessen wird (Pixel). */
    readonly densityRadius: number;

    /** Seitenlänge der Rasterzellen des Flow-Fields (Pixel). */
    readonly flowCellSize: number;
    /** Bis zu diesem Abstand vor Hindernissen werden Wege gemieden (Pixel). */
    readonly wallAvoidanceDistance: number;
}
