import type {Scenario} from "./Scenario.ts";
import {HALLENBRAND} from "./levels/hallenbrand.ts";

/** Alle spielbaren Szenarien; im Spiel mit den Zifferntasten umschaltbar. */
export const SCENARIOS: readonly Scenario[] = [
    HALLENBRAND,
];
