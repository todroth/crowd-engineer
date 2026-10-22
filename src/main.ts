import Phaser from "phaser";
import "./style.css";

class CrowdScene extends Phaser.Scene {
    private people: Phaser.GameObjects.Arc[] = [];
    static readonly width = 1000;
    static readonly height = 700;

    constructor() {
        super("CrowdScene");
    }

    create(): void {

        // Raster zeichnen
        const grid = this.add.graphics();
        grid.lineStyle(1, 0x293548, 1);

        for (let x = 0; x <= CrowdScene.width; x += 40) {
            grid.lineBetween(x, 0, x, CrowdScene.height);
        }

        for (let y = 0; y <= CrowdScene.height; y += 40) {
            grid.lineBetween(0, y, CrowdScene.width, y);
        }

        // Personen erzeugen
        for (let i = 0; i < 100; i++) {
            const x = 20 + Math.random() * 200;
            const y = 60 + Math.random() * (CrowdScene.height - 120);

            const person = this.add.circle(
                x,
                y,
                4,
                0xe9aa43
            );

            this.people.push(person);
        }

        // Beschriftungen
        this.add.text(24, 20, "CROWD ENGINEER", {
            fontFamily: "Arial",
            fontSize: "20px",
            color: "#f1f5f9",
        });

        this.add.text(845, 24, "ZIEL  →", {
            fontFamily: "Arial",
            fontSize: "16px",
            color: "#f1f5f9",
        });
    }

    update(_time: number, delta: number): void {
        // Delta ist die Zeit seit dem letzten Bild in Millisekunden.
        // 0,06 Pixel pro Millisekunde entsprechen 60 Pixel pro Sekunde.
        for (const person of this.people) {
            person.x += delta * 0.06;

            // Am rechten Rand erscheint die Person links erneut.
            if (person.x > CrowdScene.width + 5) {
                person.x = -5;
                person.y = 60 + Math.random() * (CrowdScene.height - 120);
            }
        }
    }
}

new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    backgroundColor: "#101820",

    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: CrowdScene.width,
        height: CrowdScene.height,
    },

    scene: [CrowdScene],
});