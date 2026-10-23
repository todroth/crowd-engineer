import type {Agent} from "./Agent.ts";
import type {Random} from "./random.ts";
import type {Rect} from "./geometry/Rect.ts";

const SPEED_RANGE = {min: 40, max: 60};
const AGENT_RADIUS = 4;

/** Erzeugt Agenten und wählt Startpunkt und Ziel zufällig aus den Bereichen. */
export class AgentSpawner {
    private readonly spawnArea: Rect;
    private readonly entryArea: Rect;
    private readonly goalArea: Rect;
    private readonly random: Random;

    private nextId = 0;

    constructor(spawnArea: Rect, entryArea: Rect, goalArea: Rect, random: Random) {
        this.spawnArea = spawnArea;
        this.entryArea = entryArea;
        this.goalArea = goalArea;
        this.random = random;
    }

    createAgent(isFree: (x: number, y: number, radius: number) => boolean): Agent {
        const agent: Agent = {
            id: this.nextId++,
            position: {x: 0, y: 0},
            velocity: {x: 0, y: 0},
            desiredSpeed:
                SPEED_RANGE.min +
                this.random() * (SPEED_RANGE.max - SPEED_RANGE.min),
            radius: AGENT_RADIUS,
            goal: {x: 0, y: 0},
            route: [],
            routeIndex: 0,
            replanCooldown: 0,
            localDensity: 0,
        };

        this.place(agent, this.spawnArea, isFree);

        return agent;
    }

    /** Lässt den Agenten wieder von außen in die Welt einlaufen, mit neuem Ziel. */
    respawn(
        agent: Agent,
        isFree: (x: number, y: number, radius: number) => boolean,
    ): void {
        this.place(agent, this.entryArea, isFree);
    }

    private place(
        agent: Agent,
        area: Rect,
        isFree: (x: number, y: number, radius: number) => boolean,
    ): void {
        agent.position = this.findFreePosition(area, agent.radius, isFree);
        agent.velocity = {x: 0, y: 0};
        agent.goal = this.randomPointIn(this.goalArea);
        agent.route = [];
        agent.routeIndex = 0;
        agent.localDensity = 0;
    }

    /**
     * Zufallspunkt im Bereich, der weder Hindernisse noch andere
     * Agenten berührt. Ist der Bereich voll, wird der letzte Versuch
     * genommen; der Kontakt-Solver schiebt die Agenten dann auseinander.
     */
    private findFreePosition(
        area: Rect,
        radius: number,
        isFree: (x: number, y: number, radius: number) => boolean,
    ) {
        const attempts = 30;
        let point = this.randomPointIn(area);

        for (let i = 0; i < attempts && !isFree(point.x, point.y, radius); i++) {
            point = this.randomPointIn(area);
        }

        return point;
    }

    private randomPointIn(area: Rect) {
        return {
            x: area.x + this.random() * area.width,
            y: area.y + this.random() * area.height,
        };
    }
}
