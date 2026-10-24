import type {Agent} from "./Agent.ts";
import {AgentSpawner} from "./AgentSpawner.ts";
import type {Level} from "./Level.ts";
import type {Plan} from "./Plan.ts";
import type {RunStats} from "./RunStats.ts";
import type {Vector2} from "./Vector2.ts";
import {createRandom} from "./random.ts";
import {SpatialGrid} from "./spatial/SpatialGrid.ts";
import {type Collider, createColliders} from "./geometry/Collider.ts";
import {hasLineOfSight, pointClearance} from "./geometry/clearance.ts";
import {rectContains} from "./geometry/Rect.ts";
import {moveWithCollisions} from "./collision/moveWithCollisions.ts";
import {crowdSlowdown} from "./crowd/crowdSlowdown.ts";
import {densityWithWalls, personsPerSquareMeterFactor} from "./crowd/density.ts";
import {perceiveCrowd} from "./crowd/perceiveCrowd.ts";
import {mobility, updatePressure} from "./crowd/pressure.ts";
import {resolveAgentContacts} from "./crowd/resolveAgentContacts.ts";
import {createNeighborSample, sampleNeighbors} from "./crowd/sampleNeighbors.ts";
import {updateInjury} from "./crowd/updateInjury.ts";
import {updatePanic} from "./crowd/updatePanic.ts";
import type {FlowField} from "./navigation/FlowField.ts";
import type {Wayfinder} from "./navigation/Wayfinder.ts";
import {createWayfinder} from "./navigation/createWayfinder.ts";

/** Die Simulation läuft in festen Schritten, unabhängig von der Framerate. */
const FIXED_STEP = 1 / 60;
/** Obergrenze pro `update`, damit lange Frames keine Todesspirale auslösen. */
const MAX_STEPS_PER_UPDATE = 5;

/** Radius um Verletzte, in dem Wege gemieden werden (Pixel). */
const INJURED_AVOIDANCE_RADIUS = 12;
/** So oft werden die Hindernisse im Flow-Field nachgeführt, solange es Verletzte gibt (Sekunden). */
const OBSTRUCTION_REFRESH_INTERVAL = 3;

/** Steering darf die Wunschgeschwindigkeit höchstens so weit überschreiten. */
const MAX_SPEED_FACTOR = 1.5;
/** Runden des Kontakt-Solvers pro Schritt. */
const CONTACT_ITERATIONS = 3;

/**
 * Die Simulation eines Durchlaufs: ein Level, ein Plan, deterministisch (gleicher
 * Seed, gleiches Ergebnis). Kennt weder Phaser noch Darstellung und läuft daher
 * auch headless in den Skripten.
 *
 * Ein Schritt (`step`):
 *  1. Steering: Jeder laufende Agent misst seine Nachbarschaft (Dichte, Panik,
 *     Druck, Verletzung), wählt seinen Weg und berechnet eine neue Geschwindigkeit.
 *  2. Bewegung mit Gleiten an Hindernissen.
 *  3. Verletzte abtransportieren, Flow-Fields um Verletzte herumführen.
 *  4. Harte Kontakte zwischen Agenten auflösen.
 *  5. Ankunft prüfen, Ende prüfen.
 */
export class Simulation {
    readonly agents: Agent[];
    /** Anzahl der Agenten, die ihr Ziel erreicht haben. */
    arrivedCount = 0;
    /** Anzahl der Agenten, die sich verletzt haben (liegend oder abtransportiert). */
    injuredCount = 0;
    /** Vergangene Simulationszeit (Sekunden). */
    elapsed = 0;
    /** Durchlauf beendet (alle angekommen oder verletzt, oder Zeitlimit); nur ohne Respawn. */
    finished = false;

    private readonly level: Level;
    private readonly plan: Plan;
    private readonly colliders: readonly Collider[];
    private readonly grid: SpatialGrid;
    private readonly neighborRadius: number;
    private readonly spawner: AgentSpawner;
    private readonly wayfinder: Wayfinder;
    /** Umrechnung der Kernel-Dichte in Personen pro m² (siehe `crowd/density.ts`). */
    private readonly personsPerSquareMeter: number;

