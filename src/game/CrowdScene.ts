import Phaser from "phaser";
import {AGENT_RADIUS} from "../simulation/AgentSpawner.ts";
import {Simulation} from "../simulation/Simulation.ts";
import type {Level} from "../simulation/Level.ts";
import type {Vector2} from "../simulation/Vector2.ts";
import {calculateCost, referenceCost} from "../simulation/scoring.ts";
import {loadBestCost, saveBestCost} from "./bestScores.ts";
import {type Change, PlanEditor, type Tool} from "./PlanEditor.ts";
import {type NamedPlan, type Scenario, scenarioInventory, scenarioPlans} from "./Scenario.ts";
import {SCENARIOS} from "./scenarios.ts";
import {createRouteMarkers, drawExits, drawFloor, drawFlowField, drawObstacles} from "./view/drawLevel.ts";
import {BOTTOM_BAR_HEIGHT, TOP_BAR_HEIGHT, VIEW_HEIGHT, WORLD_HEIGHT, WORLD_WIDTH} from "./view/layout.ts";
import {PeopleView} from "./view/PeopleView.ts";
import {type PanelModel, PlanPanel} from "./view/PlanPanel.ts";
import {PlanItemsView} from "./view/PlanItemsView.ts";
import {resultText} from "./view/resultText.ts";
import {createPersonTextures} from "./view/textures.ts";
import {THEME, TEXT_RESOLUTION} from "./view/theme.ts";
import {DEPTH_HUD} from "./view/ui.ts";

/** Wählbare Abspielgeschwindigkeiten (Taste S). */
const SPEEDS = [1, 2, 4] as const;

const DEPTH_DEBUG = 10;
const DEPTH_RESULT = 30;

/** Anzeigename und Taste je Werkzeug. */
const TOOLS: readonly {readonly kind: Tool; readonly name: string; readonly key: string}[] = [
    {kind: "sign", name: "Schild", key: "1"},
];

/**
 * Planung: Die Menge steht, der Spieler stellt Elemente auf. Lauf: Die
 * Simulation läuft, der Plan ist fest. Ergebnis: Tafel mit der Wertung.
 */
type Phase = "planning" | "running" | "result";

/** Auswahl, mit der die Szene (neu) gestartet wird. */
interface Selection {
    /** Index in `SCENARIOS`. */
    readonly scenario: number;
    /** Index in `scenarioPlans(...)`: Vorlage, die in den Editor geladen wird (ohne Angabe: leerer Plan). */
    readonly plan?: number;
}

