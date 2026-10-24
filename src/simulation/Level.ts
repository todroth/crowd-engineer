import type {Obstacle} from "./Obstacle.ts";
import type {Rect} from "./geometry/Rect.ts";
import type {ScoringConfig} from "./scoring.ts";
import type {SimulationConfig} from "./SimulationConfig.ts";

/** Ein Weg, zwischen denen die Agenten wählen können. */
export interface RouteOption {
    /** Bereich am Anfang des Weges; wer ihn durchquert, hat den Weg gewählt. */
    readonly entrance: Rect;
    /**
     * Index eines Ausgangs in `goalAreas`, der nur über diesen Weg bekannt ist:
     * Er fehlt im Hauptfeld, die Menge läuft also zu den anderen Ausgängen, bis
     * jemand den Weg sieht oder ein Schild darauf zeigt (etwa ein unbekannter
     * Notausgang). Ohne Angabe führt der Weg zu den bekannten Ausgängen.
     */
    readonly exit?: number;
}

export interface Level {
    /** Name und kurze Beschreibung für die Anzeige. */
    readonly name: string;
    readonly description: string;

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
    /** Wer einen dieser Bereiche (Ausgänge) erreicht, gilt als angekommen. */
    readonly goalAreas: readonly Rect[];
    /**
     * Lauftempo der Agenten (Pixel/s), je Agent zufällig daraus gezogen. In einem
     * Notfall wird gerannt (40 bis 60), bei geordneter Räumung gegangen (etwa 22 bis 32).
     */
    readonly walkingSpeed: {readonly min: number; readonly max: number};
    /**
     * Alternative Wege zum Ziel, jeweils durch ihren Eingangsbereich
     * gegeben. Wer den Bereich durchquert, hat den Weg gewählt.
     */
    readonly routes: readonly RouteOption[];

    readonly scoring: ScoringConfig;

    readonly obstacles: readonly Obstacle[];
    readonly simulation: SimulationConfig;

    /** Startwert des Zufallsgenerators, damit Läufe reproduzierbar sind. */
    readonly seed: number;
}
