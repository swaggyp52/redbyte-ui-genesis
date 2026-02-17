import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HdlEditorPanel } from '../components/HdlEditorPanel';
import type { ToolchainProjectInput } from '../fpga/toolchainBackend';
import { getBasys3XdcPresetText } from '../fpga/boards/basys3/presets';
import type { RBFpgaConfig } from '../export/projectFormat';

function StatefulHdlPanel(props: {
  initialProject: ToolchainProjectInput;
  initialFpga?: RBFpgaConfig;
  backendId?: 'vivado' | 'open';
}) {
  const [project, setProject] = React.useState<ToolchainProjectInput>(props.initialProject);
  const [fpga, setFpga] = React.useState<RBFpgaConfig | undefined>(props.initialFpga);
  return (
    <HdlEditorPanel
      project={project}
      onProjectChange={setProject}
      fpga={fpga}
      onFpgaChange={setFpga}
      backendId={props.backendId ?? 'vivado'}
    />
  );
}

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

describe('HdlEditorPanel', () => {
  afterEach(() => {
    FakeEventSource.instances = [];
    vi.unstubAllGlobals();
  });

  it('runs a stub build and emits backend logs', async () => {
    const project: ToolchainProjectInput = {
      sources: [
        {
          path: 'top.v',
          language: 'verilog',
          text: [
            'module top(',
            '  input wire clk,',
            '  input wire [15:0] sw,',
            '  input wire [4:0] btn,',
            '  output wire [15:0] led,',
            '  output wire [6:0] seg,',
            '  output wire [3:0] an,',
            '  output wire dp',
            ');',
            'assign led = sw;',
            "assign seg = 7'b1111111;",
            "assign an = 4'b1111;",
            "assign dp = 1'b1;",
            'endmodule',
            '',
          ].join('\n'),
        },
      ],
      top: 'top',
    };

    render(
      <div style={{ height: 600 }}>
        <HdlEditorPanel
          project={project}
          onProjectChange={vi.fn()}
          fpga={{
            board: 'basys3',
            constraints: {
              type: 'xdc',
              text: getBasys3XdcPresetText('basys3-switches-leds-7seg'),
            },
          }}
          backendId="vivado"
        />
      </div>
    );

    await userEvent.click(screen.getByTestId('hdl-build-button'));

    await waitFor(() => {
      expect(screen.getByTestId('hdl-build-logs')).toHaveTextContent('[vivado] synthesize: not implemented');
      expect(screen.getByTestId('hdl-build-logs')).toHaveTextContent('[vivado] implement: not implemented');
      expect(screen.getByTestId('hdl-build-logs')).toHaveTextContent('[vivado] bitgen: not implemented');
    });
  });

  it('probes the local toolchain via the bridge and renders results', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        schema_version: 'toolchain_probe_v1',
        ok: true,
        run_id: 'bridge-probe-0',
        env: { platform: 'win32', arch: 'x64', node: 'v20.0.0' },
        tools: [
          { name: 'openFPGALoader', ok: true, version: '0.12.0', path: 'openFPGALoader.exe' },
          { name: 'yosys', ok: false, error: 'not_found' },
        ],
        logs: [
          { run_id: 'bridge-probe-0', ts: 0, step: 'probe', level: 'info', msg: '[bridge] probe: starting' },
          { run_id: 'bridge-probe-0', ts: 1, step: 'probe', level: 'info', msg: '[bridge] probe: openFPGALoader: ok (0.12.0)' },
          { run_id: 'bridge-probe-0', ts: 2, step: 'probe', level: 'warn', msg: '[bridge] probe: yosys: missing (not_found)' },
          { run_id: 'bridge-probe-0', ts: 3, step: 'probe', level: 'info', msg: '[bridge] probe: complete' },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock as any);

    const project: ToolchainProjectInput = { sources: [] };

    render(
      <div style={{ height: 600 }}>
        <HdlEditorPanel project={project} onProjectChange={vi.fn()} backendId="vivado" />
      </div>
    );

    expect(screen.getByTestId('hdl-export-report-button')).toBeDisabled();

    await userEvent.click(screen.getByTestId('hdl-probe-button'));

    await waitFor(() => {
      expect(screen.getByTestId('hdl-build-logs')).toHaveTextContent('[bridge] probe: openFPGALoader: ok');
      expect(screen.getByTestId('hdl-build-logs')).toHaveTextContent('[bridge] probe: yosys: missing');
      expect(screen.getByTestId('hdl-build-logs')).toHaveTextContent('[bridge] probe: complete');
    });

    expect(screen.getByTestId('hdl-export-report-button')).toBeEnabled();
  });

  it('renders deterministic Vivado handoff command and TCL preview', async () => {
    render(
      <div style={{ height: 700 }}>
        <HdlEditorPanel
          project={{
            sources: [
              {
                path: 'top.vhd',
                language: 'vhdl',
                text: [
                  'library IEEE;',
                  'use IEEE.STD_LOGIC_1164.ALL;',
                  'entity top is',
                  '  Port ( led : out STD_LOGIC );',
                  'end entity top;',
                  'architecture rtl of top is begin led <= \"1\"; end architecture rtl;',
                ].join('\n'),
              },
            ],
            top: 'top',
          }}
          onProjectChange={vi.fn()}
          fpga={{
            board: 'basys3',
            constraints: { type: 'xdc', text: getBasys3XdcPresetText('basys3-minimal-leds') },
          }}
          backendId="vivado"
        />
      </div>
    );

    expect(screen.getByTestId('hdl-vivado-command-input')).toHaveValue('vivado');
    expect(screen.getByTestId('hdl-vivado-command-preview')).toHaveTextContent(
      'vivado -mode batch -source synth_check.tcl -notrace -nojournal -log vivado_out/vivado.log'
    );
    expect(screen.getByTestId('hdl-vivado-tcl-preview')).toHaveTextContent('create_project -force $project_name $project_dir -part $part');
    expect(screen.getByTestId('hdl-vivado-tcl-preview')).toHaveTextContent('set_property file_type {VHDL 2008}');
    expect(screen.getByTestId('hdl-vivado-tcl-preview')).toHaveTextContent('report_utilization -file "$report_dir/utilization.rpt"');
  });

  it('prefills Vivado command from detected probe path', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        schema_version: 'toolchain_probe_v1',
        ok: true,
        run_id: 'bridge-probe-vivado-path',
        env: { platform: 'win32', arch: 'x64', node: 'v20.0.0' },
        tools: [
          {
            name: 'vivado',
            ok: true,
            status: 'ok',
            source: 'system',
            path: 'C:/Xilinx/Vivado/2024.2/bin/vivado.bat',
            version: '2024.2',
          },
        ],
        logs: [
          {
            run_id: 'bridge-probe-vivado-path',
            ts: 0,
            step: 'probe',
            level: 'info',
            msg: '[bridge] probe: vivado: ok (2024.2)',
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock as any);

    render(
      <div style={{ height: 700 }}>
        <HdlEditorPanel
          project={{ sources: [{ path: 'top.vhd', language: 'vhdl', text: 'entity top is end entity;' }], top: 'top' }}
          onProjectChange={vi.fn()}
          backendId="vivado"
        />
      </div>
    );

    await userEvent.click(screen.getByTestId('hdl-probe-button'));

    await waitFor(() => {
      expect(screen.getByTestId('hdl-vivado-command-input')).toHaveValue('C:/Xilinx/Vivado/2024.2/bin/vivado.bat');
      expect(screen.getByTestId('hdl-vivado-command-preview')).toHaveTextContent(
        'C:/Xilinx/Vivado/2024.2/bin/vivado.bat -mode batch -source synth_check.tcl'
      );
    });
  });

  it('renders probe errors when the bridge is unreachable', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('bridge_unreachable'));
    vi.stubGlobal('fetch', fetchMock as any);

    const project: ToolchainProjectInput = { sources: [] };

    render(
      <div style={{ height: 600 }}>
        <HdlEditorPanel project={project} onProjectChange={vi.fn()} backendId="vivado" />
      </div>
    );

    await userEvent.click(screen.getByTestId('hdl-probe-button'));

    await waitFor(() => {
      expect(screen.getByTestId('hdl-build-logs')).toHaveTextContent('[vivado] probe: failed');
    });
  });

  it('applies a Basys 3 XDC preset into project.fpga.constraints', async () => {
    const onFpgaChange = vi.fn();

    const project: ToolchainProjectInput = { sources: [] };

    render(
      <div style={{ height: 600 }}>
        <HdlEditorPanel
          project={project}
          onProjectChange={vi.fn()}
          fpga={{ board: 'basys3' }}
          onFpgaChange={onFpgaChange}
          backendId="vivado"
        />
      </div>
    );

    await userEvent.selectOptions(screen.getByTestId('hdl-xdc-preset-select'), 'basys3-minimal-leds');

    await waitFor(() => {
      expect(screen.getByTestId('hdl-xdc-apply-preset-button')).toBeEnabled();
    });

    await userEvent.click(screen.getByTestId('hdl-xdc-apply-preset-button'));

    const expectedText = getBasys3XdcPresetText('basys3-minimal-leds');
    expect(onFpgaChange).toHaveBeenCalledWith({
      board: 'basys3',
      preset: 'basys3-minimal-leds',
      constraints: { type: 'xdc', text: expectedText },
    });
  });

  it('renders implementation dry-run plan from backend endpoint', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/toolchain/preflight')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            schema_version: 'toolchain_preflight_v1',
            run_id: 'preflight-plan',
            ts: 0,
            project: {
              board: 'basys3',
              hasHdl: true,
              top: 'top',
              hasXdc: true,
              preset: 'basys3-minimal-leds',
            },
            lint: { ok: true, warnings: [], errors: [] },
            tools: [{ name: 'yosys', ok: true, version: '0.47' }],
            overallOk: true,
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
            run_id: 'probe-plan',
            env: { platform: 'linux', arch: 'x64', node: 'v20.0.0' },
            tools: [
              { name: 'yosys', ok: true, version: '0.47', path: 'yosys' },
              { name: 'nextpnr-xilinx', ok: true, version: 'nextpnr 0.4', path: 'nextpnr-xilinx' },
            ],
            logs: [],
          }),
        } as any;
      }
      if (url.endsWith('/api/toolchain/implement/plan')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            schema_version: 'toolchain_implement_plan_v1',
            ok: true,
            run_id: 'bridge-plan-run',
            planId: 'bridge-plan-id',
            backend: 'nextpnr-xilinx',
            requiredTools: [
              { name: 'yosys', ok: true, version: '0.47', why: 'required for synthesis' },
              { name: 'nextpnr-xilinx', ok: true, version: '0.4', why: 'required for pnr' },
            ],
            commands: [
              { step: 'synth', argv: ['yosys', '-p', 'synth_xilinx -top top -family xc7'], envKeysUsed: ['PATH'] },
              { step: 'pnr', argv: ['nextpnr-xilinx', '--json', 'out/netlist.json'], envKeysUsed: ['PATH'] },
            ],
            outputs: [{ name: 'bitstream', pathHint: 'out/design.bit' }],
            warnings: [],
            logs: [
              {
                run_id: 'bridge-plan-run',
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

    render(
      <div style={{ height: 700 }}>
        <StatefulHdlPanel
          initialProject={{
            sources: [{ path: 'top.v', language: 'verilog', text: 'module top(input wire clk, output wire led); assign led = clk; endmodule' }],
            top: 'top',
          }}
          initialFpga={{
            board: 'basys3',
            preset: 'basys3-minimal-leds',
            constraints: { type: 'xdc', text: getBasys3XdcPresetText('basys3-minimal-leds') },
          }}
        />
      </div>
    );

    await userEvent.click(screen.getByTestId('hdl-implement-plan-button'));

    await waitFor(() => {
      expect(screen.getByTestId('hdl-implement-plan-summary')).toHaveTextContent('nextpnr-xilinx');
      expect(screen.getByTestId('hdl-implement-plan-commands')).toHaveTextContent('synth: yosys -p');
      expect(screen.getByTestId('hdl-build-logs')).toHaveTextContent('[vivado] build-path: selected nextpnr-xilinx');
      expect(screen.getByTestId('hdl-build-path-status')).toHaveTextContent('nextpnr-xilinx');
    });
  });

  it('applies example + switches preset and emits no lint warnings on build', async () => {
    render(
      <div style={{ height: 700 }}>
        <StatefulHdlPanel initialProject={{ sources: [] }} initialFpga={{ board: 'basys3' }} />
      </div>
    );

    await userEvent.click(screen.getByTestId('hdl-example-basys3-switches-to-leds'));
    expect(screen.getByTestId('hdl-top-input')).toHaveValue('top');
    await userEvent.selectOptions(screen.getByTestId('hdl-xdc-preset-select'), 'basys3-switches-leds-7seg');
    await userEvent.click(screen.getByTestId('hdl-xdc-apply-preset-button'));
    await userEvent.click(screen.getByTestId('hdl-build-button'));

    await waitFor(() => {
      expect(screen.getByTestId('hdl-build-logs')).toHaveTextContent('[vivado] synthesize: not implemented');
    });

    expect(screen.getByTestId('hdl-build-logs').textContent ?? '').not.toContain('[preflight] lint:');
    expect(screen.getByTestId('hdl-readiness-ports')).toHaveTextContent('preflight lint ok');
  });

  it('golden demo applies switches preset/example and starts implement run', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/toolchain/preflight')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            schema_version: 'toolchain_preflight_v1',
            run_id: 'preflight-golden-demo',
            ts: 0,
            project: {
              board: 'basys3',
              hasHdl: true,
              top: 'top',
              hasXdc: true,
              preset: 'basys3-switches-leds-7seg',
            },
            lint: { ok: true, warnings: [], errors: [] },
            tools: [{ name: 'yosys', ok: true, version: '0.47' }],
            overallOk: true,
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
            run_id: 'probe-golden-demo',
            tools: [{ name: 'yosys', ok: true, version: '0.47', path: 'yosys' }],
            logs: [],
          }),
        } as any;
      }
      if (url.endsWith('/api/toolchain/implement/plan')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            schema_version: 'toolchain_implement_plan_v1',
            ok: true,
            run_id: 'plan-golden-demo',
            planId: 'plan-golden-demo',
            backend: 'nextpnr-xilinx',
            requiredTools: [{ name: 'yosys', ok: true, version: '0.47', why: 'required for synthesis' }],
            commands: [{ step: 'pnr', argv: ['nextpnr-xilinx', '--json', 'out/netlist.json'], envKeysUsed: ['PATH'] }],
            outputs: [{ name: 'bitstream', pathHint: 'out/top.bit' }],
            warnings: [],
            logs: [],
          }),
        } as any;
      }
      if (url.endsWith('/api/toolchain/implement/run')) {
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        expect(body.project?.hdl?.top).toBe('top');
        expect(body.project?.hdl?.sources?.[0]?.path).toBe('top.v');
        expect(String(body.project?.hdl?.sources?.[0]?.text ?? '')).toContain('assign led = sw;');
        expect(body.project?.fpga?.preset).toBe('basys3-switches-leds-7seg');
        expect(body.project?.fpga?.constraints?.text).toBe(getBasys3XdcPresetText('basys3-switches-leds-7seg'));
        return {
          ok: true,
          status: 202,
          json: async () => ({
            runId: 'toolchain-implement-run-golden-demo',
            artifactId: 'toolchain-implement-artifact-golden-demo',
            state: 'done',
            ok: true,
            exitCode: 0,
            nextOffset: 1,
            logs: [{ run_id: 'toolchain-implement-run-golden-demo', ts: 0, step: 'implement', level: 'info', msg: 'implement done' }],
            artifact: {
              artifactId: 'toolchain-implement-artifact-golden-demo',
              board: 'basys3',
              top: 'top',
              planId: 'plan-golden-demo',
              backend: 'nextpnr-xilinx',
              constraintsHash: 'implement-xdc-golden-demo',
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

    render(
      <div style={{ height: 700 }}>
        <StatefulHdlPanel initialProject={{ sources: [] }} initialFpga={{ board: 'basys3' }} />
      </div>
    );

    await userEvent.click(screen.getByTestId('hdl-golden-demo-button'));

    await waitFor(() => {
      expect(screen.getByTestId('hdl-top-input')).toHaveValue('top');
      expect((screen.getByTestId('hdl-editor-textarea') as HTMLTextAreaElement).value).toContain('assign led = sw;');
      expect((screen.getByTestId('hdl-xdc-textarea') as HTMLTextAreaElement).value).toBe(
        getBasys3XdcPresetText('basys3-switches-leds-7seg')
      );
      expect(screen.getByTestId('hdl-implement-status')).toHaveTextContent('success');
    });
  });

  it('blocks stub build when preflight finds errors', async () => {
    const mismatchProject: ToolchainProjectInput = {
      sources: [
        {
          path: 'top.v',
          language: 'verilog',
          text: ['module top(input wire clk, output wire led);', '  assign led = clk;', 'endmodule', ''].join('\n'),
        },
      ],
      top: 'top',
    };

    const mismatchFpga: RBFpgaConfig = {
      board: 'basys3',
      constraints: {
        type: 'xdc',
        text: ['set_property -dict { PACKAGE_PIN W5 IOSTANDARD LVCMOS33 } [get_ports clk]', 'set_property -dict { PACKAGE_PIN V7 IOSTANDARD LVCMOS33 } [get_ports {ghost}]', ''].join('\n'),
      },
    };

    render(
      <div style={{ height: 700 }}>
        <StatefulHdlPanel initialProject={mismatchProject} initialFpga={mismatchFpga} />
      </div>
    );

    await userEvent.click(screen.getByTestId('hdl-build-button'));

    await waitFor(() => {
      expect(screen.getByTestId('hdl-build-logs')).toHaveTextContent('[preflight] lint: xdc_missing_in_hdl');
      expect(screen.getByTestId('hdl-build-logs')).toHaveTextContent('ghost');
      expect(screen.getByTestId('hdl-build-logs')).toHaveTextContent('[vivado] build: blocked by preflight');
    });

    expect(screen.getByTestId('hdl-build-logs').textContent ?? '').not.toContain('[vivado] synthesize: not implemented');
  });

  it('blocks synth run when preflight finds errors', async () => {
    const mismatchProject: ToolchainProjectInput = {
      sources: [
        {
          path: 'top.v',
          language: 'verilog',
          text: ['module top(input wire clk, output wire led);', '  assign led = clk;', 'endmodule', ''].join('\n'),
        },
      ],
      top: 'top',
    };

    const mismatchFpga: RBFpgaConfig = {
      board: 'basys3',
      constraints: {
        type: 'xdc',
        text: ['set_property -dict { PACKAGE_PIN W5 IOSTANDARD LVCMOS33 } [get_ports clk]', 'set_property -dict { PACKAGE_PIN V7 IOSTANDARD LVCMOS33 } [get_ports {ghost}]', ''].join('\n'),
      },
    };

    render(
      <div style={{ height: 700 }}>
        <StatefulHdlPanel initialProject={mismatchProject} initialFpga={mismatchFpga} />
      </div>
    );

    await userEvent.click(screen.getByTestId('hdl-synth-button'));

    await waitFor(() => {
      expect(screen.getByTestId('hdl-build-logs')).toHaveTextContent('[preflight] lint: xdc_missing_in_hdl');
      expect(screen.getByTestId('hdl-build-logs')).toHaveTextContent('[vivado] synth: blocked by preflight');
    });

    expect(screen.getByTestId('hdl-synth-status')).toHaveTextContent('failed');
  });

  it('runs synth and streams logs when preflight passes', async () => {
    const createdObjectUrls: string[] = [];
    let downloadedFileName: string | null = null;
    const synthArtifactUrls: string[] = [];
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => {
        const value = `blob:rb-${createdObjectUrls.length + 1}`;
        createdObjectUrls.push(value);
        return value;
      }),
      revokeObjectURL: vi.fn(),
    } as any);
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      downloadedFileName = this.download;
    });

    vi.stubGlobal('EventSource', FakeEventSource as any);
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/toolchain/preflight')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            schema_version: 'toolchain_preflight_v1',
            run_id: 'preflight-ok',
            ts: 0,
            project: {
              board: 'basys3',
              hasHdl: true,
              top: 'top',
              hasXdc: true,
              preset: 'basys3-switches-leds-7seg',
            },
            lint: { ok: true, warnings: [], errors: [] },
            tools: [{ name: 'yosys', ok: true, version: '0.47' }],
            overallOk: true,
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
            run_id: 'probe-ok',
            tools: [{ name: 'yosys', ok: true, version: '0.47', path: 'yosys' }],
            logs: [],
          }),
        } as any;
      }
      if (url.endsWith('/api/toolchain/implement/plan')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            schema_version: 'toolchain_implement_plan_v1',
            ok: true,
            run_id: 'implement-plan-ok',
            planId: 'implement-plan-ok',
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
      if (url.endsWith('/api/toolchain/synth')) {
        return {
          ok: true,
          status: 202,
          json: async () => ({
            ok: null,
            runId: 'toolchain-synth-run-1',
            artifactId: 'toolchain-synth-artifact-1',
            state: 'running',
            exitCode: null,
            nextOffset: 1,
            logs: [{ run_id: 'toolchain-synth-run-1', ts: 0, step: 'synth', level: 'info', msg: 'synth started' }],
          }),
        } as any;
      }
      if (url.includes('/api/toolchain/synth/runs/toolchain-synth-run-1/artifacts.zip')) {
        synthArtifactUrls.push(url);
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
          arrayBuffer: async () => Uint8Array.from([0x50, 0x4b, 0x03, 0x04]).buffer,
        } as any;
      }
      if (url.includes('/api/toolchain/synth/runs/')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            runId: 'toolchain-synth-run-1',
            artifactId: 'toolchain-synth-artifact-1',
            state: 'done',
            ok: true,
            exitCode: 0,
            logs: [],
            nextOffset: 3,
            artifact: {
              artifactId: 'toolchain-synth-artifact-1',
              board: 'basys3',
              top: 'top',
              yosysVersion: '0.47',
              scriptVersion: 'rb_yosys_synth_v1',
              outputs: {
                netlistVerilog: '.redbyte/tmp/toolchain-synth-run-1/out/netlist.v',
                statText: '.redbyte/tmp/toolchain-synth-run-1/out/stat.txt',
              },
            },
          }),
        } as any;
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock as any);

    render(
      <div style={{ height: 700 }}>
        <StatefulHdlPanel
          initialProject={{
            sources: [{ path: 'top.v', language: 'verilog', text: 'module top(input wire clk, output wire led); assign led = clk; endmodule' }],
            top: 'top',
          }}
          initialFpga={{
            board: 'basys3',
            preset: 'basys3-minimal-leds',
            constraints: { type: 'xdc', text: getBasys3XdcPresetText('basys3-minimal-leds') },
          }}
        />
      </div>
    );

    await userEvent.click(screen.getByTestId('hdl-synth-button'));

    await waitFor(() => {
      expect(FakeEventSource.instances.length).toBeGreaterThan(0);
      expect(screen.getByTestId('hdl-build-logs')).toHaveTextContent('synth started');
    });

    await act(async () => {
      FakeEventSource.instances[0]?.emit('log', {
        run_id: 'toolchain-synth-run-1',
        ts: 1,
        step: 'synth',
        level: 'info',
        msg: 'running opt pass',
      });
      FakeEventSource.instances[0]?.emit('done', {
        runId: 'toolchain-synth-run-1',
        artifactId: 'toolchain-synth-artifact-1',
        state: 'done',
        ok: true,
        exitCode: 0,
        nextOffset: 2,
        artifact: {
          artifactId: 'toolchain-synth-artifact-1',
          board: 'basys3',
          top: 'top',
          yosysVersion: '0.47',
          scriptVersion: 'rb_yosys_synth_v1',
          outputs: {
            netlistVerilog: '.redbyte/tmp/toolchain-synth-run-1/out/netlist.v',
            statText: '.redbyte/tmp/toolchain-synth-run-1/out/stat.txt',
          },
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('hdl-build-logs')).toHaveTextContent('running opt pass');
      expect(screen.getByTestId('hdl-synth-status')).toHaveTextContent('success');
      expect(screen.getByTestId('hdl-synth-artifact-summary')).toHaveTextContent('toolchain-synth-artifact-1');
      expect(screen.getByTestId('hdl-synth-download-button')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId('hdl-synth-download-button'));
    expect(downloadedFileName).toBe('rb-synth-toolchain-synth-artifact-1.zip');
    expect(clickSpy).toHaveBeenCalled();
    expect(synthArtifactUrls[0]?.endsWith('/api/toolchain/synth/runs/toolchain-synth-run-1/artifacts.zip')).toBe(true);

    await userEvent.click(screen.getByTestId('hdl-synth-include-sources-checkbox'));
    await userEvent.click(screen.getByTestId('hdl-synth-download-button'));
    expect(synthArtifactUrls[1]?.endsWith('/api/toolchain/synth/runs/toolchain-synth-run-1/artifacts.zip?includeSources=1')).toBe(true);
  });

  it('cancels synth run from the HDL panel', async () => {
    vi.stubGlobal('EventSource', FakeEventSource as any);
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/toolchain/preflight')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            schema_version: 'toolchain_preflight_v1',
            run_id: 'preflight-synth-cancel',
            ts: 0,
            project: {
              board: 'basys3',
              hasHdl: true,
              top: 'top',
              hasXdc: true,
              preset: 'basys3-minimal-leds',
            },
            lint: { ok: true, warnings: [], errors: [] },
            tools: [{ name: 'yosys', ok: true, version: '0.47' }],
            overallOk: true,
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
            run_id: 'probe-synth-cancel',
            tools: [
              { name: 'yosys', ok: true, version: '0.47', path: 'yosys' },
              { name: 'nextpnr-xilinx', ok: true, version: '0.4', path: 'nextpnr-xilinx' },
            ],
            logs: [],
          }),
        } as any;
      }
      if (url.endsWith('/api/toolchain/implement/plan')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            schema_version: 'toolchain_implement_plan_v1',
            ok: true,
            run_id: 'implement-plan-synth-cancel',
            planId: 'implement-plan-synth-cancel',
            backend: 'nextpnr-xilinx',
            requiredTools: [{ name: 'yosys', ok: true, version: '0.47', why: 'required for synthesis' }],
            commands: [{ step: 'synth', argv: ['yosys', '-p', 'synth_xilinx -top top -family xc7'], envKeysUsed: ['PATH'] }],
            outputs: [{ name: 'netlist-json', pathHint: 'out/netlist.json' }],
            warnings: [],
            logs: [],
          }),
        } as any;
      }
      if (url.endsWith('/api/toolchain/synth')) {
        return {
          ok: true,
          status: 202,
          json: async () => ({
            runId: 'toolchain-synth-run-cancel',
            artifactId: 'toolchain-synth-artifact-cancel',
            state: 'running',
            ok: null,
            exitCode: null,
            nextOffset: 1,
            logs: [{ run_id: 'toolchain-synth-run-cancel', ts: 0, step: 'synth', level: 'info', msg: 'synth started' }],
          }),
        } as any;
      }
      if (url.endsWith('/api/toolchain/runs/toolchain-synth-run-cancel/cancel')) {
        expect(init?.method).toBe('POST');
        return {
          ok: true,
          status: 200,
          json: async () => ({
            runId: 'toolchain-synth-run-cancel',
            artifactId: 'toolchain-synth-artifact-cancel',
            state: 'canceled',
            ok: false,
            exitCode: -1,
            logs: [{ run_id: 'toolchain-synth-run-cancel', ts: 1, step: 'synth', level: 'warn', msg: '[bridge] synth: canceled by user' }],
            nextOffset: 2,
            error: 'canceled_by_user',
          }),
        } as any;
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock as any);

    render(
      <div style={{ height: 700 }}>
        <StatefulHdlPanel
          initialProject={{
            sources: [{ path: 'top.v', language: 'verilog', text: 'module top(input wire clk, output wire led); assign led = clk; endmodule' }],
            top: 'top',
          }}
          initialFpga={{
            board: 'basys3',
            preset: 'basys3-minimal-leds',
            constraints: { type: 'xdc', text: getBasys3XdcPresetText('basys3-minimal-leds') },
          }}
        />
      </div>
    );

    await userEvent.click(screen.getByTestId('hdl-synth-button'));
    await waitFor(() => {
      expect(screen.getByTestId('hdl-synth-cancel-button')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByTestId('hdl-synth-cancel-button'));

    await waitFor(() => {
      expect(screen.getByTestId('hdl-synth-status')).toHaveTextContent('Canceled');
      expect(screen.getByTestId('hdl-build-logs')).toHaveTextContent('[bridge] synth: canceled by user');
    });
  });

  it('blocks implement run when preflight finds errors', async () => {
    const mismatchProject: ToolchainProjectInput = {
      sources: [
        {
          path: 'top.v',
          language: 'verilog',
          text: ['module top(input wire clk, output wire led);', '  assign led = clk;', 'endmodule', ''].join('\n'),
        },
      ],
      top: 'top',
    };

    const mismatchFpga: RBFpgaConfig = {
      board: 'basys3',
      constraints: {
        type: 'xdc',
        text: ['set_property -dict { PACKAGE_PIN W5 IOSTANDARD LVCMOS33 } [get_ports clk]', 'set_property -dict { PACKAGE_PIN V7 IOSTANDARD LVCMOS33 } [get_ports {ghost}]', ''].join('\n'),
      },
    };

    render(
      <div style={{ height: 700 }}>
        <StatefulHdlPanel initialProject={mismatchProject} initialFpga={mismatchFpga} />
      </div>
    );

    await userEvent.click(screen.getByTestId('hdl-implement-run-button'));

    await waitFor(() => {
      expect(screen.getByTestId('hdl-build-logs')).toHaveTextContent('[preflight] lint: xdc_missing_in_hdl');
      expect(screen.getByTestId('hdl-build-logs')).toHaveTextContent('[vivado] implement: blocked by preflight');
    });
    expect(screen.getByTestId('hdl-implement-status')).toHaveTextContent('failed');
  });

  it('runs implement and streams logs when preflight passes', async () => {
    const createdObjectUrls: string[] = [];
    const implementArtifactUrls: string[] = [];
    let downloadedFileName: string | null = null;
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => {
        const value = `blob:rb-implement-${createdObjectUrls.length + 1}`;
        createdObjectUrls.push(value);
        return value;
      }),
      revokeObjectURL: vi.fn(),
    } as any);
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      downloadedFileName = this.download;
    });

    vi.stubGlobal('EventSource', FakeEventSource as any);
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/toolchain/preflight')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            schema_version: 'toolchain_preflight_v1',
            run_id: 'preflight-implement-ok',
            ts: 0,
            project: {
              board: 'basys3',
              hasHdl: true,
              top: 'top',
              hasXdc: true,
              preset: 'basys3-minimal-leds',
            },
            lint: { ok: true, warnings: [], errors: [] },
            tools: [{ name: 'yosys', ok: true, version: '0.47' }],
            overallOk: true,
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
            run_id: 'probe-implement-ok',
            tools: [
              { name: 'yosys', ok: true, version: '0.47', path: 'yosys' },
              { name: 'nextpnr-xilinx', ok: true, version: '0.4', path: 'nextpnr-xilinx' },
            ],
            logs: [],
          }),
        } as any;
      }
      if (url.endsWith('/api/toolchain/implement/plan')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            schema_version: 'toolchain_implement_plan_v1',
            ok: true,
            run_id: 'implement-plan-run',
            planId: 'implement-plan-id',
            backend: 'nextpnr-xilinx',
            requiredTools: [
              { name: 'yosys', ok: true, version: '0.47', why: 'required for synthesis' },
              { name: 'nextpnr-xilinx', ok: true, version: '0.4', why: 'required for pnr' },
            ],
            commands: [{ step: 'synth', argv: ['yosys', '-p', 'synth_xilinx -top top -family xc7'], envKeysUsed: ['PATH'] }],
            outputs: [{ name: 'bitstream', pathHint: 'out/design.bit' }],
            warnings: [],
            logs: [],
          }),
        } as any;
      }
      if (url.endsWith('/api/toolchain/implement/run')) {
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        expect(body.buildPath?.backend).toBe('nextpnr-xilinx');
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
          }),
        } as any;
      }
      if (url.includes('/api/toolchain/implement/runs/toolchain-implement-run-1/artifacts.zip')) {
        implementArtifactUrls.push(url);
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
          arrayBuffer: async () => Uint8Array.from([0x50, 0x4b, 0x03, 0x04]).buffer,
        } as any;
      }
      if (url.includes('/api/toolchain/implement/runs/')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            runId: 'toolchain-implement-run-1',
            artifactId: 'toolchain-implement-artifact-1',
            state: 'done',
            ok: true,
            exitCode: 0,
            logs: [],
            nextOffset: 3,
            artifact: {
              artifactId: 'toolchain-implement-artifact-1',
              board: 'basys3',
              top: 'top',
              planId: 'implement-plan-id',
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

    render(
      <div style={{ height: 700 }}>
        <StatefulHdlPanel
          initialProject={{
            sources: [{ path: 'top.v', language: 'verilog', text: 'module top(input wire clk, output wire led); assign led = clk; endmodule' }],
            top: 'top',
          }}
          initialFpga={{
            board: 'basys3',
            preset: 'basys3-minimal-leds',
            constraints: { type: 'xdc', text: getBasys3XdcPresetText('basys3-minimal-leds') },
          }}
        />
      </div>
    );

    await userEvent.click(screen.getByTestId('hdl-implement-run-button'));

    await waitFor(() => {
      expect(FakeEventSource.instances.length).toBeGreaterThan(0);
      expect(screen.getByTestId('hdl-build-logs')).toHaveTextContent('implement started');
    });

    await act(async () => {
      FakeEventSource.instances[0]?.emit('log', {
        run_id: 'toolchain-implement-run-1',
        ts: 1,
        step: 'pnr',
        level: 'info',
        msg: 'running pnr',
      });
      FakeEventSource.instances[0]?.emit('done', {
        runId: 'toolchain-implement-run-1',
        artifactId: 'toolchain-implement-artifact-1',
        state: 'done',
        ok: true,
        exitCode: 0,
        nextOffset: 2,
        artifact: {
          artifactId: 'toolchain-implement-artifact-1',
          board: 'basys3',
          top: 'top',
          planId: 'implement-plan-id',
          backend: 'nextpnr-xilinx',
          constraintsHash: 'implement-xdc-a1b2c3d4',
          commands: [],
          requiredTools: [],
          sources: [],
          outputs: [],
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('hdl-build-logs')).toHaveTextContent('running pnr');
      expect(screen.getByTestId('hdl-implement-status')).toHaveTextContent('success');
      expect(screen.getByTestId('hdl-implement-artifact-summary')).toHaveTextContent('toolchain-implement-artifact-1');
      expect(screen.getByTestId('hdl-implement-download-button')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId('hdl-implement-download-button'));
    expect(downloadedFileName).toBe('rb-implement-toolchain-implement-artifact-1.zip');
    expect(clickSpy).toHaveBeenCalled();
    expect(implementArtifactUrls[0]?.endsWith('/api/toolchain/implement/runs/toolchain-implement-run-1/artifacts.zip')).toBe(true);

    await userEvent.click(screen.getByTestId('hdl-implement-include-sources-checkbox'));
    await userEvent.click(screen.getByTestId('hdl-implement-download-button'));
    expect(implementArtifactUrls[1]?.endsWith('/api/toolchain/implement/runs/toolchain-implement-run-1/artifacts.zip?includeSources=1')).toBe(true);
  });

  it('programs generated bitstream from implement outputs when available', async () => {
    const programRequests: Array<{ url: string; body: any }> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/toolchain/preflight')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            schema_version: 'toolchain_preflight_v1',
            run_id: 'preflight-program-generated',
            ts: 0,
            project: {
              board: 'basys3',
              hasHdl: true,
              top: 'top',
              hasXdc: true,
              preset: 'basys3-minimal-leds',
            },
            lint: { ok: true, warnings: [], errors: [] },
            tools: [{ name: 'yosys', ok: true, version: '0.47' }],
            overallOk: true,
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
            run_id: 'probe-program-generated',
            tools: [
              { name: 'openFPGALoader', ok: true, version: '0.12.0', path: 'openFPGALoader' },
              { name: 'yosys', ok: true, version: '0.47', path: 'yosys' },
            ],
            logs: [],
          }),
        } as any;
      }
      if (url.endsWith('/api/toolchain/implement/plan')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            schema_version: 'toolchain_implement_plan_v1',
            ok: true,
            run_id: 'plan-program-generated',
            planId: 'plan-program-generated',
            backend: 'nextpnr-xilinx',
            requiredTools: [{ name: 'yosys', ok: true, version: '0.47', why: 'required for synthesis' }],
            commands: [{ step: 'pnr', argv: ['nextpnr-xilinx', '--json', 'out/netlist.json'], envKeysUsed: ['PATH'] }],
            outputs: [{ name: 'bitstream', pathHint: 'out/top.bit' }],
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
            runId: 'toolchain-implement-run-program',
            artifactId: 'toolchain-implement-artifact-program',
            state: 'done',
            ok: true,
            exitCode: 0,
            nextOffset: 1,
            logs: [{ run_id: 'toolchain-implement-run-program', ts: 0, step: 'implement', level: 'info', msg: 'implement done' }],
            artifact: {
              artifactId: 'toolchain-implement-artifact-program',
              board: 'basys3',
              top: 'top',
              planId: 'plan-program-generated',
              backend: 'nextpnr-xilinx',
              constraintsHash: 'implement-xdc-program',
              commands: [],
              requiredTools: [],
              sources: [],
              outputs: [
                {
                  name: 'bitstream',
                  kind: 'bitstream',
                  pathHint: 'out/top.bit',
                  storedPath: '.redbyte/tmp/toolchain-implement-run-program/out/top.bit',
                },
              ],
            },
          }),
        } as any;
      }
      if (url.endsWith('/api/toolchain/implement/runs/toolchain-implement-run-program/output/bitstream')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            schema_version: 'toolchain_implement_output_bitstream_v1',
            ok: true,
            runId: 'toolchain-implement-run-program',
            artifactId: 'toolchain-implement-artifact-program',
            filename: 'out/top.bit',
            bitstream: { kind: 'base64', data: 'AQID' },
            output: { kind: 'bitstream', name: 'bitstream' },
          }),
        } as any;
      }
      if (url.endsWith('/api/toolchain/program-bitstream')) {
        const parsedBody = init?.body ? JSON.parse(String(init.body)) : null;
        programRequests.push({ url, body: parsedBody });
        return {
          ok: true,
          status: 202,
          json: async () => ({
            ok: true,
            runId: 'program-run-generated',
            artifactId: 'program-artifact-generated',
            state: 'done',
            exitCode: 0,
            nextOffset: 1,
            logs: [{ run_id: 'program-run-generated', ts: 0, step: 'program', level: 'info', msg: 'program done' }],
          }),
        } as any;
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock as any);

    render(
      <div style={{ height: 700 }}>
        <StatefulHdlPanel
          initialProject={{
            sources: [{ path: 'top.v', language: 'verilog', text: 'module top(input wire clk, output wire led); assign led = clk; endmodule' }],
            top: 'top',
          }}
          initialFpga={{
            board: 'basys3',
            preset: 'basys3-minimal-leds',
            constraints: { type: 'xdc', text: getBasys3XdcPresetText('basys3-minimal-leds') },
          }}
        />
      </div>
    );

    await userEvent.click(screen.getByTestId('hdl-implement-run-button'));

    await waitFor(() => {
      expect(screen.getByTestId('hdl-implement-program-button')).toBeInTheDocument();
      expect(screen.getByTestId('hdl-implement-status')).toHaveTextContent('success');
    });

    await userEvent.click(screen.getByTestId('hdl-implement-program-button'));

    await waitFor(() => {
      expect(screen.getByTestId('hdl-program-status')).toHaveTextContent('success');
      expect(screen.getByTestId('hdl-build-logs')).toHaveTextContent('program done');
    });

    expect(programRequests.length).toBe(1);
    expect(programRequests[0]?.body?.bitstream?.data).toBe('AQID');

    const outputCallIndex = fetchMock.mock.calls.findIndex((call) =>
      String(call[0]).endsWith('/api/toolchain/implement/runs/toolchain-implement-run-program/output/bitstream')
    );
    const programCallIndex = fetchMock.mock.calls.findIndex((call) =>
      String(call[0]).endsWith('/api/toolchain/program-bitstream')
    );
    expect(outputCallIndex).toBeGreaterThan(-1);
    expect(programCallIndex).toBeGreaterThan(outputCallIndex);
  });

  it('hides generated bitstream program button when implement outputs have no bitstream', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/toolchain/preflight')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            schema_version: 'toolchain_preflight_v1',
            run_id: 'preflight-no-bitstream',
            ts: 0,
            project: {
              board: 'basys3',
              hasHdl: true,
              top: 'top',
              hasXdc: true,
              preset: 'basys3-minimal-leds',
            },
            lint: { ok: true, warnings: [], errors: [] },
            tools: [{ name: 'yosys', ok: true, version: '0.47' }],
            overallOk: true,
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
            run_id: 'probe-no-bitstream',
            tools: [{ name: 'yosys', ok: true, version: '0.47', path: 'yosys' }],
            logs: [],
          }),
        } as any;
      }
      if (url.endsWith('/api/toolchain/implement/plan')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            schema_version: 'toolchain_implement_plan_v1',
            ok: true,
            run_id: 'plan-no-bitstream',
            planId: 'plan-no-bitstream',
            backend: 'nextpnr-xilinx',
            requiredTools: [{ name: 'yosys', ok: true, version: '0.47', why: 'required for synthesis' }],
            commands: [{ step: 'pnr', argv: ['nextpnr-xilinx', '--json', 'out/netlist.json'], envKeysUsed: ['PATH'] }],
            outputs: [{ name: 'report', pathHint: 'out/route.rpt' }],
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
            runId: 'toolchain-implement-run-no-bit',
            artifactId: 'toolchain-implement-artifact-no-bit',
            state: 'done',
            ok: true,
            exitCode: 0,
            nextOffset: 1,
            logs: [{ run_id: 'toolchain-implement-run-no-bit', ts: 0, step: 'implement', level: 'info', msg: 'implement done' }],
            artifact: {
              artifactId: 'toolchain-implement-artifact-no-bit',
              board: 'basys3',
              top: 'top',
              planId: 'plan-no-bitstream',
              backend: 'nextpnr-xilinx',
              constraintsHash: 'implement-xdc-no-bit',
              commands: [],
              requiredTools: [],
              sources: [],
              outputs: [
                {
                  name: 'route-report',
                  kind: 'report',
                  pathHint: 'out/route.rpt',
                  storedPath: '.redbyte/tmp/toolchain-implement-run-no-bit/out/route.rpt',
                },
              ],
            },
          }),
        } as any;
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock as any);

    render(
      <div style={{ height: 700 }}>
        <StatefulHdlPanel
          initialProject={{
            sources: [{ path: 'top.v', language: 'verilog', text: 'module top(input wire clk, output wire led); assign led = clk; endmodule' }],
            top: 'top',
          }}
          initialFpga={{
            board: 'basys3',
            preset: 'basys3-minimal-leds',
            constraints: { type: 'xdc', text: getBasys3XdcPresetText('basys3-minimal-leds') },
          }}
        />
      </div>
    );

    await userEvent.click(screen.getByTestId('hdl-implement-run-button'));

    await waitFor(() => {
      expect(screen.getByTestId('hdl-implement-status')).toHaveTextContent('success');
    });

    expect(screen.queryByTestId('hdl-implement-program-button')).toBeNull();
  });

  it('cancels implement run from the HDL panel', async () => {
    vi.stubGlobal('EventSource', FakeEventSource as any);
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/toolchain/preflight')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            schema_version: 'toolchain_preflight_v1',
            run_id: 'preflight-cancel-ok',
            ts: 0,
            project: { board: 'basys3', hasHdl: true, top: 'top', hasXdc: true, preset: 'basys3-minimal-leds' },
            lint: { ok: true, warnings: [], errors: [] },
            tools: [{ name: 'yosys', ok: true }],
            overallOk: true,
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
            run_id: 'probe-cancel-ok',
            tools: [{ name: 'yosys', ok: true }],
            logs: [],
          }),
        } as any;
      }
      if (url.endsWith('/api/toolchain/implement/plan')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            schema_version: 'toolchain_implement_plan_v1',
            ok: true,
            run_id: 'implement-plan-cancel',
            planId: 'implement-plan-cancel',
            backend: 'nextpnr-xilinx',
            requiredTools: [{ name: 'yosys', ok: true, why: 'required for synthesis' }],
            commands: [{ step: 'synth', argv: ['yosys', '-p', 'synth_xilinx -top top -family xc7'], envKeysUsed: ['PATH'] }],
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
            runId: 'toolchain-implement-run-cancel',
            artifactId: 'toolchain-implement-artifact-cancel',
            state: 'running',
            ok: null,
            exitCode: null,
            logs: [{ run_id: 'toolchain-implement-run-cancel', ts: 0, step: 'implement', level: 'info', msg: 'implement started' }],
            nextOffset: 1,
          }),
        } as any;
      }
      if (url.endsWith('/api/toolchain/runs/toolchain-implement-run-cancel/cancel')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            runId: 'toolchain-implement-run-cancel',
            artifactId: 'toolchain-implement-artifact-cancel',
            state: 'canceled',
            ok: false,
            exitCode: -1,
            logs: [{ run_id: 'toolchain-implement-run-cancel', ts: 1, step: 'implement', level: 'warn', msg: '[bridge] implement: canceled by user' }],
            nextOffset: 2,
            error: 'canceled_by_user',
          }),
        } as any;
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock as any);

    render(
      <div style={{ height: 700 }}>
        <StatefulHdlPanel
          initialProject={{
            sources: [{ path: 'top.v', language: 'verilog', text: 'module top(input wire clk, output wire led); assign led = clk; endmodule' }],
            top: 'top',
          }}
          initialFpga={{
            board: 'basys3',
            preset: 'basys3-minimal-leds',
            constraints: { type: 'xdc', text: getBasys3XdcPresetText('basys3-minimal-leds') },
          }}
        />
      </div>
    );

    await userEvent.click(screen.getByTestId('hdl-implement-run-button'));
    await waitFor(() => {
      expect(screen.getByTestId('hdl-implement-cancel-button')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByTestId('hdl-implement-cancel-button'));

    await waitFor(() => {
      expect(screen.getByTestId('hdl-implement-status')).toHaveTextContent('Canceled');
      expect(screen.getByTestId('hdl-build-logs')).toHaveTextContent('[bridge] implement: canceled by user');
    });
  });
});
