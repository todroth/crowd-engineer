import type {Agent} from "./Agent.ts";
import {AgentSpawner} from "./AgentSpawner.ts";
import type {Level} from "./Level.ts";
import {SpatialGrid} from "../spatial/SpatialGrid.ts";
import {createRandom} from "./random.ts";
import {type Collider, createColliders} from "./geometry/Collider.ts";
import {pointClearance} from "./geometry/clearance.ts";
import {rectContains} from "./geometry/Rect.ts";
import {moveWithCollisions} from "./collision/moveWithCollisions.ts";
import {createNeighborSample, sampleNeighbors} from "./crowd/sampleNeighbors.ts";
import {calculateWallProximity} from "./crowd/wallProximity.ts";
import {resolveAgentContacts} from "./crowd/resolveAgentContacts.ts";
import {FlowField} from "./navigation/FlowField.ts";
import {Wayfinder} from "./navigation/Wayfinder.ts";
import {perceiveCrowd} from "./crowd/perceiveCrowd.ts";
import {updatePanic} from "./crowd/updatePanic.ts";
import type {Vector2} from "./Vector2.ts";

/** Die Simulation läuft in festen Schritten, unabhängig von der Framerate. */
const FIXED_STEP = 1 / 60;
/** Obergrenze pro `update`, damit lange Frames keine Todesspirale auslösen. */
const MAX_STEPS_PER_UPDATE = 5;

/** Steering darf die Wunschgeschwindigkeit höchstens so weit überschreiten. */
const MAX_SPEED_FACTOR = 1.5;
const CONTACT_ITERATIONS = 3;

export class Simulation {
    readonly agents: Agent[];
    /** Anzahl der Agenten, die ihr Ziel erreicht haben. */
    arrivedCount = 0;

    private readonly level: Level;
    private readonly colliders: readonly Collider[];
    private readonly grid: SpatialGrid;
    private readonly neighborRadius: number;
    private readonly spawner: AgentSpawner;
    /** Laufrichtungen zum Zielbereich. */
    readonly flowField: FlowField;
    private readonly wayfinder: Wayfinder;

    private accumulator = 0;

    // Wiederverwendete Puffer, damit pro Schritt nichts allokiert wird.
    private readonly neighborBuffer: number[] = [];
    private readonly perceptionBuffer: number[] = [];
    private readonly sample = createNeighborSample();
    private readonly direction: Vector2 = {x: 0, y: 0};
    private readonly nextVelocityX: Float64Array;
    private readonly nextVelocityY: Float64Array;

    constructor(level: Level) {
        const {simulation: config} = level;

        this.level = level;
        this.colliders = createColliders(level.obstacles);
        this.neighborRadius = Math.max(
            config.separationRadius,
            config.densityRadius,
        );
        this.grid = new SpatialGrid(
            level.worldWidth,
            level.worldHeight,
            this.neighborRadius,
            level.agentCount,
        );
        const random = createRandom(level.seed);

        this.spawner = new AgentSpawner(level.spawnArea, level.entryArea, random);

        this.nextVelocityX = new Float64Array(level.agentCount);
        this.nextVelocityY = new Float64Array(level.agentCount);

        this.agents = [];

        for (let i = 0; i < level.agentCount; i++) {
            const agent = this.spawner.createAgent(this.isSpawnFree);

            this.agents.push(agent);
            this.grid.insert(agent.id, agent.position.x, agent.position.y);
        }

        this.flowField = new FlowField(
            this.colliders,
            this.fieldBounds(),
            level.goalArea,
            {
                cellSize: config.flowCellSize,
                agentRadius: Math.max(0, ...this.agents.map((a) => a.radius)),
                wallAvoidanceDistance: config.wallAvoidanceDistance,
            },
        );
        const fieldOptions = {
            cellSize: config.flowCellSize,
            agentRadius: Math.max(0, ...this.agents.map((a) => a.radius)),
            wallAvoidanceDistance: config.wallAvoidanceDistance,
        };

        this.wayfinder = new Wayfinder(
            this.colliders,
            this.flowField,
            level.routes.map(
                (entrance) =>
                    new FlowField(this.colliders, this.fieldBounds(), entrance, fieldOptions),
            ),
            level.routes,
            level.goalArea,
            config.wayfinding,
            random,
        );
    }

    update(deltaSeconds: number): void {
        this.accumulator += deltaSeconds;

        for (
            let steps = 0;
            this.accumulator >= FIXED_STEP && steps < MAX_STEPS_PER_UPDATE;
            steps++
        ) {
            this.step(FIXED_STEP);
            this.accumulator -= FIXED_STEP;
        }

        // Bei Überlast Rückstand verwerfen statt ihn aufzuholen.
        this.accumulator = Math.min(this.accumulator, FIXED_STEP);
    }

    private step(deltaSeconds: number): void {
        this.rebuildGrid();

        // Erst alle neuen Geschwindigkeiten aus dem Zustand zu Schrittbeginn
        // berechnen, dann anwenden: Das Ergebnis hängt nicht von der
        // Reihenfolge der Agenten ab.
        for (const agent of this.agents) {
            this.steer(agent, deltaSeconds);
        }

        for (const agent of this.agents) {
            agent.velocity = {
                x: this.nextVelocityX[agent.id],
                y: this.nextVelocityY[agent.id],
            };
            this.move(agent, deltaSeconds);
        }

        this.rebuildGrid();
        resolveAgentContacts(
            this.agents,
            this.grid,
            this.colliders,
            CONTACT_ITERATIONS,
        );

        for (const agent of this.agents) {
            if (rectContains(this.level.goalArea, agent.position)) {
                this.arrive(agent);
            }
        }
    }

