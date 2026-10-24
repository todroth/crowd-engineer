import type {Level} from "../simulation/Level.ts";

export const DEFAULT_LEVEL: Level = {
    worldWidth: 1000,
    worldHeight: 700,
    pixelsPerMeter: 16,
    agentCount: 1200,
    seed: 1,

    // Start links, Ziel ist das Tor in der Wand am rechten Rand.
    spawnArea: {x: 20, y: 60, width: 200, height: 580},
    // Blöcke von hinten nach vorn (vorn = nah am Trichter).
    sectors: [
        {x: 20, y: 60, width: 70, height: 580},
        {x: 90, y: 60, width: 70, height: 580},
        {x: 160, y: 60, width: 60, height: 580},
    ],
    entryArea: {x: -30, y: 60, width: 25, height: 580},
    respawn: false,
    timeLimit: 240,
    goalArea: {x: 1000, y: 250, width: 40, height: 100},
    // Eingänge der drei Wege: Mitte, oben, unten.
    routes: [
        {x: 580, y: 330, width: 140, height: 40},
        {x: 540, y: 20, width: 40, height: 140},
        {x: 540, y: 590, width: 60, height: 100},
    ],

    simulation: {
        separationRadius: 16,
        separationStrength: 30,
        alignmentStrength: 0.3,
        injuredWeight: 4,
        rescueTime: 30,
        maxAcceleration: 80,

        densityRadius: 25,
        wallDensityFactor: 1,
        flowCellSize: 10,
        wallAvoidanceDistance: 12,

        crush: {
            transmission: 0.8,
            responseRate: 1,
            onsetPressure: 3,
            fullPressure: 10,
            minimumMobility: 0.2,
        },

        injury: {
            threshold: 5,
            rate: 0.1,
            recovery: 0.02,
        },

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
        // Spielfeldbegrenzung oben, unten und links: Nach links gibt es keinen Ausweg.
        {type: "wall", start: {x: 0, y: 0}, end: {x: 1000, y: 0}, thickness: 12},
        {type: "wall", start: {x: 0, y: 700}, end: {x: 1000, y: 700}, thickness: 12},
        {type: "wall", start: {x: 0, y: 0}, end: {x: 0, y: 700}, thickness: 12},

        // Säulen im Startbereich: Sie teilen die Menge vor dem Trichter.
        {type: "circle", center: {x: 305, y: 190}, radius: 18},
        {type: "circle", center: {x: 305, y: 510}, radius: 18},
        {type: "circle", center: {x: 360, y: 350}, radius: 20},

        // 1) EINGANGSTRICHTER: Der Startplatz verengt sich auf 150 Pixel.
        {type: "wall", start: {x: 260, y: 0}, end: {x: 430, y: 275}, thickness: 12},
        {type: "wall", start: {x: 260, y: 700}, end: {x: 430, y: 425}, thickness: 12},

        // 2) DREI WEGE zum Tor, getrennt durch zwei Inseln aus Wänden:
        //    - Mitte:  der kürzeste Weg, aber nur etwa vier Personen breit
        //    - oben:   länger, mit einer schrägen Engstelle
        //    - unten:  am längsten, mit einem Slalom, dafür breit
        //    Ist die Mitte verstopft, können sich die Umwege lohnen.
        // Obere Insel
        {type: "wall", start: {x: 530, y: 320}, end: {x: 580, y: 175}, thickness: 12},
        {type: "wall", start: {x: 580, y: 175}, end: {x: 760, y: 175}, thickness: 12},
        {type: "wall", start: {x: 760, y: 175}, end: {x: 790, y: 320}, thickness: 12},
        {type: "wall", start: {x: 790, y: 320}, end: {x: 530, y: 320}, thickness: 12},
        // Untere Insel
        {type: "wall", start: {x: 530, y: 380}, end: {x: 580, y: 525}, thickness: 12},
        {type: "wall", start: {x: 580, y: 525}, end: {x: 760, y: 525}, thickness: 12},
        {type: "wall", start: {x: 760, y: 525}, end: {x: 790, y: 380}, thickness: 12},
        {type: "wall", start: {x: 790, y: 380}, end: {x: 530, y: 380}, thickness: 12},
        // Schräge Engstelle im oberen Weg
        {type: "wall", start: {x: 610, y: 0}, end: {x: 690, y: 105}, thickness: 12},
        // Slalom im unteren Weg
        {type: "wall", start: {x: 630, y: 700}, end: {x: 630, y: 605}, thickness: 12},
        {type: "wall", start: {x: 700, y: 525}, end: {x: 700, y: 620}, thickness: 12},

        // 3) TÜR: Alle drei Wege laufen auf eine schmale Tür (etwa neun
        //    Personen breit) zu. Sie liegt unterhalb der Mitte, das Tor dagegen
        //    darüber, die Menge muss dahinter also quer durch die Kammer.
        {type: "wall", start: {x: 840, y: 0}, end: {x: 840, y: 385}, thickness: 12},
        {type: "wall", start: {x: 840, y: 475}, end: {x: 840, y: 700}, thickness: 12},

        // Säulen in der Kammer hinter der Tür: Der Strom verteilt sich vor dem Trichter.
        {type: "circle", center: {x: 895, y: 200}, radius: 20},
        {type: "circle", center: {x: 895, y: 480}, radius: 20},

        // 4) ZWEITER TRICHTER, der exakt an den Torkanten endet. Davor steht
        //    eine Schikane: Die Menge muss um die Wand herum und drängt sich
        //    dann durchs Tor.
        {type: "wall", start: {x: 850, y: 0}, end: {x: 1000, y: 250}, thickness: 12},
        {type: "wall", start: {x: 850, y: 700}, end: {x: 1000, y: 350}, thickness: 12},
        {type: "wall", start: {x: 950, y: 240}, end: {x: 950, y: 360}, thickness: 12},

        // Wand am rechten Rand mit einem Tor (y 250 bis 350)
        {type: "wall", start: {x: 1000, y: 0}, end: {x: 1000, y: 250}, thickness: 12},
        {type: "wall", start: {x: 1000, y: 350}, end: {x: 1000, y: 700}, thickness: 12},
    ],
};
