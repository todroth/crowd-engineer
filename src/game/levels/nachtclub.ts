import type {Level} from "../../simulation/Level.ts";
import type {Scenario} from "../Scenario.ts";
import {PANIC_BEHAVIOR, RUNNING_SPEED} from "./behavior.ts";
import {circle, rectangle, wall} from "./shapes.ts";

const level: Level = {
    name: "Nachtclub",
    description: "Panik: Zwei Ausgänge. Der Notausgang unten links ist eng, der Hauptausgang führt durch Tür und Drehkreuze.",

    worldWidth: 1000,
    worldHeight: 700,
    pixelsPerMeter: 16,
    agentCount: 1600,
    seed: 1,

    // Die Tanzfläche zwischen Bühne und Tür.
    spawnArea: {x: 160, y: 90, width: 400, height: 520},
    // Bei Panik wartet niemand auf eine Freigabe: keine Startblöcke.
    sectors: [],
    entryArea: {x: -30, y: 90, width: 25, height: 520},
    respawn: false,
    timeLimit: 240,
    goalAreas: [
        // Hauptausgang rechts, hinter den Drehkreuzen.
        {x: 1000, y: 220, width: 40, height: 180},
        // Notausgang unten links.
        {x: 50, y: 700, width: 50, height: 40},
    ],
    walkingSpeed: RUNNING_SPEED,
    // Zugänge der beiden Ausgänge: Tür zur Vorhalle und Notausgang.
    routes: [
        {x: 600, y: 350, width: 70, height: 40},
        {x: 30, y: 620, width: 80, height: 60},
    ],

    // Ergebnis des Standardplans mit diesem Seed (`npm run scenarios`); bei Änderungen neu eintragen.
    scoring: {
        injuryPenalty: 1,
        crowdingThreshold: 4,
        crowdingPenalty: 0.01,
        reference: {duration: 47, injured: 43, crowdedSeconds: 8520},
    },

    simulation: PANIC_BEHAVIOR,

    obstacles: [
        // Außenwände; der Notausgang ist eine Lücke in der unteren Wand (x 50 bis 100).
        wall(0, 0, 1000, 0),
        wall(0, 0, 0, 700),
        wall(0, 700, 50, 700),
        wall(100, 700, 1000, 700),

        // Bühne an der linken Wand und Bar an der oberen Wand.
        rectangle(20, 230, 100, 240),
        rectangle(300, 24, 260, 44),

        // Säulen auf der Tanzfläche.
        circle(330, 270, 16),
        circle(330, 430, 16),
        circle(470, 350, 18),

        // Wand zur Vorhalle mit einer schmalen Tür (y 345 bis 395).
        wall(680, 0, 680, 345),
        wall(680, 395, 680, 700),

        // Drehkreuze: drei Spuren von nur 24 Pixel Breite.
        rectangle(880, 0, 20, 232),
        rectangle(880, 256, 20, 40),
        rectangle(880, 320, 20, 40),
        rectangle(880, 384, 20, 316),

        // Außenwand der Vorhalle rechts mit breiter Öffnung (y 220 bis 400).
        wall(1000, 0, 1000, 220),
        wall(1000, 400, 1000, 700),
    ],
};

export const NACHTCLUB: Scenario = {
    level,
    plan: {releaseDelays: []},
};
