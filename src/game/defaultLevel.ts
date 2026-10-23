import type {Level} from "../simulation/Level.ts";

export const DEFAULT_LEVEL: Level = {
    worldWidth: 1000,
    worldHeight: 700,
    agentCount: 1000,
    seed: 1,

    // Start links, Ziel ist das Tor in der Wand am rechten Rand.
    spawnArea: {x: 20, y: 60, width: 200, height: 580},
    entryArea: {x: -30, y: 60, width: 25, height: 580},
    goalArea: {x: 1000, y: 300, width: 40, height: 100},

    simulation: {
        separationRadius: 16,
        separationStrength: 30,
        alignmentStrength: 0.3,
        maxAcceleration: 80,

        densityRadius: 25,
        flowCellSize: 10,
        wallAvoidanceDistance: 12,
    },

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

        // Wand am rechten Rand mit einem Tor (y 300 bis 400)
        {
            type: "wall",
            start: {x: 1000, y: 0},
            end: {x: 1000, y: 300},
            thickness: 12,
        },
        {
            type: "wall",
            start: {x: 1000, y: 400},
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
    ],
};
