import type {SimulationConfig} from "../simulation/SimulationConfig.ts";
import type {Obstacle} from "../simulation/Obstacle.ts";

export const DEFAULT_LEVEL = {
    worldWidth: 1000,
    worldHeight: 700,
    agentCount: 1000,

    simulation: {
        separationRadius: 25,
        separationStrength: 50,
        maxAcceleration: 80,
        obstacleLookAheadDistance: 150,
        obstacleAvoidanceStrength: 100,
        obstacleClearanceMargin: 16,
    } satisfies SimulationConfig,

    obstacles: [
        {
            position: {x: 500, y: 350},
            radius: 55
        }
    ] satisfies readonly Obstacle[],
} as const;