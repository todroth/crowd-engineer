import type {Obstacle} from "../Obstacle.ts";
import type {Vector2} from "../Vector2.ts";
import type {Rect} from "../geometry/Rect.ts";
import {type Collider, createColliders} from "../geometry/Collider.ts";
import {isSegmentClear, pointClearance} from "../geometry/clearance.ts";
import {distanceBetween} from "../geometry/segments.ts";
import {MinHeap} from "./MinHeap.ts";
import {createRouteNodeCandidates} from "./routeNodes.ts";

interface Edge {
    readonly to: number;
    readonly cost: number;
}

/** Zusätzlicher Abstand der Graphknoten, damit Kanten sicher frei bleiben. */
const NODE_MARGIN = 2;
const TOLERANCE = 1e-7;
/** Spielraum, den ein Agent unterhalb seines aktuellen Abstands haben darf. */
const START_SLACK = 0.01;

/**
 * Kürzeste Wege durch die Hindernisse mittels Sichtbarkeitsgraph und A*.
 *
 * Der Graph aus Knoten rund um die Hindernisse wird einmal aufgebaut. Start
 * und Ziel werden pro Anfrage dynamisch angebunden. Alle Wege halten
 * `agentRadius + clearance` Abstand zu den Hindernissen.
 */
export class RoutePlanner {
    private readonly agentRadius: number;
    private readonly clearance: number;
    private readonly colliders: readonly Collider[];
    private readonly nodes: Vector2[];
    private readonly edges: Edge[][];

    constructor(
        obstacles: readonly Obstacle[],
        bounds: Rect,
        agentRadius: number,
        clearance: number,
    ) {
        this.agentRadius = agentRadius;
        this.clearance = clearance;
        this.colliders = createColliders(obstacles);
        this.nodes = this.createNodes(obstacles, bounds);
        this.edges = this.createEdges();
    }

    /**
     * Ist die Strecke frei, wenn zusätzlich zum Agentenradius `margin`
     * Abstand zu allen Hindernissen verlangt wird?
     */
    isPathClear(from: Vector2, to: Vector2, margin: number): boolean {
        return this.isSegmentFree(from, to, this.agentRadius + margin);
    }

    /**
     * Kann ein Agent von `from` aus geradeaus nach `to` laufen? Wie
     * `isPathClear` ohne Sicherheitsmarge, aber ein Agent, der dicht an einer
     * Wand steht (etwa von der Menge dorthin gedrückt), wird nicht strenger
     * beurteilt als sein aktueller Abstand.
     */
    canWalk(from: Vector2, to: Vector2): boolean {
        return this.isSegmentFree(from, to, this.requiredAt(from, 0));
    }

    /**
     * Route von `start` nach `goal` (ohne `start`, mit `goal` als letztem
     * Punkt). Gibt es keinen Weg, bleibt nur die direkte Linie; die
     * Kollisionsbehandlung verhindert dann trotzdem das Durchdringen.
     */
    planRoute(start: Vector2, goal: Vector2): Vector2[] {
        const target = {x: goal.x, y: goal.y};
        const startRequired = this.requiredAt(start, this.clearance);

        if (this.isSegmentFree(start, target, startRequired)) {
            return [target];
        }

        const path = this.searchPath(start, target, startRequired);

        return path ? this.pullString(start, path, startRequired) : [target];
    }

    private isSegmentFree(from: Vector2, to: Vector2, required: number): boolean {
        return isSegmentClear(from, to, this.colliders, required - TOLERANCE);
    }

    /**
     * Abstand zu Hindernissen, den eine Strecke ab `point` einhalten muss:
     * Agentenradius plus `margin`, aber nie mehr, als `point` selbst hat.
     * Wer von der Menge in den Randbereich geschoben wurde, darf von dort
     * trotzdem losplanen, sonst wäre jede Verbindung "blockiert".
     */
    private requiredAt(point: Vector2, margin: number): number {
        return Math.min(
            this.agentRadius + margin,
            pointClearance(point, this.colliders) - START_SLACK,
        );
    }

