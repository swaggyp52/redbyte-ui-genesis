// Copyright © 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { RBProject } from '../../../export/projectFormat';
import type { TestVector, IoMapping } from '@redbyte/rb-utils';
import { analyzeSequentialLogic } from './sequentialAnalysis';

/**
 * Generate deterministic testbench.vhd from RBProject vectors
 *
 * The generated testbench mirrors the vectorRunner schedule exactly:
 *   - Combinational: drive → wait 0ns → assert
 *   - Clocked macro: drive → (clk=0,wait) → (clk=1,wait) → (clk=0,wait) → assert
 *
 * No edge-triggered semantics. Pure latch-gated behavior.
 */
export function generateTestbenchVhdl(project: RBProject, vectors: TestVector[]): string {
  const analysis = analyzeSequentialLogic(project.circuit, project.ioMapping);

  const schedule = analysis.hasClockedMacros ? 'clocked_macro' : 'combinational';
  const hasSimClock = !analysis.hasClockNet && analysis.hasClockedMacros;

  // Extract input and output port names from circuit
  const inputPorts = extractInputPorts(project);
  const outputPorts = extractOutputPorts(project);

  // Generate signal declarations
  const signals = generateSignalDeclarations(inputPorts, outputPorts, hasSimClock);

  // Generate clock process (only if needed)
  const clockProcess = schedule === 'clocked_macro' ? generateClockProcess(hasSimClock) : '';

  // Generate stimulus and assertion process
  const stimProcess = generateStimulusProcess(
    project,
    vectors,
    inputPorts,
    outputPorts,
    schedule,
    hasSimClock
  );

  // Assemble testbench
  return generateTestbenchTemplate(project, signals, clockProcess, stimProcess, hasSimClock);
}

/**
 * Extract input port names from circuit
 */
function extractInputPorts(project: RBProject): string[] {
  const ports: Set<string> = new Set();

  // Look for all input sources in the circuit (InputPin nodes, Switch nodes)
  for (const node of project.circuit.nodes) {
    if (node.type === 'Switch' || node.type === 'InputPin' || node.label?.match(/^(in|input)/i)) {
      const label = node.label || node.id;
      if (label && !label.startsWith('__')) {
        ports.add(label);
      }
    }
  }

  // Also check ioMapping for Basys3 inputs
  if (project.ioMapping) {
    for (const key of Object.keys(project.ioMapping)) {
      if (key.match(/^(SW|BTN)/i)) {
        ports.add(key);
      }
    }
  }

  return Array.from(ports).sort();
}

/**
 * Extract output port names from circuit
 */
function extractOutputPorts(project: RBProject): string[] {
  const ports: Set<string> = new Set();

  // Look for all output sinks (Lamp nodes, etc)
  for (const node of project.circuit.nodes) {
    if (node.type === 'Lamp' || node.label?.match(/^(out|output|led)/i)) {
      const label = node.label || node.id;
      if (label && !label.startsWith('__')) {
        ports.add(label);
      }
    }
  }

  // Also check ioMapping for Basys3 outputs
  if (project.ioMapping) {
    for (const key of Object.keys(project.ioMapping)) {
      if (key.match(/^LD/i)) {
        ports.add(key);
      }
    }
  }

  return Array.from(ports).sort();
}

/**
 * Generate signal declarations for testbench
 */
function generateSignalDeclarations(
  inputs: string[],
  outputs: string[],
  hasSimClock: boolean
): string {
  let signals = '  -- Input signals\n';
  for (const input of inputs) {
    signals += `  signal ${input} : std_logic := '0';\n`;
  }

  signals += '\n  -- Output signals\n';
  for (const output of outputs) {
    signals += `  signal ${output} : std_logic;\n`;
  }

  if (hasSimClock) {
    signals += '\n  -- Simulation clock\n';
    signals += "  signal clk : std_logic := '0';\n";
    signals += '  constant CLK_PERIOD : time := 10 ns;\n';
  }

  return signals;
}

/**
 * Generate clock process (for clocked_macro designs)
 */
