import type {Obstacle} from "../Obstacle.ts";
import type {Vector2} from "../Vector2.ts";
import {distanceBetween, isPointBlocked, isRouteSegmentClear,} from "./routeGeometry.ts";

interface Edge {
    readonly to: number;
    readonly cost: number;
}

const NODE_MARGIN = 2;
const CIRCLE_SAMPLES = 16;
const WALL_ARC_SEGMENTS = 8;
const EPSILON = 1e-7;

export class RoutePlanner {
    private readonly obstacles: readonly Obstacle[];
    private readonly agentRadius: number;
    private readonly clearance: number;
    private readonly worldHeight: number;

    private readonly nodes: Vector2[];
    private readonly graph: Edge[][];

    constructor(
        obstacles: readonly Obstacle[],
        agentRadius: number,
        clearance: number,
        worldHeight: number,
    ) {
        this.obstacles = obstacles;
        this.agentRadius = agentRadius;
        this.clearance = clearance;
        this.worldHeight = worldHeight;

        this.nodes = this.createNodes();
        this.graph = this.createGraph();
    }

    planRoute(start: Vector2, target: Vector2): Vector2[] {
        const destination = {x: target.x, y: target.y};

        if (
            isRouteSegmentClear(
                start,
                destination,
                this.obstacles,
                this.agentRadius,
                this.clearance,
            )
        ) {
            return [destination];
        }

        const nodeCount = this.nodes.length;
        const startId = nodeCount;
        const goalId = nodeCount + 1;
        const totalVertices = nodeCount + 2;

        const distances = new Array<number>(totalVertices).fill(Infinity);
        const previous = new Array<number>(totalVertices).fill(-1);
        const closed = new Array<boolean>(totalVertices).fill(false);
        const inOpen = new Array<boolean>(totalVertices).fill(false);
        const open: number[] = [startId];

        distances[startId] = 0;
        inOpen[startId] = true;

        const pointFor = (id: number): Vector2 => {
            if (id === startId) return start;
            if (id === goalId) return destination;
            return this.nodes[id];
        };

        const heuristic = (id: number): number =>
            distanceBetween(pointFor(id), destination);

        const relax = (
            from: number,
            to: number,
            cost: number,
        ): void => {
            if (closed[to]) {
                return;
            }

            const alternative = distances[from] + cost;

            if (alternative + EPSILON >= distances[to]) {
                return;
            }

            distances[to] = alternative;
            previous[to] = from;

            if (!inOpen[to]) {
                open.push(to);
                inOpen[to] = true;
            }
        };

        while (open.length > 0) {
            // Für unseren relativ kleinen statischen Graphen reicht
            // eine einfache Open-Liste; keine Priority-Queue nötig.
            let bestIndex = 0;
            let bestScore = Infinity;

            for (let i = 0; i < open.length; i++) {
                const id = open[i];
                const score = distances[id] + heuristic(id);

                if (score < bestScore) {
                    bestScore = score;
                    bestIndex = i;
                }
            }

            const current = open.splice(bestIndex, 1)[0];
            inOpen[current] = false;

            if (closed[current]) {
                continue;
            }

            closed[current] = true;

            if (current === goalId) {
                break;
            }

            if (current === startId) {
                // Dynamische Verbindung vom aktuellen Agenten
                // zu allen statischen, direkt erreichbaren Punkten.
                for (let i = 0; i < nodeCount; i++) {
                    const node = this.nodes[i];

                    if (
                        isRouteSegmentClear(
                            start,
                            node,
                            this.obstacles,
                            this.agentRadius,
                            this.clearance,
                        )
                    ) {
                        relax(
                            current,
                            i,
                            distanceBetween(start, node),
                        );
                    }
                }

                continue;
            }

            // Statische Kanten des vorab berechneten Graphen.
            for (const edge of this.graph[current]) {
                relax(current, edge.to, edge.cost);
            }

            // Ziel ist ein dynamischer Endknoten.
            const currentPoint = this.nodes[current];

            if (
                isRouteSegmentClear(
                    currentPoint,
                    destination,
                    this.obstacles,
                    this.agentRadius,
                    this.clearance,
                )
            ) {
                relax(
                    current,
                    goalId,
                    distanceBetween(currentPoint, destination),
                );
            }
        }

        if (!Number.isFinite(distances[goalId])) {
            // Fallback: Die vorhandene Kollisionsprüfung verhindert
            // weiterhin das Durchdringen, falls kein Weg gefunden wird.
            return [destination];
        }

        const reversed: number[] = [];
        let current = goalId;

        while (current !== startId && current !== -1) {
            reversed.push(current);
            current = previous[current];
        }

        if (current !== startId) {
            return [destination];
        }

        reversed.reverse();

        return reversed.map((id) =>
            id === goalId
                ? destination
                : {...this.nodes[id]},
        );
    }

