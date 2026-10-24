import type {Agent} from "../Agent.ts";
import type {Vector2} from "../Vector2.ts";
import type {Collider} from "../geometry/Collider.ts";
import type {Rect} from "../geometry/Rect.ts";
import {rectContains} from "../geometry/Rect.ts";
import {hasLineOfSight} from "../geometry/clearance.ts";
import {distanceBetween} from "../geometry/segments.ts";
import type {Random} from "../random.ts";
import type {Marshal} from "../Marshal.ts";
import type {Sign} from "../Sign.ts";
import type {MarshalConfig, WayfindingConfig} from "../SimulationConfig.ts";
import type {FlowField} from "./FlowField.ts";

/** Wie weit (in Feldeinheiten) ein Agent näher am Ziel sein muss als der Eingang, um ihn als passiert zu zählen. */
const PASSED_ENTRANCE_MARGIN = 5;

/** Wie unsicher panische Agenten ihre Wahl treffen (±Anteil der Kosten). */
const PANIC_NOISE = 0.3;

/** Ein Weg, wie ihn der Wayfinder kennt: Eingang und die beiden Felder. */
export interface WayfinderRoute {
    readonly entrance: Rect;
    /** Feld, das zum Eingang führt. */
    readonly toEntrance: FlowField;
    /** Feld, dem man nach dem Eingang folgt: das Hauptfeld oder das zum eigenen Ausgang. */
    readonly afterEntrance: FlowField;
}

/**
 * Entscheidet, welchem Flow-Field ein Agent folgt. Bewegt wird immer über
 * Felder (glatt, ohne an Wänden hängenzubleiben); entschieden wird lokal:
 *
 *  - Standard ist das Hauptfeld (kürzester Weg zu den bekannten Ausgängen).
 *  - Ein anderer Weg kommt nur in Frage, wenn der Agent seinen Eingang sieht
 *    (freie Sichtlinie, begrenzte Reichweite) oder ein Schild kennt, das darauf
 *    zeigt (gesehene Schilder werden eine Weile gemerkt). Dann folgt er dem
 *    Feld zu diesem Eingang.
 *  - Mögliche Wege bewertet er nach Länge (mit eigenem Schätzfehler), nach dem
 *    Gedränge, das er davor sieht, und nach Schildern. Wer vorsichtig ist, meidet
 *    Staus eher; wer in Panik ist, blendet Staus und Schilder aus und
 *    entscheidet unsicher.
 *  - Sieht er gerade nichts Neues, bleibt er bei seinem Weg.
 *  - Hat er den Eingang durchquert, ist der Weg fest gewählt: Er folgt dann dem
 *    Feld nach dem Eingang (Hauptfeld oder Feld zum eigenen Ausgang des Weges).
 */
export class Wayfinder {
    /** Kürzester Weg zu den bekannten Ausgängen; Standard, solange kein anderer Weg gewählt ist. */
    readonly mainField: FlowField;

    private readonly colliders: readonly Collider[];
    private readonly routes: readonly WayfinderRoute[];
    private readonly entranceCenters: readonly Vector2[];
    /** Länge des Wegs vom Eingang bis zum Ausgang. */
    private readonly remainingLength: readonly number[];
    private readonly goalCenters: readonly Vector2[];
    private readonly signs: readonly Sign[];
    /** Ordner als Schilder mit voller Stärke: Sie werden wie diese gemerkt, nur mit eigener Reichweite. */
    private readonly marshalPosts: readonly Sign[];
    private readonly config: WayfindingConfig;
    private readonly marshalConfig: MarshalConfig;
    private readonly random: Random;

    constructor(
        colliders: readonly Collider[],
        mainField: FlowField,
        routes: readonly WayfinderRoute[],
        goalAreas: readonly Rect[],
        signs: readonly Sign[],
        marshals: readonly Marshal[],
        config: WayfindingConfig,
        marshalConfig: MarshalConfig,
        random: Random,
    ) {
        this.colliders = colliders;
        this.mainField = mainField;
        this.routes = routes;
        this.signs = signs;
        this.marshalPosts = marshals.map(({position, route}) => ({position, route, strength: 1}));
        this.config = config;
        this.marshalConfig = marshalConfig;
        this.random = random;

        this.entranceCenters = routes.map(({entrance}) => ({
            x: entrance.x + entrance.width / 2,
            y: entrance.y + entrance.height / 2,
        }));
        this.remainingLength = routes.map(({afterEntrance}, index) =>
            afterEntrance.distanceAt(this.entranceCenters[index].x, this.entranceCenters[index].y),
        );
        this.goalCenters = goalAreas.map((area) => ({
            x: area.x + area.width / 2,
            y: area.y + area.height / 2,
        }));
    }

