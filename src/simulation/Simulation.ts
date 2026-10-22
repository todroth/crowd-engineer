import type {Agent, Vector2} from "./Agent.ts";

export class Simulation {

    private readonly worldWidth: number;
    private readonly worldHeight: number;

    private readonly separationRadius = 25;
    private readonly separationStrength = 50;

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

        const updates = this.agents.map((agent) => ({
            agent,
            separation: this.calculateSeparation(agent)
        }));

        for (const {agent, separation} of updates) {
            this.updateAgent(agent, deltaSeconds, separation);
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

    private updateAgent(agent: Agent, deltaSeconds: number, separation: Vector2): void {

        const dx = agent.target.x - agent.position.x;
        const dy = agent.target.y - agent.position.y;
        const distance = Math.hypot(dx, dy);

        if (distance < agent.radius) {
            this.resetAgent(agent);
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

    private calculateSeparation(agent: Agent): Vector2 {
        let separationX = 0;
        let separationY = 0;

        for (const other of this.agents) {
            if (other.id === agent.id) {
                continue;
            }

            const dx = agent.position.x - other.position.x;
            const dy = agent.position.y - other.position.y;
            const distance = Math.hypot(dx, dy);

            if (distance === 0 || distance >= this.separationRadius) {
                continue;
            }

            const weight = (this.separationRadius - distance) / this.separationRadius;

            separationX += (dx / distance) * weight;
            separationY += (dy / distance) * weight;

        }

        return {
            x: separationX * this.separationStrength,
            y: separationY * this.separationStrength
        }

    }

}