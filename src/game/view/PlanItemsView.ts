import type Phaser from "phaser";
import type {Plan} from "../../simulation/Plan.ts";
import type {Vector2} from "../../simulation/Vector2.ts";
import type {Placement, Selected, Tool} from "../PlanEditor.ts";
import {routeColor} from "./theme.ts";

/** Länge des Pfeils vom Element aus (Pixel). */
const ARROW_LENGTH = 22;
const SELECTION_RADIUS = 13;
const DEPTH_ITEMS = 6;
/** Warnwestengelb für Ordner. */
const MARSHAL_COLOR = 0xfacc15;

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
    private readonly marshalRange: number;

    /** @param marshalRange Reichweite eines Ordners (Pixel), wird als Kreis gezeichnet */
    constructor(scene: Phaser.Scene, marshalRange: number) {
        this.graphics = scene.add.graphics().setDepth(DEPTH_ITEMS);
        this.ghost = scene.add.graphics().setDepth(DEPTH_ITEMS).setAlpha(0.55);
        this.marshalRange = marshalRange;
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
