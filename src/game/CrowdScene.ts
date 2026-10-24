import Phaser from "phaser";
import {Simulation} from "../simulation/Simulation.ts";
import type {Level} from "../simulation/Level.ts";
import {type NamedPlan, scenarioPlans} from "./Scenario.ts";
import {SCENARIOS} from "./scenarios.ts";
import {drawFlowField, drawGrid, drawObstacles, drawSigns} from "./view/drawLevel.ts";
import {PeopleView} from "./view/PeopleView.ts";
import {resultText} from "./view/resultText.ts";

/** Wählbare Abspielgeschwindigkeiten (Taste S). */
const SPEEDS = [1, 2, 4] as const;

/** Auswahl, mit der die Szene (neu) gestartet wird. */
interface Selection {
    /** Index in `SCENARIOS`. */
    readonly scenario: number;
    /** Index in `scenarioPlans(...)`. */
    readonly plan: number;
}

/**
 * Die einzige Szene: zeigt ein Szenario mit einem Plan und lässt die Simulation
 * laufen. Ein Szenario- oder Planwechsel startet die Szene neu.
 *
 * Tasten: 1–9 Szenario, P nächster Plan, Leertaste Neustart, S Tempo,
 * R Flow-Field anzeigen. URL: `?scenario=2&plan=1` (Szenario ab 1, Plan ab 0).
 */
export class CrowdScene extends Phaser.Scene {
    private simulation!: Simulation;
    private level!: Level;
    private selection!: Selection;
    /** Index in `SPEEDS`; bleibt über Neustarts erhalten (die Szene-Instanz bleibt dieselbe). */
    private speedIndex = 0;

    private people!: PeopleView;
    private flowGraphics!: Phaser.GameObjects.Graphics;
    private showFlowDebug = false;
    private statusText!: Phaser.GameObjects.Text;
    private resultShown = false;

    constructor() {
        super("CrowdScene");
    }

    /** Phaser übergibt beim ersten Start ein leeres Objekt, bei `restart` eine `Selection`. */
    create(data?: Partial<Selection>): void {
        this.selection =
            data?.scenario === undefined
                ? selectionFromUrl()
                : {scenario: data.scenario, plan: data.plan ?? 0};

        const scenario = SCENARIOS[this.selection.scenario];
        const {plan} = this.plans()[this.selection.plan];

        this.level = scenario.level;
        this.simulation = new Simulation(scenario.level, plan);
        this.resultShown = false;

        drawGrid(this, this.level);
        drawObstacles(this, this.level);
        drawSigns(this, plan, this.simulation);
        this.people = new PeopleView(this, this.simulation.agents);
        this.flowGraphics = this.add.graphics().setDepth(10);
        this.createTexts();
        this.bindKeys();
    }

    override update(_time: number, delta: number): void {
        this.simulation.update((delta / 1000) * SPEEDS[this.speedIndex]);
        this.people.update(this.simulation.agents);
        this.updateStatus();
    }

    private plans(): readonly NamedPlan[] {
        return scenarioPlans(SCENARIOS[this.selection.scenario]);
    }

    private bindKeys(): void {
        const {KeyCodes} = Phaser.Input.Keyboard;
        const onKey = (key: number, action: () => void): void => {
            this.input.keyboard?.addKey(key).on("down", action);
        };

        onKey(KeyCodes.R, () => {
            this.showFlowDebug = !this.showFlowDebug;
            this.flowGraphics.clear();

            if (this.showFlowDebug) {
                drawFlowField(this.flowGraphics, this.simulation.flowField, this.level.simulation.flowCellSize);
            }
        });
        onKey(KeyCodes.SPACE, () => this.scene.restart(this.selection));
        onKey(KeyCodes.P, () =>
            this.scene.restart({
                scenario: this.selection.scenario,
                plan: (this.selection.plan + 1) % this.plans().length,
            }),
        );
        onKey(KeyCodes.S, () => {
            this.speedIndex = (this.speedIndex + 1) % SPEEDS.length;
        });

        SCENARIOS.slice(0, 9).forEach((_, index) => {
            onKey(KeyCodes.ONE + index, () => this.scene.restart({scenario: index, plan: 0}));
        });
    }

    private createTexts(): void {
        this.statusText = this.add
            .text(12, 10, "", {fontFamily: "monospace", fontSize: "16px", color: "#ffffff"})
            .setDepth(20);

        // Am unteren Rand verankert und umbrochen, damit lange Texte im Bild bleiben.
        this.add
            .text(12, this.level.worldHeight - 8, this.scenarioMenu(), {
                fontFamily: "monospace",
                fontSize: "13px",
                color: "#9aacc7",
                wordWrap: {width: this.level.worldWidth - 24},
            })
            .setOrigin(0, 1)
            .setDepth(20);
    }

    /** Text unten: Szenarien zum Umschalten, Beschreibung des aktuellen, Plan. */
    private scenarioMenu(): string {
        const keys = SCENARIOS
            .map((scenario, index) =>
                `${index === this.selection.scenario ? "▶" : " "}${index + 1} ${scenario.level.name}`)
            .join("   ");

        return (
            `${keys}\n${this.level.description}\n` +
            `Plan: ${this.plans()[this.selection.plan].name}   [P: nächster Plan]`
        );
    }

    private updateStatus(): void {
        const {arrived, total, elapsed, injured} = this.simulation.stats;

        this.statusText.setText(
            `Evakuiert ${arrived}/${total}   Verletzt ${injured}   Zeit ${elapsed.toFixed(1)} s   ` +
            `[S: Tempo ${SPEEDS[this.speedIndex]}x   Leertaste: Neustart]`,
        );

        if (this.simulation.finished && !this.resultShown) {
            this.resultShown = true;
            this.showResult();
        }
    }

    private showResult(): void {
        this.add
            .text(
                this.level.worldWidth / 2,
                this.level.worldHeight / 2,
                resultText(this.simulation.stats, this.level.scoring),
                {
                    fontFamily: "monospace",
                    fontSize: "22px",
                    color: "#ffffff",
                    backgroundColor: "#101820e6",
                    padding: {x: 24, y: 18},
                    align: "left",
                },
            )
            .setOrigin(0.5)
            .setDepth(30);
    }
}

/** Startauswahl aus der URL; ungültige oder fehlende Werte fallen auf das erste Szenario und den Startplan zurück. */
function selectionFromUrl(): Selection {
    const query = new URLSearchParams(window.location.search);
    const scenario = validIndex(Number(query.get("scenario") ?? 1) - 1, SCENARIOS.length);
    const plan = validIndex(Number(query.get("plan") ?? 0), scenarioPlans(SCENARIOS[scenario]).length);

    return {scenario, plan};
}

function validIndex(value: number, length: number): number {
    return Number.isInteger(value) && value >= 0 && value < length ? value : 0;
}
