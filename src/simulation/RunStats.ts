/** Kennzahlen eines Durchlaufs. */
export interface RunStats {
    /** Vergangene Zeit in Sekunden; nach dem Ende die Dauer des Durchlaufs. */
    readonly elapsed: number;
    readonly arrived: number;
    readonly total: number;
    /** Zahl der Agenten, die verletzt am Boden liegen (oder schon abtransportiert wurden). */
    readonly injured: number;
    /** Personensekunden über der Gedränge-Schwelle (`ScoringConfig.crowdingThreshold`). */
    readonly crowdedSeconds: number;
    /** Höchste Personendichte, die ein Agent erlebt hat (Personen pro m²). */
    readonly peakDensity: number;
}
