import type Phaser from "phaser";
import type {Tool} from "../PlanEditor.ts";
import {createButton, createHeading, DEPTH_HUD} from "./ui.ts";
import {PANEL_WIDTH, VIEW_HEIGHT, WORLD_WIDTH} from "./layout.ts";
import {routeColor, routeLetter, THEME, TEXT_RESOLUTION} from "./theme.ts";

const PADDING = 10;
const INNER_WIDTH = PANEL_WIDTH - 2 * PADDING;
const ROW = 26;
const GAP = 4;
const ROUTE_BUTTON = 30;

/** Was die Seitenleiste anzeigt (die Szene baut das bei Änderungen neu zusammen). */
export interface PanelModel {
    readonly planning: boolean;
    readonly scenarios: readonly string[];
    readonly scenarioIndex: number;
    readonly tools: readonly {
        readonly kind: Tool;
        readonly label: string;
        readonly key: string;
        readonly selected: boolean;
        readonly exhausted: boolean;
    }[];
    /** Das ausgewählte Element; `route` fehlt, wenn es keinen Weg hat. */
    readonly selection: {readonly title: string; readonly route?: number} | null;
    readonly routeCount: number;
    readonly templates: readonly string[];
    readonly warning: string | null;
    readonly canStart: boolean;
    readonly speed: number;
}

export interface PanelActions {
    selectScenario(index: number): void;
    selectTool(kind: Tool): void;
    setRoute(route: number): void;
    removeSelected(): void;
    loadTemplate(index: number): void;
    clearAll(): void;
    start(): void;
    back(): void;
    toggleSpeed(): void;
}

/** Seitenleiste rechts: Szenarien, Werkzeuge, Auswahl, Vorlagen und Start. */
export class PlanPanel {
    private readonly scene: Phaser.Scene;
    private readonly actions: PanelActions;
    private objects: Phaser.GameObjects.GameObject[] = [];

    constructor(scene: Phaser.Scene, actions: PanelActions) {
        this.scene = scene;
        this.actions = actions;
        scene.add
            .rectangle(WORLD_WIDTH + PANEL_WIDTH / 2, VIEW_HEIGHT / 2, PANEL_WIDTH, VIEW_HEIGHT, THEME.panel)
            .setScrollFactor(0)
            .setDepth(DEPTH_HUD - 1);
        scene.add
            .rectangle(WORLD_WIDTH + 1, VIEW_HEIGHT / 2, 2, VIEW_HEIGHT, 0x24323f)
            .setScrollFactor(0)
            .setDepth(DEPTH_HUD - 1);
    }

    render(model: PanelModel): void {
        this.objects.forEach((object) => object.destroy());
        this.objects = [];

        const x = WORLD_WIDTH + PADDING;
        let y = PADDING;

        const add = (...objects: Phaser.GameObjects.GameObject[]) => this.objects.push(...objects);
        const button = (label: string, onClick: () => void, extra: Partial<Parameters<typeof createButton>[1]> = {}) => {
            add(...createButton(this.scene, {x, y, width: INNER_WIDTH, height: ROW, label, onClick, ...extra}));
            y += ROW + GAP;
        };

        add(createHeading(this.scene, x, y, "SZENARIO"));
        y += 16;
        model.scenarios.forEach((name, index) => {
            button(`${index + 1} ${name}`, () => this.actions.selectScenario(index), {
                selected: index === model.scenarioIndex,
            });
        });
        y += 8;

        if (!model.planning) {
            button(`Tempo ${model.speed}x  [S]`, () => this.actions.toggleSpeed());
            button("Zur Planung  [Leertaste]", () => this.actions.back());
            return;
        }

        add(createHeading(this.scene, x, y, "WERKZEUGE"));
        y += 16;
        for (const tool of model.tools) {
            button(`[${tool.key}] ${tool.label}`, () => this.actions.selectTool(tool.kind), {
                selected: tool.selected,
                textColor: tool.exhausted ? THEME.mutedText : THEME.text,
            });
        }
        y += 8;

        add(createHeading(this.scene, x, y, "AUSWAHL"));
        y += 16;

        if (model.selection) {
            add(this.scene.add
                .text(x, y, model.selection.title, {fontFamily: THEME.font, resolution: TEXT_RESOLUTION, fontSize: "13px", color: THEME.accentText})
                .setScrollFactor(0)
                .setDepth(DEPTH_HUD));
            y += 22;

            if (model.selection.route !== undefined) {
                for (let route = 0; route < model.routeCount; route++) {
                    add(...createButton(this.scene, {
                        x: x + route * (ROUTE_BUTTON + GAP),
                        y,
                        width: ROUTE_BUTTON,
                        height: ROUTE_BUTTON,
                        label: routeLetter(route),
                        fill: routeColor(route),
                        textColor: "#0b1118",
                        fontSize: 14,
                        center: true,
                        selected: route === model.selection.route,
                        onClick: () => this.actions.setRoute(route),
                    }));
                }
                y += ROUTE_BUTTON + GAP + 2;
            }

            button("Entfernen  [Entf]", () => this.actions.removeSelected());
        } else {
            add(this.scene.add
                .text(x, y, "Klick auf ein Element\nwählt es aus, Ziehen\nverschiebt es.", {
                    fontFamily: THEME.font, resolution: TEXT_RESOLUTION, fontSize: "11px", color: THEME.mutedText,
                })
                .setScrollFactor(0)
                .setDepth(DEPTH_HUD));
            y += 48;
        }
        y += 8;

        add(createHeading(this.scene, x, y, "VORLAGEN"));
        y += 16;
        model.templates.forEach((name, index) => {
            button(truncate(name, 27), () => this.actions.loadTemplate(index), {fontSize: 11});
        });
        button("Alles entfernen", () => this.actions.clearAll(), {fontSize: 11});

        // Start unten in der Leiste.
        const startHeight = 46;
        const startY = VIEW_HEIGHT - PADDING - startHeight;

        if (model.warning) {
            add(this.scene.add
                .text(x, startY - 8, model.warning, {
                    fontFamily: THEME.font, resolution: TEXT_RESOLUTION, fontSize: "11px", color: "#fca5a5", wordWrap: {width: INNER_WIDTH},
                })
                .setOrigin(0, 1)
                .setScrollFactor(0)
                .setDepth(DEPTH_HUD));
        }

        add(...createButton(this.scene, {
            x,
            y: startY,
            width: INNER_WIDTH,
            height: startHeight,
            label: "▶ Start  [Enter]",
            fill: 0x166534,
            fontSize: 16,
            center: true,
            disabled: !model.canStart,
            onClick: () => this.actions.start(),
        }));
    }
}

function truncate(text: string, length: number): string {
    return text.length <= length ? text : `${text.slice(0, length - 1)}…`;
}
