
import { LabTransport, TransportStatus } from './types';

export class TransportRouter implements LabTransport {
    public readonly type = 'bridge';
    private transports: Map<string, LabTransport> = new Map();

    addTransport(id: string, transport: LabTransport) {
        this.transports.set(id, transport);
    }

    getTransport(id: string): LabTransport | undefined {
        return this.transports.get(id);
    }

    async connect(options?: any): Promise<void> {
        const promises = Array.from(this.transports.values()).map(t => t.connect(options));
        await Promise.all(promises);
    }

    async disconnect(): Promise<void> {
        const promises = Array.from(this.transports.values()).map(t => t.disconnect());
        await Promise.all(promises);
    }

    getStatus(): TransportStatus {
        const statuses = Array.from(this.transports.values()).map(t => t.getStatus());
        const allConnected = statuses.length > 0 && statuses.every(s => s.connected);
        const allVerified = statuses.length > 0 && statuses.every(s => s.deviceVerified);

        return {
            type: 'bridge',
            connected: allConnected,
            deviceVerified: allVerified,
            error: statuses.find(s => s.error)?.error
        };
    }

    // New method for UI to get individual statuses
    getDetailedStatuses(): Record<string, TransportStatus> {
        const result: Record<string, TransportStatus> = {};
        this.transports.forEach((t, id) => {
            result[id] = t.getStatus();
        });
        return result;
    }

    pushInteraction(nodeId: string, pinId: string, value: number): void {
        // Route by nodeId prefix if available, otherwise broadcast
        // Standard nodeId format: "deviceId:pinId" or "deviceId/subnode"
        const deviceId = nodeId.split(':')[0] || nodeId.split('/')[0];
        const transport = this.transports.get(deviceId);

        if (transport) {
            transport.pushInteraction(nodeId, pinId, value);
        } else {
            // Broadcast if no specific match
            this.transports.forEach(t => t.pushInteraction(nodeId, pinId, value));
        }
    }

    loadPreset(nodeId: string, presetId: string): void {
        const deviceId = nodeId.split(':')[0] || nodeId.split('/')[0];
        const transport = this.transports.get(deviceId);

        if (transport) {
            transport.loadPreset(nodeId, presetId);
        } else {
            this.transports.forEach(t => t.loadPreset(nodeId, presetId));
        }
    }

    async uploadSketch(payload: any): Promise<any> {
        // Find transport matching the target or deviceId
        // For now, if it's an Arduino payload, try the 'uno' transport
        const transport = this.transports.get('uno') || this.transports.get('arduino-uno');
        if (transport && transport.uploadSketch) {
            return transport.uploadSketch(payload);
        }
        return { ok: false, message: 'No suitable transport found for upload' };
    }

    async verifyDevice(): Promise<any> {
        const promises = Array.from(this.transports.values()).map(t => t.verifyDevice?.());
        const results = await Promise.all(promises);
        return results[0]; // Simplified return
    }

    poll(): Record<string, number> {
        const combined: Record<string, number> = {};
        this.transports.forEach(t => {
            const state = t.poll();
            Object.assign(combined, state);
        });
        return combined;
    }
}
