import { IDENTIFY_MAGIC, IDENTIFY_VERSION } from "./identify.js";

export const STREAM_MAGIC = IDENTIFY_MAGIC;
export const STREAM_VERSION = IDENTIFY_VERSION;
export const STREAM_TYPE_START = 0x10;
export const STREAM_TYPE_STOP = 0x11;
export const STREAM_TYPE_SAMPLE = 0x12;

const HEADER_LEN = 4 + 1 + 1 + 2;
const CRC_LEN = 4;
const MIN_FRAME_LEN = HEADER_LEN + CRC_LEN;

function readUInt16LE(buf, offset) {
  return buf.readUInt16LE(offset);
}

function readUInt32LE(buf, offset) {
  return buf.readUInt32LE(offset);
}

function writeUInt16LE(buf, value, offset) {
  buf.writeUInt16LE(value, offset);
}

function writeUInt32LE(buf, value, offset) {
  buf.writeUInt32LE(value, offset);
}

export function encodeStreamFrame(type, payloadObj, options = {}) {
  const payload = Buffer.from(JSON.stringify(payloadObj), "utf8");
  const buf = Buffer.alloc(HEADER_LEN + payload.length + CRC_LEN);

  STREAM_MAGIC.copy(buf, 0);
  buf[4] = STREAM_VERSION;
  buf[5] = type;
  writeUInt16LE(buf, payload.length, 6);
  payload.copy(buf, HEADER_LEN);

  const crcValue = options.crc32 ?? 0;
  writeUInt32LE(buf, crcValue, HEADER_LEN + payload.length);

  return buf;
}

export function buildStreamStartFrame({ hz } = {}) {
  return encodeStreamFrame(STREAM_TYPE_START, { kind: "start", hz: hz ?? null });
}

export function buildStreamStopFrame() {
  return encodeStreamFrame(STREAM_TYPE_STOP, { kind: "stop" });
}

export function decodeStreamFrames(buffer) {
  let offset = 0;
  const frames = [];

  while (offset + MIN_FRAME_LEN <= buffer.length) {
    const magicIndex = buffer.indexOf(STREAM_MAGIC, offset);
    if (magicIndex === -1) {
      const keep = buffer.slice(Math.max(buffer.length - 3, 0));
      return { frames, remainder: keep };
    }

    if (magicIndex > offset) {
      offset = magicIndex;
    }

    if (offset + HEADER_LEN > buffer.length) {
      break;
    }

    const version = buffer[offset + 4];
    const type = buffer[offset + 5];
    const length = readUInt16LE(buffer, offset + 6);
    const totalLen = HEADER_LEN + length + CRC_LEN;

    if (offset + totalLen > buffer.length) {
      break;
    }

    const payload = buffer.slice(offset + HEADER_LEN, offset + HEADER_LEN + length);
    const crc = readUInt32LE(buffer, offset + HEADER_LEN + length);

    frames.push({
      version,
      type,
      length,
      payload,
      crc,
      raw: buffer.slice(offset, offset + totalLen),
    });

    offset += totalLen;
  }

  return { frames, remainder: buffer.slice(offset) };
}

export function parseStreamSample(payloadBuffer) {
  let payload;
  try {
    payload = JSON.parse(payloadBuffer.toString("utf8"));
  } catch (err) {
    return { ok: false, error: "invalid_json", detail: err instanceof Error ? err.message : String(err) };
  }

  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "invalid_payload" };
  }

  if (!payload.io || typeof payload.io !== "object") {
    return { ok: false, error: "missing_io" };
  }

  let tMs = null;
  if (typeof payload.t_ms === "number") {
    tMs = payload.t_ms;
  } else if (typeof payload.t_us === "number") {
    tMs = Math.floor(payload.t_us / 1000);
  }

  return { ok: true, sample: { t_ms: tMs, io: payload.io } };
}
