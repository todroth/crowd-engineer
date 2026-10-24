import type {Level} from "../../simulation/Level.ts";
import type {Scenario} from "../Scenario.ts";
import {CALM_BEHAVIOR, WALKING_SPEED} from "./behavior.ts";
import {circle, rectangle, wall} from "./shapes.ts";

const level: Level = {
    name: "Festival: Brücke",
    description: "Geordnete Räumung: Das Gelände liegt hinter einem Fluss. Es gibt nur die Hauptbrücke und einen schmalen Steg im Norden.",

    worldWidth: 1000,
    worldHeight: 700,
    pixelsPerMeter: 16,
    agentCount: 1400,
    seed: 1,

    // Das Festivalgelände links vom Fluss. Die Blöcke sind Streifen quer zur
    // Laufrichtung (von weit weg bis nah an der Brücke).
    spawnArea: {x: 30, y: 60, width: 370, height: 580},
    sectors: [
        {x: 30, y: 60, width: 130, height: 580},
        {x: 160, y: 60, width: 130, height: 580},
        {x: 290, y: 60, width: 110, height: 580},
    ],
    entryArea: {x: -30, y: 60, width: 25, height: 580},
    respawn: false,
    timeLimit: 600,
    // Der Ausgang am rechten Rand.
    goalAreas: [{x: 1000, y: 296, width: 40, height: 108}],
    walkingSpeed: WALKING_SPEED,
    // Zugänge der beiden Übergänge: Hauptbrücke und Steg im Norden.
    routes: [
        {x: 360, y: 320, width: 70, height: 60},
        {x: 360, y: 80, width: 70, height: 40},
    ],

    // Ergebnis des Standardplans mit diesem Seed (`npm run scenarios`); bei Änderungen neu eintragen.
    // Bei geordneter Räumung gilt Gedränge schon ab 2,5 Personen/m² als unangenehm.
    scoring: {
        injuryPenalty: 1,
        crowdingThreshold: 2.5,
        crowdingPenalty: 0.01,
        reference: {duration: 151, injured: 19, crowdedSeconds: 47760},
    },

    simulation: CALM_BEHAVIOR,

    obstacles: [
        // Außenwände.
        wall(0, 0, 1000, 0),
        wall(0, 700, 1000, 700),
        wall(0, 0, 0, 700),

        // Der Fluss (x 430 bis 570) mit zwei Übergängen: dem Steg (y 70 bis 130)
        // und der Hauptbrücke (y 310 bis 390). Die Ufer sind Rechtecke.
        rectangle(430, 0, 140, 70),
        rectangle(430, 130, 140, 180),
        rectangle(430, 390, 140, 310),

        // Bühne, Stände und Bäume auf dem Gelände.
        rectangle(40, 280, 60, 140),
        rectangle(160, 140, 70, 40),
        rectangle(160, 520, 70, 40),
        rectangle(270, 330, 50, 40),
        circle(250, 250, 18),
        circle(250, 450, 18),
        circle(340, 160, 18),
        circle(340, 540, 18),

        // Trichter hinter der Brücke: führt die Menge auf den Ausgang zu.
        wall(680, 0, 1000, 290),
        wall(680, 700, 1000, 410),

        // Rechte Außenwand mit dem Ausgang (y 290 bis 410).
        wall(1000, 0, 1000, 290),
        wall(1000, 410, 1000, 700),
    ],
};

export const FESTIVAL: Scenario = {
    level,
    plan: {releaseDelays: [0, 0, 0]},
};
