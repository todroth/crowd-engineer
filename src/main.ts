import Phaser from "phaser";
import "./style.css";
import {CrowdScene} from "./game/CrowdScene.ts";

new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    backgroundColor: "#101820",

    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 1000,
        height: 700,
    },

    scene: [CrowdScene],
});