import Phaser from "phaser";
import {Simulation} from "../simulation/Simulation.ts";
import {DEFAULT_LEVEL} from "./defaultLevel.ts";
import {DEFAULT_PLAN} from "./defaultPlan.ts";
import {calculateCost, referenceCost} from "../simulation/scoring.ts";
import {getDensityColor} from "./getDensityColor.ts";

/** Farbe für Verletzte (Füllung) und den Gefährdungsring; Verletzte haben zusätzlich einen weißen Ring. */
const INJURED_COLOR = 0x000000;

/** Abtransportierte Verletzte: blass graurot, damit man sie sieht, sie aber nicht auffallen. */
const RESCUED_COLOR = 0x7a5a5f;
const RESCUED_ALPHA = 0.45;

export class CrowdScene extends Phaser.Scene {
    private simulation!: Simulation;

    private readonly level = DEFAULT_LEVEL;

    private readonly personViews = new Map<number, Phaser.GameObjects.Arc>();

    private flowGraphics!: Phaser.GameObjects.Graphics;
    private showFlowDebug = false;

    private statusText!: Phaser.GameObjects.Text;
    private resultText?: Phaser.GameObjects.Text;

    constructor() {
        super("CrowdScene");
    }

    create(): void {

        this.simulation = new Simulation(this.level, DEFAULT_PLAN);
        this.personViews.clear();
        this.resultText = undefined;

        this.drawGrid();
        this.drawObstacles();
        this.createPeople();

        this.flowGraphics = this.add.graphics().setDepth(10);
        this.statusText = this.add
            .text(12, 10, "", {fontFamily: "monospace", fontSize: "16px", color: "#ffffff"})
            .setDepth(20);

        this.input.keyboard
            ?.addKey(Phaser.Input.Keyboard.KeyCodes.R)
            .on("down", () => {
                this.showFlowDebug = !this.showFlowDebug;
                this.drawFlowFieldDebug();
            });

        this.input.keyboard
            ?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
            .on("down", () => this.scene.restart());

    }

    override update(_time: number, delta: number): void {

        this.simulation.update(delta / 1000);

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

    private updateStatus(): void {
        const {arrived, total, elapsed, injured} = this.simulation.stats;

        this.statusText.setText(
            `Evakuiert ${arrived}/${total}   Verletzt ${injured}   Zeit ${elapsed.toFixed(1)} s   [Leertaste: Neustart]`,
        );

        if (this.simulation.finished && !this.resultText) {
            this.showResult();
        }
    }

    private showResult(): void {
        const stats = this.simulation.stats;
        const cost = calculateCost(stats, this.level.scoring);
        const reference = referenceCost(this.level.scoring);
        const difference = cost - reference;

        const lines = [
            stats.arrived + stats.injured < stats.total
                ? "Zeit abgelaufen"
                : stats.injured === 0
                    ? "Alle evakuiert, niemand verletzt"
                    : "Alle Gehfähigen sind draußen, es gab Verletzte",
            "",
            `Evakuiert:        ${stats.arrived}/${stats.total}`,
            `Verletzte:        ${stats.injured} (liegen am Boden)`,
            `Dauer:            ${stats.elapsed.toFixed(1)} s`,
            `Kosten:           ${cost.toFixed(0)}  (Dauer + ${this.level.scoring.injuryPenalty} s je Verletztem, niedriger ist besser)`,
            `Ohne Maßnahmen:   ${reference.toFixed(0)}  (${difference <= 0 ? "" : "+"}${difference.toFixed(0)})`,
            `Spitzendichte:    ${stats.peakDensity.toFixed(1)} Pers./m² (${describeDensity(stats.peakDensity)})`,
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
