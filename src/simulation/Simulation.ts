import type {Agent} from "./Agent.ts";
import {AgentSpawner} from "./AgentSpawner.ts";
import type {Level} from "./Level.ts";
import type {Plan} from "./Plan.ts";
import type {Sign} from "./Sign.ts";
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
import {updateInjury} from "./crowd/updateInjury.ts";
import {updatePanic} from "./crowd/updatePanic.ts";
import type {Vector2} from "./Vector2.ts";

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
/** Selbst im dichtesten Gedränge bleibt etwas Tempo (Anteil), damit niemand ganz festfriert. */
const MIN_SLOWDOWN_FACTOR = 0.05;
/** Bezugstempo (Pixel/s), mit dem blockierter Schub in Druck umgerechnet wird. */
const NORMAL_SPEED = 50;
const CONTACT_ITERATIONS = 3;

/** Kennzahlen eines Durchlaufs. */
export interface RunStats {
    /** Vergangene Zeit in Sekunden; nach dem Ende die Dauer des Durchlaufs. */
    readonly elapsed: number;
    readonly arrived: number;
    readonly total: number;
    /** Zahl der Agenten, die verletzt am Boden liegen. */
    readonly injured: number;
    /** Personensekunden über der Gedränge-Schwelle (`ScoringConfig.crowdingThreshold`). */
    readonly crowdedSeconds: number;
    /** Höchste Personendichte, die ein Agent erlebt hat (Personen pro m²). */
    readonly peakDensity: number;
}

export class Simulation {
    readonly agents: Agent[];
    /** Anzahl der Agenten, die ihr Ziel erreicht haben. */
    arrivedCount = 0;
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
    /** Laufrichtungen zum Zielbereich. */
    readonly flowField: FlowField;
    private readonly wayfinder: Wayfinder;

    private accumulator = 0;
    private obstructedInjuredCount = 0;
    private lastObstructionUpdate = 0;
    private peakDensity = 0;
    private crowdedSeconds = 0;
    /**
     * Umrechnung der Kernel-Dichte (`sampleNeighbors`) in Personen pro m²: Der
     * Kegelkern 1 - d/R hat das Integral πR²/3, daher Anzahl ≈ Dichte · πR²/3.
     */
    private readonly personsPerSquareMeter: number;

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
        this.personsPerSquareMeter =
            (3 * level.pixelsPerMeter ** 2) /
            (Math.PI * config.densityRadius ** 2);
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

        this.spawner = new AgentSpawner(
            level.spawnArea,
            level.entryArea,
            level.walkingSpeed,
            random,
        );

        this.nextVelocityX = new Float64Array(level.agentCount);
        this.nextVelocityY = new Float64Array(level.agentCount);

        this.agents = [];

        for (let i = 0; i < level.agentCount; i++) {
            const agent = this.spawner.createAgent(this.isSpawnFree);

            this.assignRelease(agent);
            this.agents.push(agent);
            this.grid.insert(agent.id, agent.position.x, agent.position.y);
        }

        const fieldOptions = {
            cellSize: config.flowCellSize,
            agentRadius: Math.max(0, ...this.agents.map((a) => a.radius)),
            wallAvoidanceDistance: config.wallAvoidanceDistance,
        };

        // Ausgänge, die nur über einen bestimmten Weg bekannt sind, fehlen im Hauptfeld.
        const knownGoals = level.goalAreas.filter(
            (_, index) => !level.routes.some((route) => route.exit === index),
        );

        this.flowField = new FlowField(
            this.colliders,
            this.fieldBounds(),
            knownGoals,
            fieldOptions,
        );

        const bounds = this.fieldBounds();

