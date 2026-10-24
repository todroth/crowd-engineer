import type Phaser from "phaser";
import {BARRIER_THICKNESS, type Barrier} from "../../simulation/Barrier.ts";
import type {Plan} from "../../simulation/Plan.ts";
import type {Vector2} from "../../simulation/Vector2.ts";
import type {Placement, Selected, Tool} from "../PlanEditor.ts";
import {routeColor, TEXT_RESOLUTION, THEME} from "./theme.ts";

/** Länge des Pfeils vom Element aus (Pixel). */
const ARROW_LENGTH = 22;
const SELECTION_RADIUS = 13;
const DEPTH_ITEMS = 6;
/** Warnwestengelb für Ordner und Gitter. */
const MARSHAL_COLOR = 0xfacc15;
/** Länge eines Streifens im Absperrgitter (Pixel). */
const BARRIER_STRIPE = 8;

/** Liefert die Richtung, in die ein Schild oder Ordner zeigt (die Simulation erfüllt das). */
export interface SignDirections {
    routeDirection(route: number, position: Vector2, out: Vector2): boolean;
}

/**
 * Die Elemente des Plans in der Welt, in der Farbe ihres Weges und mit Pfeil in
 * Richtung des begehbaren Weges zum Eingang. Schilder sind ein Punkt, Ordner
 * eine gelbe Figur mit Ring und blassem Kreis für die Reichweite. Die Auswahl
 * hat einen Ring; unter dem Zeiger erscheint eine Vorschau.
 */
export class PlanItemsView {
    private readonly graphics: Phaser.GameObjects.Graphics;
    private readonly ghost: Phaser.GameObjects.Graphics;
    private readonly direction: Vector2 = {x: 1, y: 0};
    private readonly lengthLabel: Phaser.GameObjects.Text;
    private readonly marshalRange: number;
    private readonly pixelsPerMeter: number;

    /**
     * @param marshalRange Reichweite eines Ordners (Pixel), wird als Kreis gezeichnet
     * @param pixelsPerMeter für die Längenanzeige der Gitter
     */
    constructor(scene: Phaser.Scene, marshalRange: number, pixelsPerMeter: number) {
        this.graphics = scene.add.graphics().setDepth(DEPTH_ITEMS);
        this.ghost = scene.add.graphics().setDepth(DEPTH_ITEMS).setAlpha(0.55);
        this.lengthLabel = scene.add
            .text(0, 0, "", {
                fontFamily: THEME.font, resolution: TEXT_RESOLUTION,
                fontSize: "12px",
                color: "#fde68a",
                backgroundColor: "#0b1118cc",
                padding: {x: 4, y: 2},
            })
            .setOrigin(0.5)
            .setDepth(DEPTH_ITEMS + 1)
            .setVisible(false);
        this.marshalRange = marshalRange;
        this.pixelsPerMeter = pixelsPerMeter;
    }

    draw(plan: Plan, selected: Selected | null, directions: SignDirections): void {
        this.graphics.clear();

        const isSelected = (kind: Tool, index: number) => selected?.kind === kind && selected.index === index;

        plan.marshals.forEach((marshal, index) => {
            this.drawItem(this.graphics, "marshal", marshal.position, marshal.route, directions, isSelected("marshal", index));
        });
        plan.signs.forEach((sign, index) => {
            this.drawItem(this.graphics, "sign", sign.position, sign.route, directions, isSelected("sign", index));
        });

        this.lengthLabel.setVisible(false);
        plan.barriers.forEach((barrier, index) => {
            this.drawBarrier(barrier, isSelected("barrier", index));
        });
    }

    /** Gelb-schwarz gestreifte Linie; ausgewählt mit Griffen an den Enden und Länge in Metern. */
    private drawBarrier(barrier: Barrier, selected: boolean): void {
        const g = this.graphics;
        const {start, end} = barrier;
        const length = Math.hypot(end.x - start.x, end.y - start.y);

        g.lineStyle(BARRIER_THICKNESS + 2, 0x000000, 0.5);
        g.lineBetween(start.x, start.y, end.x, end.y);
        g.lineStyle(BARRIER_THICKNESS, MARSHAL_COLOR, 1);
        g.lineBetween(start.x, start.y, end.x, end.y);

        if (length > 0) {
            const ux = (end.x - start.x) / length;
            const uy = (end.y - start.y) / length;

            g.lineStyle(BARRIER_THICKNESS, 0x1f2937, 1);

            for (let at = BARRIER_STRIPE; at < length; at += 2 * BARRIER_STRIPE) {
                const to = Math.min(length, at + BARRIER_STRIPE);

                g.lineBetween(start.x + ux * at, start.y + uy * at, start.x + ux * to, start.y + uy * to);
            }
        }

        if (selected) {
            g.lineStyle(2, 0xfde68a, 1);
            g.strokeCircle(start.x, start.y, 7);
            g.strokeCircle(end.x, end.y, 7);
            this.lengthLabel
                .setText(`${(length / this.pixelsPerMeter).toFixed(1)} m`)
                .setPosition((start.x + end.x) / 2, (start.y + end.y) / 2 - 16)
                .setVisible(true);
        }
    }

    /** Vorschau eines Elements, das man hier aufstellen würde; `null` blendet sie aus. */
    showGhost(placement: Placement | null, directions: SignDirections): void {
        this.ghost.clear();

        if (placement) {
            this.drawItem(this.ghost, placement.kind, placement.position, placement.route, directions, false);
        }
    }

    private drawItem(
        g: Phaser.GameObjects.Graphics,
        kind: Tool,
        position: Vector2,
        route: number,
        directions: SignDirections,
        selected: boolean,
    ): void {
        const color = routeColor(route);
        const {x, y} = position;
        const d = this.direction;

        if (kind === "marshal") {
            g.fillStyle(MARSHAL_COLOR, selected ? 0.12 : 0.06);
            g.fillCircle(x, y, this.marshalRange);
            g.lineStyle(1, MARSHAL_COLOR, selected ? 0.7 : 0.3);
            g.strokeCircle(x, y, this.marshalRange);
        }

        if (directions.routeDirection(route, position, d)) {
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
        g.fillCircle(x, y, 9);

        if (kind === "marshal") {
            g.fillStyle(MARSHAL_COLOR, 1);
            g.fillCircle(x, y, 7);
            g.lineStyle(3, color, 1);
            g.strokeCircle(x, y, 7);
        } else {
            g.fillStyle(color, 1);
            g.fillCircle(x, y, 6);
            g.lineStyle(2, 0xffffff, 1);
            g.strokeCircle(x, y, 6);
        }

        if (selected) {
            g.lineStyle(2, 0xfde68a, 1);
            g.strokeCircle(x, y, SELECTION_RADIUS);
        }
    }
}
