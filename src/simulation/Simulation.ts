import type {Agent} from "./Agent.ts";
import {SpatialGrid} from "../spatial/SpatialGrid.ts";
import type {Vector2} from "./Vector2.ts";
import {calculateSeparation} from "./steering/calculateSeparation.ts";
import {AgentFactory} from "./AgentFactory.ts";
import type {SimulationConfig} from "./SimulationConfig.ts";
import type {Obstacle} from "./Obstacle.ts";
import {calculateObstacleAvoidance} from "./steering/calculateObstacleAvoidance.ts";

export class Simulation {

    private readonly separationRadius: number;
    private readonly separationStrength: number;
    private readonly maxAcceleration: number;
    private readonly obstacleLookAheadDistance: number;
    private readonly obstacleAvoidanceStrength: number;
    private readonly obstacleClearanceMargin: number;

    private readonly spatialGrid: SpatialGrid<Agent>;
    private readonly agentFactory: AgentFactory;

    readonly agents: Agent[];
    private readonly obstacles: readonly Obstacle[];

    constructor(
        worldWidth: number,
        worldHeight: number,
        agentCount: number,
        config: SimulationConfig,
        obstacles: readonly Obstacle[] = [],
    ) {

        this.separationRadius = config.separationRadius;
        this.separationStrength = config.separationStrength;
        this.maxAcceleration = config.maxAcceleration;
        this.obstacleLookAheadDistance = config.obstacleLookAheadDistance;
        this.obstacleAvoidanceStrength = config.obstacleAvoidanceStrength;
        this.obstacleClearanceMargin = config.obstacleClearanceMargin;

        this.spatialGrid = new SpatialGrid<Agent>(this.separationRadius);
        this.agentFactory = new AgentFactory(worldWidth, worldHeight);
        this.obstacles = obstacles;

        this.agents = Array.from(
            {length: agentCount},
            () => this.agentFactory.createAgent(),
        );

    }

    update(deltaSeconds: number): void {
        this.rebuildSpatialGrid();

        const updates = this.agents.map((agent) => {
            const candidates = this.spatialGrid.queryCandidates(
                agent.position.x,
                agent.position.y,
                this.separationRadius,
            );

            const separation = calculateSeparation(
                agent,
                candidates,
                this.separationRadius,
                this.separationStrength,
            );

            const obstacleAvoidance = calculateObstacleAvoidance(
                agent,
                this.obstacles,
                this.obstacleLookAheadDistance,
                this.obstacleAvoidanceStrength,
                this.obstacleClearanceMargin,
            );

            return {
                agent,
                steering: {
                    x: separation.x + obstacleAvoidance.x,
                    y: separation.y + obstacleAvoidance.y,
                },
            };
        });

        for (const {agent, steering} of updates) {
            this.updateAgent(agent, deltaSeconds, steering);
        }

    }


    private updateAgent(
        agent: Agent,
        deltaSeconds: number,
        steering: Vector2,
    ): void {
        const dx = agent.target.x - agent.position.x;
        const dy = agent.target.y - agent.position.y;
        const distance = Math.hypot(dx, dy);

        if (distance < agent.radius) {
            this.agentFactory.resetAgent(agent);
            return;
        }

        // Gewünschte Geschwindigkeit in Richtung des Ziels.
        const desiredVelocityX = (dx / distance) * agent.desiredSpeed;
        const desiredVelocityY = (dy / distance) * agent.desiredSpeed;

        let targetVelocityX = desiredVelocityX + steering.x;
        let targetVelocityY = desiredVelocityY + steering.y;

        // Maximale Zielgeschwindigkeit begrenzen.
        const targetSpeed = Math.hypot(targetVelocityX, targetVelocityY);
        const maxSpeed = agent.desiredSpeed * 1.5;

        if (targetSpeed > maxSpeed) {
            const scale = maxSpeed / targetSpeed;
            targetVelocityX *= scale;
            targetVelocityY *= scale;
        }

        // Differenz zwischen aktueller und gewünschter Geschwindigkeit.
        const deltaVX = targetVelocityX - agent.velocity.x;
        const deltaVY = targetVelocityY - agent.velocity.y;
        const velocityChange = Math.hypot(deltaVX, deltaVY);

        // Die Geschwindigkeit darf sich pro Frame nur begrenzt ändern.
        const maxVelocityChange = this.maxAcceleration * deltaSeconds;

        if (velocityChange > maxVelocityChange) {
            const scale = maxVelocityChange / velocityChange;

            agent.velocity.x += deltaVX * scale;
            agent.velocity.y += deltaVY * scale;
        } else {
            agent.velocity.x = targetVelocityX;
            agent.velocity.y = targetVelocityY;
        }

        // Mit der tatsächlich erreichten Geschwindigkeit bewegen.
        agent.position.x += agent.velocity.x * deltaSeconds;
        agent.position.y += agent.velocity.y * deltaSeconds;

        const remainingDistance = Math.hypot(
            agent.target.x - agent.position.x,
            agent.target.y - agent.position.y,
        );

        if (remainingDistance < agent.radius) {
            this.agentFactory.resetAgent(agent);
        }
    }

    private rebuildSpatialGrid(): void {
        this.spatialGrid.clear();

        for (const agent of this.agents) {
            this.spatialGrid.insert(
                agent,
                agent.position.x,
                agent.position.y,
            );
        }
    }

}