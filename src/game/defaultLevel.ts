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
        obstacleLookAheadDistance: 240,
        obstacleAvoidanceStrength: 180,
        obstacleClearanceMargin: 24,
    } satisfies SimulationConfig,

    obstacles: [
        {
            position: {x: 500, y: 350},
            radius: 55
        },
        {
            position: {x: 100, y: 100},
            radius: 10
        }
    ] satisfies readonly Obstacle[],
} as const;