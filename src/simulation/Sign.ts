import type {Vector2} from "./Vector2.ts";

/**
 * Ein Wegweiser. Wer ihn sieht, kennt den Weg, auf den er zeigt, auch wenn
 * dessen Eingang noch nicht zu sehen ist, und bewertet ihn besser. Panik
 * schwächt die Wirkung ab.
 */
export interface Sign {
    readonly position: Vector2;
    /** Index des Weges in `Level.routes`, auf den das Schild zeigt. */
    readonly route: number;
    /** Wie überzeugend das Schild ist (0..1). */
    readonly strength: number;
}
