// RedByte Binary Protocol V1 Parser (ESM)
// Matches redbyte_telemetry.v implementation
// Frame: [0xAA, 0x55, SEQ, TICK(4), PAYLOAD(2), CRC(1)] = 10 bytes

import { EventEmitter } from 'events';

export default class RbBinV1Parser extends EventEmitter {
    constructor() {
        super();
        this.buffer = Buffer.alloc(0);
        this.FRAME_LEN = 10;

        // Stats
        this.stats = {
            bytes: 0,
            frames: 0,
            crcErrors: 0,
            resyncs: 0
        };
    }

    write(chunk) {
        if (!chunk || chunk.length === 0) return;
        this.stats.bytes += chunk.length;
        this.buffer = Buffer.concat([this.buffer, chunk]);
        this.parse();
    }

    parse() {
        // While we have enough data for a frame
        while (this.buffer.length >= this.FRAME_LEN) {
            // 1. Scan for Sync [0xAA, 0x55]
            if (this.buffer[0] !== 0xAA || this.buffer[1] !== 0x55) {
                // Not aligned, scan forward for next 0xAA 0x55
                let foundAt = -1;
                for (let i = 1; i < this.buffer.length - 1; i++) {
                    if (this.buffer[i] === 0xAA && this.buffer[i + 1] === 0x55) {
                        foundAt = i;
                        break;
                    }
                }

                if (foundAt === -1) {
                    // No sync found.
                    // Keep the last byte if it's 0xAA (possible start of sync)
                    const keep = (this.buffer[this.buffer.length - 1] === 0xAA) ? 1 : 0;
                    if (keep) {
                        this.buffer = this.buffer.slice(this.buffer.length - 1);
                    } else {
                        // Drop everything, but count bytes dropped if we want strict accounting?
                        // For resync stats, we count one event per contiguous flush
                        this.stats.resyncs++;
                        this.buffer = Buffer.alloc(0);
                    }
                    return; // Wait for more data
                } else {
                    // Resync found
                    this.buffer = this.buffer.slice(foundAt);
                    this.stats.resyncs++;
                    continue; // Retry with aligned buffer
                }
            }

            // 2. We have Sync at 0. Check for substantial length again (in case we just resynced near end)
            if (this.buffer.length < this.FRAME_LEN) break;

            // 3. Extract Frame Candidate
            const frame = this.buffer.slice(0, this.FRAME_LEN);

            // 4. Validate Checksum
            // Checksum covers SEQ..PAYLOAD (bytes 2..8). The stored CRC is byte 9.
            // HDL: crc <= crc ^ data (XOR sum)
            const dataToCrc = frame.slice(2, 9);
            const receivedCrc = frame[9];
            const calculatedCrc = this.calcChecksum(dataToCrc);

            if (calculatedCrc !== receivedCrc) {
                this.stats.crcErrors++;
                // Invalid frame. Drop the 0xAA 0x55 header and try again.
                // We advance by 2 so we don't re-match the same invalid header
                this.buffer = this.buffer.slice(2);
                continue;
            }

            // 5. Parse Payload (Valid)
            this.stats.frames++;
            const seq = frame[2];
            const tick = frame.readUInt32BE(3);
            const ioState = frame.readUInt16BE(7);

            // Unpack IO: {SW[3:0], BTN[3:0], LED[7:0]}
            // MSB (15..12) = SW
            //     (11..8)  = BTN
            //     (7..0)   = LED
            const sw = (ioState >> 12) & 0x0F;
            const btn = (ioState >> 8) & 0x0F;
            const led = ioState & 0xFF;

            const event = {
                type: 'io',
                tick,
                seq,
                payload: { sw, btn, led }
            };

            this.emit('data', event);

            // Advance buffer by full frame
            this.buffer = this.buffer.slice(this.FRAME_LEN);
        }
    }

    // Simple XOR checksum matching existing HDL 
    calcChecksum(buffer) {
        let crc = 0;
        for (const byte of buffer) {
            crc = (crc ^ byte) & 0xFF;
        }
        return crc;
    }
}
