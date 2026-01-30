
import { SerialPort } from 'serialport';
import { SetPinsPayload } from '@redbyte/rb-protocol';

export interface Basys3Options {
    port: string;
    baud?: number;
}

// Protocol Definition
// Protocol Definition (RB Telemetry v1)
const PKT_MAGIC0 = 0x52; // 'R'
const PKT_MAGIC1 = 0x42; // 'B'
const PKT_SIZE = 28;

// Offsets
const IDX_MAGIC0 = 0;
const IDX_MAGIC1 = 1;
const IDX_VERSION = 2;
const IDX_FLAGS = 3;
const IDX_SEQ = 4; // 4 bytes Big Endian
const IDX_DIGITAL = 8; // 2 bytes Big Endian (SW)
const IDX_ANALOG = 10; // 8 * 2 bytes = 16 bytes
const IDX_CRC = 26; // 2 bytes Big Endian

export class Basys3Backend {
    private port: SerialPort | null = null;
    private pinState: Record<string, number> = {};
    private connected: boolean = false;
    private buffer: Buffer = Buffer.alloc(0);

    constructor(private options: Basys3Options) { }

    async connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this.port = new SerialPort({
                    path: this.options.port,
                    baudRate: this.options.baud || 115200,
                    autoOpen: false
                });

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

                this.port.on('data', (data: Buffer) => {
                    this.handleSerialData(data);
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

    private handleSerialData(chunk: Buffer) {
        this.buffer = Buffer.concat([this.buffer, chunk]);

        while (this.buffer.length >= PKT_SIZE) {
            // Find Header (0x52 0x42)
            let headIdx = -1;
            for (let i = 0; i < this.buffer.length - 1; i++) {
                if (this.buffer[i] === PKT_MAGIC0 && this.buffer[i + 1] === PKT_MAGIC1) {
                    headIdx = i;
                    break;
                }
            }

            if (headIdx === -1) {
                // Keep last byte just in case it's 0x52
                if (this.buffer.length > 0 && this.buffer[this.buffer.length - 1] === PKT_MAGIC0) {
                    this.buffer = this.buffer.subarray(this.buffer.length - 1);
                } else {
                    this.buffer = Buffer.alloc(0);
                }
                return;
            }

            if (headIdx > 0) {
                // Discard garbage before header
                this.buffer = this.buffer.subarray(headIdx);
            }

            if (this.buffer.length < PKT_SIZE) {
                // Need more data
                return;
            }

            // Extract Packet
            const packet = this.buffer.subarray(0, PKT_SIZE);
            if (this.validatePacket(packet)) {
                this.parsePacket(packet);
                // Advance buffer
                this.buffer = this.buffer.subarray(PKT_SIZE);
            } else {
                console.warn('[Basys3] Invalid Checksum, skipping header');
                // Skip these two magic bytes and search again
                this.buffer = this.buffer.subarray(2);
            }
        }
    }

    private validatePacket(pkt: Buffer): boolean {
        // CRC-16-CCITT (0x1021) over 0..25 (inclusive)
        // Packet has CRC at 26, 27
        const claimedCrc = (pkt[IDX_CRC] << 8) | pkt[IDX_CRC + 1];

        let crc = 0xFFFF;
        for (let i = 0; i < IDX_CRC; i++) {
            crc = crc ^ (pkt[i] << 8);
            for (let j = 0; j < 8; j++) {
                if ((crc & 0x8000) !== 0) {
                    crc = (crc << 1) ^ 0x1021;
                } else {
                    crc = crc << 1;
                }
            }
        }
        crc = crc & 0xFFFF;
        return crc === claimedCrc;
    }

    private parsePacket(pkt: Buffer) {
        const flags = pkt[IDX_FLAGS];
        // Big Endian
        const digital = (pkt[IDX_DIGITAL] << 8) | pkt[IDX_DIGITAL + 1];

        // Update Pin State
        // Switches SW0..SW15 mapped from 'digital'
        for (let i = 0; i < 16; i++) {
            this.pinState[`basys3:SW${i}`] = (digital >> i) & 1;
        }

        // Buttons from Flags
        // HDL: {3'b000, btnD, btnR, btnL, btnU, btnC}
        // Bit 0: BTNC
        // Bit 1: BTNU
        // Bit 2: BTNL
        // Bit 3: BTNR
        // Bit 4: BTND
        this.pinState['basys3:BTNC'] = (flags >> 0) & 1;
        this.pinState['basys3:BTNU'] = (flags >> 1) & 1;
        this.pinState['basys3:BTNL'] = (flags >> 2) & 1;
        this.pinState['basys3:BTNR'] = (flags >> 3) & 1;
        this.pinState['basys3:BTND'] = (flags >> 4) & 1;

        // Note: LEDs are not in this Telemetry packet (it's device -> host).
        // If we want to reflect LED state, we assume the board 'loopback' logic holds
        // or we rely on the Simulation causing the Virtual LEDs to light up.
        // For "Hardware Reality", we strictly report what we measure.
    }

    setPins(payload: SetPinsPayload): void {
        if (!this.connected || !this.port) return;

        // Basys3 usually doesn't accept SET PINS from PC unless we have a specific control protocol.
        // The current plan is mostly monitoring. 
        // If we need to drive inputs (Virtual Lab Mode -> Hardware), standard UART would need a command.
        // For now, we log or ignore.
        // console.log('[Basys3] setPins not implemented for hardware inputs yet');
    }

    async getPins(): Promise<Record<string, number>> {
        return this.pinState;
    }

    loadPreset(nodeId: string, presetId: string): void {
        // No-op for now
    }

    async verify(): Promise<any> {
        if (!this.connected || !this.port) return { verified: false, error: 'Not connected' };

        return {
            verified: true,
            board: 'Basys 3 (Artix-7)',
            port: this.options.port,
            agent: '127.0.0.1:4242',
            timestamp: new Date().toLocaleTimeString(),
            details: 'RedByte Protocol v1 (Raw Reality)'
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
