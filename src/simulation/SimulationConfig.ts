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
    /**
     * Verstärkung der Dichte durch eine Wand im Rücken: Wer zwischen Menge
     * und Hindernis eingeklemmt ist, kann nicht ausweichen. An der Wand
     * wird die Dichte um diesen Faktor erhöht (0 = Wand zählt nicht).
     * Ein Agent allein an der Wand bleibt unverändert.
     */
    readonly wallDensityFactor: number;

    /** Seitenlänge der Rasterzellen des Flow-Fields (Pixel). */
    readonly flowCellSize: number;
    /** Bis zu diesem Abstand vor Hindernissen werden Wege gemieden (Pixel). */
    readonly wallAvoidanceDistance: number;

    readonly crush: CrushConfig;
    readonly wayfinding: WayfindingConfig;
    readonly panic: PanicConfig;
}

/** Wie Agenten zwischen mehreren Wegen wählen. Sie kennen nur, was sie sehen. */
export interface WayfindingConfig {
    /** Bis zu dieser Entfernung erkennt ein Agent den Eingang eines Weges (Pixel). */
    readonly sightRange: number;
    /** Mittlere Zeit zwischen zwei Überlegungen eines Agenten (Sekunden). */
    readonly decisionInterval: number;
    /** Wie stark gesehenes Gedränge einen Weg unattraktiv macht (0 = ignoriert). */
    readonly congestionAversion: number;
    /** Anteil, um den der bisherige Weg bevorzugt wird, um nicht ständig zu wechseln. */
    readonly switchHysteresis: number;
    /** Fehler (±Anteil), mit dem jeder Agent die Länge eines Weges einschätzt. */
    readonly knowledgeError: number;
}

/**
 * Panik entsteht durch Gedränge und steckt Nachbarn an. Sie macht schneller
 * und rücksichtsloser, blendet Staus aus und macht Entscheidungen unsicher.
 */
export interface PanicConfig {
    /** Ab dieser lokalen Dichte beginnt Panik zu steigen. */
    readonly onsetDensity: number;
    /** Bei dieser Dichte ist die Panik voll ausgeprägt. */
    readonly fullDensity: number;
    /** Anstieg pro Sekunde (0..1). */
    readonly riseRate: number;
    /** Abklingen pro Sekunde (0..1). */
    readonly decayRate: number;
    /** Wie stark sich Panik von Nachbarn überträgt (0..1). */
    readonly contagion: number;
    /** Zusätzliche Wunschgeschwindigkeit bei voller Panik (Anteil). */
    readonly speedBoost: number;
    /** Wie viel weniger Abstand bei voller Panik gehalten wird (Anteil der Abstoßung). */
    readonly separationReduction: number;
}

/**
 * Quetschung: Wo es extrem dicht ist (Wandverstärkung eingerechnet), können
 * sich Menschen kaum noch bewegen. Drängeln verdichtet die Menge an
 * Engstellen und bremst sie dadurch selbst aus ("Faster-is-slower").
 */
export interface CrushConfig {
    /** Ab dieser lokalen Dichte lässt die Beweglichkeit nach. */
    readonly onsetDensity: number;
    /** Bei dieser Dichte ist die Beweglichkeit auf den Restwert gesunken. */
    readonly fullDensity: number;
    /** Anteil der Geschwindigkeit, der bei voller Quetschung bleibt (0..1). */
    readonly minimumMobility: number;
}
