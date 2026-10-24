import type Phaser from "phaser";
import type {Agent} from "../../simulation/Agent.ts";
import {getDensityColor} from "./densityColor.ts";

/** Farbe für Verletzte (Füllung) und den Gefährdungsring; Verletzte haben zusätzlich einen weißen Ring. */
const INJURED_COLOR = 0x000000;
/** Ab diesem Verletzungswert wird der Gefährdungsring gezeichnet. */
const INJURY_RING_THRESHOLD = 0.05;

/** Abtransportierte Verletzte: blass graurot, damit man sie sieht, sie aber nicht auffallen. */
const RESCUED_COLOR = 0x7a5a5f;
const RESCUED_ALPHA = 0.45;

/**
 * Ein Kreis je Agent. Farbe nach Dichte (je dunkler, desto enger), ein
 * schwarzer Ring zeigt die Gefährdung (Deckkraft = Verletzungswert).
 * Verletzte sind schwarz mit weißem Ring, Abtransportierte bleiben blass liegen,
 * Angekommene verschwinden.
 */
export class PeopleView {
    private readonly circles: Phaser.GameObjects.Arc[];

    constructor(scene: Phaser.Scene, agents: readonly Agent[]) {
        this.circles = agents.map((agent) =>
            scene.add.circle(
                agent.position.x,
                agent.position.y,
                agent.radius,
                getDensityColor(agent.localDensity),
            ),
        );
    }

    update(agents: readonly Agent[]): void {
        for (const agent of agents) {
            const circle = this.circles[agent.id];

            if (agent.rescued) {
                // Liegt fest: nur einmal umfärben und nach hinten legen.
                if (circle.depth !== -1) {
                    circle
                        .setPosition(agent.position.x, agent.position.y)
                        .setFillStyle(RESCUED_COLOR, RESCUED_ALPHA)
                        .setStrokeStyle()
                        .setDepth(-1);
                }
                continue;
            }

            if (agent.arrived) {
                circle.setVisible(false);
                continue;
            }

            circle
                .setVisible(true)
                .setPosition(agent.position.x, agent.position.y)
                .setFillStyle(agent.injured ? INJURED_COLOR : getDensityColor(agent.localDensity));
            updateInjuryRing(circle, agent);
        }
    }
}

function updateInjuryRing(circle: Phaser.GameObjects.Arc, agent: Agent): void {
    if (agent.injured) {
        circle.setStrokeStyle(2, 0xffffff, 1);
    } else if (agent.injury > INJURY_RING_THRESHOLD) {
        circle.setStrokeStyle(1, INJURED_COLOR, agent.injury);
    } else if (circle.isStroked) {
        circle.setStrokeStyle();
    }
}
