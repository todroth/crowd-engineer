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

        routeClearance: 2,
        densityRadius: 25,
    } satisfies SimulationConfig,

    obstacles: [
        // Spielfeldbegrenzung oben und unten
        {
            type: "wall",
            start: {x: 0, y: 0},
            end: {x: 1000, y: 0},
            thickness: 12,
        },
        {
            type: "wall",
            start: {x: 0, y: 700},
            end: {x: 1000, y: 700},
            thickness: 12,
        },

        // TRICHTER: breit links, eng rechts
        {
            type: "wall",
            start: {x: 300, y: 90},
            end: {x: 540, y: 300},
            thickness: 12,
        },
        {
            type: "wall",
            start: {x: 300, y: 600},
            end: {x: 540, y: 400},
            thickness: 12,
        },

        // HINTER DEM TRICHTER: versetzte Hindernisse
        {
            type: "circle",
            center: {x: 650, y: 190},
            radius: 35,
        },
        {
            type: "rectangle",
            position: {x: 650, y: 455},
            width: 45,
            height: 125,
        },

        // Zentrale Engstelle: Agenten müssen sich aufteilen
        {
            type: "circle",
            center: {x: 770, y: 345},
            radius: 42,
        },

        // Weiterer versetzter Durchgang
        {
            type: "rectangle",
            position: {x: 840, y: 105},
            width: 50,
            height: 140,
        },
        {
            type: "wall",
            start: {x: 840, y: 500},
            end: {x: 930, y: 430},
            thickness: 12,
        },
        {
            type: "circle",
            center: {x: 920, y: 300},
            radius: 30,
        },
    ] satisfies readonly Obstacle[],
} as const;
