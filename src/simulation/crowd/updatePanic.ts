import type {Agent} from "../Agent.ts";
import type {PanicConfig} from "../SimulationConfig.ts";

/**
 * Panik steigt, wo es eng ist, und steckt sich über Nachbarn an. Sie baut
 * sich langsam ab, wenn der Druck nachlässt.
 */
export function updatePanic(
    agent: Agent,
    neighborPanic: number,
    config: PanicConfig,
    deltaSeconds: number,
): void {
    const stress = clamp01(
        (agent.localDensity - config.onsetDensity) /
        (config.fullDensity - config.onsetDensity),
    );
    const target = Math.max(stress, neighborPanic * config.contagion);
    const rate = target > agent.panic ? config.riseRate : config.decayRate;

    agent.panic = clamp01(agent.panic + (target - agent.panic) * rate * deltaSeconds);
}

function clamp01(value: number): number {
    return Math.min(1, Math.max(0, value));
}
