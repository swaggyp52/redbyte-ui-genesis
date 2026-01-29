
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import { SetPinsPayload } from '../protocol.js';

export interface Basys3Options {
    port: string;
    baud?: number;
}

export class Basys3Backend {
    private port: SerialPort | null = null;
    private parser: ReadlineParser | null = null;
    private pinState: Record<string, number> = {};
    private connected: boolean = false;

    constructor(private options: Basys3Options) { }

    async connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this.port = new SerialPort({
                    path: this.options.port,
                    baudRate: this.options.baud || 115200,
                    autoOpen: false
                });

                this.parser = this.port.pipe(new ReadlineParser({ delimiter: '\n' }));

                this.port.open((err) => {
                    if (err) {
                        console.error(`[Basys3] Failed to open port ${this.options.port}: ${err.message}`);
                        reject(err);
                        return;
                    }
                    console.log(`[Basys3] Connected on ${this.options.port}`);
                    this.connected = true;
                    resolve();
                });

                this.parser.on('data', (data: string) => {
                    this.handleSerialData(data.trim());
                });

                this.port.on('error', (err) => {
                    console.error('[Basys3] Serial error:', err.message);
                    this.connected = false;
                });

                this.port.on('close', () => {
                    console.log('[Basys3] Port closed');
                    this.connected = false;
                });

            } catch (err) {
                reject(err);
            }
        });
    }

    async disconnect(): Promise<void> {
        return new Promise((resolve) => {
            if (this.port && this.port.isOpen) {
                this.port.close(() => {
                    this.connected = false;
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    private handleSerialData(data: string) {
        // Assume Basys 3 UART protocol for simulation
        // Expecting format like "SW[0..15]=1" or "LD[0..15]=0"
        if (data.includes('=')) {
            const [key, val] = data.split('=');
            this.pinState[key] = parseInt(val, 10);
        }
    }

    setPins(payload: SetPinsPayload): void {
        if (!this.connected || !this.port) return;

        Object.entries(payload.pins).forEach(([pinId, value]) => {
            // Send command to Basys 3
            this.port?.write(`SET ${pinId} ${value}\n`);
            this.pinState[pinId] = value;
        });
    }

    async getPins(): Promise<Record<string, number>> {
        return this.pinState;
    }

    loadPreset(nodeId: string, presetId: string): void {
        if (this.connected && this.port) {
            this.port.write(`PRESET ${presetId}\n`);
        }
    }

    async verify(): Promise<any> {
        if (!this.connected || !this.port) return { verified: false, error: 'Not connected' };

        return {
            verified: true,
            board: 'Basys 3 (Artix-7)',
            port: this.options.port,
            agent: '127.0.0.1:4242',
            timestamp: new Date().toLocaleTimeString(),
            details: 'UART connection established. Signature pending.'
        };
    }

    getStatus() {
        return {
            connected: this.connected,
            port: this.options.port,
            target: 'basys3',
            protocol: 'rb-basys3.v1',
            verified: this.connected
        };
    }
}
