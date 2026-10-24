import type {Scenario} from "./Scenario.ts";
import {HALLENBRAND} from "./levels/hallenbrand.ts";
import {NACHTCLUB} from "./levels/nachtclub.ts";
import {STADION} from "./levels/stadion.ts";

/** Alle spielbaren Szenarien; im Spiel mit den Zifferntasten umschaltbar. */
export const SCENARIOS: readonly Scenario[] = [
    HALLENBRAND,
    NACHTCLUB,
    STADION,
];
