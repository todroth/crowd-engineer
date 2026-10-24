import type {Agent} from "../Agent.ts";
import type {Vector2} from "../Vector2.ts";
import type {SpatialGrid} from "../spatial/SpatialGrid.ts";

const SAMPLE_SPACING = 20;
const SAMPLE_RADIUS = 16;

/**
 * Wie viel Gedränge sieht `agent` auf der Strecke bis `target`? Mittelwert
 * der Agentenzahl in Kreisen entlang der Blicklinie (Hindernisse
 * schließt der Aufrufer über die Sichtprüfung aus). Der Agent kennt nur,
 * was auf dieser Linie steht, nicht die Menge insgesamt.
 */
export function perceiveCrowd(
    agent: Agent,
    target: Vector2,
    agents: readonly Agent[],
    grid: SpatialGrid,
    buffer: number[],
): number {
    const dx = target.x - agent.position.x;
    const dy = target.y - agent.position.y;
    const length = Math.hypot(dx, dy);
    const samples = Math.max(1, Math.floor(length / SAMPLE_SPACING));

    let total = 0;

    for (let i = 1; i <= samples; i++) {
        const t = (i * SAMPLE_SPACING) / length;
        const x = agent.position.x + dx * Math.min(1, t);
        const y = agent.position.y + dy * Math.min(1, t);

        grid.query(x, y, SAMPLE_RADIUS, buffer);

        for (const index of buffer) {
            const other = agents[index];

            if (
                other !== agent &&
                Math.hypot(other.position.x - x, other.position.y - y) < SAMPLE_RADIUS
            ) {
                total++;
            }
        }
    }

    return total / samples;
}
