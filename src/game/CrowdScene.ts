import Phaser from "phaser";
import {Simulation} from "../simulation/Simulation.ts";
import {DEFAULT_LEVEL} from "./defaultLevel.ts";
import {getDensityColor} from "./getDensityColor.ts";

export class CrowdScene extends Phaser.Scene {
    private simulation!: Simulation;

    private readonly level = DEFAULT_LEVEL;

    private readonly personViews = new Map<number, Phaser.GameObjects.Arc>();

    private routeGraphics!: Phaser.GameObjects.Graphics;
    private showRouteDebug = false;
    private readonly routesToDraw = 12;

    constructor() {
        super("CrowdScene");
    }

    create(): void {

        this.simulation = new Simulation(
            this.level.worldWidth,
            this.level.worldHeight,
            this.level.agentCount,
            this.level.simulation,
            this.level.obstacles,
        );

        this.drawGrid();
        this.drawObstacles();
        this.createPeople();

        this.routeGraphics = this.add.graphics().setDepth(10);

        this.input.keyboard
            ?.addKey(Phaser.Input.Keyboard.KeyCodes.R)
            .on("down", () => {
                this.showRouteDebug = !this.showRouteDebug;
            });

    }

    override update(_time: number, delta: number): void {

        this.simulation.update(delta / 1000);

        for (const agent of this.simulation.agents) {
            const view = this.personViews.get(agent.id);

            if (view) {
                view.setPosition(
                    agent.position.x,
                    agent.position.y,
                );
                view.setFillStyle(getDensityColor(agent.localDensity));
            }
        }

        this.drawRouteDebug();
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

    private drawRouteDebug(): void {
        this.routeGraphics.clear();

        if (!this.showRouteDebug) {
            return;
        }

        const agents = this.simulation.agents.slice(
            0,
            this.routesToDraw,
        );

        for (const agent of agents) {
            const remainingWaypoints = agent.waypoints.slice(
                agent.waypointIndex,
            );

            const points = [
                agent.position,
                ...remainingWaypoints,
            ];

            if (points.length < 2) {
                continue;
            }

            this.routeGraphics.lineStyle(2, 0x00d5ff, 0.8);

            for (let i = 0; i < points.length - 1; i++) {
                this.routeGraphics.lineBetween(
                    points[i].x,
                    points[i].y,
                    points[i + 1].x,
                    points[i + 1].y,
                );
            }

            // Wegpunkte als kleine Kreise anzeigen.
            this.routeGraphics.fillStyle(0xffffff, 0.95);

            for (const waypoint of remainingWaypoints) {
                this.routeGraphics.fillCircle(
                    waypoint.x,
                    waypoint.y,
                    3,
                );
            }
        }
    }

}