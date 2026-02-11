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
    });
  });
});
