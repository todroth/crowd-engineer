import type {SimulationConfig} from "../../simulation/SimulationConfig.ts";

/** Gemeinsame Werte beider Verhaltensprofile. */
const BASE = {
    separationRadius: 16,
    separationStrength: 30,
    alignmentStrength: 0.3,
    injuredWeight: 4,
    rescueTime: 30,
    maxAcceleration: 80,

    densityRadius: 25,
    wallDensityFactor: 1,

    flowCellSize: 10,
    wallAvoidanceDistance: 12,

    crush: {
        transmission: 0.8,
        responseRate: 1,
        onsetPressure: 3,
        fullPressure: 10,
        minimumMobility: 0.2,
    },

    injury: {
        threshold: 5,
        rate: 0.1,
        recovery: 0.02,
    },

    wayfinding: {
        sightRange: 350,
        signRange: 300,
        signInfluence: 0.5,
        decisionInterval: 0.8,
        congestionAversion: 0.25,
        switchHysteresis: 0.15,
        knowledgeError: 0.15,
    },
} satisfies Omit<SimulationConfig, "panic" | "slowdown">;

/** Fundamentaldiagramm nach Weidmann: bei etwa 5,4 Personen/m² steht die Menge. */
const WEIDMANN = {jamDensity: 5.4, steepness: 1.913};

/**
 * Notfall: Gedränge löst Panik aus, die ansteckt, schneller und rücksichtsloser macht.
 * Die Dichte bremst hier nicht zusätzlich, die Menge drängt sich über sie hinweg.
 */
export const PANIC_BEHAVIOR: SimulationConfig = {
    ...BASE,
    slowdown: {...WEIDMANN, strength: 0},
    panic: {
        onsetDensity: 6,
        fullDensity: 14,
        riseRate: 0.5,
        decayRate: 0.1,
        contagion: 0.6,
        speedBoost: 0.35,
        separationReduction: 0.5,
    },
};

/** Geordnete Räumung: Es gibt keine Panik, die Menge geht und wird in der Dichte langsamer. */
export const CALM_BEHAVIOR: SimulationConfig = {
    ...BASE,
    slowdown: {...WEIDMANN, strength: 1},
    panic: {
        // Schwellen so hoch, dass keine Panik entsteht.
        onsetDensity: 50,
        fullDensity: 60,
        riseRate: 0,
        decayRate: 1,
        contagion: 0,
        speedBoost: 0,
        separationReduction: 0,
    },
};

/** Lauftempo bei Panik (Pixel/s, entspricht etwa 2,5 bis 3,7 m/s: Rennen). */
export const RUNNING_SPEED = {min: 40, max: 60};

/** Lauftempo bei geordneter Räumung (Pixel/s, entspricht etwa 1,4 bis 2 m/s: zügiges Gehen). */
export const WALKING_SPEED = {min: 22, max: 32};
