import type {Agent} from "./Agent.ts";
import {SpatialGrid} from "../spatial/SpatialGrid.ts";
import type {Vector2} from "./Vector2.ts";
import {calculateSeparation} from "./steering/calculateSeparation.ts";
import {AgentFactory} from "./AgentFactory.ts";
import type {SimulationConfig} from "./SimulationConfig.ts";

export class Simulation {

    private readonly separationRadius: number;
    private readonly separationStrength: number;

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

    private updateAgent(agent: Agent, deltaSeconds: number, separation: Vector2): void {

        const dx = agent.target.x - agent.position.x;
        const dy = agent.target.y - agent.position.y;
        const distance = Math.hypot(dx, dy);

        if (distance < agent.radius) {
            this.agentFactory.resetAgent(agent);
            return;
        }

        const desiredVelocityX = (dx / distance) * agent.desiredSpeed;
        const desiredVelocityY = (dy / distance) * agent.desiredSpeed;

        let vx = desiredVelocityX + separation.x;
        let vy = desiredVelocityY + separation.y;

        const speed = Math.hypot(vx, vy);
        const maxSpeed = agent.desiredSpeed * 1.5;

        if (speed > maxSpeed) {
            const scale = maxSpeed / speed;
            vx *= scale;
            vy *= scale;
        }

        agent.velocity.x = vx;
        agent.velocity.y = vy;

        agent.position.x += vx * deltaSeconds;
        agent.position.y += vy * deltaSeconds;

        const remainingDistance = Math.hypot(
            agent.target.x - agent.position.x,
            agent.target.y - agent.position.y
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