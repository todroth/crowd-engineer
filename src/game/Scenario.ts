import type {Level} from "../simulation/Level.ts";
import type {Plan} from "../simulation/Plan.ts";

/** Ein spielbares Szenario: die Welt und der Plan, mit dem man startet. */
export interface Scenario {
    readonly level: Level;
    readonly plan: Plan;
}
