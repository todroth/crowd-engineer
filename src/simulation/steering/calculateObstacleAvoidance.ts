import type {Agent} from "../Agent.ts";
import type {Obstacle} from "../Obstacle.ts";
import type {Vector2} from "../Vector2.ts";
import {calculateCircleAvoidance} from "./obstacle-avoidance/calculateCircleAvoidance.ts";
import {calculateRectangleAvoidance} from "./obstacle-avoidance/calculateRectangleAvoidance.ts";
import {calculateWallAvoidance} from "./obstacle-avoidance/calculateWallAvoidance.ts";

export function calculateObstacleAvoidance(
    agent: Agent,
    obstacles: readonly Obstacle[],
    lookAheadDistance: number,
    strength: number,
    clearanceMargin: number,
): Vector2 {
    let x = 0;
    let y = 0;

    for (const obstacle of obstacles) {
        let force: Vector2 = {x: 0, y: 0};

        switch (obstacle.type) {
            case "circle":
                force = calculateCircleAvoidance(
                    agent, obstacle, lookAheadDistance, strength, clearanceMargin,
                );
                break;

            case "rectangle":
                force = calculateRectangleAvoidance(
                    agent, obstacle, lookAheadDistance, strength, clearanceMargin,
                );
                break;

            case "wall":
                force = calculateWallAvoidance(
                    agent, obstacle, lookAheadDistance, strength, clearanceMargin,
                );
                break;
        }

        x += force.x;
        y += force.y;
    }

    return {x, y};
}
