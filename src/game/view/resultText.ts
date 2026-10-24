import type {RunStats} from "../../simulation/RunStats.ts";
import {calculateCost, referenceCost, type ScoringConfig} from "../../simulation/scoring.ts";

/** Text der Ergebnistafel am Ende eines Durchlaufs. */
export function resultText(stats: RunStats, scoring: ScoringConfig): string {
    const cost = calculateCost(stats, scoring);
    const reference = referenceCost(scoring);
    const difference = cost.total - reference.total;
    const sign = difference > 0 ? "+" : "";

    return [
        headline(stats),
        "",
        `Evakuiert:   ${stats.arrived}/${stats.total}`,
        `Verletzte:   ${stats.injured}`,
        `Dauer:       ${stats.elapsed.toFixed(1)} s`,
        `Gedränge:    ${(stats.crowdedSeconds / 60).toFixed(0)} Personen-Min. über ${scoring.crowdingThreshold} P/m²`,
        `Spitze:      ${stats.peakDensity.toFixed(1)} Pers./m² (${describeDensity(stats.peakDensity)})`,
        "",
        `Kosten:      ${cost.total.toFixed(0)}  = Dauer ${cost.duration.toFixed(0)} + Verletzte ${cost.injuries.toFixed(0)} + Gedränge ${cost.crowding.toFixed(0)}`,
        `Ohne Maßnahmen: ${reference.total.toFixed(0)}  (${sign}${difference.toFixed(0)}, niedriger ist besser)`,
        "",
        "Leertaste: Neustart",
    ].join("\n");
}

function headline(stats: RunStats): string {
    if (stats.arrived + stats.injured < stats.total) {
        return "Zeit abgelaufen";
    }

    return stats.injured === 0
        ? "Alle evakuiert, niemand verletzt"
        : "Alle Gehfähigen sind draußen, es gab Verletzte";
}

/**
 * Einordnung der Personendichte (angelehnt an die Fruin-Stufen für
 * Fußgängerströme; ab etwa 5 Personen/m² besteht Quetschgefahr).
 */
function describeDensity(personsPerSquareMeter: number): string {
    if (personsPerSquareMeter < 2) return "locker";
    if (personsPerSquareMeter < 4) return "dicht";
    if (personsPerSquareMeter < 5.5) return "Gedränge";
    return "kritisch";
}
