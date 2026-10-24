import type Phaser from "phaser";
import type {Level} from "../../simulation/Level.ts";
import type {Obstacle} from "../../simulation/Obstacle.ts";
import type {Rect} from "../../simulation/geometry/Rect.ts";
import type {FlowField} from "../../simulation/navigation/FlowField.ts";
import {cssColor, routeColor, routeLetter, THEME, TEXT_RESOLUTION} from "./theme.ts";

const GRID_SPACING = 40;
/** Versatz des Schlagschattens unter Hindernissen (Pixel). */
const SHADOW_OFFSET = 4;
/** Breite der Ausgangsmarkierung am Rand (Pixel). */
const EXIT_STRIP = 8;
const FLOW_DEBUG_COLOR = 0x00d5ff;

const DEPTH_FLOOR = -10;
const DEPTH_OBSTACLES = 0;
const DEPTH_EXITS = 4;

/** Boden mit Raster als Maßstab (40 Pixel = 2,5 m). */
export function drawFloor(scene: Phaser.Scene, level: Level): void {
    const floor = scene.add.graphics().setDepth(DEPTH_FLOOR);

    floor.fillStyle(THEME.floor, 1);
    floor.fillRect(0, 0, level.worldWidth, level.worldHeight);
    floor.lineStyle(1, THEME.grid, 1);

    for (let x = 0; x <= level.worldWidth; x += GRID_SPACING) {
        floor.lineBetween(x, 0, x, level.worldHeight);
    }

    for (let y = 0; y <= level.worldHeight; y += GRID_SPACING) {
        floor.lineBetween(0, y, level.worldWidth, y);
    }
}

/** Hindernisse mit Schlagschatten; Wände mit runden Enden, wie sie auch kollidieren (Kapseln). */
export function drawObstacles(scene: Phaser.Scene, level: Level): void {
    const shadow = scene.add.graphics().setDepth(DEPTH_OBSTACLES - 1).setAlpha(THEME.shadowAlpha);
    const body = scene.add.graphics().setDepth(DEPTH_OBSTACLES);

    for (const obstacle of level.obstacles) {
        drawObstacle(shadow, obstacle, SHADOW_OFFSET, THEME.shadow, THEME.shadow);
    }

    for (const obstacle of level.obstacles) {
        drawObstacle(body, obstacle, 0, THEME.wall, THEME.wallEdge);
    }
}

function drawObstacle(
    g: Phaser.GameObjects.Graphics,
    obstacle: Obstacle,
    offset: number,
    fill: number,
    edge: number,
): void {
    switch (obstacle.type) {
        case "circle": {
            const {x, y} = obstacle.center;

            g.fillStyle(fill, 1);
            g.fillCircle(x + offset, y + offset, obstacle.radius);
            g.lineStyle(2, edge, 1);
            g.strokeCircle(x + offset, y + offset, obstacle.radius - 1);
            break;
        }

        case "rectangle": {
            const {x, y} = obstacle.position;

            g.fillStyle(fill, 1);
            g.fillRect(x + offset, y + offset, obstacle.width, obstacle.height);
            g.lineStyle(2, edge, 1);
            g.strokeRect(x + offset + 1, y + offset + 1, obstacle.width - 2, obstacle.height - 2);
            break;
        }

        case "wall": {
            const {start, end, thickness} = obstacle;

            g.lineStyle(thickness, fill, 1);
            g.lineBetween(start.x + offset, start.y + offset, end.x + offset, end.y + offset);
            g.fillStyle(fill, 1);
            g.fillCircle(start.x + offset, start.y + offset, thickness / 2);
            g.fillCircle(end.x + offset, end.y + offset, thickness / 2);
            break;
        }
    }
}

/**
 * Markiert die Ausgänge am Rand der Welt (die Zielbereiche selbst liegen
 * außerhalb des Bildes). Ausgänge, die die Menge nicht kennt, sind türkis.
 */
