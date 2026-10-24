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
    /**
     * Wie träge Verletzte sind, wenn sie von anderen weggeschoben werden
     * (Vielfaches der Masse eines gesunden Agenten). Je höher, desto
     * schwerer lassen sie sich bewegen.
     */
    readonly injuredWeight: number;
    /**
     * Nach dieser Zeit (Sekunden) werden Verletzte abtransportiert und
     * verlassen die Simulation. Platzhalter für echte Rettungskräfte;
     * `Infinity` lässt sie liegen.
     */
    readonly rescueTime: number;
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

    readonly slowdown: SlowdownConfig;
    readonly crush: CrushConfig;
    readonly injury: InjuryConfig;
    readonly wayfinding: WayfindingConfig;
    readonly panic: PanicConfig;
}

/** Wie Agenten zwischen mehreren Wegen wählen. Sie kennen nur, was sie sehen. */
export interface WayfindingConfig {
    /** Bis zu dieser Entfernung erkennt ein Agent den Eingang eines Weges (Pixel). */
    readonly sightRange: number;
    /** Bis zu dieser Entfernung erkennt ein Agent ein Schild (Pixel). */
    readonly signRange: number;
    /** Größte Kostensenkung eines Weges durch ein Schild (Anteil, bei Stärke 1 und ohne Panik). */
    readonly signInfluence: number;
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
 * Druck und Quetschung. Wer gegen ein Hindernis oder eine Menge drückt,
 * ohne voranzukommen, erzeugt Druck (blockierter Schub). Druck wird durch
 * die Menge weitergegeben, sodass er sich nach hinten aufstaut, und bremst
 * die Betroffenen: Unter hohem Druck bewegt sich kaum noch jemand.
 * Stärkeres Drängeln erhöht den Druck und verlangsamt damit den Durchfluss
 * ("Faster-is-slower").
 */
export interface CrushConfig {
    /** Welcher Anteil des Drucks der Nachbarn zusätzlich zum eigenen wirkt (0..<1). */
    readonly transmission: number;
    /** Wie schnell sich der Druck anpasst (pro Sekunde). */
    readonly responseRate: number;
    /** Ab diesem Druck lässt die Beweglichkeit nach. */
    readonly onsetPressure: number;
    /** Bei diesem Druck ist die Beweglichkeit auf den Restwert gesunken. */
    readonly fullPressure: number;
    /** Anteil der Geschwindigkeit, der bei vollem Druck bleibt (0..1). */
    readonly minimumMobility: number;
}

/** Verletzung durch Quetschung, gemessen an der Belastung in Personen pro m². */
export interface InjuryConfig {
    /** Ab dieser Belastung steigt der Verletzungswert (Personen/m²). */
    readonly threshold: number;
    /** Anstieg pro Sekunde und Person/m² über der Schwelle. */
    readonly rate: number;
    /** Erholung pro Sekunde unterhalb der Schwelle. */
    readonly recovery: number;
}

/**
 * Dichteabhängiges Tempo (Fundamentaldiagramm nach Weidmann): In einer dichten
 * Menge kommt man kaum noch voran, auch wenn man gern schneller wäre.
 * Panische Agenten drängen sich darüber hinweg, für sie gilt es abgeschwächt.
 */
export interface SlowdownConfig {
    /** Wie stark die Dichte bremst: 0 = gar nicht, 1 = volles Fundamentaldiagramm. */
    readonly strength: number;
    /** Personendichte (Personen/m²), bei der man nahezu zum Stehen kommt. */
    readonly jamDensity: number;
    /** Wie schnell das Tempo mit der Dichte fällt (Weidmann: 1,913). */
    readonly steepness: number;
}
