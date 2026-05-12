// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Board I/O Verifier — Declarative
 *
 * Verifies circuit outputs match expected board LEDs when virtual switches are applied.
 * Operates purely on declarative spec (no functions).
 */

import type {
  LabProjectV1,
  BoardIOCheckpoint,
  CheckpointResult,
  CheckpointFailure,
} from '@redbyte/rb-utils';
import { CircuitEngine } from '@redbyte/rb-logic-core';
import { toLegacyCircuit } from '../adapters/circuitAdapter';

export async function verifyBoardIO(
  project: LabProjectV1,
  checkpoint: BoardIOCheckpoint
): Promise<CheckpointResult> {
  const { switchSettings: inputSwitches, expectedLEDs } = checkpoint.config;
  const ticksToStabilize =
    typeof checkpoint.spec?.ticksToStabilize === 'number'
      ? checkpoint.spec.ticksToStabilize
      : 1;

  if (!project.boardMap) {
    return {
      passed: false,
      headline: '✗ No board mapping configured',
      failures: [{ message: 'Board profile must be set before verifying board I/O' }],
      evidence: { expected: expectedLEDs, actual: [] },
    };
  }

  // Convert CircuitV1 to legacy circuit for simulation (temporary during migration)
  const legacyCircuit = toLegacyCircuit(project.circuit);
  const engine = new CircuitEngine(legacyCircuit);

  // Apply input switches to mapped signals
  const switchSignals = Object.entries(project.boardMap.signalToPinMap)
    .filter(([_, pin]) => pin.startsWith('SW'))
    .sort((a, b) => a[1].localeCompare(b[1])); // Sort by pin name (SW0, SW1, ...)

  for (let i = 0; i < inputSwitches.length; i++) {
    const switchValue = inputSwitches[i] ? 1 : 0;
    const [signal] = switchSignals[i] ?? [];

    if (signal) {
      const node = project.circuit.nodes.find(
        (n) => n.label === signal || n.id === signal
      );
      if (node) {
        engine.setNodeValue(node.id, switchValue);
      }
    }
  }

  // Step simulation to stabilize
  for (let i = 0; i < ticksToStabilize; i++) {
    engine.tick();
  }

  // Read LED outputs from mapped signals
  const ledSignals = Object.entries(project.boardMap.signalToPinMap)
    .filter(([_, pin]) => pin.startsWith('LED'))
    .sort((a, b) => a[1].localeCompare(b[1])); // Sort by pin name (LED0, LED1, ...)

  const actualLEDs: boolean[] = [];
  for (const [signal] of ledSignals) {
    const node = project.circuit.nodes.find(
      (n) => n.label === signal || n.id === signal
    );
    if (node) {
      const value = engine.getNodeValue(node.id, 'Q') ?? 0;
      actualLEDs.push(typeof value === 'number' ? value > 0 : false);
    } else {
      actualLEDs.push(false);
    }
  }

  // Compare expected vs actual
  const failures: CheckpointFailure[] = [];
  for (let i = 0; i < Math.max(expectedLEDs.length, actualLEDs.length); i++) {
    const expected = expectedLEDs[i] ?? false;
    const actual = actualLEDs[i] ?? false;

    if (expected !== actual) {
      const ledPin = ledSignals[i]?.[1] ?? `LED${i}`;
      failures.push({
        message: `${ledPin}: expected ${expected ? 'ON' : 'OFF'}, got ${actual ? 'ON' : 'OFF'}`,
        jumpTarget: { type: 'pin', pin: ledPin },
      });
    }
  }

  const passed = failures.length === 0;
  const headline = passed
    ? '✓ Board I/O matches'
    : `✗ ${failures.length} LED mismatch${failures.length > 1 ? 'es' : ''}`;

  return {
    passed,
    headline,
    failures,
    evidence: {
      expected: expectedLEDs,
      actual: actualLEDs,
      diff: failures.map((f) => f.message),
    },
  };
}
