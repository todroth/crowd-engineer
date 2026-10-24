import type Phaser from "phaser";
import type {Level} from "../../simulation/Level.ts";
import type {Plan} from "../../simulation/Plan.ts";
import type {Simulation} from "../../simulation/Simulation.ts";
import type {FlowField} from "../../simulation/navigation/FlowField.ts";

const GRID_SPACING = 40;
const GRID_COLOR = 0x293548;
const OBSTACLE_FILL = 0x45556b;
const OBSTACLE_OUTLINE = 0x9aacc7;
const SIGN_COLOR = 0xffd60a;
const SIGN_ARROW_LENGTH = 22;
const FLOW_DEBUG_COLOR = 0x00d5ff;

/** Hintergrundraster als Maßstab (40 Pixel = 2,5 m). */
export function drawGrid(scene: Phaser.Scene, level: Level): void {
    const grid = scene.add.graphics();

    grid.lineStyle(1, GRID_COLOR, 1);

    for (let x = 0; x <= level.worldWidth; x += GRID_SPACING) {
        grid.lineBetween(x, 0, x, level.worldHeight);
    }

    for (let y = 0; y <= level.worldHeight; y += GRID_SPACING) {
        grid.lineBetween(0, y, level.worldWidth, y);
    }
}

export function drawObstacles(scene: Phaser.Scene, level: Level): void {
    const walls = scene.add.graphics();

    for (const obstacle of level.obstacles) {
        switch (obstacle.type) {
            case "circle":
                scene.add
                    .circle(obstacle.center.x, obstacle.center.y, obstacle.radius, OBSTACLE_FILL)
                    .setStrokeStyle(3, OBSTACLE_OUTLINE);
                break;

            case "rectangle":
                scene.add
                    .rectangle(
                        obstacle.position.x + obstacle.width / 2,
                        obstacle.position.y + obstacle.height / 2,
                        obstacle.width,
                        obstacle.height,
                        OBSTACLE_FILL,
                    )
                    .setStrokeStyle(3, OBSTACLE_OUTLINE);
                break;

            case "wall":
                walls.lineStyle(obstacle.thickness, OBSTACLE_FILL, 1);
                walls.lineBetween(obstacle.start.x, obstacle.start.y, obstacle.end.x, obstacle.end.y);
                break;
        }
    }
}

/**
 * Zeichnet jedes Schild als gelben Punkt mit einem Pfeil in Richtung des
 * begehbaren Weges zum Eingang der Route (nicht in Luftlinie durch Wände).
 */
export function drawSigns(scene: Phaser.Scene, plan: Plan, simulation: Simulation): void {
    const graphics = scene.add.graphics().setDepth(5);
    const direction = {x: 1, y: 0};

    graphics.lineStyle(3, SIGN_COLOR, 1);
    graphics.fillStyle(SIGN_COLOR, 1);

    for (const sign of plan.signs) {
        if (!simulation.signDirection(sign, direction)) {
            continue;
        }

        const {x, y} = sign.position;
        const tipX = x + direction.x * SIGN_ARROW_LENGTH;
        const tipY = y + direction.y * SIGN_ARROW_LENGTH;

        graphics.lineBetween(x, y, tipX, tipY);
        graphics.fillTriangle(
            tipX + direction.x * 7,
            tipY + direction.y * 7,
            tipX - direction.y * 5,
            tipY + direction.x * 5,
            tipX + direction.y * 5,
            tipY - direction.x * 5,
        );
        graphics.fillCircle(x, y, 5);
    }
}

/** Zeigt pro Rasterzelle die Laufrichtung des Flow-Fields (Debug-Anzeige). */
export function drawFlowField(
    graphics: Phaser.GameObjects.Graphics,
    field: FlowField,
    cellSize: number,
): void {
    const half = (cellSize * 0.7) / 2;

    graphics.lineStyle(1, FLOW_DEBUG_COLOR, 0.7);

    field.forEachDirection((x, y, dx, dy) => {
        graphics.lineBetween(x - dx * half, y - dy * half, x + dx * half, y + dy * half);
    });
}
