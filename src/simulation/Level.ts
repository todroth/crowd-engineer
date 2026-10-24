import type {Obstacle} from "./Obstacle.ts";
import type {Rect} from "./geometry/Rect.ts";
import type {SimulationConfig} from "./SimulationConfig.ts";

export interface Level {
    readonly worldWidth: number;
    readonly worldHeight: number;
    /**
     * Maßstab: Pixel pro Meter. Ein Mensch ist etwa 0,5 m breit (Agentendurchmesser
     * 8 px), das ergibt 16 px/m. Dient dazu, Werte in reale Einheiten umzurechnen.
     */
    readonly pixelsPerMeter: number;

    readonly agentCount: number;
    /** Hier werden die Agenten zu Beginn platziert. */
    readonly spawnArea: Rect;
    /**
     * Teilt den Startbereich in Blöcke, die der Plan zeitversetzt freigeben
     * kann. Agenten gehören zu dem Block, in dem sie starten.
     */
    readonly sectors: readonly Rect[];
    /** Hier treten Agenten wieder ein, nachdem sie angekommen sind (außerhalb der Welt). */
    readonly entryArea: Rect;
    /**
     * Treten angekommene Agenten wieder ein (Dauerbetrieb)? Sonst läuft die
     * Menge einmal durch, und der Durchlauf endet, wenn alle angekommen sind
     * oder das Zeitlimit erreicht ist.
     */
    readonly respawn: boolean;
    /** Zeitlimit eines Durchlaufs (Sekunden); nur ohne Respawn relevant. */
    readonly timeLimit: number;
    /** Wer diesen Bereich erreicht, gilt als angekommen. */
    readonly goalArea: Rect;
    /**
     * Alternative Wege zum Ziel, jeweils durch ihren Eingangsbereich
     * gegeben. Wer den Bereich durchquert, hat den Weg gewählt.
     */
    readonly routes: readonly Rect[];

    readonly obstacles: readonly Obstacle[];
    readonly simulation: SimulationConfig;

    /** Startwert des Zufallsgenerators, damit Läufe reproduzierbar sind. */
    readonly seed: number;
}
