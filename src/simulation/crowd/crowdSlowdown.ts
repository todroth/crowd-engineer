import type {SlowdownConfig} from "../SimulationConfig.ts";

/** Selbst im dichtesten Gedränge bleibt etwas Tempo (Anteil), damit niemand ganz festfriert. */
const MIN_SLOWDOWN_FACTOR = 0.05;

/**
 * Tempofaktor durch die Dichte (Weidmann): v/v0 = 1 - exp(-γ (1/ρ - 1/ρmax)).
 * Wirkt voll auf ruhige Agenten und schwächt sich mit der Panik ab.
 *
 * @param personsPerSquareMeter Dichte um den Agenten
 * @param panic Panik des Agenten (0..1)
 */
export function crowdSlowdown(
    personsPerSquareMeter: number,
    panic: number,
    config: SlowdownConfig,
): number {
    const {strength, jamDensity, steepness} = config;

    if (strength === 0 || personsPerSquareMeter <= 0.01) {
        return 1;
    }

    const factor = Math.min(
        1,
        Math.max(
            MIN_SLOWDOWN_FACTOR,
            1 - Math.exp(-steepness * (1 / personsPerSquareMeter - 1 / jamDensity)),
        ),
    );

    return 1 - strength * (1 - factor) * (1 - panic);
}
