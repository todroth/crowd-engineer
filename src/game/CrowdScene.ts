import Phaser from "phaser";
import {Simulation} from "../simulation/Simulation.ts";
import type {Level} from "../simulation/Level.ts";
import type {Plan} from "../simulation/Plan.ts";
import {planWithoutMeasures} from "./Scenario.ts";
import {SCENARIOS} from "./scenarios.ts";
import {calculateCost, referenceCost} from "../simulation/scoring.ts";
import {getDensityColor} from "./getDensityColor.ts";

/** Farbe für Verletzte (Füllung) und den Gefährdungsring; Verletzte haben zusätzlich einen weißen Ring. */
const INJURED_COLOR = 0x000000;

/** Abtransportierte Verletzte: blass graurot, damit man sie sieht, sie aber nicht auffallen. */
const RESCUED_COLOR = 0x7a5a5f;
const RESCUED_ALPHA = 0.45;

export class CrowdScene extends Phaser.Scene {
    private simulation!: Simulation;

    private level!: Level;
    private scenarioIndex = 0;
    /** Index in der Liste der Pläne des Szenarios (0 = Startplan, 1 = ohne Maßnahmen, danach Beispiele). */
    private planIndex = 0;
    /** Abspielgeschwindigkeit (1, 2 oder 4), bleibt über Neustarts erhalten. */
    private speed = 1;

    private readonly personViews = new Map<number, Phaser.GameObjects.Arc>();

    private flowGraphics!: Phaser.GameObjects.Graphics;
    private showFlowDebug = false;

    private statusText!: Phaser.GameObjects.Text;
    private resultText?: Phaser.GameObjects.Text;

    constructor() {
        super("CrowdScene");
    }

    create(data?: {scenario?: number; plan?: number}): void {

        // Beim ersten Start können Szenario und Plan über die URL gewählt werden
        // (?scenario=2&plan=1, jeweils ab 1 gezählt, der Plan ab 0).
        const query = new URLSearchParams(window.location.search);
        const startScenario = Number(query.get("scenario") ?? 1) - 1;
        const startPlan = Number(query.get("plan") ?? 0);

        // Phaser übergibt beim ersten Start ein leeres Objekt, bei `restart` unsere Werte.
        const restarted = data?.scenario !== undefined;

        this.scenarioIndex = restarted ? data.scenario! : startScenario;
        this.planIndex = restarted ? data.plan ?? 0 : startPlan;

        const scenario = SCENARIOS[this.scenarioIndex];
        const plan = this.plans()[this.planIndex];

        this.level = scenario.level;
        this.simulation = new Simulation(scenario.level, plan.plan);
        this.personViews.clear();
        this.resultText = undefined;

        this.drawGrid();
        this.drawObstacles();
        this.drawSigns(plan.plan);
        this.createPeople();

        this.flowGraphics = this.add.graphics().setDepth(10);
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

        this.input.keyboard
            ?.addKey(Phaser.Input.Keyboard.KeyCodes.R)
            .on("down", () => {
                this.showFlowDebug = !this.showFlowDebug;
                this.drawFlowFieldDebug();
            });

        this.input.keyboard
            ?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
            .on("down", () => this.scene.restart({scenario: this.scenarioIndex, plan: this.planIndex}));

        // P wechselt zum nächsten Plan des Szenarios (Startplan, ohne Maßnahmen, Beispiele).
        this.input.keyboard
            ?.addKey(Phaser.Input.Keyboard.KeyCodes.P)
            .on("down", () =>
                this.scene.restart({
                    scenario: this.scenarioIndex,
                    plan: (this.planIndex + 1) % this.plans().length,
                }),
            );

        // S schaltet die Abspielgeschwindigkeit um: 1x, 2x, 4x.
        this.input.keyboard
            ?.addKey(Phaser.Input.Keyboard.KeyCodes.S)
            .on("down", () => {
                this.speed = this.speed === 1 ? 2 : this.speed === 2 ? 4 : 1;
            });

        // Zifferntasten wechseln das Szenario.
        SCENARIOS.forEach((_, index) => {
            this.input.keyboard
                ?.addKey(Phaser.Input.Keyboard.KeyCodes.ONE + index)
                .on("down", () => this.scene.restart({scenario: index, plan: 0}));
        });

    }

