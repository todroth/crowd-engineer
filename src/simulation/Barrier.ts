import type {Vector2} from "./Vector2.ts";

/** Dicke eines Absperrgitters (Pixel). */
export const BARRIER_THICKNESS = 6;

/**
 * Ein Absperrgitter: eine gerade Strecke, die niemand durchquert. Es wird wie
 * eine Wand behandelt (Kollision, Sicht, Wege), die Menge sucht sich also von
 * selbst einen Weg darum herum.
 */
export interface Barrier {
    readonly start: Vector2;
    readonly end: Vector2;
}
