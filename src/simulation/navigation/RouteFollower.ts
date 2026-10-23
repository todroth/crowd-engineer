import type {Agent} from "../Agent.ts";
import type {Vector2} from "../Vector2.ts";
import {distanceBetween} from "../geometry/segments.ts";
import type {RoutePlanner} from "./RoutePlanner.ts";

/** Mindestabstand zwischen zwei Neuplanungen eines Agenten (Sekunden). */
const REPLAN_COOLDOWN = 0.5;
/** Ein Wegpunkt gilt als erreicht, wenn der Agent näher ist als Radius + dies. */
const WAYPOINT_REACH_MARGIN = 2;

/**
 * Lässt Agenten ihrer Route folgen, ohne an Wegpunkten hängenzubleiben:
 *
 *  - Ein Wegpunkt wird abgehakt, sobald der Agent ihn erreicht hat *oder*
 *    den übernächsten direkt sehen kann. Dadurch schneiden Agenten Ecken
 *    so eng wie erlaubt und stauen sich nicht um Zwischenpunkte, auch
 *    wenn die Menge sie davon wegdrückt.
 *  - Verliert ein Agent die Sicht auf seinen nächsten Wegpunkt (von der
 *    Menge abgedrängt), wird neu geplant.
 */
export class RouteFollower {
    private readonly planner: RoutePlanner;
    private readonly clearance: number;

    constructor(planner: RoutePlanner, clearance: number) {
        this.planner = planner;
        this.clearance = clearance;
    }

    assignRoute(agent: Agent): void {
        agent.route = this.planner.planRoute(agent.position, agent.goal);
        agent.routeIndex = 0;
        agent.replanCooldown = REPLAN_COOLDOWN;
    }

    currentTarget(agent: Agent): Vector2 {
        return agent.route[agent.routeIndex] ?? agent.goal;
    }

    update(agent: Agent, deltaSeconds: number): void {
        agent.replanCooldown = Math.max(0, agent.replanCooldown - deltaSeconds);

        this.advanceAlongRoute(agent);

        if (
            agent.replanCooldown === 0 &&
            !this.planner.canWalk(agent.position, this.currentTarget(agent))
        ) {
            this.assignRoute(agent);
        }
    }

    private advanceAlongRoute(agent: Agent): void {
        const reach = agent.radius + WAYPOINT_REACH_MARGIN;
        const lastIndex = agent.route.length - 1;

        while (agent.routeIndex < lastIndex) {
            const reached =
                distanceBetween(agent.position, agent.route[agent.routeIndex]) < reach;

            const nextVisible = this.planner.isPathClear(
                agent.position,
                agent.route[agent.routeIndex + 1],
                this.clearance,
            );

            if (!reached && !nextVisible) {
                return;
            }

            agent.routeIndex++;
        }
    }
}
