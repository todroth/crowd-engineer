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
            type: "circle",
            center: {x: 500, y: 100},
            radius: 55,
        },
        {
            type: "rectangle",
            position: {x: 300, y: 230},
            width: 42,
            height: 140,
        },
        {
            type: "wall",
            start: {x: 700, y: 400},
            end: {x: 700, y: 550},
            thickness: 12,
        },
    ] satisfies readonly Obstacle[],
} as const;
