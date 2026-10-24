import type {Level} from "../simulation/Level.ts";
import type {Plan} from "../simulation/Plan.ts";

/** Ein spielbares Szenario: die Welt und der Plan, mit dem man startet. */
export interface Scenario {
    readonly level: Level;
    /** Startplan, in den Beispielszenarien mit ein paar Beispiel-Schildern. */
    readonly plan: Plan;
    /** Weitere Beispielpläne zum Ausprobieren und für `npm run scenarios`. */
    readonly examples?: readonly {readonly name: string; readonly plan: Plan}[];
}

/**
 * Der Lauf ohne Maßnahmen: keine Schilder, keine Verzögerung. Sein Ergebnis steht
 * als Referenz in `Level.scoring`, gegen die jeder Plan verglichen wird.
 */
export function planWithoutMeasures(level: Level): Plan {
    return {signs: [], releaseDelays: level.sectors.map(() => 0)};
}
