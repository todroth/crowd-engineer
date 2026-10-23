import type {Obstacle} from "./Obstacle.ts";
import type {Rect} from "./geometry/Rect.ts";
import type {SimulationConfig} from "./SimulationConfig.ts";

export interface Level {
    readonly worldWidth: number;
    readonly worldHeight: number;

    readonly agentCount: number;
    /** Hier werden die Agenten zu Beginn platziert. */
    readonly spawnArea: Rect;
    /** Hier treten Agenten wieder ein, nachdem sie angekommen sind (außerhalb der Welt). */
    readonly entryArea: Rect;
    /** Wer diesen Bereich erreicht, gilt als angekommen. */
    readonly goalArea: Rect;

    readonly obstacles: readonly Obstacle[];
    readonly simulation: SimulationConfig;

    /** Startwert des Zufallsgenerators, damit Läufe reproduzierbar sind. */
    readonly seed: number;
}