    private searchPath(
        start: Vector2,
        goal: Vector2,
        startRequired: number,
    ): Vector2[] | null {
        const startId = this.nodes.length;
        const goalId = startId + 1;
        const vertexCount = startId + 2;

        const cost = new Array<number>(vertexCount).fill(Infinity);
        const previous = new Array<number>(vertexCount).fill(-1);
        const closed = new Array<boolean>(vertexCount).fill(false);

        const pointOf = (id: number): Vector2 =>
            id === startId ? start : id === goalId ? goal : this.nodes[id];

        const open = new MinHeap(
            (id) => cost[id] + distanceBetween(pointOf(id), goal),
        );

        const relax = (from: number, to: number, edgeCost: number): void => {
            const candidate = cost[from] + edgeCost;

            if (!closed[to] && candidate + TOLERANCE < cost[to]) {
                cost[to] = candidate;
                previous[to] = from;
                // Doppelte Einträge sind unschädlich: Geschlossene werden übersprungen.
                open.push(to);
            }
        };

        cost[startId] = 0;
        open.push(startId);

        while (open.size > 0) {
            const current = open.pop();

            if (closed[current]) {
                continue;
            }

            closed[current] = true;

            if (current === goalId) {
                break;
            }

            const point = pointOf(current);

            if (current === startId) {
                this.nodes.forEach((node, id) => {
                    if (this.isSegmentFree(start, node, startRequired)) {
                        relax(current, id, distanceBetween(start, node));
                    }
                });
                continue;
            }

            for (const edge of this.edges[current]) {
                relax(current, edge.to, edge.cost);
            }

            if (this.isPathClear(point, goal, this.clearance)) {
                relax(current, goalId, distanceBetween(point, goal));
            }
        }

        if (!Number.isFinite(cost[goalId])) {
            return null;
        }

        const path: Vector2[] = [];

        for (let id = goalId; id !== startId; id = previous[id]) {
            path.push(pointOf(id));
        }

        return path.reverse();
    }

    /**
     * "String pulling": überspringt Zwischenpunkte, solange die direkte
     * Verbindung frei bleibt. Ergibt die kürzeste Route mit den wenigsten
     * Wegpunkten.
     */
    private pullString(
        start: Vector2,
        path: readonly Vector2[],
        startRequired: number,
    ): Vector2[] {
        const route: Vector2[] = [];
        let anchor = start;
        let required = startRequired;
        let index = 0;

        while (index < path.length) {
            let next = index;

            for (let candidate = path.length - 1; candidate > index; candidate--) {
                if (this.isSegmentFree(anchor, path[candidate], required)) {
                    next = candidate;
                    break;
                }
            }

            route.push(path[next]);
            anchor = path[next];
            required = this.agentRadius + this.clearance;
            index = next + 1;
        }

        return route;
    }

    private createNodes(obstacles: readonly Obstacle[], bounds: Rect): Vector2[] {
        const margin = this.agentRadius + this.clearance + NODE_MARGIN;
        const nodes: Vector2[] = [];

        for (const point of createRouteNodeCandidates(obstacles, margin)) {
            const insideWorld =
                point.x >= bounds.x &&
                point.x <= bounds.x + bounds.width &&
                point.y >= bounds.y &&
                point.y <= bounds.y + bounds.height;

            const blocked =
                pointClearance(point, this.colliders) <
                this.agentRadius + this.clearance;

            const duplicate = nodes.some(
                (existing) => distanceBetween(existing, point) < 1,
            );

            if (insideWorld && !blocked && !duplicate) {
                nodes.push(point);
            }
        }

        return nodes;
    }

    private createEdges(): Edge[][] {
        const edges: Edge[][] = this.nodes.map(() => []);

        for (let i = 0; i < this.nodes.length; i++) {
            for (let j = i + 1; j < this.nodes.length; j++) {
                if (!this.isPathClear(this.nodes[i], this.nodes[j], this.clearance)) {
                    continue;
                }

                const cost = distanceBetween(this.nodes[i], this.nodes[j]);

                edges[i].push({to: j, cost});
                edges[j].push({to: i, cost});
            }
        }

        return edges;
    }
}
