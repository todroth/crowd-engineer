import type {Agent} from "../Agent.ts";
import type {Vector2} from "../Vector2.ts";
import type {Collider} from "../geometry/Collider.ts";
import type {Rect} from "../geometry/Rect.ts";
import {rectContains} from "../geometry/Rect.ts";
import {hasLineOfSight} from "../geometry/clearance.ts";
import {distanceBetween} from "../geometry/segments.ts";
import type {Random} from "../random.ts";
import type {Sign} from "../Sign.ts";
import type {WayfindingConfig} from "../SimulationConfig.ts";
import type {FlowField} from "./FlowField.ts";

/** Wie weit (in Feldeinheiten) ein Agent näher am Ziel sein muss als der Eingang, um ihn als passiert zu zählen. */
const PASSED_ENTRANCE_MARGIN = 5;

/** Wie unsicher panische Agenten ihre Wahl treffen (±Anteil der Kosten). */
const PANIC_NOISE = 0.3;

/**
 * Entscheidet, welchem Flow-Field ein Agent folgt. Bewegt wird immer über
 * Felder (glatt, ohne an Wänden hängenzubleiben); entschieden wird lokal:
 *
 *  - Standard ist das Hauptfeld (kürzester Weg zum Ziel).
 *  - Ein anderer Weg kommt nur in Frage, solange der Agent seinen Eingang
 *    sehen kann (freie Sichtlinie, begrenzte Reichweite). Dann folgt er dem
 *    Feld dieses Weges.
 *  - Sichtbare Wege bewertet er nach Länge (mit eigenem Schätzfehler) und nach
 *    dem Gedränge, das er davor sieht. Wer Vorsicht walten lässt, meidet Staus
 *    eher, wer in Panik ist, blendet sie aus und entscheidet unsicher.
 *  - Hat er den Eingang eines Weges durchquert, folgt er wieder dem Hauptfeld.
 */
export interface WayfinderRoute {
    readonly entrance: Rect;
    /** Feld, das zum Eingang führt. */
    readonly toEntrance: FlowField;
    /** Feld, dem man nach dem Eingang folgt: das Hauptfeld oder das zum eigenen Ausgang. */
    readonly afterEntrance: FlowField;
}

export class Wayfinder {
    private readonly colliders: readonly Collider[];
    private readonly mainField: FlowField;
    private readonly routes: readonly WayfinderRoute[];
    private readonly entranceCenters: readonly Vector2[];
    /** Länge des Wegs vom Eingang bis zum Ausgang. */
    private readonly remainingLength: readonly number[];
    private readonly goalCenters: readonly Vector2[];
    private readonly signs: readonly Sign[];
    private readonly config: WayfindingConfig;
    private readonly random: Random;

    constructor(
        colliders: readonly Collider[],
        mainField: FlowField,
        routes: readonly WayfinderRoute[],
        goalAreas: readonly Rect[],
        signs: readonly Sign[],
        config: WayfindingConfig,
        random: Random,
    ) {
        this.colliders = colliders;
        this.mainField = mainField;
        this.routes = routes;
        this.signs = signs;
        this.config = config;
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

    /** Lässt die Erinnerung an gesehene Schilder verblassen. */
    private ageSignMemory(agent: Agent, deltaSeconds: number): void {
        for (const memory of agent.signMemory) {
            memory.secondsLeft = Math.max(0, memory.secondsLeft - deltaSeconds);
        }
    }

    /**
     * Stärke des Schildes für `route`, das der Agent kennt: das stärkste, das er
     * gerade sieht, oder, falls es verdeckt ist, das gemerkte (0, wenn keines).
     * Gesehene Schilder werden gemerkt, sonst kippt die Wahl, sobald ein Hindernis
     * die Sicht auf das Schild verdeckt.
     */
    private knownSignStrength(agent: Agent, route: number): number {
        while (agent.signMemory.length < this.routes.length) {
            agent.signMemory.push({strength: 0, secondsLeft: 0});
        }

        const memory = agent.signMemory[route];

        for (const sign of this.signs) {
            if (
                sign.route === route &&
                sign.strength > (memory.secondsLeft > 0 ? memory.strength : 0) &&
                distanceBetween(agent.position, sign.position) <= this.config.signRange &&
                hasLineOfSight(agent.position, sign.position, this.colliders)
            ) {
                memory.strength = sign.strength;
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
            const signStrength = this.knownSignStrength(agent, route);

            if (!entranceVisible && signStrength === 0) {
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
            // Ein Schild macht den Weg attraktiver; Panik lässt es untergehen.
            const signBonus = signInfluence * signStrength * (1 - agent.panic);
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
