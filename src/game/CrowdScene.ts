import Phaser from "phaser";
import {Simulation} from "../simulation/Simulation.ts";

export class CrowdScene extends Phaser.Scene {
    private readonly worldWidth = 1000;
    private readonly worldHeight = 700;
    private readonly agentCount = 1000;

    private simulation!: Simulation;

    private readonly personViews = new Map<number, Phaser.GameObjects.Arc>();

    constructor() {
        super("CrowdScene");
    }

    create(): void {

        this.simulation = new Simulation(
            this.worldWidth,
            this.worldHeight,
            this.agentCount
        );

        this.drawGrid();
        this.createPeople();

    }

    override update(_time: number, delta: number): void {

        this.simulation.update(delta / 1000);

        for (const agent of this.simulation.agents) {
            const view = this.personViews.get(agent.id);

            if (view) {
                view.setPosition(
                    agent.position.x,
                    agent.position.y,
                )
            }
        }

    }

    private drawGrid(): void {

        const grid = this.add.graphics();
        grid.lineStyle(1, 0x293548, 1);

        for (let x = 0; x <= this.worldWidth; x += 40) {
            grid.lineBetween(x, 0, x, this.worldHeight);
        }

        for (let y = 0; y <= this.worldHeight; y += 40) {
            grid.lineBetween(0, y, this.worldWidth, y);
        }

    }

    private createPeople(): void {
        for (const agent of this.simulation.agents) {
            const person = this.add.circle(
                agent.position.x,
                agent.position.y,
                agent.radius,
                0xe9aa43
            );

            this.personViews.set(agent.id, person);
        }

    }
}