    private accumulator = 0;
    /** Liegende Verletzte, wie sie zuletzt in die Flow-Fields eingetragen wurden. */
    private obstructionCount = 0;
    private lastObstructionUpdate = 0;
    private peakDensity = 0;
    private crowdedSeconds = 0;

    // Wiederverwendete Puffer, damit pro Schritt nichts allokiert wird.
    private readonly neighborBuffer: number[] = [];
    private readonly perceptionBuffer: number[] = [];
    private readonly sample = createNeighborSample();
    private readonly direction: Vector2 = {x: 0, y: 0};
    private readonly nextVelocityX: Float64Array;
    private readonly nextVelocityY: Float64Array;

    constructor(level: Level, plan: Plan) {
        const {simulation: config} = level;

        this.level = level;
        this.plan = plan;
        this.personsPerSquareMeter = personsPerSquareMeterFactor(
            level.pixelsPerMeter,
            config.densityRadius,
        );
        this.colliders = createColliders(level.obstacles);
        this.neighborRadius = Math.max(config.separationRadius, config.densityRadius);
        this.grid = new SpatialGrid(
            level.worldWidth,
            level.worldHeight,
            this.neighborRadius,
            level.agentCount,
        );
        this.nextVelocityX = new Float64Array(level.agentCount);
        this.nextVelocityY = new Float64Array(level.agentCount);

        // Ein Zufallsgenerator für alles; die Reihenfolge der Ziehungen (erst
        // Agenten, dann Wegwahl) gehört zum Ergebnis eines Seeds.
        const random = createRandom(level.seed);

        this.spawner = new AgentSpawner(level.spawnArea, level.entryArea, level.walkingSpeed, random);
        this.agents = [];

        for (let i = 0; i < level.agentCount; i++) {
            const agent = this.spawner.createAgent(this.isSpawnFree);

            this.assignRelease(agent);
            this.agents.push(agent);
            this.grid.insert(agent.id, agent.position.x, agent.position.y);
        }

        this.wayfinder = createWayfinder(
            level,
            this.colliders,
            plan,
            Math.max(0, ...this.agents.map((agent) => agent.radius)),
            random,
        );
    }

    /** Hauptfeld (kürzester Weg zu den bekannten Ausgängen), etwa für die Debug-Anzeige. */
    get flowField(): FlowField {
        return this.wayfinder.mainField;
    }

    get stats(): RunStats {
        return {
            elapsed: this.elapsed,
            arrived: this.arrivedCount,
            total: this.agents.length,
            injured: this.injuredCount,
            crowdedSeconds: this.crowdedSeconds,
            peakDensity: this.peakDensity,
        };
    }

    /**
     * Richtung, in die ein Schild oder Ordner an `position` zeigen sollte: der
     * begehbare Weg zum Eingang der Route (und nicht die Luftlinie durch Wände).
     */
    routeDirection(route: number, position: Vector2, out: Vector2): boolean {
        return this.wayfinder.routeDirection(route, position, out);
    }

    /** Begehbare Entfernung von `position` zum Eingang von Weg `route` (`Infinity`, wenn unerreichbar). */
    routeDistance(route: number, position: Vector2): number {
        return this.wayfinder.routeDistance(route, position);
    }

    /** Liegt der Punkt in der Welt und frei von Hindernissen (mit Platz für einen Agenten)? */
    isWalkable(position: Vector2): boolean {
        const {worldWidth, worldHeight} = this.level;
        const radius = this.agents[0]?.radius ?? 0;

        return (
            position.x >= 0 && position.x <= worldWidth &&
            position.y >= 0 && position.y <= worldHeight &&
            pointClearance(position, this.colliders) >= radius
        );
    }

