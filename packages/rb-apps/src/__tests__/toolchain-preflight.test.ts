import { describe, expect, it } from 'vitest';
import {
  createToolchainPreflightStatus,
  encodeToolchainPreflightStatus,
  type ToolchainProjectSnapshotInput,
} from '../fpga/toolchainBackend';

describe('toolchain preflight', () => {
  it('is deterministic for identical project input', () => {
    const snapshot: ToolchainProjectSnapshotInput = {
      hdl: {
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
      },
      fpga: {
        board: 'basys3',
        constraints: {
          type: 'xdc',
          text: ['set_property -dict { PACKAGE_PIN W5 IOSTANDARD LVCMOS33 } [get_ports clk]', 'set_property -dict { PACKAGE_PIN U16 IOSTANDARD LVCMOS33 } [get_ports {led[0]}]', ''].join('\n'),
        },
      },
    };

    const probe = {
      schema_version: 'toolchain_probe_v1' as const,
      ok: true,
      run_id: 'bridge-probe-0',
      env: { platform: 'win32', arch: 'x64', node: 'v20.0.0' },
      tools: [{ name: 'openFPGALoader', ok: true, version: '0.12.0', path: 'openFPGALoader.exe' }],
      logs: [{ run_id: 'bridge-probe-0', ts: 0, step: 'probe' as const, level: 'info' as const, msg: '[bridge] probe: ok' }],
    };

    const statusA = createToolchainPreflightStatus({
      backend_id: 'vivado',
      snapshot,
      probe,
    });
    const statusB = createToolchainPreflightStatus({
      backend_id: 'vivado',
      snapshot,
      probe,
    });

    expect(statusA.run_id).toBe(statusB.run_id);
    expect(statusA.ts).toBe(0);
    expect(statusB.ts).toBe(0);
    expect(encodeToolchainPreflightStatus(statusA)).toBe(encodeToolchainPreflightStatus(statusB));
  });
});

