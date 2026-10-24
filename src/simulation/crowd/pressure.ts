import type {Agent} from "../Agent.ts";
import type {Vector2} from "../Vector2.ts";
import type {CrushConfig} from "../SimulationConfig.ts";

/** Bezugstempo (Pixel/s), mit dem blockierter Schub in Druck umgerechnet wird. */
const NORMAL_SPEED = 50;

/**
 * Druck = blockierter Schub: Wunschtempo abzüglich des tatsächlichen
 * Fortschritts in Wunschrichtung (bezogen auf ein Normaltempo), dazu
 * ein Anteil vom Druck der Nachbarn. Ein Agent, der mit mehr Schub
 * (Panik) gegen dieselbe Blockade drückt, erzeugt mehr Druck.
 *
 * @param speed Wunschtempo (Pixel/s)
 * @param direction Wunschrichtung (Einheitsvektor)
 * @param neighborPressure mittlerer Druck der Nachbarn
 */
export function updatePressure(
    agent: Agent,
    speed: number,
    direction: Vector2,
    neighborPressure: number,
    config: CrushConfig,
    deltaSeconds: number,
): void {
    const progress = agent.velocity.x * direction.x + agent.velocity.y * direction.y;
    const blockedPush = Math.max(0, speed - progress) / NORMAL_SPEED;
    const target = blockedPush + config.transmission * neighborPressure;

    agent.pressure += (target - agent.pressure) * Math.min(1, config.responseRate * deltaSeconds);
}

/** Beweglichkeit (minimumMobility..1): sinkt unter Druck, siehe `CrushConfig`. */
export function mobility(pressure: number, config: CrushConfig): number {
    const {onsetPressure, fullPressure, minimumMobility} = config;
    const crush = Math.min(
        1,
        Math.max(0, (pressure - onsetPressure) / (fullPressure - onsetPressure)),
    );

    return 1 - crush * (1 - minimumMobility);
}
