import type {Plan} from "../simulation/Plan.ts";

/** Ausgangslage: Alle starten gleichzeitig. */
export const DEFAULT_PLAN: Plan = {
    releaseDelays: [0, 0, 0],
};
