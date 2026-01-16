/**
 * Bridge Contract - Immutable JSON schema for FPGA bridge events and state
 * 
 * This contract defines the exact structure of all messages between:
 * - Mock bridge (development)
 * - Serial bridge (real hardware)
 * - UI clients
 * - Proof runners
 * 
 * All parties must conform to this contract or validation fails.
 * When hardware arrives, only the transport/codec layer changes.
 * This contract remains unchanged.
 */

/**
 * Health state - reported by bridge /api/health
 * 
 * ok: true if bridge is operational
 * connected: true if device/mock is connected
 * port: "MOCK" | "COM3" | "/dev/ttyUSB0" etc
 * baud: 115200 | other
 * lastMsgTs: timestamp of last message from device, or null
 * lastMsg: last raw message, or null
 * board_id: optional identifier of detected/configured board
 */
export const HealthSchema = {
  ok: 'boolean',
  connected: 'boolean',
  port: 'string',
  baud: 'number',
  lastMsgTs: 'number | null',
  lastMsg: 'string | null',
  board_id: 'string | null (optional)'
};

/**
 * Event types emitted by bridge (via WebSocket /api/ws)
 * 
 * All events include:
 * - type: exact event category
 * - seq: sequence number (monotonically increasing per session)
 * - timestamp: milliseconds since epoch when event was generated
 * - source: "device" (real hardware) | "mock" (development)
 */

export const StatusEventSchema = {
  type: '"status"',
  seq: 'number (monotonic)',
  timestamp: 'number (epoch ms)',
  source: '"device" | "mock"',
  connected: 'boolean',
  port: 'string',
  baud: 'number',
  lastMsgTs: 'number | null',
  lastMsg: 'string | null'
};

/**
 * IO Update event - signals changed on board
 * 
 * Emitted when:
 * - Device sends new switch/button/LED state
 * - Mock advances one step
 * 
 * Fields are bitstrings matching board widths:
 * - SW: 16 bits (one char per bit: "0" or "1")
 * - BTN: 5 bits
 * - LED: 16 bits
 * - TICK: counter or timestamp, format TBD
 * 
 * ts_offset_ms: milliseconds since session start (for replay)
 */
export const IoUpdateEventSchema = {
  type: '"io:update"',
  seq: 'number (monotonic)',
  timestamp: 'number (epoch ms)',
  source: '"device" | "mock"',
  SW: 'string (16 bits as "0011001010101010")',
  BTN: 'string (5 bits as "10101")',
  LED: 'string (16 bits)',
  TICK: 'string (counter or timestamp)',
  ts_offset_ms: 'number (ms since session start)'
};

/**
 * Validation functions (runtime)
 * 
 * When implementing in JS: use these or equivalent checks
 * to ensure all events conform to contract before processing.
 */

export function validateHealth(obj) {
  if (!obj) return false;
  return (
    typeof obj.ok === 'boolean' &&
    typeof obj.connected === 'boolean' &&
    typeof obj.port === 'string' &&
    typeof obj.baud === 'number' &&
    (obj.lastMsgTs === null || typeof obj.lastMsgTs === 'number') &&
    (obj.lastMsg === null || typeof obj.lastMsg === 'string')
  );
}

export function validateStatusEvent(obj) {
  if (!obj) return false;
  return (
    obj.type === 'status' &&
    typeof obj.seq === 'number' &&
    typeof obj.timestamp === 'number' &&
    (obj.source === 'device' || obj.source === 'mock') &&
    typeof obj.connected === 'boolean' &&
    typeof obj.port === 'string' &&
    typeof obj.baud === 'number'
  );
}

export function validateIoUpdateEvent(obj) {
  if (!obj) return false;
  const isBitstring = (s, len) => typeof s === 'string' && s.length === len && /^[01]+$/.test(s);
  return (
    obj.type === 'io:update' &&
    typeof obj.seq === 'number' &&
    typeof obj.timestamp === 'number' &&
    (obj.source === 'device' || obj.source === 'mock') &&
    isBitstring(obj.SW, 16) &&
    isBitstring(obj.BTN, 5) &&
    isBitstring(obj.LED, 16) &&
    typeof obj.TICK === 'string' &&
    typeof obj.ts_offset_ms === 'number'
  );
}

export function validateEvent(obj) {
  if (obj.type === 'status') return validateStatusEvent(obj);
  if (obj.type === 'io:update') return validateIoUpdateEvent(obj);
  return false;
}

/**
 * Type definitions for TypeScript users
 * (Also documentative for JS implementations)
 */

export const TypeDefinitions = `
type Health = {
  ok: boolean;
  connected: boolean;
  port: string;
  baud: number;
  lastMsgTs: number | null;
  lastMsg: string | null;
  board_id?: string | null;
};

type StatusEvent = {
  type: 'status';
  seq: number;
  timestamp: number;
  source: 'device' | 'mock';
  connected: boolean;
  port: string;
  baud: number;
  lastMsgTs: number | null;
  lastMsg: string | null;
};

type IoUpdateEvent = {
  type: 'io:update';
  seq: number;
  timestamp: number;
  source: 'device' | 'mock';
  SW: string;  // 16-bit bitstring
  BTN: string; // 5-bit bitstring
  LED: string; // 16-bit bitstring
  TICK: string;
  ts_offset_ms: number;
};

type Event = StatusEvent | IoUpdateEvent;
`;
