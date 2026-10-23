import type {Vector2} from "./Vector2.ts";

export interface Obstacle {
    readonly position: Readonly<Vector2>;
    readonly radius: number;
}