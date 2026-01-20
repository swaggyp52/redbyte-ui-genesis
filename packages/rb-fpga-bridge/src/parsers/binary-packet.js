import { Transform } from "stream";
import { crc16_ccitt_false } from "./crc16.js";

export const PACKET_SIZE = 28;
const MAGIC_0 = 0x52;
const MAGIC_1 = 0x42;

function findMagic(buf, start) {
  for (let i = start; i < buf.length - 1; i += 1) {
    if (buf[i] === MAGIC_0 && buf[i + 1] === MAGIC_1) {
      return i;
    }
  }
  return -1;
}

export class BinaryPacketParser extends Transform {
  constructor() {
    super({ readableObjectMode: true });
    this.buffer = Buffer.alloc(0);
  }

  _transform(chunk, _encoding, callback) {
    try {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      this.buffer = Buffer.concat([this.buffer, buf]);
      this._process();
      callback();
    } catch (err) {
      callback(err);
    }
  }

  _process() {
    while (this.buffer.length >= 2) {
      if (this.buffer[0] !== MAGIC_0 || this.buffer[1] !== MAGIC_1) {
        const idx = findMagic(this.buffer, 1);
        if (idx === -1) {
          const keepLast = this.buffer[this.buffer.length - 1] === MAGIC_0;
          const dropCount = keepLast ? this.buffer.length - 1 : this.buffer.length;
          if (dropCount > 0) {
            this.emit("resync", dropCount);
          }
          this.buffer = keepLast
            ? this.buffer.slice(this.buffer.length - 1)
            : Buffer.alloc(0);
          break;
        }
        this.emit("resync", idx);
        this.buffer = this.buffer.slice(idx);
        continue;
      }

      if (this.buffer.length < PACKET_SIZE) {
        break;
      }

      const frame = this.buffer.slice(0, PACKET_SIZE);
      if (frame[2] !== 0x01) {
        this.emit("resync", 1);
        this.buffer = this.buffer.slice(1);
        continue;
      }

      const crcExpected = frame.readUInt16BE(26);
      const crcActual = crc16_ccitt_false(frame.subarray(0, 26));
      if (crcExpected !== crcActual) {
        this.emit("crc_fail", 1);
        this.emit("resync", 1);
        this.buffer = this.buffer.slice(1);
        continue;
      }

      const analog = [];
      for (let i = 0; i < 8; i += 1) {
        analog.push(frame.readUInt16BE(10 + i * 2));
      }

      this.push({
        protocol: "rb-binary-v1",
        version: 1,
        flags: frame[3],
        sequence: frame.readUInt32BE(4),
        digital: frame.readUInt16BE(8),
        analog,
        crc_ok: true,
      });
      this.emit("frame_ok", 1);

      this.buffer = this.buffer.slice(PACKET_SIZE);
    }
  }
}
