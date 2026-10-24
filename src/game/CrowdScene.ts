import Phaser from "phaser";
import {AGENT_RADIUS} from "../simulation/AgentSpawner.ts";
import {Simulation} from "../simulation/Simulation.ts";
import type {Level} from "../simulation/Level.ts";
import type {Vector2} from "../simulation/Vector2.ts";
import {calculateCost, referenceCost} from "../simulation/scoring.ts";
import {loadBestCost, saveBestCost} from "./bestScores.ts";
import {PlanEditor} from "./PlanEditor.ts";
import {DEFAULT_SIGN_BUDGET, type NamedPlan, type Scenario, scenarioPlans} from "./Scenario.ts";
import {SCENARIOS} from "./scenarios.ts";
import {createRouteMarkers, drawExits, drawFloor, drawFlowField, drawObstacles} from "./view/drawLevel.ts";
import {PeopleView} from "./view/PeopleView.ts";
import {resultText} from "./view/resultText.ts";
import {SignsView} from "./view/SignsView.ts";
import {createPersonTextures} from "./view/textures.ts";
import {THEME} from "./view/theme.ts";
import {BOTTOM_BAR_HEIGHT, TOP_BAR_HEIGHT, VIEW_HEIGHT, VIEW_WIDTH} from "./view/layout.ts";

/** Wählbare Abspielgeschwindigkeiten (Taste S). */
const SPEEDS = [1, 2, 4] as const;

const DEPTH_DEBUG = 10;
const DEPTH_HUD = 20;
const DEPTH_RESULT = 30;

/**
 * Planung: Die Menge steht, der Spieler stellt Schilder auf. Lauf: Die
 * Simulation läuft, der Plan ist fest. Ergebnis: Tafel mit der Wertung.
 */
type Phase = "planning" | "running" | "result";

/** Auswahl, mit der die Szene (neu) gestartet wird. */
interface Selection {
    /** Index in `SCENARIOS`. */
    readonly scenario: number;
    /** Index in `scenarioPlans(...)`: die Vorlage, die in den Editor geladen wird. */
    readonly plan: number;
}

/**
 * Die einzige Szene. Ein Szenario wird geplant, gespielt und gewertet; ein
 * Szenariowechsel startet die Szene neu, alles andere passiert in ihr.
 *
 * Tasten: Enter Start, Leertaste zurück zur Planung, P nächste Vorlage,
 * C alle Schilder entfernen, 1–9 Szenario, S Tempo, F Flow-Field.
 * Maus (Planung): Klick stellt ein Schild auf oder auf den nächsten Weg um,
 * Rechtsklick entfernt es. URL: `?scenario=2&plan=1&run` (Szenario ab 1, Plan
 * ab 0, `run` startet sofort ohne Planung).
 */
export class CrowdScene extends Phaser.Scene {
    private scenario!: Scenario;
    private level!: Level;
    private selection!: Selection;
    private editor!: PlanEditor;
    private simulation!: Simulation;
    private phase: Phase = "planning";
    /** Index in `SPEEDS`; bleibt über Neustarts erhalten (die Szene-Instanz bleibt dieselbe). */
    private speedIndex = 0;

    private people?: PeopleView;
    private signs!: SignsView;
    private routeMarkers!: Phaser.GameObjects.Container;
    private flowGraphics!: Phaser.GameObjects.Graphics;
    private showFlowDebug = false;
    private statusText!: Phaser.GameObjects.Text;
    private infoText!: Phaser.GameObjects.Text;
    private resultPanel?: Phaser.GameObjects.Text;

    constructor() {
        super("CrowdScene");
    }

