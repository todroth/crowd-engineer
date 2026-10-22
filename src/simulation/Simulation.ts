import type {Agent} from "./Agent.ts";

export class Simulation {

    private readonly worldWidth: number;
    private readonly worldHeight: number;

    readonly agents: Agent[];

    private nextId = 0;

    constructor(
        worldWidth: number,
        worldHeight: number,
        agentCount = 100
    ) {

        this.worldWidth = worldWidth;
        this.worldHeight = worldHeight;

        this.agents = Array.from(
            {length: agentCount},
            () => this.createAgent(),
        );

    }

    update(deltaSeconds: number): void {

        for (const agent of this.agents) {
            this.updateAgent(agent, deltaSeconds);
        }

    }

    private createAgent(): Agent {
        return {
            id: this.nextId++,

            position: {
                x: 20 + Math.random() * 200,
                y: this.randomY(),
            },

            velocity: {
                x: 0,
                y: 0,
            },

            target: {
                x: this.worldWidth + 20,
                y: this.randomY(),
            },

            desiredSpeed: 40 + Math.random() * 20,
            radius: 4

        };
    }

    private updateAgent(agent: Agent, deltaSeconds: number): void {

        const dx = agent.target.x - agent.position.x;
        const dy = agent.target.y - agent.position.y;
        const distance = Math.hypot(dx, dy);

        if (distance < 1) {
            this.resetAgent(agent);
            return;
        }

        const distanceToTravel = Math.min(
            agent.desiredSpeed * deltaSeconds,
            distance
        );

        const directionX = dx / distance;
        const directionY = dy / distance;

        agent.velocity.x = directionX * agent.desiredSpeed;
        agent.velocity.y = directionY * agent.desiredSpeed;

        agent.position.x += directionX * distanceToTravel;
        agent.position.y += directionY * distanceToTravel;

        if (distanceToTravel >= distance) {
            this.resetAgent(agent);
        }

    }

    private resetAgent(agent: Agent): void {

        agent.position = {
            x: -5,
            y: this.randomY()
        }

        agent.velocity = {
            x: 0,
            y: 0
        }

        agent.target = {
            x: this.worldWidth + 20,
            y: this.randomY()
        }

    }

    private randomY(): number {
        return 60 + Math.random() * (this.worldHeight - 120)
    }

}