    /** Lässt die Simulation um `deltaSeconds` Echtzeit weiterlaufen (in festen Schritten). */
    update(deltaSeconds: number): void {
        if (this.finished) {
            return;
        }

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
        this.elapsed += deltaSeconds;
        this.rebuildGrid();

        // Erst alle neuen Geschwindigkeiten aus dem Zustand zu Schrittbeginn
        // berechnen, dann anwenden: Das Ergebnis hängt nicht von der
        // Reihenfolge der Agenten ab.
        for (const agent of this.agents) {
            if (this.isMoving(agent)) {
                this.steer(agent, deltaSeconds);
            }
        }

        for (const agent of this.agents) {
            // Angekommene sind weg, Verletzte bleiben liegen, Wartende stehen.
            if (!this.isMoving(agent)) {
                continue;
            }

            agent.velocity = {
                x: this.nextVelocityX[agent.id],
                y: this.nextVelocityY[agent.id],
            };
            this.move(agent, deltaSeconds);
        }

        this.rescueInjured(deltaSeconds);
        this.updateObstructions();

        this.rebuildGrid();
        resolveAgentContacts(
            this.agents,
            this.grid,
            this.colliders,
            CONTACT_ITERATIONS,
            this.level.simulation.injuredWeight,
        );

        for (const agent of this.agents) {
            // Verletzte, die von der Menge in den Ausgangsbereich geschoben werden,
            // zählen nicht als angekommen (sie sind schon als Verletzte gezählt).
            if (
                !agent.arrived &&
                !agent.injured &&
                this.level.goalAreas.some((goal) => rectContains(goal, agent.position))
            ) {
                this.arrive(agent);
            }
        }

        if (
            !this.level.respawn &&
            (this.arrivedCount + this.injuredCount >= this.agents.length ||
                this.elapsed >= this.level.timeLimit)
        ) {
            this.finished = true;
        }
    }

    /** Bestimmt, wann der Agent laut Plan loslaufen darf (nach seinem Block). */
    private assignRelease(agent: Agent): void {
        agent.sector = this.level.sectors.findIndex((sector) =>
            rectContains(sector, agent.position),
        );
        agent.releaseTime = this.plan.releaseDelays[agent.sector] ?? 0;
    }

    /** Läuft der Agent gerade selbst (nicht angekommen, nicht verletzt, freigegeben)? */
    private isMoving(agent: Agent): boolean {
        return !agent.arrived && !agent.injured && this.elapsed >= agent.releaseTime;
    }

