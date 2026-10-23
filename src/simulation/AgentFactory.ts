import type {Agent} from "./Agent.ts";

export class AgentFactory {
    private readonly worldWidth: number;
    private readonly worldHeight: number;
    private nextId = 0;

    constructor(worldWidth: number, worldHeight: number) {
        this.worldWidth = worldWidth;
        this.worldHeight = worldHeight;
    }

    createAgent(): Agent {
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


    resetAgent(agent: Agent): void {

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