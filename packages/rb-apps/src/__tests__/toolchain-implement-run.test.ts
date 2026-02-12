import { afterEach, describe, expect, it, vi } from 'vitest';
import { getToolchainBackend } from '../fpga/toolchainBackend';
import type { ImplementRunRequest } from '../fpga/toolchainTypes';

function createImplementInput(): ImplementRunRequest {
  return {
    board: 'basys3',
    project: {
      hdl: {
        sources: [{ path: 'src/top.v', language: 'verilog', text: 'module top(input wire clk, output wire led); assign led = clk; endmodule' }],
        top: 'top',
      },
      fpga: {
        board: 'basys3',
        constraints: { type: 'xdc', text: 'set_property PACKAGE_PIN W5 [get_ports clk]' },
        preset: 'basys3-minimal-leds',
        top: 'top',
      },
    },
    buildPath: {
      planId: 'build-path-1',
      backend: 'nextpnr-xilinx',
    },
  };
}

describe('toolchain implement run', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('derives deterministic implement run identity when bridge is unavailable', async () => {
    vi.stubGlobal('fetch', undefined as any);

    const backend = getToolchainBackend('vivado');
    const input = createImplementInput();
    const first = await backend.implementRun(input);
    const second = await backend.implementRun(input);

    expect(first.state).toBe('error');
    expect(second.state).toBe('error');
    expect(first.error).toBe('fetch_unavailable');
    expect(second.error).toBe('fetch_unavailable');
    expect(first.runId).toBe(second.runId);
    expect(first.artifactId).toBe(second.artifactId);
    expect(first.runId.startsWith('vivado-implement-run-')).toBe(true);
    expect(first.artifactId.startsWith('vivado-implement-artifact-')).toBe(true);
  });

  it('posts implement run payload and normalizes running response', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/toolchain/implement/plan')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            schema_version: 'toolchain_implement_plan_v1',
            ok: true,
            run_id: 'plan-run-1',
            planId: 'plan-1',
            backend: 'nextpnr-xilinx',
            requiredTools: [
              { name: 'yosys', ok: true, version: '0.47', why: 'required for synthesis' },
              { name: 'nextpnr-xilinx', ok: true, version: '0.4', why: 'required for pnr' },
            ],
            commands: [
              { step: 'synth', argv: ['yosys', '-p', 'read_verilog -sv src/top.v; synth_xilinx -top top -family xc7'], envKeysUsed: ['PATH'] },
              { step: 'pnr', argv: ['nextpnr-xilinx', '--json', 'out/netlist.json'], envKeysUsed: ['PATH'] },
              { step: 'bitgen', argv: ['python', '-m', 'f4pga.utils.xc7.bitgen'], envKeysUsed: ['PATH'] },
            ],
            outputs: [{ name: 'bitstream', pathHint: 'out/design.bit' }],
            warnings: [],
            logs: [],
          }),
        } as any;
      }
      if (url.endsWith('/api/toolchain/implement/run')) {
        return {
          ok: true,
          status: 202,
          json: async () => ({
            runId: 'toolchain-implement-run-1',
            artifactId: 'toolchain-implement-artifact-1',
            state: 'running',
            ok: null,
            exitCode: null,
            nextOffset: 1,
            logs: [{ run_id: 'toolchain-implement-run-1', ts: 0, step: 'implement', level: 'info', msg: 'implement started' }],
            artifact: {
              artifactId: 'toolchain-implement-artifact-1',
              board: 'basys3',
              top: 'top',
              planId: 'plan-1',
              backend: 'nextpnr-xilinx',
              constraintsHash: 'implement-xdc-a1b2c3d4',
              commands: [],
              requiredTools: [],
              sources: [],
              outputs: [],
            },
          }),
        } as any;
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock as any);

    const backend = getToolchainBackend('vivado');
    const input = createImplementInput();
    input.project.hdl.sources = [
      {
        path: 'src/top_nextpnr.v',
        language: 'verilog',
        text: 'module top(input wire clk, output wire led); assign led = clk; endmodule',
      },
    ];
    input.project.fpga.preset = 'plan-test';
    const result = await backend.implementRun(input);
    expect(result.state).toBe('running');
    expect(result.ok).toBeNull();
    expect(result.runId).toBe('toolchain-implement-run-1');
    expect(result.artifactId).toBe('toolchain-implement-artifact-1');
    expect(result.nextOffset).toBe(1);
    expect(result.logs.map((entry) => entry.msg)).toEqual(['implement started']);

    const implementCall = fetchMock.mock.calls.find((call) =>
      String(call[0]).endsWith('/api/toolchain/implement/run')
    );
    expect(implementCall).toBeTruthy();
    const payload = JSON.parse(String(implementCall?.[1]?.body ?? '{}'));
    expect(payload.board).toBe('basys3');
    expect(payload.buildPath?.backend).toBe('nextpnr-xilinx');
    expect(typeof payload.buildPath?.planId).toBe('string');
    expect(Array.isArray(payload.buildPath?.commands)).toBe(true);
    expect(Array.isArray(payload.buildPath?.outputs)).toBe(true);
    expect(Array.isArray(payload.buildPath?.requiredTools)).toBe(true);
  });

  it('downloads implement artifact zip from bridge endpoint with includeSources support', async () => {
    const zipBytes = Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/toolchain/implement/runs/run-impl-1/artifacts.zip?includeSources=1')) {
        return {
          ok: true,
          status: 200,
          headers: {
            get(name: string) {
              if (name.toLowerCase() === 'content-disposition') {
                return 'attachment; filename="rb-implement-toolchain-implement-artifact-1.zip"';
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
    const result = await backend.downloadImplementArtifacts('run-impl-1', { includeSources: true });
    expect(result.filename).toBe('rb-implement-toolchain-implement-artifact-1.zip');
    expect(Array.from(result.bytes)).toEqual(Array.from(zipBytes));
  });

  it('fetches generated implement bitstream bytes from bridge endpoint', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/toolchain/implement/runs/run-impl-bit/output/bitstream')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            schema_version: 'toolchain_implement_output_bitstream_v1',
            ok: true,
            runId: 'run-impl-bit',
            artifactId: 'artifact-impl-bit',
            filename: 'out/top.bit',
            bitstream: { kind: 'base64', data: 'AQID' },
            output: { kind: 'bitstream', name: 'bitstream' },
          }),
        } as any;
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock as any);

    const backend = getToolchainBackend('vivado');
    const result = await backend.getImplementBitstream('run-impl-bit');
    expect(result.runId).toBe('run-impl-bit');
    expect(result.artifactId).toBe('artifact-impl-bit');
    expect(result.filename).toBe('out/top.bit');
    expect(result.bitstream.kind).toBe('base64');
    expect(result.bitstream.data).toBe('AQID');
  });

  it('programs implement-generated bitstream through existing program pipeline', async () => {
    const programBodies: any[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/toolchain/implement/runs/run-impl-program/output/bitstream')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            schema_version: 'toolchain_implement_output_bitstream_v1',
            ok: true,
            runId: 'run-impl-program',
            artifactId: 'artifact-impl-program',
            filename: 'out/top.bit',
            bitstream: { kind: 'base64', data: 'AQID' },
            output: { kind: 'bitstream', name: 'bitstream' },
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
            run_id: 'probe-program-impl',
            tools: [{ name: 'openFPGALoader', ok: true, version: '0.12.0', path: 'openFPGALoader' }],
            logs: [],
          }),
        } as any;
      }
      if (url.endsWith('/api/toolchain/program-bitstream')) {
        programBodies.push(init?.body ? JSON.parse(String(init.body)) : null);
        return {
          ok: true,
          status: 202,
          json: async () => ({
            ok: true,
            runId: 'program-run-1',
            artifactId: 'program-artifact-1',
            state: 'done',
            exitCode: 0,
            nextOffset: 1,
            logs: [{ run_id: 'program-run-1', ts: 0, step: 'program', level: 'info', msg: 'program done' }],
          }),
        } as any;
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock as any);

    const backend = getToolchainBackend('vivado');
    const result = await backend.programImplementBitstream('run-impl-program');
    expect(result.runId).toBe('program-run-1');
    expect(result.ok).toBe(true);
    expect(programBodies).toHaveLength(1);
    expect(programBodies[0]?.bitstream?.data).toBe('AQID');
    expect(programBodies[0]?.board).toBe('basys3');
  });
});
