import type {Agent} from "../../Agent.ts";
import type {Vector2} from "../../Vector2.ts";
import {getNavigationTarget} from "../../navigation/getNavigationTarget.ts";

export interface TargetBasis {
    readonly forwardX: number;
    readonly forwardY: number;
    readonly normalX: number;
    readonly normalY: number;
}

export function getTargetBasis(agent: Agent): TargetBasis | null {
    const target = getNavigationTarget(agent);
    const dx = target.x - agent.position.x;
    const dy = target.y - agent.position.y;
    const distance = Math.hypot(dx, dy);

    if (distance === 0) {
        return null;
    }

    const forwardX = dx / distance;
    const forwardY = dy / distance;

    return {
        forwardX,
        forwardY,
        normalX: -forwardY,
        normalY: forwardX,
    };
}

export function calculateProjectedAvoidance(
    agent: Agent,
    center: Vector2,
    forwardExtent: number,
    lateralExtent: number,
    basis: TargetBasis,
    lookAheadDistance: number,
    strength: number,
    clearanceMargin: number,
): Vector2 {
    if (lookAheadDistance <= 0) {
        return {x: 0, y: 0};
    }

    const relativeX = center.x - agent.position.x;
    const relativeY = center.y - agent.position.y;

    const forwardDistance =
        relativeX * basis.forwardX + relativeY * basis.forwardY;

    const lateralDistance =
        relativeX * basis.normalX + relativeY * basis.normalY;

    const longitudinalClearance = agent.radius + clearanceMargin;

    const clearanceRadius =
        lateralExtent + longitudinalClearance;

// Abstand zur Vorderkante einschließlich Sicherheitsabstand.
    const frontDistance = Math.max(
        0,
        forwardDistance - forwardExtent - longitudinalClearance,
    );

// Nur ausweichen, solange das Hindernis vor bzw. neben
// dem Agenten liegt und tatsächlich relevant ist.
    if (
        forwardDistance + forwardExtent < -longitudinalClearance ||
        frontDistance > lookAheadDistance ||
        Math.abs(lateralDistance) >= clearanceRadius
    ) {
        return {x: 0, y: 0};
    }

    const side = Math.abs(lateralDistance) < 0.001
        ? (agent.id % 2 === 0 ? -1 : 1)
        : (lateralDistance > 0 ? -1 : 1);

    const forwardUrgency = Math.max(
        0,
        1 - frontDistance / lookAheadDistance,
    );

    const lateralUrgency =
        1 - Math.abs(lateralDistance) / clearanceRadius;

    const force = strength * forwardUrgency * lateralUrgency;

    return {
        x: basis.normalX * side * force,
        y: basis.normalY * side * force,
    };
}
