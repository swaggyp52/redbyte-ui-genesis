import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  deriveProgramBitstreamArtifactId,
  deriveProgramBitstreamRunId,
  encodeProgramBitstreamRequestPayload,
  getToolchainBackend,
  type ProgramBitstreamInput,
} from '../fpga/toolchainBackend';

class FakeEventSource {
  static instances: FakeEventSource[] = [];

  readonly url: string;

  onerror: ((ev: Event) => void) | null = null;

  private listeners: Record<string, Array<(event: MessageEvent) => void>> = {};

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, cb: (event: MessageEvent) => void) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(cb);
  }

  emit(type: string, payload: unknown) {
    const event = { data: JSON.stringify(payload) } as MessageEvent;
    for (const cb of this.listeners[type] ?? []) cb(event);
  }

  close() {
    return;
  }
}

describe('toolchain program-bitstream', () => {
  afterEach(() => {
    FakeEventSource.instances = [];
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('derives deterministic artifactId, unique runId, and normalizes base64 payload', () => {
    const inputA: ProgramBitstreamInput = {
      board: 'basys3',
      mode: 'sram',
      bitstream: {
        kind: 'base64',
        data: 'data:application/octet-stream;base64,QUJDRA==',
      },
    };
    const inputB: ProgramBitstreamInput = {
      board: 'basys3',
      mode: 'sram',
      bitstream: {
        kind: 'base64',
        data: 'QUJDRA==',
      },
    };

    const artifactA = deriveProgramBitstreamArtifactId(inputA);
    const artifactB = deriveProgramBitstreamArtifactId(inputB);
    const runIdA = deriveProgramBitstreamRunId(inputA);
    const runIdB = deriveProgramBitstreamRunId(inputB);

    expect(artifactA).toBe(artifactB);
    expect(artifactA.startsWith('program-bitstream-')).toBe(true);
    expect(runIdA).not.toBe(runIdB);
    expect(runIdA.startsWith(`${artifactA}-run-`)).toBe(true);
    expect(runIdB.startsWith(`${artifactA}-run-`)).toBe(true);

    const payload = encodeProgramBitstreamRequestPayload(inputA);
    expect(payload.bitstream.data).toBe('QUJDRA==');
  });

  it('posts normalized payload to bridge after successful tool probe', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/toolchain/probe')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            schema_version: 'toolchain_probe_v1',
            ok: true,
            run_id: 'bridge-probe-0',
            tools: [{ name: 'openFPGALoader', ok: true, version: '0.12.0', path: 'openFPGALoader.exe' }],
            logs: [{ run_id: 'bridge-probe-0', ts: 0, step: 'probe', level: 'info', msg: 'probe ok' }],
          }),
        } as any;
      }
      if (url.endsWith('/api/toolchain/program-bitstream')) {
        const body = init?.body ? JSON.parse(String(init.body)) : null;
        return {
          ok: true,
          status: 202,
          json: async () => ({
            ok: true,
            runId: 'program-bitstream-bridge',
            artifactId: 'program-bitstream-artifact',
            state: 'running',
            nextOffset: 1,
            logs: [{ run_id: 'program-bitstream-bridge', ts: 0, step: 'program', level: 'info', msg: 'program ok' }],
            payloadEcho: body,
          }),
        } as any;
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock as any);

    const backend = getToolchainBackend('vivado');
    const input: ProgramBitstreamInput = {
      board: 'basys3',
      mode: 'sram',
      bitstream: {
        kind: 'base64',
        data: 'data:application/octet-stream;base64,QUJDRA==',
      },
    };

    const result = await backend.programBitstream(input);
    expect(result.ok).toBe(true);
    expect(result.runId).toBe('program-bitstream-bridge');
    expect(result.artifactId).toBe('program-bitstream-artifact');
    expect(result.state).toBe('running');
    expect(result.nextOffset).toBe(1);
    expect(result.logs[0]?.msg).toContain('program ok');

    const programCall = fetchMock.mock.calls.find((call) => String(call[0]).endsWith('/api/toolchain/program-bitstream'));
    expect(programCall).toBeTruthy();
    const payload = JSON.parse(String(programCall?.[1]?.body));
    expect(payload).toEqual({
      board: 'basys3',
      mode: 'sram',
      bitstream: { kind: 'base64', data: 'QUJDRA==' },
    });
  });

  it('handles BOARD_BUSY response with activeRunId', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/toolchain/probe')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            schema_version: 'toolchain_probe_v1',
            ok: true,
            run_id: 'bridge-probe-1',
            tools: [{ name: 'openFPGALoader', ok: true }],
            logs: [],
          }),
        } as any;
      }
      if (url.endsWith('/api/toolchain/program-bitstream')) {
        return {
          ok: false,
          status: 409,
          json: async () => ({
            ok: false,
            error: 'BOARD_BUSY',
            board: 'basys3',
            activeRunId: 'program-active-r0001',
            logs: [
              {
                run_id: 'program-active-r0001',
                ts: 0,
                step: 'program',
                level: 'warn',
                msg: 'Board busy: another run is active.',
              },
            ],
            nextOffset: 1,
          }),
        } as any;
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock as any);

    const backend = getToolchainBackend('vivado');
    const result = await backend.programBitstream({
      board: 'basys3',
      mode: 'sram',
      bitstream: { kind: 'base64', data: 'QUJDRA==' },
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('BOARD_BUSY');
    expect(result.activeRunId).toBe('program-active-r0001');
    expect(result.runId).toBe('program-active-r0001');
    expect(result.logs.map((entry) => entry.msg)).toEqual(['Board busy: another run is active.']);
  });

  it('returns incremental logs from getRunStatus offset polling', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/toolchain/runs/run-a?offset=0')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            runId: 'run-a',
            artifactId: 'artifact-a',
            state: 'running',
            ok: null,
            exitCode: null,
            logs: [{ run_id: 'run-a', ts: 0, step: 'program', level: 'info', msg: 'line-0' }],
            nextOffset: 1,
          }),
        } as any;
      }
      if (url.includes('/api/toolchain/runs/run-a?offset=1')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            runId: 'run-a',
            artifactId: 'artifact-a',
            state: 'done',
            ok: true,
            exitCode: 0,
            logs: [{ run_id: 'run-a', ts: 1, step: 'program', level: 'info', msg: 'line-1' }],
            nextOffset: 2,
          }),
        } as any;
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock as any);

    const backend = getToolchainBackend('vivado');
    const first = await backend.getRunStatus('run-a', 0);
    expect(first.state).toBe('running');
    expect(first.artifactId).toBe('artifact-a');
    expect(first.nextOffset).toBe(1);
    expect(first.logs.map((entry) => entry.msg)).toEqual(['line-0']);

    const second = await backend.getRunStatus('run-a', first.nextOffset);
    expect(second.state).toBe('done');
    expect(second.ok).toBe(true);
    expect(second.exitCode).toBe(0);
    expect(second.nextOffset).toBe(2);
    expect(second.logs.map((entry) => entry.msg)).toEqual(['line-1']);
  });

  it('posts cancel request and normalizes canceled run status', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/toolchain/runs/run-cancel/cancel')) {
        expect(init?.method).toBe('POST');
        return {
          ok: true,
          status: 200,
          json: async () => ({
            runId: 'run-cancel',
            artifactId: 'artifact-cancel',
            state: 'canceled',
            ok: false,
            exitCode: -1,
            logs: [{ run_id: 'run-cancel', ts: 7, step: 'program', level: 'warn', msg: 'Canceled by user' }],
            nextOffset: 8,
            error: 'canceled_by_user',
          }),
        } as any;
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock as any);

    const backend = getToolchainBackend('vivado');
    const result = await backend.cancelRun('run-cancel');
    expect(result.runId).toBe('run-cancel');
    expect(result.artifactId).toBe('artifact-cancel');
    expect(result.state).toBe('canceled');
    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(-1);
    expect(result.nextOffset).toBe(8);
    expect(result.logs.map((entry) => entry.msg)).toEqual(['Canceled by user']);
  });

  it('parses run stream log and done events', async () => {
    vi.stubGlobal('EventSource', FakeEventSource as any);
    const backend = getToolchainBackend('vivado');
    const onLog = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    const stream = backend.openRunStream(
      'run-stream',
      {
        onLog,
        onDone,
        onError,
      },
      { offset: 3 }
    );

    expect(stream).toBeTruthy();
    expect(FakeEventSource.instances[0]?.url).toContain('/api/toolchain/runs/run-stream/stream?offset=3');

    FakeEventSource.instances[0]?.emit('log', {
      run_id: 'run-stream',
      ts: 3,
      step: 'program',
      level: 'info',
      msg: 'line-3',
    });
    FakeEventSource.instances[0]?.emit('done', {
      runId: 'run-stream',
      artifactId: 'artifact-stream',
      state: 'canceled',
      ok: false,
      exitCode: -1,
      nextOffset: 4,
      error: 'canceled_by_user',
    });

    expect(onError).not.toHaveBeenCalled();
    expect(onLog).toHaveBeenCalledTimes(1);
    expect(onLog.mock.calls[0]?.[0]?.msg).toBe('line-3');
    expect(onDone).toHaveBeenCalledWith({
      runId: 'run-stream',
      artifactId: 'artifact-stream',
      state: 'canceled',
      ok: false,
      exitCode: -1,
      nextOffset: 4,
      error: 'canceled_by_user',
    });
  });
});
