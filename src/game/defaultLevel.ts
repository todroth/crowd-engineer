import type {Level} from "../simulation/Level.ts";

export const DEFAULT_LEVEL: Level = {
    worldWidth: 1000,
    worldHeight: 700,
    agentCount: 1200,
    seed: 1,

    // Start links, Ziel ist das Tor in der Wand am rechten Rand.
    spawnArea: {x: 20, y: 60, width: 200, height: 580},
    entryArea: {x: -30, y: 60, width: 25, height: 580},
    goalArea: {x: 1000, y: 250, width: 40, height: 100},
    // Eingänge der drei Wege: Mitte, oben, unten.
    routes: [
        {x: 560, y: 335, width: 120, height: 30},
        {x: 540, y: 20, width: 40, height: 140},
        {x: 520, y: 580, width: 60, height: 110},
    ],

    simulation: {
        separationRadius: 16,
        separationStrength: 30,
        alignmentStrength: 0.3,
        maxAcceleration: 80,

        densityRadius: 25,
        wallDensityFactor: 1,
        flowCellSize: 10,
        wallAvoidanceDistance: 12,

        wayfinding: {
            sightRange: 350,
            decisionInterval: 0.8,
            congestionAversion: 0.25,
            switchHysteresis: 0.15,
            knowledgeError: 0.15,
        },

        panic: {
            onsetDensity: 6,
            fullDensity: 14,
            riseRate: 0.5,
            decayRate: 0.1,
            contagion: 0.6,
            speedBoost: 0.35,
            separationReduction: 0.5,
        },
    },

    obstacles: [
        // Spielfeldbegrenzung oben und unten
        {type: "wall", start: {x: 0, y: 0}, end: {x: 1000, y: 0}, thickness: 12},
        {type: "wall", start: {x: 0, y: 700}, end: {x: 1000, y: 700}, thickness: 12},

        // 1) EINGANGSTRICHTER: Der Startplatz verengt sich auf 200 Pixel.
        {type: "wall", start: {x: 260, y: 0}, end: {x: 430, y: 250}, thickness: 12},
        {type: "wall", start: {x: 260, y: 700}, end: {x: 430, y: 450}, thickness: 12},
        // Kleine Trennwand im Trichter, teilt den Strom kurz vor der Enge
        {type: "wall", start: {x: 300, y: 350}, end: {x: 380, y: 350}, thickness: 12},

        // 2) DREI WEGE zum Tor, getrennt durch zwei Inseln aus Wänden:
        //    - Mitte:  der kürzeste Weg, aber nur etwa vier Personen breit
        //    - oben:   länger, mit einer schrägen Engstelle
        //    - unten:  am längsten, mit einem Slalom, dafür breit
        //    Ist die Mitte verstopft, können sich die Umwege lohnen.
        // Obere Insel
        {type: "wall", start: {x: 520, y: 325}, end: {x: 570, y: 170}, thickness: 12},
        {type: "wall", start: {x: 570, y: 170}, end: {x: 780, y: 170}, thickness: 12},
        {type: "wall", start: {x: 780, y: 170}, end: {x: 780, y: 325}, thickness: 12},
        {type: "wall", start: {x: 780, y: 325}, end: {x: 520, y: 325}, thickness: 12},
        // Untere Insel
        {type: "wall", start: {x: 520, y: 375}, end: {x: 545, y: 520}, thickness: 12},
        {type: "wall", start: {x: 545, y: 520}, end: {x: 740, y: 560}, thickness: 12},
        {type: "wall", start: {x: 740, y: 560}, end: {x: 800, y: 375}, thickness: 12},
        {type: "wall", start: {x: 800, y: 375}, end: {x: 520, y: 375}, thickness: 12},
        // Schräge Engstelle im oberen Weg
        {type: "wall", start: {x: 600, y: 0}, end: {x: 690, y: 110}, thickness: 12},
        // Slalom im unteren Weg
        {type: "wall", start: {x: 620, y: 700}, end: {x: 620, y: 600}, thickness: 12},
        {type: "wall", start: {x: 690, y: 550}, end: {x: 690, y: 630}, thickness: 12},

        // 3) ZWEITER TRICHTER zum Tor mit einer Schikane davor: Die drei
        //    Ströme treffen sich, müssen um die Wand herum und drängen
        //    sich dann durchs Tor.
        {type: "wall", start: {x: 840, y: 0}, end: {x: 960, y: 240}, thickness: 12},
        {type: "wall", start: {x: 840, y: 700}, end: {x: 960, y: 360}, thickness: 12},
        {type: "wall", start: {x: 910, y: 290}, end: {x: 910, y: 410}, thickness: 12},

        // Wand am rechten Rand mit einem Tor (y 250 bis 350)
        {type: "wall", start: {x: 1000, y: 0}, end: {x: 1000, y: 250}, thickness: 12},
        {type: "wall", start: {x: 1000, y: 350}, end: {x: 1000, y: 700}, thickness: 12},
    ],
};