    /**
     * Aktualisiert die Wahl des Agenten. `perceive(entrance)` liefert das
     * Gedränge, das er auf der Strecke zum Eingang sieht.
     */
    update(
        agent: Agent,
        deltaSeconds: number,
        perceive: (entrance: Vector2) => number,
    ): void {
        if (agent.committed) {
            return;
        }

        this.ageSignMemory(agent, deltaSeconds);

        const passed = this.passedRoute(agent);

        if (passed >= 0) {
            agent.routeChoice = passed;
            agent.committed = true;
            return;
        }

        agent.decisionTimer -= deltaSeconds;

        if (agent.decisionTimer > 0) {
            return;
        }

        // Leicht streuen, damit nicht alle im selben Takt überlegen.
        agent.decisionTimer = this.config.decisionInterval * (0.75 + 0.5 * this.random());
        agent.routeChoice = this.chooseRoute(agent, perceive);
    }

    /**
     * Welchen Weg hat der Agent betreten (-1: keinen)? Entweder liegt er im
     * Eingangsbereich, oder er ist dem Ausgang schon näher als der Eingang
     * des gewählten Weges, hat ihn also am Rand vorbei durchquert. Sonst liefe er
     * weiter dem Feld zum Eingang nach, der inzwischen hinter ihm liegt, und
     * würde zurückwollen.
     */
    private passedRoute(agent: Agent): number {
        const inside = this.routes.findIndex(({entrance}) =>
            rectContains(entrance, agent.position),
        );

        if (inside >= 0) {
            return inside;
        }

        const chosen = agent.routeChoice;

        if (
            chosen >= 0 &&
            this.routes[chosen].afterEntrance.distanceAt(agent.position.x, agent.position.y) <
            this.remainingLength[chosen] - PASSED_ENTRANCE_MARGIN
        ) {
            return chosen;
        }

        return -1;
    }

    /**
     * Laufrichtung (Einheitsvektor) an `position` auf dem Weg zum Eingang von `route`,
     * also dahin, wohin jemand liefe, der diesen Weg gewählt hat. `false`, wenn dort keine bekannt ist.
     */
    routeDirection(route: number, position: Vector2, out: Vector2): boolean {
        return this.routes[route].toEntrance.sampleDirection(position.x, position.y, out);
    }

    /** Begehbare Entfernung von `position` zum Eingang von `route` (`Infinity`, wenn unerreichbar). */
    routeDistance(route: number, position: Vector2): number {
        return this.routes[route].toEntrance.distanceAt(position.x, position.y);
    }

    /** Kann man von `position` aus einen Ausgang erreichen (über das Hauptfeld oder einen Weg)? */
    canReachGoal(position: Vector2): boolean {
        return (
            Number.isFinite(this.mainField.distanceAt(position.x, position.y)) ||
            this.routes.some(({toEntrance}) => Number.isFinite(toEntrance.distanceAt(position.x, position.y)))
        );
    }

    /** Meldet bewegliche Hindernisse an alle Felder, damit Wege daran vorbeiführen. */
    setObstructions(centers: readonly Vector2[], radius: number): void {
        const fields = new Set<FlowField>([this.mainField]);

        for (const route of this.routes) {
            fields.add(route.toEntrance);
            fields.add(route.afterEntrance);
        }

        for (const field of fields) {
            field.setObstructions(centers, radius);
        }
    }

    /** Schreibt die Laufrichtung (Einheitsvektor) des Agenten nach `out`. */
    direction(agent: Agent, out: Vector2): void {
        let field = this.mainField;

        if (agent.routeChoice >= 0) {
            const route = this.routes[agent.routeChoice];

            field = agent.committed ? route.afterEntrance : route.toEntrance;
        }

        if (
            field.sampleDirection(agent.position.x, agent.position.y, out) ||
            this.mainField.sampleDirection(agent.position.x, agent.position.y, out)
        ) {
            return;
        }

        // Kein Feldwert (etwa vollständig von Hindernissen umgeben): geradeaus zum nächsten Ziel.
        const goal = this.goalCenters.reduce((best, center) =>
            distanceBetween(agent.position, center) < distanceBetween(agent.position, best)
                ? center
                : best,
        );
        const distance = distanceBetween(agent.position, goal) || 1;

        out.x = (goal.x - agent.position.x) / distance;
        out.y = (goal.y - agent.position.y) / distance;
    }

    /** Lässt die Erinnerung an gesehene Schilder und Ordner verblassen. */
    private ageSignMemory(agent: Agent, deltaSeconds: number): void {
        for (const memory of [...agent.signMemory, ...agent.marshalMemory]) {
            memory.secondsLeft = Math.max(0, memory.secondsLeft - deltaSeconds);
        }
    }

