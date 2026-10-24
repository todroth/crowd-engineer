import type {Agent} from "./Agent.ts";
import type {Random} from "./random.ts";
import type {Rect} from "./geometry/Rect.ts";
import type {Vector2} from "./Vector2.ts";

const AGENT_RADIUS = 4;

/** Ist an (x, y) Platz für einen Agenten mit diesem Radius? */
export type SpawnCheck = (x: number, y: number, radius: number) => boolean;

/** Veränderlicher Zustand eines Agenten, wie er beim (Wieder-)Eintreten ist. */
function freshState(): Omit<Agent, "id" | "desiredSpeed" | "radius"> {
    return {
        position: {x: 0, y: 0},
        velocity: {x: 0, y: 0},
        localDensity: 0,
        arrived: false,
        injury: 0,
        injured: false,
        injuredFor: 0,
        rescued: false,
        sector: -1,
        releaseTime: 0,
        panic: 0,
        pressure: 0,
        routeChoice: -1,
        signMemory: [],
        committed: false,
        decisionTimer: 0,
    };
}

/** Erzeugt Agenten und platziert sie zufällig auf freien Plätzen. */
export class AgentSpawner {
    private readonly spawnArea: Rect;
    private readonly entryArea: Rect;
    private readonly speedRange: {readonly min: number; readonly max: number};
    private readonly random: Random;

    private nextId = 0;

    constructor(
        spawnArea: Rect,
        entryArea: Rect,
        speedRange: {readonly min: number; readonly max: number},
        random: Random,
    ) {
        this.spawnArea = spawnArea;
        this.entryArea = entryArea;
        this.speedRange = speedRange;
        this.random = random;
    }

    createAgent(isFree: SpawnCheck): Agent {
        const agent: Agent = {
            id: this.nextId++,
            desiredSpeed:
                this.speedRange.min +
                this.random() * (this.speedRange.max - this.speedRange.min),
            radius: AGENT_RADIUS,
            ...freshState(),
        };

        this.place(agent, this.spawnArea, isFree);

        return agent;
    }

    /** Lässt den Agenten wieder von außen in die Welt einlaufen. */
    respawn(agent: Agent, isFree: SpawnCheck): void {
        this.place(agent, this.entryArea, isFree);
    }

    /** Setzt den Agenten auf einen freien Platz im Bereich, mit frischem Zustand. */
    private place(agent: Agent, area: Rect, isFree: SpawnCheck): void {
        Object.assign(agent, freshState());
        agent.position = this.findFreePosition(area, agent.radius, isFree);
    }

    /**
     * Zufallspunkt im Bereich, der weder Hindernisse noch andere
     * Agenten berührt. Ist der Bereich voll, wird der letzte Versuch
     * genommen; der Kontakt-Solver schiebt die Agenten dann auseinander.
     */
    private findFreePosition(
        area: Rect,
        radius: number,
        isFree: SpawnCheck,
    ): Vector2 {
        const attempts = 30;
        let point = this.randomPointIn(area);

        for (let i = 0; i < attempts && !isFree(point.x, point.y, radius); i++) {
            point = this.randomPointIn(area);
        }

        return point;
    }

    private randomPointIn(area: Rect): Vector2 {
        return {
            x: area.x + this.random() * area.width,
            y: area.y + this.random() * area.height,
        };
    }
}
