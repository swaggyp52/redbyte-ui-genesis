
export type TransportType = 'sim' | 'bridge';

export interface TransportStatus {
    type: TransportType;
    connected: boolean;
    deviceVerified?: boolean;
    error?: string;
}

export interface LabTransport {
    readonly type: TransportType;
    // Lifecycle
    connect(options?: any): Promise<void>;
    disconnect(): Promise<void>;
    getStatus(): TransportStatus;

    // Output to Transport (User -> Engine/HW)
    pushInteraction(nodeId: string, pinId: string, value: number): void;
    loadPreset(nodeId: string, presetId: string): void;
    uploadSketch?(payload: { target: string, port: string, fqbn: string, sketchText: string }): Promise<{ ok: boolean, message: string }>;
    verifySketch?(payload: { target: string, fqbn: string, sketchText: string }): Promise<{ ok: boolean, message: string }>;
    listDevices?(): Promise<Array<{ target: string, port: string, manufacturer?: string }>>;
    verifyDevice?(): Promise<{ verified: boolean, board: string, port: string, agent: string, timestamp: string, details?: string }>;

    // Input from Transport (Engine/HW -> UI)
    // Returns map of "nodeId:pinId" -> value
    poll(): Record<string, number>;

    getDetailedStatuses?(): Record<string, TransportStatus>;

    // For Simulation Transport specifically, we need to tick it
    tick?(): void;
}