    /** Berechnet die Geschwindigkeit des nächsten Schritts (in die Puffer). */
    private steer(agent: Agent, deltaSeconds: number): void {
        const config = this.level.simulation;
        const sample = this.sample;

        this.grid.query(agent.position.x, agent.position.y, this.neighborRadius, this.neighborBuffer);
        sampleNeighbors(agent, this.agents, this.neighborBuffer, config, sample);

        agent.localDensity = densityWithWalls(
            agent,
            sample.density,
            this.colliders,
            config.densityRadius,
            config.wallDensityFactor,
        );

        const personsPerSquareMeter = sample.density * this.personsPerSquareMeter;

        this.recordDensity(personsPerSquareMeter, deltaSeconds);

        if (
            updateInjury(
                agent,
                agent.localDensity * this.personsPerSquareMeter,
                config.injury,
                deltaSeconds,
            )
        ) {
            // Der Agent stürzt und bleibt als Hindernis liegen; er steuert nicht mehr.
            this.injuredCount++;
            agent.velocity = {x: 0, y: 0};
            return;
        }

        updatePanic(
            agent,
            sample.neighborPanic,
            config.panic,
            deltaSeconds,
            this.marshalCalming(agent),
            config.marshal.calmingRate,
        );

        this.wayfinder.update(agent, deltaSeconds, (entrance) =>
            perceiveCrowd(agent, entrance, this.agents, this.grid, this.perceptionBuffer),
        );
        this.wayfinder.direction(agent, this.direction);

        // Panik macht schneller und lässt weniger Abstand; dichte Menge bremst.
        const speed =
            agent.desiredSpeed *
            (1 + config.panic.speedBoost * agent.panic) *
            crowdSlowdown(personsPerSquareMeter, agent.panic, config.slowdown);
        const separation =
            config.separationStrength *
            (1 - config.panic.separationReduction * agent.panic);

        // Wunschgeschwindigkeit plus Einflüsse der Menge.
        let wantedX =
            this.direction.x * speed +
            sample.separationX * separation +
            sample.alignmentX * config.alignmentStrength;
        let wantedY =
            this.direction.y * speed +
            sample.separationY * separation +
            sample.alignmentY * config.alignmentStrength;

        updatePressure(agent, speed, this.direction, sample.neighborPressure, config.crush, deltaSeconds);

        const maxSpeed = speed * MAX_SPEED_FACTOR * mobility(agent.pressure, config.crush);
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

    /**
     * Beruhigung durch Ordner (0..1): der stärkste Einfluss aller Ordner, die der
     * Agent sieht. Sie ist beim Ordner am größten und nimmt bis zur Reichweite ab.
     */
    private marshalCalming(agent: Agent): number {
        const {range, calming} = this.level.simulation.marshal;
        let strongest = 0;

        for (const marshal of this.plan.marshals) {
            const distance = Math.hypot(
                agent.position.x - marshal.position.x,
                agent.position.y - marshal.position.y,
            );

            if (distance < range && hasLineOfSight(agent.position, marshal.position, this.colliders)) {
                strongest = Math.max(strongest, calming * (1 - distance / range));
            }
        }

        return strongest;
    }

    /** Hält Spitzendichte und Zeit im Gedränge für die Wertung fest. */
    private recordDensity(personsPerSquareMeter: number, deltaSeconds: number): void {
        this.peakDensity = Math.max(this.peakDensity, personsPerSquareMeter);

        if (personsPerSquareMeter > this.level.scoring.crowdingThreshold) {
            this.crowdedSeconds += deltaSeconds;
        }
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

    /** Verletzte, die lange genug lagen, werden abtransportiert. */
    private rescueInjured(deltaSeconds: number): void {
        for (const agent of this.agents) {
            if (!agent.injured || agent.arrived) {
                continue;
            }

            agent.injuredFor += deltaSeconds;

            if (agent.injuredFor >= this.level.simulation.rescueTime) {
                // Verlässt die Simulation, bleibt für die Anzeige aber liegen.
                agent.arrived = true;
                agent.rescued = true;
            }
        }
    }

    /**
     * Führt die Verletzten als Hindernisse im Flow-Field nach, wenn jemand
     * gestürzt ist (und gelegentlich, weil sie langsam weggeschoben werden).
     */
    private updateObstructions(): void {
        const isLying = (agent: Agent): boolean => agent.injured && !agent.arrived;
        let lyingCount = 0;

        for (const agent of this.agents) {
            lyingCount += isLying(agent) ? 1 : 0;
        }

        const changed = lyingCount !== this.obstructionCount;
        const stale =
            lyingCount > 0 &&
            this.elapsed - this.lastObstructionUpdate >= OBSTRUCTION_REFRESH_INTERVAL;

        if (!changed && !stale) {
            return;
        }

        this.wayfinder.setObstructions(
            this.agents.filter(isLying).map((agent) => agent.position),
            INJURED_AVOIDANCE_RADIUS,
        );
        this.obstructionCount = lyingCount;
        this.lastObstructionUpdate = this.elapsed;
    }

    private arrive(agent: Agent): void {
        this.arrivedCount++;

        if (this.level.respawn) {
            this.spawner.respawn(agent, this.isSpawnFree);
            return;
        }

        // Der Agent verlässt die Simulation.
        agent.arrived = true;
        agent.velocity = {x: 0, y: 0};
        agent.localDensity = 0;
    }

    private rebuildGrid(): void {
        this.grid.clear();

        for (const agent of this.agents) {
            if (!agent.arrived) {
                this.grid.insert(agent.id, agent.position.x, agent.position.y);
            }
        }
    }

    /** Ist an dieser Stelle Platz für einen neuen Agenten? */
    private readonly isSpawnFree = (x: number, y: number, radius: number): boolean => {
        if (pointClearance({x, y}, this.colliders) < radius) {
            return false;
        }

        this.grid.query(x, y, 2 * radius, this.neighborBuffer);

        return this.neighborBuffer.every((index) => {
            const other = this.agents[index];

            return Math.hypot(other.position.x - x, other.position.y - y) >= radius + other.radius;
        });
    };
}
