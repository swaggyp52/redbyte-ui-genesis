import type {
    BridgeDevice, ConnectPayload, UploadSketchPayload,
    UploadSketchResponsePayload, VerifyDeviceResponsePayload,
} from '@redbyte/rb-protocol';

export type TransportType = 'sim' | 'bridge';

export interface TransportStatus {
    type: TransportType;
    connected: boolean;
    deviceVerified?: boolean;
    error?: string;
}

export interface TransportConnectOptions extends ConnectPayload {
    target: 'basys3' | 'arduino-uno' | 'arduino-nano';
}

/** A disconnected/error reply does not invent board identity or a verification time. */
export type DeviceVerificationResult = VerifyDeviceResponsePayload | {
    verified: false;
    error: string;
    message?: string;
    details?: string;
};

export interface LabTransport {
    readonly type: TransportType;
    connect(options?: TransportConnectOptions): Promise<void>;
    disconnect(): Promise<void>;
    getStatus(): TransportStatus;
    pushInteraction(nodeId: string, pinId: string, value: number): void;
    loadPreset(nodeId: string, presetId: string): void;
    uploadSketch?(payload: UploadSketchPayload): Promise<UploadSketchResponsePayload>;
    verifySketch?(payload: Omit<UploadSketchPayload, 'port'>): Promise<UploadSketchResponsePayload>;
    listDevices?(): Promise<BridgeDevice[]>;
    verifyDevice?(): Promise<DeviceVerificationResult>;
    poll(): Record<string, number>;
    getDetailedStatuses?(): Record<string, TransportStatus>;
    tick?(): void;
    /** Actual simulation capability; input memory and passthrough preserve numeric values. */
    tickWithInputs?(inputs: Record<string, number>): void;
}
