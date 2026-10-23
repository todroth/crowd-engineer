import type {Agent} from "../Agent.ts";
import type {Vector2} from "../Vector2.ts";

export function calculateSeparation(
    agent: Agent,
    candidates: readonly Agent[],
    radius: number,
    strength: number
): Vector2 {
    let separationX = 0;
    let separationY = 0;

    for (const other of candidates) {
        if (other.id === agent.id) {
            continue;
        }

        const dx = agent.position.x - other.position.x;
        const dy = agent.position.y - other.position.y;
        const distance = Math.hypot(dx, dy);

        if (distance === 0 || distance >= radius) {
            continue;
        }

        const weight = (radius - distance) / radius;

        separationX += (dx / distance) * weight;
        separationY += (dy / distance) * weight;
    }

    return {
        x: separationX * strength,
        y: separationY * strength,
    };
}