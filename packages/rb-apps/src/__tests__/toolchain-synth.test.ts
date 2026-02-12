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
      if (url.endsWith('/api/toolchain/implement/plan')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            schema_version: 'toolchain_implement_plan_v1',
            ok: true,
            run_id: 'implement-plan-0',
            planId: 'plan-0',
            backend: 'nextpnr-xilinx',
            requiredTools: [
              { name: 'yosys', ok: true, version: '0.47', why: 'required for synthesis' },
              { name: 'nextpnr-xilinx', ok: true, version: '0.4', why: 'required for pnr' },
            ],
            commands: [{ step: 'synth', argv: ['yosys', '-p', 'synth_xilinx -top top -family xc7'], envKeysUsed: ['PATH'] }],
            outputs: [{ name: 'netlist-json', pathHint: 'out/netlist.json' }],
            warnings: [],
            logs: [],
          }),
        } as any;
      }
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
        expect(body).toMatchObject({
          board: 'basys3',
          top: 'top',
          sources: [{ path: 'src/top.v', language: 'verilog', text: 'module top; endmodule' }],
          buildPath: {
            backend: 'nextpnr-xilinx',
          },
        });
        expect(typeof body?.buildPath?.planId).toBe('string');
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
            artifact: {
              artifactId: 'toolchain-synth-artifact',
              board: 'basys3',
              top: 'top',
              scriptVersion: 'rb_yosys_synth_v1',
              buildPath: { planId: 'plan-0', backend: 'nextpnr-xilinx' },
              outputs: { netlistVerilog: 'out/netlist.v', statText: 'out/stat.txt' },
            },
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
    expect(result.artifact?.buildPath?.backend).toBe('nextpnr-xilinx');
    expect(typeof result.artifact?.buildPath?.planId).toBe('string');
  });

  it('downloads synth artifacts zip from bridge endpoint', async () => {
    const zipBytes = Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x01, 0x02]);
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/toolchain/synth/runs/synth-run-1/artifacts.zip')) {
        return {
          ok: true,
          status: 200,
          headers: {
            get(name: string) {
              if (name.toLowerCase() === 'content-disposition') {
                return 'attachment; filename="rb-synth-toolchain-synth-artifact-1.zip"';
              }
              return null;
            },
          },
          arrayBuffer: async () => zipBytes.buffer,
        } as any;
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock as any);

    const backend = getToolchainBackend('vivado');
    const result = await backend.downloadSynthArtifacts('synth-run-1');
    expect(result.filename).toBe('rb-synth-toolchain-synth-artifact-1.zip');
    expect(Array.from(result.bytes)).toEqual(Array.from(zipBytes));
  });

  it('passes includeSources=1 when requested', async () => {
    const zipBytes = Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x01, 0x02]);
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/toolchain/synth/runs/synth-run-2/artifacts.zip?includeSources=1')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          arrayBuffer: async () => zipBytes.buffer,
        } as any;
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock as any);

    const backend = getToolchainBackend('vivado');
    const result = await backend.downloadSynthArtifacts('synth-run-2', { includeSources: true });
    expect(result.filename).toBe('rb-synth-synth-run-2.zip');
    expect(Array.from(result.bytes)).toEqual(Array.from(zipBytes));
  });
});
