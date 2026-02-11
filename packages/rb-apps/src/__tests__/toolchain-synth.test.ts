import { afterEach, describe, expect, it, vi } from 'vitest';
import { deriveSynthArtifactId, encodeSynthRequestPayload, getToolchainBackend } from '../fpga/toolchainBackend';
import type { SynthRequest } from '../fpga/toolchainTypes';

describe('toolchain synth', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('derives deterministic synth artifact ids and normalizes payload', () => {
    const input: SynthRequest = {
      board: 'basys3',
      top: ' top ',
      sources: [
        {
          path: '.\\src\\top.v',
          language: 'verilog',
          text: 'module top; endmodule',
        },
      ],
    };

    const artifactA = deriveSynthArtifactId(input, '0.47');
    const artifactB = deriveSynthArtifactId(input, '0.47');
    const artifactChanged = deriveSynthArtifactId(
      {
        ...input,
        sources: [{ path: 'src/top.v', language: 'verilog', text: 'module top; wire a; endmodule' }],
      },
      '0.47'
    );

    expect(artifactA).toBe(artifactB);
    expect(artifactA.startsWith('toolchain-synth-')).toBe(true);
    expect(artifactChanged).not.toBe(artifactA);

    const payload = encodeSynthRequestPayload(input);
    expect(payload).toEqual({
      board: 'basys3',
      top: 'top',
      sources: [{ path: 'src/top.v', language: 'verilog', text: 'module top; endmodule' }],
    });
  });

  it('posts synth request and parses run status response', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/toolchain/probe')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            schema_version: 'toolchain_probe_v1',
            ok: true,
            run_id: 'bridge-probe-synth',
            tools: [{ name: 'yosys', ok: true, version: '0.47', path: 'yosys' }],
            logs: [],
          }),
        } as any;
      }
      if (url.endsWith('/api/toolchain/synth')) {
        const body = init?.body ? JSON.parse(String(init.body)) : null;
        expect(body).toEqual({
          board: 'basys3',
          top: 'top',
          sources: [{ path: 'src/top.v', language: 'verilog', text: 'module top; endmodule' }],
        });
        return {
          ok: true,
          status: 202,
          json: async () => ({
            ok: null,
            runId: 'toolchain-synth-run',
            artifactId: 'toolchain-synth-artifact',
            state: 'running',
            exitCode: null,
            nextOffset: 1,
            logs: [{ run_id: 'toolchain-synth-run', ts: 0, step: 'synth', level: 'info', msg: 'synth started' }],
          }),
        } as any;
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock as any);

    const backend = getToolchainBackend('vivado');
    const result = await backend.synth({
      board: 'basys3',
      top: 'top',
      sources: [{ path: 'src/top.v', language: 'verilog', text: 'module top; endmodule' }],
    });
    expect(result.state).toBe('running');
    expect(result.ok).toBeNull();
    expect(result.runId).toBe('toolchain-synth-run');
    expect(result.artifactId).toBe('toolchain-synth-artifact');
    expect(result.nextOffset).toBe(1);
    expect(result.logs.map((entry) => entry.msg)).toEqual(['synth started']);
  });
});