    /** Berechnet die Geschwindigkeit des nächsten Schritts (in die Puffer). */
    private steer(agent: Agent, deltaSeconds: number): void {
        const config = this.level.simulation;

        this.grid.query(
            agent.position.x,
            agent.position.y,
            this.neighborRadius,
            this.neighborBuffer,
        );
        sampleNeighbors(
            agent,
            this.agents,
            this.neighborBuffer,
            config,
            this.sample,
        );
        agent.localDensity = this.measureDensity(agent);

        updatePanic(agent, this.sample.neighborPanic, config.panic, deltaSeconds);

        this.wayfinder.update(agent, deltaSeconds, (entrance) =>
            perceiveCrowd(agent, entrance, this.agents, this.grid, this.perceptionBuffer),
        );
        this.wayfinder.direction(agent, this.direction);

        // Panik macht schneller und lässt weniger Abstand.
        const speed = agent.desiredSpeed * (1 + config.panic.speedBoost * agent.panic);
        const separation =
            config.separationStrength *
            (1 - config.panic.separationReduction * agent.panic);

        // Wunschgeschwindigkeit plus Einflüsse der Menge.
        let wantedX =
            this.direction.x * speed +
            this.sample.separationX * separation +
            this.sample.alignmentX * config.alignmentStrength;
        let wantedY =
            this.direction.y * speed +
            this.sample.separationY * separation +
            this.sample.alignmentY * config.alignmentStrength;

        const maxSpeed = speed * MAX_SPEED_FACTOR * this.mobility(agent);
        const wantedSpeed = Math.hypot(wantedX, wantedY);

        if (wantedSpeed > maxSpeed) {
            wantedX *= maxSpeed / wantedSpeed;
            wantedY *= maxSpeed / wantedSpeed;
        }

        // Die Geschwindigkeit darf sich pro Schritt nur begrenzt ändern.
        const changeX = wantedX - agent.velocity.x;
        const changeY = wantedY - agent.velocity.y;
        const change = Math.hypot(changeX, changeY);
        const maxChange = config.maxAcceleration * deltaSeconds;
        const scale = change > maxChange ? maxChange / change : 1;

        this.nextVelocityX[agent.id] = agent.velocity.x + changeX * scale;
        this.nextVelocityY[agent.id] = agent.velocity.y + changeY * scale;
    }

    /** Beweglichkeit (minimumMobility..1): sinkt bei Quetschung, siehe `CrushConfig`. */
    private mobility(agent: Agent): number {
        const {onsetDensity, fullDensity, minimumMobility} = this.level.simulation.crush;
        const crush = Math.min(
            1,
            Math.max(0, (agent.localDensity - onsetDensity) / (fullDensity - onsetDensity)),
        );

        return 1 - crush * (1 - minimumMobility);
    }

    /** Dichte durch Nachbarn, verstärkt, wenn der Agent an einer Wand eingeklemmt ist. */
    private measureDensity(agent: Agent): number {
        const {densityRadius, wallDensityFactor} = this.level.simulation;

        if (this.sample.density === 0 || wallDensityFactor === 0) {
            return this.sample.density;
        }

        const proximity = calculateWallProximity(
            agent,
            this.colliders,
            densityRadius,
        );

        return this.sample.density * (1 + wallDensityFactor * proximity);
    }

    /** Rasterbereich des Flow-Fields: Welt plus Ein- und Austrittsbereich. */
    private fieldBounds() {
        const {worldWidth, worldHeight, entryArea, goalArea} = this.level;
        const left = Math.min(0, entryArea.x, goalArea.x);
        const top = Math.min(0, entryArea.y, goalArea.y);
        const right = Math.max(
            worldWidth,
            entryArea.x + entryArea.width,
            goalArea.x + goalArea.width,
        );
        const bottom = Math.max(
            worldHeight,
            entryArea.y + entryArea.height,
            goalArea.y + goalArea.height,
        );

        return {x: left, y: top, width: right - left, height: bottom - top};
    }

    private move(agent: Agent, deltaSeconds: number): void {
        const result = moveWithCollisions(
            agent.position,
            {
                x: agent.velocity.x * deltaSeconds,
                y: agent.velocity.y * deltaSeconds,
            },
            agent.velocity,
            agent.radius,
            this.colliders,
        );

        agent.position = result.position;
        agent.velocity = result.velocity;
    }

    private arrive(agent: Agent): void {
        this.arrivedCount++;
        this.spawner.respawn(agent, this.isSpawnFree);
    }

    private rebuildGrid(): void {
        this.grid.clear();

        for (const agent of this.agents) {
            this.grid.insert(agent.id, agent.position.x, agent.position.y);
        }
    }

    /** Ist an dieser Stelle Platz für einen neuen Agenten? */
    private readonly isSpawnFree = (
        x: number,
        y: number,
        radius: number,
    ): boolean => {
        if (pointClearance({x, y}, this.colliders) < radius) {
            return false;
        }

        this.grid.query(x, y, 2 * radius, this.neighborBuffer);

        return this.neighborBuffer.every((index) => {
            const other = this.agents[index];

            return (
                Math.hypot(other.position.x - x, other.position.y - y) >=
                radius + other.radius
            );
        });
    };
}
