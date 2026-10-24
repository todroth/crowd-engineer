import type Phaser from "phaser";

/** Personen werden in doppelter Auflösung gezeichnet und halb so groß dargestellt: wirkt weicher. */
export const PERSON_TEXTURE_SCALE = 2;
export const PERSON_TEXTURE = "person";
export const FALLEN_TEXTURE = "person-fallen";

/**
 * Erzeugt die Texturen für Personen (einmal pro Spiel). Die Person ist weiß mit
 * etwas dunklerem Rand, damit die Farbe (Tint) plastisch wirkt; Gestürzte
 * sind schwarz mit weißem Ring und werden nicht eingefärbt.
 */
export function createPersonTextures(scene: Phaser.Scene, radius: number): void {
    if (scene.textures.exists(PERSON_TEXTURE)) {
        return;
    }

    const r = radius * PERSON_TEXTURE_SCALE;
    const size = 2 * r + 2;
    const g = scene.make.graphics({}, false);

    g.fillStyle(0xb8b8b8, 1);
    g.fillCircle(size / 2, size / 2, r);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(size / 2 - r * 0.15, size / 2 - r * 0.15, r * 0.78);
    g.generateTexture(PERSON_TEXTURE, size, size);

    g.clear();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(size / 2, size / 2, r);
    g.fillStyle(0x000000, 1);
    g.fillCircle(size / 2, size / 2, r - 2 * PERSON_TEXTURE_SCALE);
    g.generateTexture(FALLEN_TEXTURE, size, size);

    g.destroy();
}
