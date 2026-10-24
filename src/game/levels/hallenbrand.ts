import type {Level} from "../../simulation/Level.ts";
import {createPlan} from "../../simulation/Plan.ts";
import type {Scenario} from "../Scenario.ts";
import {PANIC_BEHAVIOR, RUNNING_SPEED} from "./behavior.ts";
import {circle, wall} from "./shapes.ts";

const level: Level = {
    name: "Brand in der Halle",
    description: "Panik: Alle rennen gleichzeitig zum einzigen Tor. Drei Wege, eine Tür, ein Tor.",

    worldWidth: 1000,
    worldHeight: 700,
    pixelsPerMeter: 16,
    agentCount: 1200,
    seed: 1,

    // Start links, Ziel ist das Tor in der Wand am rechten Rand.
    spawnArea: {x: 20, y: 60, width: 200, height: 580},
    // Bei Panik wartet niemand auf eine Freigabe: keine Startblöcke.
    sectors: [],
    entryArea: {x: -30, y: 60, width: 25, height: 580},
    respawn: false,
    timeLimit: 240,
    goalAreas: [{x: 1000, y: 250, width: 40, height: 100}],
    walkingSpeed: RUNNING_SPEED,
    // Eingänge der drei Wege: Mitte, oben, unten.
    routes: [
        {entrance: {x: 580, y: 330, width: 140, height: 40}},
        {entrance: {x: 540, y: 20, width: 40, height: 140}},
        {entrance: {x: 540, y: 590, width: 60, height: 100}},
    ],

    // Der Referenzwert ist das Ergebnis des Laufs ohne Maßnahmen mit diesem Seed
    // (`npm run scenarios`, Zeile "Ohne Maßnahmen", Seed 1); bei Änderungen am
    // Level oder an der Simulation neu eintragen.
    scoring: {
        injuryPenalty: 1,
        crowdingThreshold: 4,
        crowdingPenalty: 0.01,
        reference: {duration: 73, injured: 140, crowdedSeconds: 10874},
    },

    simulation: PANIC_BEHAVIOR,

    obstacles: [
        // Spielfeldbegrenzung oben, unten und links: Nach links gibt es keinen Ausweg.
        wall(0, 0, 1000, 0),
        wall(0, 700, 1000, 700),
        wall(0, 0, 0, 700),

        // Säulen im Startbereich: Sie teilen die Menge vor dem Trichter.
        circle(305, 190, 18),
        circle(305, 510, 18),
        circle(360, 350, 20),

        // 1) EINGANGSTRICHTER: Der Startplatz verengt sich auf 150 Pixel.
        wall(260, 0, 430, 275),
        wall(260, 700, 430, 425),

        // 2) DREI WEGE zum Tor, getrennt durch zwei Inseln aus Wänden:
        //    - Mitte:  der kürzeste Weg, aber nur etwa vier Personen breit
        //    - oben:   länger, mit einer schrägen Engstelle
        //    - unten:  am längsten, mit einem Slalom, dafür breit
        //    Ist die Mitte verstopft, können sich die Umwege lohnen.
        // Obere Insel
        wall(530, 320, 580, 175),
        wall(580, 175, 760, 175),
        wall(760, 175, 790, 320),
        wall(790, 320, 530, 320),
        // Untere Insel
        wall(530, 380, 580, 525),
        wall(580, 525, 760, 525),
        wall(760, 525, 790, 380),
        wall(790, 380, 530, 380),
        // Schräge Engstelle im oberen Weg
        wall(610, 0, 690, 105),
        // Slalom im unteren Weg
        wall(630, 700, 630, 605),
        wall(700, 525, 700, 620),

        // 3) TÜR: Alle drei Wege laufen auf eine schmale Tür (etwa neun
        //    Personen breit) zu. Sie liegt unterhalb der Mitte, das Tor dagegen
        //    darüber, die Menge muss dahinter also quer durch die Kammer.
        wall(840, 0, 840, 385),
        wall(840, 475, 840, 700),

        // Säulen in der Kammer hinter der Tür: Der Strom verteilt sich vor dem Trichter.
        circle(895, 200, 20),
        circle(895, 480, 20),

        // 4) ZWEITER TRICHTER, der exakt an den Torkanten endet. Davor steht
        //    eine Schikane: Die Menge muss um die Wand herum und drängt sich
        //    dann durchs Tor.
        wall(850, 0, 1000, 250),
        wall(850, 700, 1000, 350),
        wall(950, 240, 950, 360),

        // Wand am rechten Rand mit einem Tor (y 250 bis 350)
        wall(1000, 0, 1000, 250),
        wall(1000, 350, 1000, 700),
    ],
};

/** Wege: 0 = Mitte (Tunnel), 1 = oben, 2 = unten. */
export const HALLENBRAND: Scenario = {
    level,
    inventory: {marshals: 2, barrierMeters: 25},
    // Schilder dort, wo sich der Weg teilt (hinter dem Trichter), entlasten den Mitteltunnel.
    plan: createPlan({
        releaseDelays: [],
        signs: [
            {position: {x: 480, y: 150}, route: 1, strength: 0.9},
            {position: {x: 480, y: 550}, route: 2, strength: 0.9},
        ],
    }),
    examples: [
        {
            name: "Gitter macht den Mitteltunnel halb zu",
            plan: createPlan({barriers: [{start: {x: 548, y: 330}, end: {x: 548, y: 370}}]}),
        },
        {
            name: "Gitter-Trichter vor der Tür (verstopft)",
            plan: createPlan({
                barriers: [
                    {start: {x: 760, y: 330}, end: {x: 830, y: 380}},
                    {start: {x: 760, y: 520}, end: {x: 830, y: 480}},
                ],
            }),
        },
        {
            name: "Zwei Ordner an der Gabelung (hilft kaum)",
            plan: createPlan({
                marshals: [
                    {position: {x: 480, y: 150}, route: 1},
                    {position: {x: 480, y: 550}, route: 2},
                ],
            }),
        },
        {
            name: "Schilder am Startplatz (zu früh, hilft wenig)",
            plan: createPlan({
                releaseDelays: [],
                signs: [
                    {position: {x: 240, y: 110}, route: 1, strength: 0.9},
                    {position: {x: 240, y: 590}, route: 2, strength: 0.9},
                ],
            }),
        },
        {
            name: "Schild nur zum Mitteltunnel",
            plan: createPlan({
                releaseDelays: [],
                signs: [{position: {x: 460, y: 350}, route: 0, strength: 0.9}],
            }),
        },
    ],
};