export function drawExits(scene: Phaser.Scene, level: Level): void {
    const g = scene.add.graphics().setDepth(DEPTH_EXITS);
    const hidden = new Set(level.routes.flatMap((route) => (route.exit === undefined ? [] : [route.exit])));

    level.goalAreas.forEach((goal, index) => {
        const color = hidden.has(index) ? THEME.hiddenExit : THEME.exit;
        const strip = exitStrip(goal, level);
        const vertical = strip.height > strip.width;

        // Schein quer zum Streifen (was außerhalb der Welt liegt, ist ohnehin nicht zu sehen).
        const glow = vertical ? 2 * EXIT_STRIP : 0;
        const glowY = vertical ? 0 : 2 * EXIT_STRIP;

        g.fillStyle(color, 0.18);
        g.fillRect(strip.x - glow, strip.y - glowY, strip.width + 2 * glow, strip.height + 2 * glowY);
        g.fillStyle(color, 0.9);
        g.fillRect(strip.x, strip.y, strip.width, strip.height);

        const label = scene.add
            .text(strip.x + strip.width / 2, strip.y + strip.height / 2, hidden.has(index) ? "NOTAUSGANG" : "AUSGANG", {
                fontFamily: THEME.font, resolution: TEXT_RESOLUTION,
                fontSize: "10px",
                color: cssColor(color),
                fontStyle: "bold",
            })
            .setDepth(DEPTH_EXITS)
            .setOrigin(0.5);

        // Senkrechte Ausgänge: Schrift gedreht, neben dem Streifen in der Welt.
        if (vertical) {
            label.setAngle(-90).setX(strip.x > level.worldWidth / 2 ? strip.x - 10 : strip.x + strip.width + 10);
        } else {
            label.setY(strip.y > level.worldHeight / 2 ? strip.y - 10 : strip.y + strip.height + 10);
        }
    });
}

/** Schmaler Streifen am Weltrand, an dem der Zielbereich anliegt. */
function exitStrip(goal: Rect, level: Level): Rect {
    const {worldWidth, worldHeight} = level;
    const x0 = Math.max(0, goal.x);
    const x1 = Math.min(worldWidth, goal.x + goal.width);
    const y0 = Math.max(0, goal.y);
    const y1 = Math.min(worldHeight, goal.y + goal.height);

    if (goal.x >= worldWidth) return {x: worldWidth - EXIT_STRIP / 2, y: y0, width: EXIT_STRIP / 2, height: y1 - y0};
    if (goal.x + goal.width <= 0) return {x: 0, y: y0, width: EXIT_STRIP / 2, height: y1 - y0};
    if (goal.y >= worldHeight) return {x: x0, y: worldHeight - EXIT_STRIP / 2, width: x1 - x0, height: EXIT_STRIP / 2};
    if (goal.y + goal.height <= 0) return {x: x0, y: 0, width: x1 - x0, height: EXIT_STRIP / 2};

    return {x: x0, y: y0, width: x1 - x0, height: y1 - y0};
}

/** Eingänge der wählbaren Wege, beschriftet mit A, B, C … (für die Planung). */
export function createRouteMarkers(scene: Phaser.Scene, level: Level): Phaser.GameObjects.Container {
    const container = scene.add.container(0, 0).setDepth(DEPTH_EXITS);
    const g = scene.add.graphics();

    container.add(g);

    level.routes.forEach(({entrance}, route) => {
        const color = routeColor(route);

        g.fillStyle(color, 0.12);
        g.fillRect(entrance.x, entrance.y, entrance.width, entrance.height);
        g.lineStyle(1, color, 0.7);
        g.strokeRect(entrance.x, entrance.y, entrance.width, entrance.height);

        container.add(
            scene.add
                .text(entrance.x + entrance.width / 2, entrance.y + entrance.height / 2, routeLetter(route), {
                    fontFamily: THEME.font, resolution: TEXT_RESOLUTION,
                    fontSize: "18px",
                    fontStyle: "bold",
                    color: cssColor(color),
                })
                .setOrigin(0.5),
        );
    });

    return container;
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
