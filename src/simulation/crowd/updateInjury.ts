import type {Agent} from "../Agent.ts";
import type {InjuryConfig} from "../SimulationConfig.ts";

/**
 * Verletzung entsteht durch anhaltende Quetschung: Liegt die Belastung über
 * der Schwelle, steigt der Wert (je stärker, desto schneller), darunter
 * erholt sich der Agent langsam. Wer einmal 1 erreicht hat, gilt als
 * verletzt. Gibt zurück, ob der Agent in diesem Schritt neu verletzt wurde.
 *
 * @param load Belastung in Personen pro m² (inklusive Wandverstärkung)
 */
export function updateInjury(
    agent: Agent,
    load: number,
    config: InjuryConfig,
    deltaSeconds: number,
): boolean {
    const excess = Math.max(0, load - config.threshold);
    const change = excess > 0
        ? config.rate * excess
        : -config.recovery;

    agent.injury = Math.min(1, Math.max(0, agent.injury + change * deltaSeconds));

    if (agent.injury >= 1 && !agent.injured) {
        agent.injured = true;
        return true;
    }

    return false;
}
