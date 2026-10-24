import type {Level} from "../../simulation/Level.ts";
import type {Scenario} from "../Scenario.ts";
import {CALM_BEHAVIOR, WALKING_SPEED} from "./behavior.ts";
import {circle, rectangle, wall} from "./shapes.ts";

const level: Level = {
    name: "Stadion nach dem Abpfiff",
    description: "Geordnete Räumung: Die Tribüne leert sich über drei Treppen und drei Tore. Staffeln spart Gedränge, kostet aber Zeit.",

    worldWidth: 1000,
    worldHeight: 700,
    pixelsPerMeter: 16,
    agentCount: 1500,
    seed: 1,

    // Die Tribüne links. Die Blöcke sind Streifen quer zur Laufrichtung (von
    // hinten nach vorn), sie nutzen also dieselben Treppen und Tore.
    spawnArea: {x: 30, y: 60, width: 220, height: 580},
    sectors: [
        {x: 30, y: 60, width: 80, height: 580},
        {x: 110, y: 60, width: 70, height: 580},
        {x: 180, y: 60, width: 70, height: 580},
    ],
    entryArea: {x: -30, y: 60, width: 25, height: 580},
    respawn: false,
    timeLimit: 600,
    goalAreas: [
        {x: 1000, y: 106, width: 40, height: 48},
        {x: 1000, y: 326, width: 40, height: 48},
        {x: 1000, y: 546, width: 40, height: 48},
    ],
    walkingSpeed: WALKING_SPEED,
    // Zugänge der drei Tore (jeweils vor ihrem Trichter). Die Menge kennt nur das
    // mittlere Tor, die beiden äußeren erkennt sie erst, wenn sie sie sieht oder ein
    // Schild darauf zeigt.
    routes: [
        {entrance: {x: 880, y: 70, width: 40, height: 100}, exit: 0},
        {entrance: {x: 880, y: 285, width: 40, height: 130}},
        {entrance: {x: 880, y: 500, width: 40, height: 150}, exit: 2},
    ],

    // Ergebnis des Laufs ohne Maßnahmen mit diesem Seed (`npm run scenarios`, Zeile "Ohne Maßnahmen");
    // bei Änderungen neu eintragen.
    // Bei geordneter Räumung gilt Gedränge schon ab 2,5 Personen/m² als unangenehm.
    scoring: {
        injuryPenalty: 1,
        crowdingThreshold: 2.5,
        crowdingPenalty: 0.01,
        reference: {duration: 127, injured: 0, crowdedSeconds: 43509},
    },

    simulation: CALM_BEHAVIOR,

    obstacles: [
        // Außenwände.
        wall(0, 0, 1000, 0),
        wall(0, 700, 1000, 700),
        wall(0, 0, 0, 700),

        // Wand der Tribüne mit drei Treppenaufgängen (je 48 Pixel breit).
        wall(270, 0, 270, 150),
        wall(270, 210, 270, 320),
        wall(270, 380, 270, 490),
        wall(270, 550, 270, 700),

        // Kioske und Pflanzkübel auf dem Vorplatz.
        rectangle(430, 190, 80, 50),
        rectangle(430, 460, 80, 50),
        rectangle(580, 310, 60, 80),
        rectangle(700, 120, 70, 50),
        rectangle(700, 530, 70, 50),
        circle(520, 110, 22),
        circle(520, 590, 22),

        // Drei Trichter zu den Toren am rechten Rand (Tore bei y 100 bis 160,
        // 320 bis 380 und 540 bis 600). Die Zacken dazwischen sind geschlossen.
        wall(860, 0, 1000, 100),
        wall(860, 235, 1000, 160),
        wall(860, 245, 1000, 320),
        wall(860, 455, 1000, 380),
        wall(860, 465, 1000, 540),
        wall(860, 700, 1000, 600),

        // Rechte Außenwand zwischen den Toren.
        wall(1000, 0, 1000, 100),
        wall(1000, 160, 1000, 320),
        wall(1000, 380, 1000, 540),
        wall(1000, 600, 1000, 700),
    ],
};

/** Wege: 0 = oberes Tor, 1 = mittleres Tor (bekannt), 2 = unteres Tor. */
export const STADION: Scenario = {
    level,
    inventory: {signs: 4},
    // Vier Schilder an den Treppen weisen auf die beiden unbekannten äußeren Tore.
    plan: {
        releaseDelays: [0, 0, 0],
        signs: [
            {position: {x: 330, y: 120}, route: 0, strength: 0.9},
            {position: {x: 330, y: 230}, route: 0, strength: 0.9},
            {position: {x: 330, y: 470}, route: 2, strength: 0.9},
            {position: {x: 330, y: 580}, route: 2, strength: 0.9},
        ],
    },
    examples: [
        {
            name: "Schilder erst im Vorplatz (wirkt besser als der Startplan)",
            plan: {
                releaseDelays: [0, 0, 0],
                signs: [
                    {position: {x: 600, y: 230}, route: 0, strength: 0.9},
                    {position: {x: 600, y: 470}, route: 2, strength: 0.9},
                ],
            },
        },
    ],
};
