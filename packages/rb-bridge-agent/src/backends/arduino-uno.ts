
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import { SetPinsPayload } from '../protocol.js';

export interface ArduinoOptions {
    port: string;
    baud?: number;
}

export class ArduinoUnoBackend {
    private port: SerialPort | null = null;
    private parser: ReadlineParser | null = null;
    private pinState: Record<string, number> = {};
    private connected: boolean = false;
    private lastOutput: string = '';

    constructor(private options: ArduinoOptions) { }

    async connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this.port = new SerialPort({
                    path: this.options.port,
                    baudRate: this.options.baud || 115200,
                    autoOpen: false
                });

                this.parser = this.port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

                this.port.open((err) => {
                    if (err) {
                        console.error(`[Arduino] Failed to open port ${this.options.port}:`, err.message);
                        reject(err);
                        return;
                    }
                    console.log(`[Arduino] Connected on ${this.options.port}`);
                    this.connected = true;
                    resolve();
                });

                this.parser.on('data', (data: string) => {
                    this.handleSerialData(data);
                });

                this.port.on('error', (err) => {
                    console.error('[Arduino] Serial error:', err.message);
                    this.connected = false;
                });

                this.port.on('close', () => {
                    console.log('[Arduino] Port closed');
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
        // console.log(`[Arduino] Serial RX: ${data}`);
        if (data.startsWith('PINS ')) {
            const parts = data.substring(5).split(' ');
            parts.forEach(part => {
                const [pinId, valStr] = part.split('=');
                if (pinId && valStr !== undefined) {
                    this.pinState[pinId] = parseInt(valStr, 10);
                }
            });
        }
    }

    setPins(payload: SetPinsPayload): void {
        if (!this.connected || !this.port) return;

        Object.entries(payload.pins).forEach(([pinId, value]) => {
            // Map common pin IDs if needed, otherwise send as-is
            // UI might send "LED0", we might need to map it to "D13" for the firmware
            // For now, let's assume the UI sends "D13" or similar if targeted for Arduino, 
            // OR we map it here.
            let targetPin = pinId;
            if (pinId === 'LED0') targetPin = 'D13';

            this.port?.write(`SET ${targetPin} ${value}\n`);
            this.pinState[targetPin] = value;
        });
    }

    async getPins(): Promise<Record<string, number>> {
        if (!this.connected || !this.port) return this.pinState;

        return new Promise((resolve) => {
            // Request update from board
            this.port?.write('GET\n');

            // Give it 10ms to respond (it's polled every 50ms anyway)
            setTimeout(() => {
                // Ensure we return LED0 if D13 is the internal ID
                const result = { ...this.pinState };
                if (result['D13'] !== undefined) result['LED0'] = result['D13'];
                resolve(result);
            }, 10);
        });
    }

    loadPreset(nodeId: string, presetId: string): void {
        console.log(`[Arduino] Load Preset ${presetId} - Not fully implemented for UNO`);
        // We could send a command to the Arduino to run a specific routine
        if (this.connected && this.port) {
            this.port.write(`PRESET ${presetId}\n`);
        }
    }

    getStatus() {
        return {
            connected: this.connected,
            port: this.options.port,
            target: 'arduino-uno'
        };
    }
}
