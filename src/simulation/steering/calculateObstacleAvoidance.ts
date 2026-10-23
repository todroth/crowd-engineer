import type {Agent} from "../Agent.ts";
import type {Obstacle} from "../Obstacle.ts";
import type {Vector2} from "../Vector2.ts";

export function calculateObstacleAvoidance(
    agent: Agent,
    obstacles: readonly Obstacle[],
    lookAheadDistance: number,
    strength: number,
    clearanceMargin: number,
): Vector2 {
    const targetX = agent.target.x - agent.position.x;
    const targetY = agent.target.y - agent.position.y;
    const targetDistance = Math.hypot(targetX, targetY);

    if (targetDistance === 0) {
        return {x: 0, y: 0};
    }

    const forwardX = targetX / targetDistance;
    const forwardY = targetY / targetDistance;

    // Senkrecht zur Richtung des Ziels.
    const normalX = -forwardY;
    const normalY = forwardX;

    let avoidanceX = 0;
    let avoidanceY = 0;

    for (const obstacle of obstacles) {
        const relativeX = obstacle.position.x - agent.position.x;
        const relativeY = obstacle.position.y - agent.position.y;

        const forwardDistance = relativeX * forwardX + relativeY * forwardY;

        // Hindernisse außerhalb des relevanten Bereichs ignorieren.
        if (
            forwardDistance <= -obstacle.radius ||
            forwardDistance >= lookAheadDistance + obstacle.radius
        ) {
            continue;
        }

        const lateralDistance = relativeX * normalX + relativeY * normalY;
        const clearanceRadius = obstacle.radius + agent.radius + clearanceMargin;
        const absoluteLateralDistance = Math.abs(lateralDistance);

        // Der geplante Weg führt bereits weit genug am Hindernis vorbei.
        if (absoluteLateralDistance >= clearanceRadius) {
            continue;
        }

        // Vom Hindernis weglenken; bei direkter Ausrichtung
        // anhand der Agenten-ID eine stabile Seite auswählen.
        const side = absoluteLateralDistance < 0.001
            ? (agent.id % 2 === 0 ? -1 : 1)
            : (lateralDistance > 0 ? -1 : 1);

        const distancePastFront = Math.max(0, forwardDistance - obstacle.radius);
        const forwardUrgency = 1 - Math.min( 1, distancePastFront / lookAheadDistance);
        const lateralUrgency =  1 - absoluteLateralDistance / clearanceRadius;
        const force = strength * forwardUrgency * lateralUrgency;

        avoidanceX += normalX * side * force;
        avoidanceY += normalY * side * force;
    }

    return {
        x: avoidanceX,
        y: avoidanceY,
    };
}