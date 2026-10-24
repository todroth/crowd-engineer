import type {RunStats} from "./Simulation.ts";

export interface ScoringConfig {
    /** Wie viele Sekunden eine verletzte (oder nicht herausgekommene) Person kostet. */
    readonly injuryPenalty: number;
    /** Ab dieser Personendichte (Personen/m²) gilt ein Agent als im Gedränge. */
    readonly crowdingThreshold: number;
    /** Kosten (in Sekunden) je Personensekunde im Gedränge. */
    readonly crowdingPenalty: number;
    /** Ergebnis des Laufs ohne Maßnahmen (`planWithoutMeasures`), als Vergleichswert. */
    readonly reference: {
        readonly duration: number;
        readonly injured: number;
        readonly crowdedSeconds: number;
    };
}

export interface CostBreakdown {
    readonly duration: number;
    readonly injuries: number;
    readonly crowding: number;
    readonly total: number;
}

type CostInput = Pick<RunStats, "elapsed" | "arrived" | "injured" | "total" | "crowdedSeconds">;

/**
 * Kosten eines Durchlaufs: Dauer, Strafe je Verletztem und Strafe für Zeit im
 * Gedränge. Wer am Ende nicht herausgekommen ist (Zeitlimit), zählt wie ein
 * Verletzter. Niedriger ist besser.
 */
export function calculateCost(stats: CostInput, scoring: ScoringConfig): CostBreakdown {
    const stranded = stats.total - stats.arrived - stats.injured;

    return breakdown(
        stats.elapsed,
        stats.injured + stranded,
        stats.crowdedSeconds,
        scoring,
    );
}

/** Kosten der Referenz (Lauf ohne Maßnahmen). */
export function referenceCost(scoring: ScoringConfig): CostBreakdown {
    const {duration, injured, crowdedSeconds} = scoring.reference;

    return breakdown(duration, injured, crowdedSeconds, scoring);
}

function breakdown(
    duration: number,
    injured: number,
    crowdedSeconds: number,
    scoring: ScoringConfig,
): CostBreakdown {
    const injuries = scoring.injuryPenalty * injured;
    const crowding = scoring.crowdingPenalty * crowdedSeconds;

    return {duration, injuries, crowding, total: duration + injuries + crowding};
}