    /**
     * Stärke des Hinweises (Schild oder Ordner) für `route`, den der Agent kennt:
     * der stärkste, den er gerade sieht, oder, falls er verdeckt ist, der gemerkte
     * (0, wenn keiner). Gesehene Hinweise werden gemerkt, sonst kippt die Wahl,
     * sobald ein Hindernis die Sicht darauf verdeckt.
     *
     * @param memories Gedächtnis des Agenten für diese Art von Hinweis (wird bei Bedarf angelegt)
     * @param range Bis zu dieser Entfernung wird ein Hinweis erkannt (Pixel)
     */
    private knownStrength(
        agent: Agent,
        route: number,
        posts: readonly Sign[],
        memories: Agent["signMemory"],
        range: number,
    ): number {
        while (memories.length < this.routes.length) {
            memories.push({strength: 0, secondsLeft: 0});
        }

        const memory = memories[route];

        for (const post of posts) {
            if (
                post.route === route &&
                post.strength > (memory.secondsLeft > 0 ? memory.strength : 0) &&
                distanceBetween(agent.position, post.position) <= range &&
                hasLineOfSight(agent.position, post.position, this.colliders)
            ) {
                memory.strength = post.strength;
                memory.secondsLeft = this.config.signMemory;
            }
        }

        return memory.secondsLeft > 0 ? memory.strength : 0;
    }

    private chooseRoute(
        agent: Agent,
        perceive: (entrance: Vector2) => number,
    ): number {
        const {sightRange, congestionAversion, switchHysteresis, knowledgeError, signInfluence} =
            this.config;
        // Vorsicht 0,6 .. 1,4: wie stark dieser Mensch Staus scheut.
        const caution = 1 + 0.4 * personal(agent.id, 99);

        let best = -1;
        let bestCost = Infinity;

        for (let route = 0; route < this.entranceCenters.length; route++) {
            const entrance = this.entranceCenters[route];
            // Ein Weg kommt in Frage, wenn der Agent seinen Eingang sieht oder
            // ein Schild kennt, das auf ihn zeigt.
            const entranceVisible =
                distanceBetween(agent.position, entrance) <= sightRange &&
                hasLineOfSight(agent.position, entrance, this.colliders);
            const signStrength = this.knownStrength(
                agent, route, this.signs, agent.signMemory, this.config.signRange,
            );
            const marshalStrength = this.knownStrength(
                agent, route, this.marshalPosts, agent.marshalMemory, this.marshalConfig.range,
            );

            if (!entranceVisible && signStrength === 0 && marshalStrength === 0) {
                continue;
            }

            const distance = this.routes[route].toEntrance.distanceAt(
                agent.position.x,
                agent.position.y,
            );

            if (!Number.isFinite(distance)) {
                continue;
            }

            const believedRemaining =
                this.remainingLength[route] *
                (1 + knowledgeError * personal(agent.id, route));
            // Gedränge vor dem Eingang sieht man nur, wenn man ihn sieht.
            const crowdPenalty = entranceVisible
                ? congestionAversion * caution * (1 - agent.panic) * perceive(entrance)
                : 0;
            // Ein Schild macht den Weg attraktiver; Panik lässt es untergehen. Einen Ordner hört man auch in Panik.
            const signBonus =
                signInfluence * signStrength * (1 - agent.panic) +
                this.marshalConfig.guidance * marshalStrength;
            const nervousness =
                1 + PANIC_NOISE * agent.panic * (2 * this.random() - 1);

            let cost =
                (distance + believedRemaining) * (1 + crowdPenalty) * nervousness *
                (1 - signBonus);

            if (route === agent.routeChoice) {
                cost *= 1 - switchHysteresis * (1 - agent.panic);
            }

            if (cost < bestCost) {
                bestCost = cost;
                best = route;
            }
        }

        // Sieht der Agent gerade nichts Neues, bleibt er bei seinem Weg, statt
        // zurückzufallen (sonst kippt die Wahl, sobald etwas die Sicht verdeckt).
        return best >= 0 ? best : agent.routeChoice;
    }
}

/**
 * Feste, pseudozufällige Eigenschaft einer Person in [-1, 1] (je Agent und
 * Merkmal), damit jeder dauerhaft anders ist, ohne Zustand zu speichern.
 */
function personal(agentId: number, trait: number): number {
    const value = Math.sin(agentId * 12.9898 + trait * 78.233) * 43758.5453;

    return 2 * (value - Math.floor(value)) - 1;
}
