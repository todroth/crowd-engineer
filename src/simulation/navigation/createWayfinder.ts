import type {Level} from "../Level.ts";
import type {Plan} from "../Plan.ts";
import type {Collider} from "../geometry/Collider.ts";
import type {Rect} from "../geometry/Rect.ts";
import type {Random} from "../random.ts";
import {FlowField, type FlowFieldOptions} from "./FlowField.ts";
import {Wayfinder} from "./Wayfinder.ts";

/**
 * Baut die Flow-Fields eines Levels und den Wayfinder darüber:
 *
 *  - Hauptfeld zu allen bekannten Ausgängen (Ausgänge, die nur über einen Weg
 *    bekannt sind, fehlen darin),
 *  - je Weg ein Feld zu seinem Eingang und, falls er zu einem eigenen
 *    Ausgang führt, eines von dort zu diesem Ausgang.
 */
export function createWayfinder(
    level: Level,
    colliders: readonly Collider[],
    plan: Plan,
    agentRadius: number,
    random: Random,
): Wayfinder {
    const {simulation: config} = level;
    const bounds = fieldBounds(level);
    const options: FlowFieldOptions = {
        cellSize: config.flowCellSize,
        agentRadius,
        wallAvoidanceDistance: config.wallAvoidanceDistance,
    };
    const field = (goals: readonly Rect[]) => new FlowField(colliders, bounds, goals, options);

    const knownGoals = level.goalAreas.filter(
        (_, index) => !level.routes.some((route) => route.exit === index),
    );
    const mainField = field(knownGoals);

    return new Wayfinder(
        colliders,
        mainField,
        level.routes.map(({entrance, exit}) => ({
            entrance,
            toEntrance: field([entrance]),
            afterEntrance: exit === undefined ? mainField : field([level.goalAreas[exit]]),
        })),
        level.goalAreas,
        plan.signs,
        plan.marshals,
        config.wayfinding,
        config.marshal,
        random,
    );
}

/** Rasterbereich der Flow-Fields: Welt plus Ein- und Austrittsbereiche (die außerhalb liegen). */
function fieldBounds(level: Level): Rect {
    const {worldWidth, worldHeight, entryArea, goalAreas} = level;
    const areas = [entryArea, ...goalAreas];
    const left = Math.min(0, ...areas.map((area) => area.x));
    const top = Math.min(0, ...areas.map((area) => area.y));
    const right = Math.max(worldWidth, ...areas.map((area) => area.x + area.width));
    const bottom = Math.max(worldHeight, ...areas.map((area) => area.y + area.height));

    return {x: left, y: top, width: right - left, height: bottom - top};
}
