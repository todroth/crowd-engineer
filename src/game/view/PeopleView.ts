import type Phaser from "phaser";
import type {Agent} from "../../simulation/Agent.ts";
import {getDensityColor} from "./densityColor.ts";
import {FALLEN_TEXTURE, PERSON_TEXTURE, PERSON_TEXTURE_SCALE} from "./textures.ts";

/** Farbe des Gefährdungsrings (Deckkraft = Verletzungswert). */
const DANGER_RING_COLOR = 0x000000;
/** Ab diesem Verletzungswert wird der Gefährdungsring gezeichnet. */
const DANGER_RING_THRESHOLD = 0.05;

/** Abtransportierte Verletzte: blass graurot, damit man sie sieht, sie aber nicht auffallen. */
const RESCUED_COLOR = 0x7a5a5f;
const RESCUED_ALPHA = 0.45;

const DEPTH_RESCUED = 1;
const DEPTH_PEOPLE = 2;
const DEPTH_RINGS = 3;

/**
 * Ein Bild je Agent, eingefärbt nach Dichte (je dunkler, desto enger). Ein
 * schwarzer Ring zeigt die Gefährdung. Gestürzte sind schwarz mit weißem Ring,
 * Abtransportierte bleiben blass liegen, Angekommene verschwinden.
 */
export class PeopleView {
    private readonly images: Phaser.GameObjects.Image[];
    private readonly rings: Phaser.GameObjects.Graphics;

    constructor(scene: Phaser.Scene, agents: readonly Agent[]) {
        this.images = agents.map((agent) =>
            scene.add
                .image(agent.position.x, agent.position.y, PERSON_TEXTURE)
                .setScale((agent.radius * 2 + 1) / (agent.radius * 2 * PERSON_TEXTURE_SCALE + 2)),
        );
        this.rings = scene.add.graphics().setDepth(DEPTH_RINGS);
        this.update(agents);
    }

    update(agents: readonly Agent[]): void {
        this.rings.clear();

        for (const agent of agents) {
            const image = this.images[agent.id];

            if (agent.arrived && !agent.rescued) {
                image.setVisible(false);
                continue;
            }

            image.setVisible(true).setPosition(agent.position.x, agent.position.y);

            if (agent.rescued) {
                image
                    .setTexture(PERSON_TEXTURE)
                    .setTint(RESCUED_COLOR)
                    .setAlpha(RESCUED_ALPHA)
                    .setDepth(DEPTH_RESCUED);
            } else if (agent.injured) {
                image.setTexture(FALLEN_TEXTURE).clearTint().setAlpha(1).setDepth(DEPTH_PEOPLE);
            } else {
                image
                    .setTexture(PERSON_TEXTURE)
                    .setTint(getDensityColor(agent.localDensity))
                    .setAlpha(1)
                    .setDepth(DEPTH_PEOPLE);

                if (agent.injury > DANGER_RING_THRESHOLD) {
                    this.rings.lineStyle(1.5, DANGER_RING_COLOR, agent.injury);
                    this.rings.strokeCircle(agent.position.x, agent.position.y, agent.radius + 0.5);
                }
            }
        }
    }

    destroy(): void {
        this.images.forEach((image) => image.destroy());
        this.rings.destroy();
    }
}
