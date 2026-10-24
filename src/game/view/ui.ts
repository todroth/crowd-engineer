import type Phaser from "phaser";
import {THEME, TEXT_RESOLUTION} from "./theme.ts";

export const DEPTH_HUD = 20;

export interface ButtonSpec {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly label: string;
    readonly onClick: () => void;
    /** Füllfarbe; Standard ist die Farbe der Bedienelemente. */
    readonly fill?: number;
    readonly textColor?: string;
    readonly fontSize?: number;
    readonly selected?: boolean;
    readonly disabled?: boolean;
    readonly center?: boolean;
}

const BUTTON_FILL = 0x1b2735;
const BUTTON_HOVER = 0x2a3a4e;
const BUTTON_SELECTED_EDGE = 0xfde68a;
const BUTTON_EDGE = 0x33465c;

/**
 * Ein Knopf aus Rechteck und Text, fest am Bildschirm (nicht an der Kamera).
 * Gibt die erzeugten Objekte zurück, damit der Aufrufer sie wieder entfernen kann.
 */
export function createButton(scene: Phaser.Scene, spec: ButtonSpec): Phaser.GameObjects.GameObject[] {
    const {x, y, width, height, disabled = false, selected = false} = spec;
    const fill = spec.fill ?? BUTTON_FILL;
    const rect = scene.add
        .rectangle(x + width / 2, y + height / 2, width, height, fill, disabled ? 0.4 : 1)
        .setStrokeStyle(selected ? 2 : 1, selected ? BUTTON_SELECTED_EDGE : BUTTON_EDGE)
        .setScrollFactor(0)
        .setDepth(DEPTH_HUD);
    const text = scene.add
        .text(spec.center ? x + width / 2 : x + 8, y + height / 2, spec.label, {
            fontFamily: THEME.font, resolution: TEXT_RESOLUTION,
            fontSize: `${spec.fontSize ?? 12}px`,
            color: spec.textColor ?? (disabled ? "#5b6b80" : THEME.text),
        })
        .setOrigin(spec.center ? 0.5 : 0, 0.5)
        .setScrollFactor(0)
        .setDepth(DEPTH_HUD);

    if (!disabled) {
        rect.setInteractive({useHandCursor: true})
            .on("pointerover", () => rect.setFillStyle(spec.fill === undefined ? BUTTON_HOVER : fill, 1))
            .on("pointerout", () => rect.setFillStyle(fill, 1))
            .on("pointerdown", spec.onClick);
    }

    return [rect, text];
}

/** Kleine Überschrift über einem Abschnitt. */
export function createHeading(scene: Phaser.Scene, x: number, y: number, label: string): Phaser.GameObjects.Text {
    return scene.add
        .text(x, y, label, {fontFamily: THEME.font, resolution: TEXT_RESOLUTION, fontSize: "11px", color: THEME.mutedText})
        .setScrollFactor(0)
        .setDepth(DEPTH_HUD);
}
