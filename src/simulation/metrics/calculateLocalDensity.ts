import type {Agent} from "../Agent.ts";

export function calculateLocalDensity(
    agent: Agent,
    candidates: readonly Agent[],
    radius: number,
): number {
    if (radius <= 0) {
        return 0;
    }

    let density = 0;

    for (const other of candidates) {
        if (other.id === agent.id) {
            continue;
        }

        const dx = agent.position.x - other.position.x;
        const dy = agent.position.y - other.position.y;
        const distance = Math.hypot(dx, dy);

        if (distance >= radius) {
            continue;
        }

        // Nahe Nachbarn zählen stärker als weit entfernte.
        density += 1 - distance / radius;
    }

    return density;
}
