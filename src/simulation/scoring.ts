import type {RunStats} from "./Simulation.ts";

export interface ScoringConfig {
    /** Wie viele Sekunden eine verletzte (oder nicht herausgekommene) Person kostet. */
    readonly injuryPenalty: number;
    /** Ergebnis des Laufs ohne Maßnahmen (Standardplan), als Vergleichswert. */
    readonly reference: {
        readonly duration: number;
        readonly injured: number;
    };
}

/**
 * Kosten eines Durchlaufs: Dauer plus Strafe je Verletztem. Wer am Ende
 * nicht herausgekommen ist (Zeitlimit), zählt wie ein Verletzter.
 * Niedriger ist besser.
 */
export function calculateCost(
    stats: Pick<RunStats, "elapsed" | "arrived" | "injured" | "total">,
    scoring: ScoringConfig,
): number {
    const stranded = stats.total - stats.arrived - stats.injured;

    return stats.elapsed + scoring.injuryPenalty * (stats.injured + stranded);
}

/** Kosten der Referenz (Lauf ohne Maßnahmen). */
export function referenceCost(scoring: ScoringConfig): number {
    return scoring.reference.duration + scoring.injuryPenalty * scoring.reference.injured;
}
