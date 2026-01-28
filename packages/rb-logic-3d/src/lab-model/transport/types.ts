
export type TransportType = 'sim' | 'bridge';

export interface TransportStatus {
    type: TransportType;
    connected: boolean;
    error?: string;
}

export interface LabTransport {
    // Lifecycle
    connect(options?: any): Promise<void>;
    disconnect(): Promise<void>;
    getStatus(): TransportStatus;

    // Output to Transport (User -> Engine/HW)
    pushInteraction(nodeId: string, pinId: string, value: number): void;
    loadPreset(nodeId: string, presetId: string): void;
    uploadSketch?(payload: any): Promise<any>;
    listDevices?(): Promise<any>;

    // Input from Transport (Engine/HW -> UI)
    // Returns map of "nodeId:pinId" -> value
    poll(): Record<string, number>;

    // For Simulation Transport specifically, we need to tick it
    tick?(): void;
}
