import Phaser from "phaser";
import "./style.css";
import {CrowdScene} from "./game/CrowdScene.ts";
import {cssColor, THEME} from "./game/view/theme.ts";
import {VIEW_HEIGHT, VIEW_WIDTH} from "./game/view/layout.ts";

new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    backgroundColor: cssColor(THEME.background),

    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: VIEW_WIDTH,
        height: VIEW_HEIGHT,
    },

    scene: [CrowdScene],
});