import type {Level} from "../../simulation/Level.ts";
import {createPlan} from "../../simulation/Plan.ts";
import type {Scenario} from "../Scenario.ts";
import {CALM_BEHAVIOR, WALKING_SPEED} from "./behavior.ts";
import {circle, rectangle, wall} from "./shapes.ts";

const level: Level = {
    name: "Festival: Brücke",
    description: "Geordnete Räumung: Hinter dem Fluss liegen zwei Ausgänge. Die Menge kennt nur den Hauptausgang, der Steg im Norden führt zu einem unbekannten Nordausgang.",

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
    goalAreas: [
        // Hauptausgang am rechten Rand, über die Hauptbrücke erreichbar.
        {x: 1000, y: 296, width: 40, height: 108},
        // Nordausgang oben rechts, nur über den Steg bekannt.
        {x: 1000, y: 36, width: 40, height: 68},
    ],
    walkingSpeed: WALKING_SPEED,
    // Zugänge der beiden Übergänge: Hauptbrücke und Steg im Norden. Der Nordausgang
    // ist unbekannt: Die Menge läuft zur Hauptbrücke, bis jemand den Steg sieht oder
    // ein Schild darauf zeigt.
    routes: [
        {entrance: {x: 360, y: 320, width: 70, height: 60}},
        {entrance: {x: 360, y: 80, width: 70, height: 40}, exit: 1},
    ],

    // Ergebnis des Laufs ohne Maßnahmen mit diesem Seed (`npm run scenarios`, Zeile "Ohne Maßnahmen");
    // bei Änderungen neu eintragen.
    // Bei geordneter Räumung gilt Gedränge schon ab 2,5 Personen/m² als unangenehm.
    scoring: {
        injuryPenalty: 1,
        crowdingThreshold: 2.5,
        crowdingPenalty: 0.01,
        reference: {duration: 144, injured: 10, crowdedSeconds: 42815},
    },

    simulation: CALM_BEHAVIOR,

    obstacles: [
        // Außenwände.
        wall(0, 0, 1000, 0),
        wall(0, 700, 1000, 700),
        wall(0, 0, 0, 700),

        // Der Fluss (x 430 bis 570) mit zwei Übergängen: dem Steg (y 60 bis 140)
        // und der Hauptbrücke (y 310 bis 390). Die Ufer sind Rechtecke.
        rectangle(430, 0, 140, 60),
        rectangle(430, 140, 140, 170),
        rectangle(430, 390, 140, 310),

        // Zaun vor dem Steg: Er verdeckt von der Wiese aus den Weg dorthin.
        wall(330, 25, 330, 215),

        // Bühne, Stände und Bäume auf dem Gelände.
        rectangle(40, 280, 60, 140),
        rectangle(160, 140, 70, 40),
        rectangle(160, 520, 70, 40),
        rectangle(270, 330, 50, 40),
        circle(250, 250, 18),
        circle(250, 450, 18),
        circle(340, 160, 18),
        circle(340, 540, 18),

        // Trichter hinter der Brücke führt die Menge auf den Hauptausgang zu; über
        // ihm bleibt eine Gasse vom Steg zum Nordausgang frei.
        wall(700, 170, 1000, 290),
        wall(680, 700, 1000, 410),

        // Rechte Außenwand mit dem Hauptausgang (y 290 bis 410) und dem Nordausgang (y 30 bis 110).
        wall(1000, 0, 1000, 30),
        wall(1000, 110, 1000, 290),
        wall(1000, 410, 1000, 700),
    ],
};

/** Wege: 0 = Hauptbrücke, 1 = Steg im Norden. */
export const FESTIVAL: Scenario = {
    level,
    inventory: {marshals: 2},
    examples: [
        {
            name: "Zwei Ordner auf der Wiese weisen zum Steg",
            plan: createPlan({
                marshals: [
                    {position: {x: 250, y: 300}, route: 1},
                    {position: {x: 340, y: 200}, route: 1},
                ],
            }),
        },
    ],
    // Ein Schild weist von der Wiese zum Steg und entlastet die Hauptbrücke ein wenig.
    plan: createPlan({
        releaseDelays: [0, 0, 0],
        signs: [{position: {x: 260, y: 300}, route: 1, strength: 0.9}],
    }),
};
