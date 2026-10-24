import type {Vector2} from "./Vector2.ts";

/**
 * Ein Ordner. Er steht fest an einem Ort und beruhigt Menschen in seiner Nähe
 * (Sichtkontakt vorausgesetzt). Wer ihn sieht, folgt seiner Weisung auf den
 * Weg, auf den er zeigt, auch in Panik, und erinnert sich eine Weile daran.
 *
 * Er ist kein Hindernis: Ein Körper mitten im Strom ließ in Tests die Menge vor
 * dem Ausgang verstopfen, ein Ordner steht in Wirklichkeit am Rand.
 */
export interface Marshal {
    readonly position: Vector2;
    /** Index des Weges in `Level.routes`, auf den er weist. */
    readonly route: number;
}