    override update(_time: number, delta: number): void {

        this.simulation.update((delta / 1000) * this.speed);

        for (const agent of this.simulation.agents) {
            const view = this.personViews.get(agent.id);

            if (view) {
                // Angekommene verschwinden, Abtransportierte bleiben ausgegraut liegen.
                view.setVisible(!agent.arrived || agent.rescued);
                view.setPosition(
                    agent.position.x,
                    agent.position.y,
                );
                if (agent.rescued) {
                    view.setFillStyle(RESCUED_COLOR, RESCUED_ALPHA).setStrokeStyle();
                    view.setDepth(-1);
                } else {
                    view.setFillStyle(agent.injured ? INJURED_COLOR : getDensityColor(agent.localDensity));
                    this.drawInjuryRing(view, agent.injury, agent.injured);
                }
            }
        }

        this.updateStatus();
    }

    /** Schwarzer Ring, dessen Stärke mit der Verletzung wächst; Verletzte sind schwarz mit weißem Ring. */
    private drawInjuryRing(
        view: Phaser.GameObjects.Arc,
        injury: number,
        injured: boolean,
    ): void {
        if (injured) {
            view.setStrokeStyle(2, 0xffffff, 1);
        } else if (injury > 0.05) {
            view.setStrokeStyle(1, INJURED_COLOR, injury);
        } else if (view.isStroked) {
            view.setStrokeStyle();
        }
    }

    /** Zeile unten: Name und Beschreibung des Szenarios, dazu die Tasten zum Wechseln. */
    private scenarioMenu(): string {
        const keys = SCENARIOS
            .map((scenario, index) =>
                `${index === this.scenarioIndex ? "▶" : " "}${index + 1} ${scenario.level.name}`)
            .join("   ");

        return (
            `${keys}\n${this.level.description}\n` +
            `Plan: ${this.plans()[this.planIndex].name}   [P: nächster Plan]`
        );
    }

    /** Die wählbaren Pläne des aktuellen Szenarios: Startplan, ohne Maßnahmen und Beispiele. */
    private plans(): readonly {readonly name: string; readonly plan: Plan}[] {
        const scenario = SCENARIOS[this.scenarioIndex];

        return [
            {name: "Startplan", plan: scenario.plan},
            {name: "Ohne Maßnahmen (Vergleichswert)", plan: planWithoutMeasures(scenario.level)},
            ...(scenario.examples ?? []),
        ];
    }

    /** Zeichnet jedes Schild als gelben Punkt mit einem Pfeil zum Eingang des Weges. */
    private drawSigns(plan: Plan): void {
        const graphics = this.add.graphics().setDepth(5);

        for (const sign of plan.signs) {
            const {entrance} = this.level.routes[sign.route];
            const dx = entrance.x + entrance.width / 2 - sign.position.x;
            const dy = entrance.y + entrance.height / 2 - sign.position.y;
            const length = Math.hypot(dx, dy) || 1;
            const ux = dx / length;
            const uy = dy / length;
            const tipX = sign.position.x + ux * 22;
            const tipY = sign.position.y + uy * 22;

            graphics.lineStyle(3, 0xffd60a, 1);
            graphics.lineBetween(sign.position.x, sign.position.y, tipX, tipY);
            graphics.fillStyle(0xffd60a, 1);
            graphics.fillTriangle(
                tipX + ux * 7,
                tipY + uy * 7,
                tipX - uy * 5,
                tipY + ux * 5,
                tipX + uy * 5,
                tipY - ux * 5,
            );
            graphics.fillCircle(sign.position.x, sign.position.y, 5);
        }
    }

    private updateStatus(): void {
        const {arrived, total, elapsed, injured} = this.simulation.stats;

        this.statusText.setText(
            `Evakuiert ${arrived}/${total}   Verletzt ${injured}   Zeit ${elapsed.toFixed(1)} s   ` +
            `[S: Tempo ${this.speed}x   Leertaste: Neustart]`,
        );

        if (this.simulation.finished && !this.resultText) {
            this.showResult();
        }
    }

