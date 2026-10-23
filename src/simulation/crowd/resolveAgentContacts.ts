import type {Agent} from "../Agent.ts";
import type {SpatialGrid} from "../../spatial/SpatialGrid.ts";
import type {Collider} from "../geometry/Collider.ts";
import {moveWithCollisions} from "../collision/moveWithCollisions.ts";

const COINCIDENT_DISTANCE = 1e-6;
/** Das Raster ist nach Korrekturen leicht veraltet; Abfrageradius mit Puffer. */
const QUERY_PADDING = 4;

/**
 * Harte Kontakte zwischen Agenten (positionsbasiert): Überlappende Agenten
 * werden auseinandergeschoben, aufeinander zulaufende Geschwindigkeiten
 * werden verlustbehaftet abgebaut. Dadurch haben Engstellen eine echte
 * Kapazität und Staus entstehen von selbst.
 *
 * Nach jeder Runde werden Agenten, die in ein Hindernis gedrückt wurden,
 * wieder herausgeschoben. Unter starkem Druck bleibt ein Rest-Überlapp
 * zwischen Agenten, die Hindernisse werden aber nie durchdrungen.
 *
 * `grid` muss die aktuellen Positionen enthalten.
 */
export function resolveAgentContacts(
    agents: readonly Agent[],
    grid: SpatialGrid,
    colliders: readonly Collider[],
    iterations: number,
): void {
    const maxRadius = agents.reduce((m, agent) => Math.max(m, agent.radius), 0);
    const queryRadius = 2 * maxRadius + QUERY_PADDING;

    const neighbors: number[] = [];
    const moved = new Set<Agent>();

    for (let round = 0; round < iterations; round++) {
        moved.clear();

        for (const agent of agents) {
            grid.query(agent.position.x, agent.position.y, queryRadius, neighbors);

            for (const index of neighbors) {
                // Jedes Paar nur einmal behandeln.
                if (index <= agent.id) {
                    continue;
                }

                if (separatePair(agent, agents[index])) {
                    moved.add(agent);
                    moved.add(agents[index]);
                }
            }
        }

        if (moved.size === 0) {
            return;
        }

        for (const agent of moved) {
            const result = moveWithCollisions(
                agent.position,
                {x: 0, y: 0},
                agent.velocity,
                agent.radius,
                colliders,
            );

            agent.position = result.position;
            agent.velocity = result.velocity;
        }
    }
}

/** Trennt zwei Agenten gleichmäßig. Gibt zurück, ob sie sich berührten. */
function separatePair(a: Agent, b: Agent): boolean {
    let dx = a.position.x - b.position.x;
    let dy = a.position.y - b.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const minimumDistance = a.radius + b.radius;

    if (distance >= minimumDistance) {
        return false;
    }

    if (distance < COINCIDENT_DISTANCE) {
        dx = 1;
        dy = 0;
    } else {
        dx /= distance;
        dy /= distance;
    }

    const push = (minimumDistance - distance) / 2;

    a.position = {x: a.position.x + dx * push, y: a.position.y + dy * push};
    b.position = {x: b.position.x - dx * push, y: b.position.y - dy * push};

    // Annäherungsgeschwindigkeit entlang der Kontaktnormalen abbauen.
    const approach =
        (a.velocity.x - b.velocity.x) * dx + (a.velocity.y - b.velocity.y) * dy;

    if (approach < 0) {
        a.velocity = {x: a.velocity.x - dx * approach / 2, y: a.velocity.y - dy * approach / 2};
        b.velocity = {x: b.velocity.x + dx * approach / 2, y: b.velocity.y + dy * approach / 2};
    }

    return true;
}