/**
 * Die einzige Szene. Ein Szenario wird geplant, gespielt und gewertet; ein
 * Szenariowechsel startet die Szene neu, alles andere passiert in ihr.
 *
 * Planung: Werkzeug in der Seitenleiste wählen (Tasten 1–), Klick ins Freie
 * platziert, Klick auf ein Element wählt es aus, Ziehen verschiebt, Rechtsklick
 * oder Entf entfernt. Enter startet, im Lauf geht die Leertaste zurück zur
 * Planung, S ändert das Tempo, F zeigt das Flow-Field.
 * URL: `?scenario=2&plan=1&run` (Szenario ab 1, Vorlage ab 0, `run` startet sofort).
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
    private items!: PlanItemsView;
    private panel!: PlanPanel;
    /** Die Seitenleiste muss neu aufgebaut werden (geschieht einmal pro Bild). */
    private panelDirty = true;
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
        const first = data?.scenario === undefined;

        this.selection = first ? selectionFromUrl() : {scenario: data.scenario!, plan: data.plan};
        this.scenario = SCENARIOS[this.selection.scenario];
        this.level = this.scenario.level;
        this.editor = new PlanEditor(
            scenarioInventory(this.scenario),
            this.level.routes.length,
            this.selection.plan === undefined ? undefined : this.plans()[this.selection.plan].plan,
        );
        this.people = undefined;
        this.resultPanel = undefined;
        this.phase = "planning";

        createPersonTextures(this, AGENT_RADIUS);
        drawFloor(this, this.level);
        drawObstacles(this, this.level);
        drawExits(this, this.level);
        this.routeMarkers = createRouteMarkers(this, this.level);
        this.items = new PlanItemsView(this);
        this.flowGraphics = this.add.graphics().setDepth(DEPTH_DEBUG);
        this.createHud();
        this.bindKeys();
        this.bindPointer();
        this.enterPlanning();

        // `?run` in der URL startet sofort (praktisch für Screenshots und zum Zuschauen).
        if (first && new URLSearchParams(window.location.search).has("run")) {
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

        if (this.panelDirty) {
            this.panelDirty = false;
            this.panel.render(this.panelModel());
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
        this.panelDirty = true;
    }

    private startRun(): void {
        if (this.phase !== "planning") {
            return;
        }

        this.phase = "running";
        this.items.showGhost(null, this.simulation);
        this.routeMarkers.setVisible(false);
        this.updateInfo();
        this.panelDirty = true;
    }

    private showResult(): void {
        this.phase = "result";

        const stats = this.simulation.stats;
        const cost = Math.round(calculateCost(stats, this.level.scoring).total);
        const previous = loadBestCost(this.level.name);
        const isNew = saveBestCost(this.level.name, cost);

        this.resultPanel = this.add
            .text(
                WORLD_WIDTH / 2,
                WORLD_HEIGHT / 2,
                resultText(stats, this.level.scoring, {previous, isNew}),
                {
                    fontFamily: THEME.font, resolution: TEXT_RESOLUTION,
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

    /** Neue Simulation mit dem Plan aus dem Editor; Elemente und Menge neu zeichnen. */
    private rebuildSimulation(): void {
        this.simulation = new Simulation(this.level, this.editor.plan);
        this.people?.destroy();
        this.people = new PeopleView(this, this.simulation.agents);
        this.redrawItems();
        this.redrawFlowDebug();
    }

    private redrawItems(): void {
        this.items.draw(this.editor.plan, this.editor.selected, this.simulation);
    }

    /** Folgen einer Editoränderung: neu zeichnen, bei fertigen Änderungen die Simulation neu bauen. */
    private apply(change: Change): void {
        if (change === "none") {
            return;
        }

        if (change === "commit") {
            this.rebuildSimulation();
        } else {
            this.redrawItems();
        }

        this.panelDirty = true;
    }

    // --- Eingabe --------------------------------------------------------------

    private bindKeys(): void {
        const {KeyCodes} = Phaser.Input.Keyboard;
        const onKey = (key: number, action: () => void): void => {
            this.input.keyboard?.addKey(key).on("down", action);
        };
        const planningOnly = (action: () => void) => () => {
            if (this.phase === "planning") {
                action();
            }
        };

        onKey(KeyCodes.ENTER, () => this.startRun());
        onKey(KeyCodes.SPACE, () => {
            if (this.phase !== "planning") {
                this.enterPlanning();
            }
        });
        onKey(KeyCodes.DELETE, planningOnly(() => this.apply(this.editor.removeSelected())));
        onKey(KeyCodes.BACKSPACE, planningOnly(() => this.apply(this.editor.removeSelected())));
        onKey(KeyCodes.S, () => this.toggleSpeed());
        onKey(KeyCodes.F, () => {
            this.showFlowDebug = !this.showFlowDebug;
            this.redrawFlowDebug();
        });

        TOOLS.forEach(({kind, key}) => {
            onKey(KeyCodes.ONE + Number(key) - 1, planningOnly(() => this.selectTool(kind)));
        });
    }

    private bindPointer(): void {
        this.input.mouse?.disableContextMenu();

        this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
            const position = this.worldPosition(pointer);

            if (this.phase !== "planning" || !position) {
                return;
            }

            this.apply(
                pointer.rightButtonDown()
                    ? this.editor.removeAt(position)
                    : this.editor.pointerDown(position, this.simulation),
            );
            this.items.showGhost(null, this.simulation);
        });

        this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
            const position = this.worldPosition(pointer);

            if (this.phase !== "planning" || !position) {
                this.items.showGhost(null, this.simulation);
                return;
            }

            this.apply(this.editor.pointerMove(position, this.simulation));
            this.items.showGhost(
                pointer.isDown ? null : this.editor.ghost(position, this.simulation),
                this.simulation,
            );
        });

        const release = () => this.apply(this.editor.pointerUp());

        this.input.on("pointerup", release);
        this.input.on("pointerupoutside", release);
    }

    /** Position des Zeigers in der Welt; `null`, wenn er auf einer Leiste oder der Seitenleiste liegt. */
    private worldPosition(pointer: Phaser.Input.Pointer): Vector2 | null {
        // Die Welt beginnt unter der Statusleiste (Kamera ist verschoben).
        const x = pointer.x;
        const y = pointer.y - TOP_BAR_HEIGHT;

        return x >= 0 && x <= WORLD_WIDTH && y >= 0 && y <= WORLD_HEIGHT ? {x, y} : null;
    }

    private selectTool(kind: Tool): void {
        this.editor.tool = kind;
        this.panelDirty = true;
    }

    private toggleSpeed(): void {
        this.speedIndex = (this.speedIndex + 1) % SPEEDS.length;
        this.panelDirty = true;
    }

    private redrawFlowDebug(): void {
        this.flowGraphics.clear();

        if (this.showFlowDebug) {
            drawFlowField(this.flowGraphics, this.simulation.flowField, this.level.simulation.flowCellSize);
        }
    }

    // --- Anzeige --------------------------------------------------------------

    /** Leisten oben und unten und die Seitenleiste; sie bewegen sich nicht mit der Kamera. */
    private createHud(): void {
        // Die Welt beginnt unter der Statusleiste.
        this.cameras.main.setScroll(0, -TOP_BAR_HEIGHT);

        const bars = this.add.graphics().setDepth(DEPTH_HUD).setScrollFactor(0);

        bars.fillStyle(THEME.panel, 1);
        bars.fillRect(0, 0, WORLD_WIDTH, TOP_BAR_HEIGHT);
        bars.fillRect(0, VIEW_HEIGHT - BOTTOM_BAR_HEIGHT, WORLD_WIDTH, BOTTOM_BAR_HEIGHT);

        this.statusText = this.add
            .text(12, 8, "", {fontFamily: THEME.font, resolution: TEXT_RESOLUTION, fontSize: "16px", color: THEME.text})
            .setDepth(DEPTH_HUD)
            .setScrollFactor(0);
        this.infoText = this.add
            .text(12, VIEW_HEIGHT - BOTTOM_BAR_HEIGHT + 8, "", {
                fontFamily: THEME.font, resolution: TEXT_RESOLUTION,
                fontSize: "13px",
                color: THEME.mutedText,
                wordWrap: {width: WORLD_WIDTH - 24},
                lineSpacing: 3,
            })
            .setDepth(DEPTH_HUD)
            .setScrollFactor(0);

        this.panel = new PlanPanel(this, {
            selectScenario: (index) => this.scene.restart({scenario: index}),
            selectTool: (kind) => this.selectTool(kind),
            setRoute: (route) => this.apply(this.editor.setRoute(route)),
            removeSelected: () => this.apply(this.editor.removeSelected()),
            loadTemplate: (index) => {
                this.editor.load(this.plans()[index].plan);
                this.rebuildSimulation();
                this.panelDirty = true;
            },
            clearAll: () => {
                this.editor.clear();
                this.rebuildSimulation();
                this.panelDirty = true;
            },
            start: () => this.startRun(),
            back: () => this.enterPlanning(),
            toggleSpeed: () => this.toggleSpeed(),
        });
    }

    private panelModel(): PanelModel {
        const sign = this.editor.selectedSign;

        return {
            planning: this.phase === "planning",
            scenarios: SCENARIOS.map((scenario) => scenario.level.name),
            scenarioIndex: this.selection.scenario,
            tools: TOOLS.filter(({kind}) => this.editor.total(kind) > 0).map(({kind, name, key}) => ({
                kind,
                key,
                label: `${name}  ${this.editor.used(kind)}/${this.editor.total(kind)}`,
                selected: this.editor.tool === kind,
                exhausted: this.editor.remaining(kind) === 0,
            })),
            selection: sign ? {title: "Schild", route: sign.route} : null,
            routeCount: this.level.routes.length,
            templates: this.plans().map(({name}) => name),
            warning: null,
            canStart: true,
            speed: SPEEDS[this.speedIndex],
        };
    }

    private updateStatus(): void {
        if (this.phase === "planning") {
            const best = loadBestCost(this.level.name);
            const reference = referenceCost(this.level.scoring).total;

            this.statusText.setText(
                `PLANUNG   Ohne Maßnahmen ${reference.toFixed(0)}   Bestwert ${best?.toFixed(0) ?? "–"}`,
            );
            return;
        }

        const {arrived, total, elapsed, injured} = this.simulation.stats;

        this.statusText.setText(
            `Evakuiert ${arrived}/${total}   Verletzt ${injured}   Zeit ${elapsed.toFixed(1)} s   ` +
            `Tempo ${SPEEDS[this.speedIndex]}x`,
        );
    }

    /** Text unten: Beschreibung des Szenarios und was man gerade tun kann. */
    private updateInfo(): void {
        const help =
            this.phase === "planning"
                ? "Klick: platzieren oder auswählen · Ziehen: verschieben · Rechtsklick / Entf: entfernen · Enter: Start"
                : "Leertaste: zurück zur Planung · S: Tempo · F: Flow-Field";

        this.infoText.setText(`${this.level.description}\n\n${help}`);
    }
}

/** Startauswahl aus der URL; ungültige oder fehlende Werte fallen auf das erste Szenario zurück. */
function selectionFromUrl(): Selection {
    const query = new URLSearchParams(window.location.search);
    const scenario = validIndex(Number(query.get("scenario") ?? 1) - 1, SCENARIOS.length);
    const planParam = query.get("plan");

    if (planParam === null) {
        return {scenario};
    }

    const plan = validIndex(Number(planParam), scenarioPlans(SCENARIOS[scenario]).length);

    return {scenario, plan};
}

function validIndex(value: number, length: number): number {
    return Number.isInteger(value) && value >= 0 && value < length ? value : 0;
}
