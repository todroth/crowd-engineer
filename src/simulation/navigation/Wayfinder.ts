import type {Agent} from "../Agent.ts";
import type {Vector2} from "../Vector2.ts";
import type {Collider} from "../geometry/Collider.ts";
import type {Rect} from "../geometry/Rect.ts";
import {rectContains} from "../geometry/Rect.ts";
import {hasLineOfSight} from "../geometry/clearance.ts";
import {distanceBetween} from "../geometry/segments.ts";
import type {Random} from "../random.ts";
import type {WayfindingConfig} from "../SimulationConfig.ts";
import type {FlowField} from "./FlowField.ts";

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
export class Wayfinder {
    private readonly colliders: readonly Collider[];
    private readonly mainField: FlowField;
    /** Pro Weg ein Feld, das zu dessen Eingang führt. */
    private readonly routeFields: readonly FlowField[];
    private readonly entrances: readonly Rect[];
    private readonly entranceCenters: readonly Vector2[];
    /** Länge des Wegs vom Eingang bis ins Ziel. */
    private readonly remainingLength: readonly number[];
    private readonly goalCenter: Vector2;
    private readonly config: WayfindingConfig;
    private readonly random: Random;

    constructor(
        colliders: readonly Collider[],
        mainField: FlowField,
        routeFields: readonly FlowField[],
        entrances: readonly Rect[],
        goalArea: Rect,
        config: WayfindingConfig,
        random: Random,
    ) {
        this.colliders = colliders;
        this.mainField = mainField;
        this.routeFields = routeFields;
        this.entrances = entrances;
        this.config = config;
        this.random = random;

        this.entranceCenters = entrances.map((area) => ({
            x: area.x + area.width / 2,
            y: area.y + area.height / 2,
        }));
        this.remainingLength = this.entranceCenters.map((center) =>
            mainField.distanceAt(center.x, center.y),
        );
        this.goalCenter = {
            x: goalArea.x + goalArea.width / 2,
            y: goalArea.y + goalArea.height / 2,
        };
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

        if (this.entrances.some((area) => rectContains(area, agent.position))) {
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

    /** Meldet bewegliche Hindernisse an alle Felder, damit Wege daran vorbeiführen. */
    setObstructions(centers: readonly Vector2[], radius: number): void {
        this.mainField.setObstructions(centers, radius);

        for (const field of this.routeFields) {
            field.setObstructions(centers, radius);
        }
    }

    /** Schreibt die Laufrichtung (Einheitsvektor) des Agenten nach `out`. */
    direction(agent: Agent, out: Vector2): void {
        const field = agent.routeChoice >= 0 && !agent.committed
            ? this.routeFields[agent.routeChoice]
            : this.mainField;

        if (
            field.sampleDirection(agent.position.x, agent.position.y, out) ||
            this.mainField.sampleDirection(agent.position.x, agent.position.y, out)
        ) {
            return;
        }

        // Kein Feldwert (etwa vollständig von Hindernissen umgeben): geradeaus zum Ziel.
        const distance = distanceBetween(agent.position, this.goalCenter) || 1;

        out.x = (this.goalCenter.x - agent.position.x) / distance;
        out.y = (this.goalCenter.y - agent.position.y) / distance;
    }

    private chooseRoute(
        agent: Agent,
        perceive: (entrance: Vector2) => number,
    ): number {
        const {sightRange, congestionAversion, switchHysteresis, knowledgeError} =
            this.config;
        // Vorsicht 0,6 .. 1,4: wie stark dieser Mensch Staus scheut.
        const caution = 1 + 0.4 * personal(agent.id, 99);

        let best = -1;
        let bestCost = Infinity;

        for (let route = 0; route < this.entranceCenters.length; route++) {
            const entrance = this.entranceCenters[route];
            const straightDistance = distanceBetween(agent.position, entrance);

            // Nur Wege, deren Eingang er gerade sieht.
            if (
                straightDistance > sightRange ||
                !hasLineOfSight(agent.position, entrance, this.colliders)
            ) {
                continue;
            }

            const distance = this.routeFields[route].distanceAt(
                agent.position.x,
                agent.position.y,
            );

            const believedRemaining =
                this.remainingLength[route] *
                (1 + knowledgeError * personal(agent.id, route));
            const crowdPenalty =
                congestionAversion * caution * (1 - agent.panic) *
                perceive(entrance);
            const nervousness =
                1 + PANIC_NOISE * agent.panic * (2 * this.random() - 1);

            let cost =
                (distance + believedRemaining) * (1 + crowdPenalty) * nervousness;

            if (route === agent.routeChoice) {
                cost *= 1 - switchHysteresis * (1 - agent.panic);
            }

            if (cost < bestCost) {
                bestCost = cost;
                best = route;
            }
        }

        return best;
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
