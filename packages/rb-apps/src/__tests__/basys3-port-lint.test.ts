import { describe, expect, it } from 'vitest';
import { getBasys3VerilogExample } from '../fpga/boards/basys3/examples';
import { getBasys3XdcPresetText } from '../fpga/boards/basys3/presets';
import { lintBasys3ProjectPorts } from '../fpga/boards/basys3/portLint';
import type { ToolchainProjectInput } from '../fpga/toolchainBackend';

describe('basys3 port lint', () => {
  it('reports zero mismatch for switches example with switches preset', () => {
    const example = getBasys3VerilogExample('basys3-switches-to-leds');
    expect(example).not.toBeNull();

    const project: ToolchainProjectInput = {
      sources: [
        {
          path: 'top.v',
          language: 'verilog',
          text: example?.text ?? '',
        },
      ],
      top: 'top',
    };

    const result = lintBasys3ProjectPorts(project, getBasys3XdcPresetText('basys3-switches-leds-7seg'));
    expect(result.verilogModuleFound).toBe(true);
    expect(result.missingInHdl).toEqual([]);
    expect(result.missingInXdc).toEqual([]);
    expect(result.missingContractPorts).toEqual([]);
  });

  it('reports xdc ports missing from hdl', () => {
    const project: ToolchainProjectInput = {
      sources: [
        {
          path: 'top.v',
          language: 'verilog',
          text: ['module top(input wire clk);', 'endmodule', ''].join('\n'),
        },
      ],
      top: 'top',
    };
    const xdc = ['set_property -dict { PACKAGE_PIN W5 IOSTANDARD LVCMOS33 } [get_ports clk]', 'set_property -dict { PACKAGE_PIN V7 IOSTANDARD LVCMOS33 } [get_ports {ghost}]', ''].join('\n');

    const result = lintBasys3ProjectPorts(project, xdc);
    expect(result.missingInHdl).toEqual(['ghost']);
  });
});

