import type {Vector2} from "./Vector2.ts";

export interface Agent {
    readonly id: number;

    position: Vector2;
    velocity: Vector2;
    target: Vector2;

    readonly desiredSpeed: number;
    readonly radius: number;

    localDensity: number;

}