    /** Phaser übergibt beim ersten Start ein leeres Objekt, bei `restart` eine `Selection`. */
    create(data?: Partial<Selection>): void {
        this.selection =
            data?.scenario === undefined
                ? selectionFromUrl()
                : {scenario: data.scenario, plan: data.plan ?? 0};
        this.scenario = SCENARIOS[this.selection.scenario];
        this.level = this.scenario.level;
        this.editor = new PlanEditor(
            this.plans()[this.selection.plan].plan,
            this.level.routes.length,
            this.scenario.signBudget ?? DEFAULT_SIGN_BUDGET,
        );
        this.people = undefined;

        createPersonTextures(this, AGENT_RADIUS);
        drawFloor(this, this.level);
        drawObstacles(this, this.level);
        drawExits(this, this.level);
        this.routeMarkers = createRouteMarkers(this, this.level);
        this.signs = new SignsView(this);
        this.flowGraphics = this.add.graphics().setDepth(DEPTH_DEBUG);
        this.createHud();
        this.bindKeys();
        this.bindPointer();
        this.enterPlanning();

        // `?run` in der URL startet sofort (praktisch für Screenshots und zum Zuschauen).
        if (data?.scenario === undefined && new URLSearchParams(window.location.search).has("run")) {
            this.startRun();
        }
    }

    override update(_time: number, delta: number): void {
        if (this.phase === "running") {
            this.simulation.update((delta / 1000) * SPEEDS[this.speedIndex]);
            this.people?.update(this.simulation.agents);

            if (this.simulation.finished) {
                this.showResult();
            }
        }

        this.updateStatus();
    }

    private plans(): readonly NamedPlan[] {
        return scenarioPlans(this.scenario);
    }

    // --- Phasen ---------------------------------------------------------------

    /** Baut die Simulation für den aktuellen Plan neu auf: Die Menge steht am Start. */
    private enterPlanning(): void {
        this.phase = "planning";
        this.resultPanel?.destroy();
        this.resultPanel = undefined;
        this.rebuildSimulation();
        this.routeMarkers.setVisible(true);
        this.updateInfo();
    }

    private startRun(): void {
        this.phase = "running";
        this.signs.showGhost(null, this.simulation);
        this.routeMarkers.setVisible(false);
        this.updateInfo();
    }

    private showResult(): void {
        this.phase = "result";

        const stats = this.simulation.stats;
        const cost = Math.round(calculateCost(stats, this.level.scoring).total);
        const previous = loadBestCost(this.level.name);
        const isNew = saveBestCost(this.level.name, cost);

        this.resultPanel = this.add
            .text(
                this.level.worldWidth / 2,
                this.level.worldHeight / 2,
                resultText(stats, this.level.scoring, {previous, isNew}),
                {
                    fontFamily: THEME.font,
                    fontSize: "20px",
                    color: THEME.text,
                    backgroundColor: "#0b1118ee",
                    padding: {x: 24, y: 18},
                },
            )
            .setOrigin(0.5)
            .setDepth(DEPTH_RESULT);
        this.updateInfo();
    }

    /** Neue Simulation mit dem Plan aus dem Editor; Schilder und Menge neu zeichnen. */
    private rebuildSimulation(): void {
        this.simulation = new Simulation(this.level, this.editor.plan);
        this.people?.destroy();
        this.people = new PeopleView(this, this.simulation.agents);
        this.signs.draw(this.editor.plan.signs, this.simulation);
        this.redrawFlowDebug();
    }

    // --- Eingabe --------------------------------------------------------------

    private bindKeys(): void {
        const {KeyCodes} = Phaser.Input.Keyboard;
        const onKey = (key: number, action: () => void): void => {
            this.input.keyboard?.addKey(key).on("down", action);
        };

        onKey(KeyCodes.ENTER, () => {
            if (this.phase === "planning") {
                this.startRun();
            }
        });
        onKey(KeyCodes.SPACE, () => this.enterPlanning());
        onKey(KeyCodes.P, () => {
            const plan = (this.selection.plan + 1) % this.plans().length;

            this.selection = {...this.selection, plan};
            this.editor.load(this.plans()[plan].plan);
            this.enterPlanning();
        });
        onKey(KeyCodes.C, () => {
            if (this.phase === "planning") {
                this.editor.clear();
                this.rebuildSimulation();
                this.updateInfo();
            }
        });
        onKey(KeyCodes.S, () => {
            this.speedIndex = (this.speedIndex + 1) % SPEEDS.length;
        });
        onKey(KeyCodes.F, () => {
            this.showFlowDebug = !this.showFlowDebug;
            this.redrawFlowDebug();
        });

        SCENARIOS.slice(0, 9).forEach((_, index) => {
            onKey(KeyCodes.ONE + index, () => this.scene.restart({scenario: index, plan: 0}));
        });
    }