    private showResult(): void {
        const stats = this.simulation.stats;
        const cost = calculateCost(stats, this.level.scoring);
        const reference = referenceCost(this.level.scoring);
        const difference = cost.total - reference.total;
        const sign = difference > 0 ? "+" : "";

        const lines = [
            stats.arrived + stats.injured < stats.total
                ? "Zeit abgelaufen"
                : stats.injured === 0
                    ? "Alle evakuiert, niemand verletzt"
                    : "Alle Gehfähigen sind draußen, es gab Verletzte",
            "",
            `Evakuiert:   ${stats.arrived}/${stats.total}`,
            `Verletzte:   ${stats.injured}`,
            `Dauer:       ${stats.elapsed.toFixed(1)} s`,
            `Gedränge:    ${(stats.crowdedSeconds / 60).toFixed(0)} Personen-Min. über ${this.level.scoring.crowdingThreshold} P/m²`,
            `Spitze:      ${stats.peakDensity.toFixed(1)} Pers./m² (${describeDensity(stats.peakDensity)})`,
            "",
            `Kosten:      ${cost.total.toFixed(0)}  = Dauer ${cost.duration.toFixed(0)} + Verletzte ${cost.injuries.toFixed(0)} + Gedränge ${cost.crowding.toFixed(0)}`,
            `Ohne Maßnahmen: ${reference.total.toFixed(0)}  (${sign}${difference.toFixed(0)}, niedriger ist besser)`,
            "",
            "Leertaste: Neustart",
        ];

        this.resultText = this.add
            .text(this.level.worldWidth / 2, this.level.worldHeight / 2, lines.join("\n"), {
                fontFamily: "monospace",
                fontSize: "22px",
                color: "#ffffff",
                backgroundColor: "#101820e6",
                padding: {x: 24, y: 18},
                align: "left",
            })
            .setOrigin(0.5)
            .setDepth(30);
    }

    private drawGrid(): void {

        const grid = this.add.graphics();
        grid.lineStyle(1, 0x293548, 1);

        for (let x = 0; x <= this.level.worldWidth; x += 40) {
            grid.lineBetween(x, 0, x, this.level.worldHeight);
        }

        for (let y = 0; y <= this.level.worldHeight; y += 40) {
            grid.lineBetween(0, y, this.level.worldWidth, y);
        }

    }


    private drawObstacles(): void {
        const wallGraphics = this.add.graphics();

        for (const obstacle of this.level.obstacles) {
            switch (obstacle.type) {
                case "circle":
                    this.add.circle(
                        obstacle.center.x,
                        obstacle.center.y,
                        obstacle.radius,
                        0x45556b,
                    ).setStrokeStyle(3, 0x9aacc7);
                    break;

                case "rectangle":
                    this.add.rectangle(
                        obstacle.position.x + obstacle.width / 2,
                        obstacle.position.y + obstacle.height / 2,
                        obstacle.width,
                        obstacle.height,
                        0x45556b,
                    ).setStrokeStyle(3, 0x9aacc7);
                    break;

                case "wall":
                    wallGraphics.lineStyle(
                        obstacle.thickness,
                        0x45556b,
                        1,
                    );
                    wallGraphics.lineBetween(
                        obstacle.start.x,
                        obstacle.start.y,
                        obstacle.end.x,
                        obstacle.end.y,
                    );
                    break;
            }
        }
    }


    private createPeople(): void {
        for (const agent of this.simulation.agents) {
            const person = this.add.circle(
                agent.position.x,
                agent.position.y,
                agent.radius,
                getDensityColor(agent.localDensity)
            );

            this.personViews.set(agent.id, person);
        }
    }

    /** Zeigt pro Rasterzelle die Laufrichtung des Flow-Fields. */
    private drawFlowFieldDebug(): void {
        this.flowGraphics.clear();

        if (!this.showFlowDebug) {
            return;
        }

        const length = this.level.simulation.flowCellSize * 0.7;

        this.flowGraphics.lineStyle(1, 0x00d5ff, 0.7);

        this.simulation.flowField.forEachDirection((x, y, dx, dy) => {
            this.flowGraphics.lineBetween(
                x - dx * length / 2,
                y - dy * length / 2,
                x + dx * length / 2,
                y + dy * length / 2,
            );
        });
    }

}

/**
 * Einordnung der Personendichte (angelehnt an die Fruin-Stufen für
 * Fußgängerströme; ab etwa 5 Personen/m² besteht Quetschgefahr).
 */
function describeDensity(personsPerSquareMeter: number): string {
    if (personsPerSquareMeter < 2) return "locker";
    if (personsPerSquareMeter < 4) return "dicht";
    if (personsPerSquareMeter < 5.5) return "Gedränge";
    return "kritisch";
}
