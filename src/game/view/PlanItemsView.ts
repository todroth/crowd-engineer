import type Phaser from "phaser";
import type {Plan} from "../../simulation/Plan.ts";
import type {Sign} from "../../simulation/Sign.ts";
import type {Vector2} from "../../simulation/Vector2.ts";
import type {Selected} from "../PlanEditor.ts";
import {routeColor} from "./theme.ts";

/** Länge des Pfeils vom Schild aus (Pixel). */
const ARROW_LENGTH = 22;
const SELECTION_RADIUS = 13;
const DEPTH_ITEMS = 6;

/** Liefert die Richtung, in die ein Schild zeigt (die Simulation erfüllt das). */
export interface SignDirections {
    signDirection(sign: Sign, out: Vector2): boolean;
}

/**
 * Die Elemente des Plans in der Welt: Schilder als Punkt mit Pfeil in Richtung
 * des begehbaren Weges zum Eingang ihrer Route, in der Farbe der Route. Die
 * Auswahl hat einen Ring; unter dem Zeiger erscheint eine Vorschau.
 */
export class PlanItemsView {
    private readonly graphics: Phaser.GameObjects.Graphics;
    private readonly ghost: Phaser.GameObjects.Graphics;
    private readonly direction: Vector2 = {x: 1, y: 0};

    constructor(scene: Phaser.Scene) {
        this.graphics = scene.add.graphics().setDepth(DEPTH_ITEMS);
        this.ghost = scene.add.graphics().setDepth(DEPTH_ITEMS).setAlpha(0.55);
    }

    draw(plan: Plan, selected: Selected | null, directions: SignDirections): void {
        this.graphics.clear();

        plan.signs.forEach((sign, index) => {
            this.drawSign(this.graphics, sign, directions);

            if (selected?.kind === "sign" && selected.index === index) {
                this.graphics.lineStyle(2, 0xfde68a, 1);
                this.graphics.strokeCircle(sign.position.x, sign.position.y, SELECTION_RADIUS);
            }
        });
    }

    /** Vorschau eines Elements, das man hier aufstellen würde; `null` blendet sie aus. */
    showGhost(sign: Sign | null, directions: SignDirections): void {
        this.ghost.clear();

        if (sign) {
            this.drawSign(this.ghost, sign, directions);
        }
    }

    private drawSign(g: Phaser.GameObjects.Graphics, sign: Sign, directions: SignDirections): void {
        const color = routeColor(sign.route);
        const {x, y} = sign.position;
        const d = this.direction;

        if (directions.signDirection(sign, d)) {
            const tipX = x + d.x * ARROW_LENGTH;
            const tipY = y + d.y * ARROW_LENGTH;

            // Dunkle Kontur, damit der Pfeil auch über der Menge lesbar bleibt.
            g.lineStyle(6, 0x000000, 0.5);
            g.lineBetween(x, y, tipX, tipY);
            g.lineStyle(3, color, 1);
            g.lineBetween(x, y, tipX, tipY);
            g.fillStyle(color, 1);
            g.fillTriangle(
                tipX + d.x * 8, tipY + d.y * 8,
                tipX - d.y * 6, tipY + d.x * 6,
                tipX + d.y * 6, tipY - d.x * 6,
            );
        }

        g.fillStyle(0x000000, 0.5);
        g.fillCircle(x, y, 8);
        g.fillStyle(color, 1);
        g.fillCircle(x, y, 6);
        g.lineStyle(2, 0xffffff, 1);
        g.strokeCircle(x, y, 6);
    }
}
