import type {Level} from "../simulation/Level.ts";
import type {Plan} from "../simulation/Plan.ts";

/** Ein Plan mit Namen für die Anzeige. */
export interface NamedPlan {
    readonly name: string;
    readonly plan: Plan;
}

/** Ein spielbares Szenario: die Welt und der Plan, mit dem man startet. */
export interface Scenario {
    readonly level: Level;
    /** Startplan, in den Beispielszenarien mit ein paar Beispiel-Schildern. */
    readonly plan: Plan;
    /** Weitere Beispielpläne zum Ausprobieren und für `npm run scenarios`. */
    readonly examples?: readonly NamedPlan[];
    /** Was der Spieler aufstellen darf; Fehlendes gilt als `DEFAULT_INVENTORY`. */
    readonly inventory?: Partial<Inventory>;
}

/** Vorrat an Maßnahmen, den der Spieler in der Planung platzieren darf. */
export interface Inventory {
    readonly signs: number;
    readonly marshals: number;
    /** Gesamtlänge der Absperrgitter in Metern. */
    readonly barrierMeters: number;
}

export const DEFAULT_INVENTORY: Inventory = {signs: 3, marshals: 0, barrierMeters: 0};

export function scenarioInventory(scenario: Scenario): Inventory {
    return {...DEFAULT_INVENTORY, ...scenario.inventory};
}

/**
 * Der Lauf ohne Maßnahmen: keine Schilder, keine Verzögerung. Sein Ergebnis steht
 * als Referenz in `Level.scoring`, gegen die jeder Plan verglichen wird.
 */
export function planWithoutMeasures(level: Level): Plan {
    return {signs: [], releaseDelays: level.sectors.map(() => 0)};
}

/**
 * Alle wählbaren Pläne eines Szenarios: Startplan, ohne Maßnahmen, danach die
 * Beispiele. Der Index ist der Plan-Parameter der URL (`?plan=1`) und die
 * Reihenfolge der Taste P.
 */
export function scenarioPlans(scenario: Scenario): readonly NamedPlan[] {
    return [
        {name: "Vorschlag", plan: scenario.plan},
        {name: "Ohne Maßnahmen (Vergleichswert)", plan: planWithoutMeasures(scenario.level)},
        ...(scenario.examples ?? []),
    ];
}