        this.wayfinder = new Wayfinder(
            this.colliders,
            this.flowField,
            level.routes.map(({entrance, exit}) => ({
                entrance,
                toEntrance: new FlowField(this.colliders, bounds, [entrance], fieldOptions),
                afterEntrance:
                    exit === undefined
                        ? this.flowField
                        : new FlowField(this.colliders, bounds, [level.goalAreas[exit]], fieldOptions),
            })),
            level.goalAreas,
            plan.signs,
            config.wayfinding,
            random,
        );
    }

    /**
     * Richtung, in die ein Schild zeigen sollte: der begehbare Weg zum Eingang
     * seiner Route (und nicht die Luftlinie durch Wände).
     */
    signDirection(sign: Sign, out: Vector2): boolean {
        return this.wayfinder.routeDirection(sign.route, sign.position, out);
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
        const changed = this.injuredCount !== this.obstructedInjuredCount;
        const stale =
            this.injuredCount > 0 &&
            this.elapsed - this.lastObstructionUpdate >= OBSTRUCTION_REFRESH_INTERVAL;

        if (!changed && !stale) {
            return;
        }

        this.wayfinder.setObstructions(
            this.agents
                .filter((agent) => agent.injured && !agent.arrived)
                .map((agent) => agent.position),
            INJURED_AVOIDANCE_RADIUS,
        );
        this.obstructedInjuredCount = this.injuredCount;
        this.lastObstructionUpdate = this.elapsed;
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
        if (
            updateInjury(
                agent,
                agent.localDensity * this.personsPerSquareMeter,
                config.injury,
                deltaSeconds,
            )
        ) {
            // Der Agent stürzt und bleibt als Hindernis liegen.
            this.injuredCount++;
            agent.velocity = {x: 0, y: 0};
        }

        const personsPerSquareMeter = this.sample.density * this.personsPerSquareMeter;

        this.peakDensity = Math.max(this.peakDensity, personsPerSquareMeter);

        if (personsPerSquareMeter > this.level.scoring.crowdingThreshold) {
            this.crowdedSeconds += deltaSeconds;
        }

        updatePanic(agent, this.sample.neighborPanic, config.panic, deltaSeconds);

        this.wayfinder.update(agent, deltaSeconds, (entrance) =>
            perceiveCrowd(agent, entrance, this.agents, this.grid, this.perceptionBuffer),
        );
        this.wayfinder.direction(agent, this.direction);

        // Panik macht schneller und lässt weniger Abstand; dichte Menge bremst.
        const speed =
            agent.desiredSpeed *
            (1 + config.panic.speedBoost * agent.panic) *
            this.crowdSlowdown(agent, personsPerSquareMeter);
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

        this.updatePressure(agent, speed, deltaSeconds);

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

    /**
     * Tempofaktor durch die Dichte (Weidmann): v/v0 = 1 - exp(-γ (1/ρ - 1/ρmax)).
     * Wirkt voll auf ruhige Agenten und schwächt sich mit der Panik ab.
     */
    private crowdSlowdown(agent: Agent, personsPerSquareMeter: number): number {
        const {strength, jamDensity, steepness} = this.level.simulation.slowdown;

        if (strength === 0 || personsPerSquareMeter <= 0.01) {
            return 1;
        }

        const factor = Math.min(
            1,
            Math.max(
                MIN_SLOWDOWN_FACTOR,
                1 - Math.exp(-steepness * (1 / personsPerSquareMeter - 1 / jamDensity)),
            ),
        );

        return 1 - strength * (1 - factor) * (1 - agent.panic);
    }

    /** Beweglichkeit (minimumMobility..1): sinkt unter Druck, siehe `CrushConfig`. */
    private mobility(agent: Agent): number {
        const {onsetPressure, fullPressure, minimumMobility} = this.level.simulation.crush;
        const crush = Math.min(
            1,
            Math.max(0, (agent.pressure - onsetPressure) / (fullPressure - onsetPressure)),
        );

        return 1 - crush * (1 - minimumMobility);
    }

    /**
     * Druck = blockierter Schub: Wunschtempo abzüglich des tatsächlichen
     * Fortschritts in Wunschrichtung (bezogen auf ein Normaltempo), dazu
     * ein Anteil vom Druck der Nachbarn. Ein Agent, der mit mehr Schub
     * (Panik) gegen dieselbe Blockade drückt, erzeugt mehr Druck.
     */
    private updatePressure(agent: Agent, speed: number, deltaSeconds: number): void {
        const {crush} = this.level.simulation;
        const progress =
            agent.velocity.x * this.direction.x + agent.velocity.y * this.direction.y;
        const blockedPush = Math.max(0, speed - progress) / NORMAL_SPEED;
        const target = blockedPush + crush.transmission * this.sample.neighborPressure;

        agent.pressure += (target - agent.pressure) * Math.min(1, crush.responseRate * deltaSeconds);
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
        const {worldWidth, worldHeight, entryArea, goalAreas} = this.level;
        const areas = [entryArea, ...goalAreas];
        const left = Math.min(0, ...areas.map((area) => area.x));
        const top = Math.min(0, ...areas.map((area) => area.y));
        const right = Math.max(worldWidth, ...areas.map((area) => area.x + area.width));
        const bottom = Math.max(worldHeight, ...areas.map((area) => area.y + area.height));

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
