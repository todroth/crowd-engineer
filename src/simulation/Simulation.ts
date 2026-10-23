import type {Agent} from "./Agent.ts";
import {SpatialGrid} from "../spatial/SpatialGrid.ts";
import type {Vector2} from "./Vector2.ts";
import {calculateSeparation} from "./steering/calculateSeparation.ts";
import {AgentFactory} from "./AgentFactory.ts";
import type {SimulationConfig} from "./SimulationConfig.ts";

export class Simulation {

    private readonly separationRadius: number;
    private readonly separationStrength: number;
    private readonly maxAcceleration: number;

    private readonly spatialGrid: SpatialGrid<Agent>;
    private readonly agentFactory: AgentFactory;

    readonly agents: Agent[];

    constructor(
        worldWidth: number,
        worldHeight: number,
        agentCount: number,
        config: SimulationConfig,
    ) {

        this.separationRadius = config.separationRadius;
        this.separationStrength = config.separationStrength;
        this.maxAcceleration = config.maxAcceleration;

        this.spatialGrid = new SpatialGrid<Agent>(this.separationRadius);
        this.agentFactory = new AgentFactory(worldWidth, worldHeight);

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
                this.separationRadius
            );

            const separation = calculateSeparation(
                agent,
                candidates,
                this.separationRadius,
                this.separationStrength
            );

            return {agent, separation};
        });

        for (const {agent, separation} of updates) {
            this.updateAgent(agent, deltaSeconds, separation);
        }

    }


    private updateAgent(
        agent: Agent,
        deltaSeconds: number,
        separation: Vector2,
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

        // Separation verändert die gewünschte Bewegungsrichtung.
        let targetVelocityX = desiredVelocityX + separation.x;
        let targetVelocityY = desiredVelocityY + separation.y;

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