    private bindPointer(): void {
        this.input.mouse?.disableContextMenu();

        this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
            if (this.phase !== "planning") {
                return;
            }

            const position = {x: pointer.worldX, y: pointer.worldY};
            const changed = pointer.rightButtonDown()
                ? this.editor.remove(position)
                : this.editor.click(position, this.simulation);

            if (changed) {
                this.rebuildSimulation();
                this.updateInfo();
            }

            this.updateGhost(position);
        });

        this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
            if (this.phase === "planning") {
                this.updateGhost({x: pointer.worldX, y: pointer.worldY});
            }
        });
    }

    /** Vorschau des Schildes, das ein Klick hier aufstellen würde. */
    private updateGhost(position: Vector2): void {
        const placeable =
            this.editor.signAt(position) < 0 && this.editor.canPlace(position, this.simulation);

        this.signs.showGhost(
            placeable
                ? {position, route: this.editor.nearestRoute(position, this.simulation), strength: 1}
                : null,
            this.simulation,
        );
    }

    private redrawFlowDebug(): void {
        this.flowGraphics.clear();

        if (this.showFlowDebug) {
            drawFlowField(this.flowGraphics, this.simulation.flowField, this.level.simulation.flowCellSize);
        }
    }

    // --- Anzeige --------------------------------------------------------------

    /** Leisten oben und unten; sie bewegen sich nicht mit der Kamera. */
    private createHud(): void {
        // Die Welt beginnt unter der Statusleiste.
        this.cameras.main.setScroll(0, -TOP_BAR_HEIGHT);

        const bars = this.add.graphics().setDepth(DEPTH_HUD).setScrollFactor(0);

        bars.fillStyle(THEME.panel, 1);
        bars.fillRect(0, 0, VIEW_WIDTH, TOP_BAR_HEIGHT);
        bars.fillRect(0, VIEW_HEIGHT - BOTTOM_BAR_HEIGHT, VIEW_WIDTH, BOTTOM_BAR_HEIGHT);

        this.statusText = this.add
            .text(12, 8, "", {fontFamily: THEME.font, fontSize: "16px", color: THEME.text})
            .setDepth(DEPTH_HUD)
            .setScrollFactor(0);
        this.infoText = this.add
            .text(12, VIEW_HEIGHT - BOTTOM_BAR_HEIGHT + 8, "", {
                fontFamily: THEME.font,
                fontSize: "13px",
                color: THEME.mutedText,
                wordWrap: {width: VIEW_WIDTH - 24},
                lineSpacing: 3,
            })
            .setDepth(DEPTH_HUD)
            .setScrollFactor(0);
    }

    private updateStatus(): void {
        const speed = `[S] Tempo ${SPEEDS[this.speedIndex]}x`;

        if (this.phase === "planning") {
            const best = loadBestCost(this.level.name);
            const reference = referenceCost(this.level.scoring).total;

            this.statusText.setText(
                `PLANUNG   Schilder ${this.editor.signCount}/${this.editor.budget}   ` +
                `Ohne Maßnahmen ${reference.toFixed(0)}   Bestwert ${best?.toFixed(0) ?? "–"}   ${speed}`,
            );
            return;
        }

        const {arrived, total, elapsed, injured} = this.simulation.stats;

        this.statusText.setText(
            `Evakuiert ${arrived}/${total}   Verletzt ${injured}   Zeit ${elapsed.toFixed(1)} s   ${speed}`,
        );
    }

    /** Text unten: Szenarien, Beschreibung, Plan und was man gerade tun kann. */
    private updateInfo(): void {
        const scenarios = SCENARIOS
            .map((scenario, index) =>
                `${index === this.selection.scenario ? "▶" : " "}${index + 1} ${scenario.level.name}`)
            .join("   ");
        const template = this.plans()[this.selection.plan].name;
        const planName = this.editor.edited ? `eigener Plan (aus „${template}“)` : template;
        const help =
            this.phase === "planning"
                ? "Klick: Schild aufstellen oder umstellen · Rechtsklick: entfernen · C: alle entfernen · " +
                  "P: nächste Vorlage · ENTER: Start"
                : "Leertaste: zurück zur Planung";

        this.infoText.setText(`${scenarios}\n${this.level.description}\nPlan: ${planName}\n${help}`);
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
