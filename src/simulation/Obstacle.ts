import type {Vector2} from "./Vector2.ts";

export interface CircleObstacle {
    readonly type: "circle";
    readonly center: Readonly<Vector2>;
    readonly radius: number;
}

export interface RectangleObstacle {
    readonly type: "rectangle";
    readonly position: Readonly<Vector2>;
    readonly width: number;
    readonly height: number;
}

export interface WallObstacle {
    readonly type: "wall";
    readonly start: Readonly<Vector2>;
    readonly end: Readonly<Vector2>;
    readonly thickness: number;
}

export type Obstacle =
    | CircleObstacle
    | RectangleObstacle
    | WallObstacle;