function generateClockProcess(hasSimClock: boolean): string {
  if (!hasSimClock) return '';

  return `
  -- Clock generation process
  clk_gen: process
  begin
    loop
      clk <= '0';
      wait for CLK_PERIOD / 2;
      clk <= '1';
      wait for CLK_PERIOD / 2;
    end loop;
  end process clk_gen;
`;
}

/**
 * Generate stimulus process with vectors
 */
function generateStimulusProcess(
  project: RBProject,
  vectors: TestVector[],
  inputPorts: string[],
  outputPorts: string[],
  schedule: 'combinational' | 'clocked_macro',
  hasSimClock: boolean
): string {
  let process = '  -- Test stimulus and assertion\n  stim: process\n  begin\n';

  for (let i = 0; i < vectors.length; i++) {
    const vector = vectors[i];

    // Generate stimulus comments
    process += `    -- Vector ${i}\n`;

    // Drive inputs
    for (const input of inputPorts) {
      const val = vector.inputs[input];
      if (val !== undefined) {
        const bit = typeof val === 'boolean' ? (val ? '1' : '0') : val > 0 ? '1' : '0';
        process += `    ${input} <= '${bit}';\n`;
      }
    }

    // Wait and settle
    if (schedule === 'combinational') {
      process += `    wait for 0 ns;  -- combinational settle\n`;
    } else {
      // 3-tick clocked_macro schedule
      process += `    -- clk=0, settle/hold phase\n`;
      process += `    clk <= '0';\n`;
      process += `    wait for CLK_PERIOD / 2;\n`;
      process += `    -- clk=1, transparent/update phase\n`;
      process += `    clk <= '1';\n`;
      process += `    wait for CLK_PERIOD / 2;\n`;
      process += `    -- clk=0, hold phase\n`;
      process += `    clk <= '0';\n`;
      process += `    wait for CLK_PERIOD / 2;\n`;
      process += `    wait for 0 ns;  -- delta settle\n`;
    }

    // Assert expected outputs
    if (vector.expected) {
      for (const output of outputPorts) {
        const expected = vector.expected[output];
        if (expected !== undefined) {
          const bit = typeof expected === 'boolean' ? (expected ? '1' : '0') : expected > 0 ? '1' : '0';
          process += `    assert ${output} = '${bit}'\n`;
          process += `      report "Vector ${i} failed on ${output}: expected ${bit}, got " & std_logic'image(${output})\n`;
          process += `      severity error;\n`;
        }
      }
    }

    if (i < vectors.length - 1) {
      process += `\n`;
    }
  }

  process += `    wait;\n  end process stim;\n`;

  return process;
}

/**
 * Generate complete testbench template
 */
function generateTestbenchTemplate(
  project: RBProject,
  signals: string,
  clockProcess: string,
  stimProcess: string,
  hasSimClock: boolean
): string {
  const topModule = project.fpga?.top || 'top';

  let tb = `library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;

entity tb_top is
end entity tb_top;

architecture sim of tb_top is
  -- DUT component
  component ${topModule} is
    port (
      -- TODO: Add actual port declarations from project.circuit
      clk : in std_logic;
      rst : in std_logic
    );
  end component ${topModule};

${signals}
begin
  -- Document: This testbench was auto-generated from RedByte project vectors
  -- Schedule: ${hasSimClock ? 'clocked_macro (v1 - 3-tick latch gating)' : 'combinational'}
  -- Generated deterministically from: ${project.name || 'unnamed'}
  --
  -- IMPORTANT: This testbench mirrors the RedByte Verify runner schedule exactly:
  -- - Combinational designs: drive → wait 0ns → assert
  -- - Clocked designs: drive → (clk=0,wait) → (clk=1,wait) → (clk=0,wait) → assert
  --
  -- Do NOT modify the timing without updating the corresponding vectorRunner.ts

  -- DUT instantiation
  dut: ${topModule}
    port map (
      -- TODO: Connect actual ports
      clk => ${hasSimClock ? 'clk' : 'open'},
      rst => '0'
    );
${clockProcess}
${stimProcess}
end architecture sim;
`;

  return tb;
}