    private createNodes(): Vector2[] {
        const candidates: Vector2[] = [];

        for (const obstacle of this.obstacles) {
            switch (obstacle.type) {
                case "circle": {
                    const clearance =
                        obstacle.radius +
                        this.agentRadius +
                        this.clearance;

                    // Etwas größer als der Sicherheitsradius, damit
                    // die geraden Verbindungen die Kreisfläche meiden.
                    const nodeRadius =
                        (clearance + NODE_MARGIN) /
                        Math.cos(Math.PI / CIRCLE_SAMPLES);

                    for (let i = 0; i < CIRCLE_SAMPLES; i++) {
                        const angle = 2 * Math.PI * i / CIRCLE_SAMPLES;

                        candidates.push({
                            x: obstacle.center.x +
                                Math.cos(angle) * nodeRadius,
                            y: obstacle.center.y +
                                Math.sin(angle) * nodeRadius,
                        });
                    }
                    break;
                }

                case "rectangle": {
                    const margin =
                        this.agentRadius + this.clearance + NODE_MARGIN;

                    const left = obstacle.position.x - margin;
                    const right =
                        obstacle.position.x + obstacle.width + margin;
                    const top = obstacle.position.y - margin;
                    const bottom =
                        obstacle.position.y + obstacle.height + margin;

                    candidates.push(
                        {x: left, y: top},
                        {x: right, y: top},
                        {x: right, y: bottom},
                        {x: left, y: bottom},
                    );
                    break;
                }

                case "wall": {
                    const dx = obstacle.end.x - obstacle.start.x;
                    const dy = obstacle.end.y - obstacle.start.y;
                    const angle = Math.atan2(dy, dx);

                    const clearance =
                        obstacle.thickness / 2 +
                        this.agentRadius +
                        this.clearance;

                    const nodeRadius =
                        (clearance + NODE_MARGIN) /
                        Math.cos(Math.PI / (2 * WALL_ARC_SEGMENTS));

                    // Am Startende nur die nach außen gerichtete
                    // Halbkreisbahn erzeugen.
                    for (let i = 0; i <= WALL_ARC_SEGMENTS; i++) {
                        const theta =
                            angle + Math.PI / 2 +
                            Math.PI * i / WALL_ARC_SEGMENTS;

                        candidates.push({
                            x: obstacle.start.x +
                                Math.cos(theta) * nodeRadius,
                            y: obstacle.start.y +
                                Math.sin(theta) * nodeRadius,
                        });
                    }

                    // Entsprechend für das Endende.
                    for (let i = 0; i <= WALL_ARC_SEGMENTS; i++) {
                        const theta =
                            angle - Math.PI / 2 +
                            Math.PI * i / WALL_ARC_SEGMENTS;

                        candidates.push({
                            x: obstacle.end.x +
                                Math.cos(theta) * nodeRadius,
                            y: obstacle.end.y +
                                Math.sin(theta) * nodeRadius,
                        });
                    }
                    break;
                }
            }
        }

        const valid: Vector2[] = [];

        for (const point of candidates) {
            // Kandidaten außerhalb der sichtbaren vertikalen Welt
            // verwerfen, damit Routen nicht über den oberen oder
            // unteren Spielfeldrand führen.
            if (point.y < 0 || point.y > this.worldHeight) {
                continue;
            }

            if (
                isPointBlocked(
                    point,
                    this.obstacles,
                    this.agentRadius,
                    this.clearance,
                )
            ) {
                continue;
            }

            const duplicate = valid.some(
                (existing) => distanceBetween(existing, point) < 1,
            );

            if (!duplicate) {
                valid.push(point);
            }
        }

        return valid;
    }

    private createGraph(): Edge[][] {
        const graph: Edge[][] = this.nodes.map(() => []);

        for (let i = 0; i < this.nodes.length; i++) {
            for (let j = i + 1; j < this.nodes.length; j++) {
                const start = this.nodes[i];
                const end = this.nodes[j];

                if (
                    !isRouteSegmentClear(
                        start,
                        end,
                        this.obstacles,
                        this.agentRadius,
                        this.clearance,
                    )
                ) {
                    continue;
                }

                const cost = distanceBetween(start, end);

                graph[i].push({to: j, cost});
                graph[j].push({to: i, cost});
            }
        }

        return graph;
    }
}
