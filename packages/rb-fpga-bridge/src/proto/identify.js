import { SerialPort } from "serialport";
import { EventEmitter } from "events";
import {
  RBHB_MAGIC_HEADER_BUFFER,
  RBHB_VERSION_V1,
  RBHB_TYPE_IDENTIFY,
  RBHB_TYPE_IDENTIFY_RESP,
  RBHB_HEADER_LEN,
  RBHB_CRC_LEN,
  RBHB_MIN_FRAME_LEN,
} from "./protocol.js";

// Legacy exports for compatibility (will be deprecated)
export const IDENTIFY_MAGIC = RBHB_MAGIC_HEADER_BUFFER;
export const IDENTIFY_VERSION = RBHB_VERSION_V1;
export const IDENTIFY_TYPE_REQ = RBHB_TYPE_IDENTIFY;
export const IDENTIFY_TYPE_RESP = RBHB_TYPE_IDENTIFY_RESP;

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

export function encodeIdentifyFrame(type, payloadObj, options = {}) {
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

export function buildIdentifyRequestFrame() {
  return encodeIdentifyFrame(RBHB_TYPE_IDENTIFY, { kind: "identify" });
}

export function decodeIdentifyFrames(buffer) {
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

export function parseIdentifyPayload(payloadBuffer) {
  let payload;
  try {
    payload = JSON.parse(payloadBuffer.toString("utf8"));
  } catch (err) {
    return { ok: false, error: "invalid_json", detail: err instanceof Error ? err.message : String(err) };
  }

  if (!payload || payload.kind !== "identify") {
    return { ok: false, error: "invalid_kind" };
  }

  return { ok: true, payload };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createPortInstance(portFactory, pathValue, baudRate) {
  if (portFactory) {
    return portFactory({ path: pathValue, baudRate });
  }
  return new SerialPort({ path: pathValue, baudRate, autoOpen: false });
}

function waitForResponse(state, timeoutMs) {
  const existing = state.takeFrame();
  if (existing) {
    return Promise.resolve({ ok: true, frame: existing });
  }

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      state.pendingResolve = null;
      resolve({ ok: false, error: "timeout" });
    }, timeoutMs);

    state.pendingResolve = (frame) => {
      clearTimeout(timer);
      state.pendingResolve = null;
      resolve({ ok: true, frame });
    };
  });
}

export async function identifyPort(options) {
  const {
    port,
    baud = 115200,
    timeoutMs = 250,
    retries = 3,
    backoffMs = [100, 200, 400],
    maxTotalMs,
    portFactory,
  } = options;

  const start = Date.now();
  const portInstance = createPortInstance(portFactory, port, baud);
  const state = {
    buffer: Buffer.alloc(0),
    frames: [],
    pendingResolve: null,
  };

  const takeFrame = () => {
    const index = state.frames.findIndex((f) => f.type === RBHB_TYPE_IDENTIFY_RESP);
    if (index === -1) return null;
    return state.frames.splice(index, 1)[0];
  };
  state.takeFrame = takeFrame;

  const onData = (data) => {
    state.buffer = Buffer.concat([state.buffer, data]);
    const decoded = decodeIdentifyFrames(state.buffer);
    state.buffer = decoded.remainder;
    for (const frame of decoded.frames) {
      state.frames.push(frame);
    }
    if (state.pendingResolve) {
      const frame = state.takeFrame();
      if (frame) {
        const resolver = state.pendingResolve;
        state.pendingResolve = null;
        resolver(frame);
      }
    }
  };

  const openPort = () => new Promise((resolve, reject) => {
    portInstance.open((err) => {
      if (err) return reject(err);
      resolve();
    });
  });

  const closePort = () => new Promise((resolve) => {
    if (!portInstance.isOpen) {
      resolve();
      return;
    }
    portInstance.close(() => resolve());
  });

  let lastError = null;
  let attempts = 0;

  try {
    portInstance.on("data", onData);
    await openPort();

    for (let i = 0; i < retries; i += 1) {
      attempts += 1;
      const elapsed = Date.now() - start;
      if (maxTotalMs !== undefined && elapsed + timeoutMs > maxTotalMs) {
        return { ok: false, attempts, error: "budget_exceeded", lastError };
      }

      const reqFrame = buildIdentifyRequestFrame();
      const attemptStart = Date.now();
      state.frames = [];
      const responsePromise = waitForResponse(state, timeoutMs);
      portInstance.write(reqFrame);

      const response = await responsePromise;
      if (response.ok) {
        const parsed = parseIdentifyPayload(response.frame.payload);
        if (!parsed.ok) {
          lastError = parsed.error;
        } else {
          return {
            ok: true,
            payload: parsed.payload,
            attempts,
            rttMs: Date.now() - attemptStart,
          };
        }
      } else {
        lastError = response.error;
      }

      if (i < retries - 1) {
        const backoff = backoffMs[i] ?? backoffMs[backoffMs.length - 1] ?? 0;
        if (backoff > 0) {
          await sleep(backoff);
        }
      }
    }

    return { ok: false, attempts, error: "timeout", lastError };
  } catch (err) {
    return { ok: false, attempts, error: "open_failed", lastError: err instanceof Error ? err.message : String(err) };
  } finally {
    portInstance.off("data", onData);
    await closePort();
  }
}

export function createMockPortResponder(options) {
  const responder = new EventEmitter();
  responder.isOpen = false;
  responder.open = (cb) => {
    responder.isOpen = true;
    cb?.();
  };
  responder.close = (cb) => {
    responder.isOpen = false;
    cb?.();
  };
  responder.write = (data) => {
    const decoded = decodeIdentifyFrames(data);
    const request = decoded.frames.find((frame) => frame.type === RBHB_TYPE_IDENTIFY);
    if (!request) return;

    const payload = options.payload;
    const responseFrame = encodeIdentifyFrame(RBHB_TYPE_IDENTIFY_RESP, payload);
    if (options.split) {
      for (const chunk of options.split(responseFrame)) {
        responder.emit("data", chunk);
      }
    } else {
      responder.emit("data", responseFrame);
    }
  };
  responder.off = responder.removeListener.bind(responder);

  return responder;
}

