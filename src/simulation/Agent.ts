export interface Vector2 {
    x: number;
    y: number;
}

export interface Agent {
    readonly id: number;

    position: Vector2;
    velocity: Vector2;
    target: Vector2;

    readonly desiredSpeed: number;
    readonly radius: number;

}