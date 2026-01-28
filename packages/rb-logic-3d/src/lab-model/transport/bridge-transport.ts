
import { LabTransport, TransportStatus } from './types';

export class BridgeTransport implements LabTransport {
    private connected: boolean = false;

    async connect(): Promise<void> {
        console.log('[Bridge] Connecting...');
        this.connected = true;
        return Promise.resolve();
    }

    async disconnect(): Promise<void> {
        console.log('[Bridge] Disconnecting...');
        this.connected = false;
        return Promise.resolve();
    }

    getStatus(): TransportStatus {
        return {
            type: 'bridge',
            connected: this.connected
        };
    }

    pushInteraction(nodeId: string, pinId: string, value: number): void {
        if (!this.connected) return;
        console.log(`[Bridge] Push ${nodeId}:${pinId} = ${value}`);
    }

    loadPreset(nodeId: string, presetId: string): void {
        if (!this.connected) return;
        console.log(`[Bridge] Load Preset ${presetId} on ${nodeId}`);
    }

    poll(): Record<string, number> {
        // Bridge is essentially "read-only" or "transparent" regarding local sim state?
        // If we are in Bridge mode, we probably don't want to show Sim results.
        // We return empty if no data from board.
        // Real implementation would allow polling last received state.
        return {};
    }
}
