import type {Agent} from "../Agent.ts";
import type {Vector2} from "../Vector2.ts";

export function getNavigationTarget(agent: Agent): Vector2 {
    return agent.waypoints[agent.waypointIndex] ?? agent.target;
}