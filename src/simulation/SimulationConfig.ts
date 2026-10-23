export interface SimulationConfig {
    readonly separationRadius: number;
    readonly separationStrength: number;
    readonly maxAcceleration: number;

    readonly obstacleLookAheadDistance: number;
    readonly obstacleAvoidanceStrength: number;
    readonly obstacleClearanceMargin: number;
}