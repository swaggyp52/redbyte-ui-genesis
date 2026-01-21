import {
  RBHB_MAGIC_HEADER_BUFFER,
  RBHB_VERSION_V1,
  RBHB_TYPE_STREAM_START,
  RBHB_TYPE_STREAM_STOP,
  RBHB_TYPE_SAMPLE,
  RBHB_HEADER_LEN,
  RBHB_CRC_LEN,
  RBHB_MIN_FRAME_LEN,
} from "./protocol.js";

// Legacy exports for compatibility
export const STREAM_MAGIC = RBHB_MAGIC_HEADER_BUFFER;
export const STREAM_VERSION = RBHB_VERSION_V1;
export const STREAM_TYPE_START = RBHB_TYPE_STREAM_START;
export const STREAM_TYPE_STOP = RBHB_TYPE_STREAM_STOP;
export const STREAM_TYPE_SAMPLE = RBHB_TYPE_SAMPLE;

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
  const buf = Buffer.alloc(RBHB_HEADER_LEN + payload.length + RBHB_CRC_LEN);

  RBHB_MAGIC_HEADER_BUFFER.copy(buf, 0);
  buf[4] = RBHB_VERSION_V1;
  buf[5] = type;
  writeUInt16LE(buf, payload.length, 6);
  payload.copy(buf, RBHB_HEADER_LEN);

  const crcValue = options.crc32 ?? 0;
  writeUInt32LE(buf, crcValue, RBHB_HEADER_LEN + payload.length);

  return buf;
}

export function buildStreamStartFrame({ hz } = {}) {
  return encodeStreamFrame(RBHB_TYPE_STREAM_START, { kind: "start", hz: hz ?? null });
}

export function buildStreamStopFrame() {
  return encodeStreamFrame(RBHB_TYPE_STREAM_STOP, { kind: "stop" });
}

export function decodeStreamFrames(buffer) {
  let offset = 0;
  const frames = [];

  while (offset + RBHB_MIN_FRAME_LEN <= buffer.length) {
    const magicIndex = buffer.indexOf(RBHB_MAGIC_HEADER_BUFFER, offset);
    if (magicIndex === -1) {
      const keep = buffer.slice(Math.max(buffer.length - 3, 0));
      return { frames, remainder: keep };
    }

    if (magicIndex > offset) {
      offset = magicIndex;
    }

    if (offset + RBHB_HEADER_LEN > buffer.length) {
      break;
    }

    const version = buffer[offset + 4];
    const type = buffer[offset + 5];
    const length = readUInt16LE(buffer, offset + 6);
    const totalLen = RBHB_HEADER_LEN + length + RBHB_CRC_LEN;

    if (offset + totalLen > buffer.length) {
      break;
    }

    const payload = buffer.slice(offset + RBHB_HEADER_LEN, offset + RBHB_HEADER_LEN + length);
    const crc = readUInt32LE(buffer, offset + RBHB_HEADER_LEN + length);

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
  } else if (typeof payload.t_ms === "string") {
    if (payload.t_ms.startsWith("0x")) {
      tMs = parseInt(payload.t_ms, 16);
    } else {
      tMs = parseInt(payload.t_ms, 10);
    }
    if (isNaN(tMs)) tMs = null;
  } else if (typeof payload.t_us === "number") {
    tMs = Math.floor(payload.t_us / 1000);
  }

  return { ok: true, sample: { t_ms: tMs, io: payload.io } };
}
