import type {SimulationConfig} from "../simulation/SimulationConfig.ts";

export const DEFAULT_LEVEL = {
    worldWidth: 1000,
    worldHeight: 700,
    agentCount: 1000,

    simulation: {
        separationRadius: 25,
        separationStrength: 50,
        maxAcceleration: 80,
    } satisfies SimulationConfig
} as const;