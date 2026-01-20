import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const goldenDir = path.resolve(__dirname, '..', '..', 'golden');
const schemaPath = path.resolve(__dirname, '..', '..', 'schemas', 'bridge-api.schema.json');

function loadJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function assertString(value: unknown, label: string): void {
  expect(typeof value, label).toBe('string');
}

function assertNumber(value: unknown, label: string): void {
  expect(typeof value, label).toBe('number');
}

function assertBoolean(value: unknown, label: string): void {
  expect(typeof value, label).toBe('boolean');
}

function assertRecordOfString(value: unknown, label: string): void {
  expect(typeof value, label).toBe('object');
  expect(value).not.toBeNull();
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    assertString(entry, `${label}.${key}`);
  }
}

function assertSchemaVersion(value: unknown): void {
  expect(value).toBe('bridge_v1');
}

describe('bridge api schema', () => {
  it('includes required definitions', () => {
    const schema = loadJson(schemaPath) as {
      definitions?: Record<string, unknown>;
    };

    expect(schema.definitions).toBeTruthy();
    expect(schema.definitions).toHaveProperty('bridge_schema_version');
    expect(schema.definitions).toHaveProperty('devices_response');
    expect(schema.definitions).toHaveProperty('program_request');
    expect(schema.definitions).toHaveProperty('run_request');
    expect(schema.definitions).toHaveProperty('stream_event');
  });

  it('declares bridge_v1 schema version', () => {
    const schema = loadJson(schemaPath) as {
      definitions?: {
        bridge_schema_version?: { enum?: string[] };
      };
    };

    expect(schema.definitions?.bridge_schema_version?.enum).toContain('bridge_v1');
  });
});

describe('bridge api golden payloads', () => {
  it('validates devices response shape', () => {
    const payload = loadJson(path.join(goldenDir, 'devices.response.json')) as {
      schema_version: string;
      devices: Array<Record<string, unknown>>;
    };

    assertSchemaVersion(payload.schema_version);
    expect(Array.isArray(payload.devices)).toBe(true);
    expect(payload.devices.length).toBeGreaterThan(0);

    for (const device of payload.devices) {
      assertString(device.id, 'device.id');
      assertString(device.name, 'device.name');
      assertString(device.model_id, 'device.model_id');
      assertString(device.board, 'device.board');
      assertString(device.transport, 'device.transport');
    }
  });

  it('validates program request and response shapes', () => {
    const request = loadJson(path.join(goldenDir, 'program.request.json')) as {
      schema_version: string;
      device_id: string;
      board_model_id: string;
      bitstream: { encoding: string; data: string };
    };
    const response = loadJson(path.join(goldenDir, 'program.response.json')) as {
      schema_version: string;
      ok: boolean;
    };

    assertSchemaVersion(request.schema_version);
    assertString(request.device_id, 'program.device_id');
    assertString(request.board_model_id, 'program.board_model_id');
    assertString(request.bitstream.encoding, 'program.bitstream.encoding');
    assertString(request.bitstream.data, 'program.bitstream.data');

    assertSchemaVersion(response.schema_version);
    assertBoolean(response.ok, 'program.ok');
  });

  it('validates run and stop shapes', () => {
    const runRequest = loadJson(path.join(goldenDir, 'run.request.json')) as {
      schema_version: string;
      device_id: string;
      board_model_id: string;
      mode: string;
      bin_size_ms?: number;
    };
    const runResponse = loadJson(path.join(goldenDir, 'run.response.json')) as {
      schema_version: string;
      ok: boolean;
      run_id: string;
      started_at_ms: number;
    };
    const stopRequest = loadJson(path.join(goldenDir, 'stop.request.json')) as {
      schema_version: string;
      run_id: string;
    };
    const stopResponse = loadJson(path.join(goldenDir, 'stop.response.json')) as {
      schema_version: string;
      ok: boolean;
      stopped_at_ms: number;
    };

    assertSchemaVersion(runRequest.schema_version);
    assertString(runRequest.device_id, 'run.device_id');
    assertString(runRequest.board_model_id, 'run.board_model_id');
    assertString(runRequest.mode, 'run.mode');
    if (runRequest.bin_size_ms !== undefined) {
      assertNumber(runRequest.bin_size_ms, 'run.bin_size_ms');
    }

    assertSchemaVersion(runResponse.schema_version);
    assertBoolean(runResponse.ok, 'run.ok');
    assertString(runResponse.run_id, 'run.run_id');
    assertNumber(runResponse.started_at_ms, 'run.started_at_ms');

    assertSchemaVersion(stopRequest.schema_version);
    assertString(stopRequest.run_id, 'stop.run_id');

    assertSchemaVersion(stopResponse.schema_version);
    assertBoolean(stopResponse.ok, 'stop.ok');
    assertNumber(stopResponse.stopped_at_ms, 'stop.stopped_at_ms');
  });

  it('validates stream events', () => {
    const sample = loadJson(path.join(goldenDir, 'stream.sample.json')) as {
      schema_version: string;
      type: string;
      run_id: string;
      board_model_id: string;
      hw_tick: number;
      mono_seq: number;
      ts_wall_ms: number;
      io: { inputs: Record<string, string>; outputs: Record<string, string> };
    };
    const status = loadJson(path.join(goldenDir, 'stream.status.json')) as {
      schema_version: string;
      type: string;
      run_id: string;
      state: string;
      ts_wall_ms: number;
    };

    assertSchemaVersion(sample.schema_version);
    assertString(sample.type, 'sample.type');
    assertString(sample.run_id, 'sample.run_id');
    assertString(sample.board_model_id, 'sample.board_model_id');
    assertNumber(sample.hw_tick, 'sample.hw_tick');
    assertNumber(sample.mono_seq, 'sample.mono_seq');
    assertNumber(sample.ts_wall_ms, 'sample.ts_wall_ms');
    assertRecordOfString(sample.io.inputs, 'sample.io.inputs');
    assertRecordOfString(sample.io.outputs, 'sample.io.outputs');

    assertSchemaVersion(status.schema_version);
    assertString(status.type, 'status.type');
    assertString(status.run_id, 'status.run_id');
    assertString(status.state, 'status.state');
    assertNumber(status.ts_wall_ms, 'status.ts_wall_ms');
  });
});
