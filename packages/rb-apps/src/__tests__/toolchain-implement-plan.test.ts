import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createToolchainImplementPlan,
  getToolchainBackend,
  type ToolchainProjectSnapshotInput,
  type ToolProbeResult,
} from '../fpga/toolchainBackend';

describe('toolchain implement plan', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('requests bridge implement plan and normalizes deterministic ordering', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/toolchain/probe')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            schema_version: 'toolchain_probe_v1',
            ok: true,
            run_id: 'probe-implement-plan',
            env: { platform: 'linux', arch: 'x64', node: 'v20.0.0' },
            tools: [
              { name: 'nextpnr-xilinx', ok: true, version: 'nextpnr 0.4' },
              { name: 'yosys', ok: true, version: '0.47' },
            ],
            logs: [],
          }),
        } as any;
      }
      if (url.endsWith('/api/toolchain/implement/plan')) {
        const body = init?.body ? JSON.parse(String(init.body)) : null;
        expect(body?.schema_version).toBe('toolchain_implement_plan_request_v1');
        expect(body?.project?.fpga?.board).toBe('basys3');
        return {
          ok: true,
          status: 200,
          json: async () => ({
            schema_version: 'toolchain_implement_plan_v1',
            ok: true,
            run_id: 'bridge-implement-plan-run-1',
            planId: 'bridge-implement-plan-1',
            backend: 'nextpnr-xilinx',
            requiredTools: [
              { name: 'yosys', ok: true, version: '0.47', why: 'required for synthesis' },
              { name: 'nextpnr-xilinx', ok: true, version: '0.4', why: 'required for pnr' },
            ],
            commands: [
              { step: 'pnr', argv: ['nextpnr-xilinx', '--json', 'out/netlist.json'], envKeysUsed: ['PATH'] },
              { step: 'synth', argv: ['yosys', '-p', 'synth_xilinx -top top -family xc7'], envKeysUsed: ['PATH'] },
            ],
            outputs: [
              { name: 'bitstream', pathHint: 'out/design.bit' },
              { name: 'netlist-json', pathHint: 'out/netlist.json' },
            ],
            warnings: [
              {
                run_id: 'bridge-implement-plan-run-1',
                ts: 1,
                step: 'pnr',
                level: 'warn',
                msg: '[implement-plan] warning-b',
              },
              {
                run_id: 'bridge-implement-plan-run-1',
                ts: 0,
                step: 'pnr',
                level: 'warn',
                msg: '[implement-plan] warning-a',
              },
            ],
            logs: [
              {
                run_id: 'bridge-implement-plan-run-1',
                ts: 0,
                step: 'pnr',
                level: 'info',
                msg: '[vivado] implement-plan: selected backend nextpnr-xilinx',
              },
            ],
          }),
        } as any;
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock as any);

    const backend = getToolchainBackend('vivado');
    const snapshot: ToolchainProjectSnapshotInput = {
      hdl: {
        top: 'top',
        sources: [
          {
            path: 'src/top.v',
            language: 'verilog',
            text: 'module top(input wire clk, output wire led); assign led = clk; endmodule',
          },
        ],
      },
      fpga: {
        board: 'basys3',
        constraints: { type: 'xdc', text: 'set_property PACKAGE_PIN W5 [get_ports clk]' },
      },
    };

    const result = await backend.implementPlan(snapshot);

    expect(result.backend).toBe('nextpnr-xilinx');
    expect(result.ok).toBe(true);
    expect(result.requiredTools.map((tool) => tool.name)).toEqual(['nextpnr-xilinx', 'yosys']);
    expect(result.commands.map((command) => command.step)).toEqual(['pnr', 'synth']);
    expect(result.outputs.map((output) => output.name)).toEqual(['bitstream', 'netlist-json']);
    expect(result.warnings.map((entry) => entry.msg)).toEqual(['[implement-plan] warning-a', '[implement-plan] warning-b']);
  });

  it('resolves deterministic build path for identical project input', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/toolchain/implement/plan')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            schema_version: 'toolchain_implement_plan_v1',
            ok: true,
            run_id: 'bridge-implement-plan-run-resolve',
            planId: 'bridge-implement-plan-resolve',
            backend: 'nextpnr-xilinx',
            requiredTools: [
              { name: 'yosys', ok: true, version: '0.47', why: 'required for synthesis' },
              { name: 'nextpnr-xilinx', ok: true, version: '0.4', why: 'required for pnr' },
            ],
            commands: [
              { step: 'synth', argv: ['yosys', '-p', 'synth_xilinx -top top -family xc7'], envKeysUsed: ['PATH'] },
              { step: 'pnr', argv: ['nextpnr-xilinx', '--json', 'out/netlist.json'], envKeysUsed: ['PATH'] },
            ],
            outputs: [
              { name: 'netlist-json', pathHint: 'out/netlist.json' },
              { name: 'bitstream', pathHint: 'out/design.bit' },
            ],
            warnings: [],
            logs: [],
          }),
        } as any;
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock as any);

    const backend = getToolchainBackend('open');
    const snapshot: ToolchainProjectSnapshotInput = {
      hdl: {
        top: 'top',
        sources: [{ path: 'src/top.v', language: 'verilog', text: 'module top; endmodule' }],
      },
      fpga: {
        board: 'basys3',
        constraints: { type: 'xdc', text: 'set_property PACKAGE_PIN W5 [get_ports clk]' },
        preset: 'basys3-minimal-leds',
      },
    };

    const first = await backend.resolveBuildPath(snapshot);
    const second = await backend.resolveBuildPath(snapshot);

    expect(first.planId).toBe(second.planId);
    expect(first.backend).toBe('nextpnr-xilinx');
    expect(first.constraintsPreset).toBe('basys3-minimal-leds');
    expect(first.requiredTools.map((tool) => tool.name)).toEqual(['nextpnr-xilinx', 'yosys']);
    expect(second.commands.map((command) => command.step)).toEqual(['pnr', 'synth']);
  });

  it('prefers buildpack-open when verified buildpack tools are available', () => {
    const snapshot: ToolchainProjectSnapshotInput = {
      hdl: {
        top: 'top',
        sources: [{ path: 'src/top.v', language: 'verilog', text: 'module top; endmodule' }],
      },
      fpga: {
        board: 'basys3',
        constraints: { type: 'xdc', text: 'set_property PACKAGE_PIN W5 [get_ports clk]' },
      },
    };
    const probe: ToolProbeResult = {
      schema_version: 'toolchain_probe_v1',
      ok: true,
      run_id: 'probe-buildpack-ready',
      env: { platform: 'linux', arch: 'x64', node: 'v20.0.0' },
      tools: [
        {
          name: 'yosys',
          ok: true,
          status: 'ok',
          source: 'bundled',
          integrity: 'verified',
          version: '0.47',
        },
        {
          name: 'f4pga',
          ok: true,
          status: 'ok',
          source: 'buildpack',
          integrity: 'verified',
          version: '1.0',
          path: 'C:/redbyte/buildpacks/basys3-open/bin/f4pga.exe',
          buildpackName: 'basys3-open',
          buildpackVersion: '0.1.0',
        },
        { name: 'vivado', ok: true, status: 'ok', source: 'system', integrity: 'unknown', version: '2024.1' },
      ],
      logs: [],
    };

    const plan = createToolchainImplementPlan({
      backend_id: 'open',
      snapshot,
      probe,
    });

    expect(plan.backend).toBe('buildpack-open');
    expect(plan.buildpack).toEqual({ name: 'basys3-open', version: '0.1.0' });
    const synthCommand = plan.commands.find((command) => command.step === 'synth');
    expect(synthCommand?.argv[0]).toBe('C:/redbyte/buildpacks/basys3-open/bin/f4pga.exe');
    expect(plan.outputs.find((output) => output.name === 'bitstream')?.pathHint).toBe('out/top.bit');
  });

  it('ignores corrupt buildpack and falls back to vivado when available', () => {
    const snapshot: ToolchainProjectSnapshotInput = {
      hdl: {
        top: 'top',
        sources: [{ path: 'src/top.v', language: 'verilog', text: 'module top; endmodule' }],
      },
      fpga: {
        board: 'basys3',
        constraints: { type: 'xdc', text: 'set_property PACKAGE_PIN W5 [get_ports clk]' },
      },
    };
    const probe: ToolProbeResult = {
      schema_version: 'toolchain_probe_v1',
      ok: true,
      run_id: 'probe-buildpack-corrupt',
      env: { platform: 'linux', arch: 'x64', node: 'v20.0.0' },
      tools: [
        {
          name: 'yosys',
          ok: true,
          status: 'ok',
          source: 'buildpack',
          integrity: 'verified',
          version: '0.47',
          buildpackName: 'basys3-open',
          buildpackVersion: '0.1.0',
        },
        {
          name: 'f4pga',
          ok: true,
          status: 'ok',
          source: 'buildpack',
          integrity: 'corrupt',
          version: '1.0',
          buildpackName: 'basys3-open',
          buildpackVersion: '0.1.0',
        },
        { name: 'vivado', ok: true, status: 'ok', source: 'system', integrity: 'unknown', version: '2024.1' },
      ],
      logs: [],
    };

    const plan = createToolchainImplementPlan({
      backend_id: 'open',
      snapshot,
      probe,
    });

    expect(plan.backend).toBe('vivado-fallback');
    expect(plan.buildpack).toBeUndefined();
  });
});
