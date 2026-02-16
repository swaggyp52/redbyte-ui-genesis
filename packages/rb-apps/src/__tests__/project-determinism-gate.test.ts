import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { decodeRBProject, encodeRBProject, type RBProject } from '../export/projectFormat';
import { digestCircuit } from '../recording/runRecordUtils';

const FIXTURE_PATH = join(__dirname, 'fixtures', 'rbproject-roundtrip.fixture.json');

function loadFixture(): RBProject {
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as RBProject;
}

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

describe('RC D0 project determinism gate', () => {
  it('encode/decode remains byte-stable and circuit fingerprint-stable for 10 cycles', () => {
    const fixture = loadFixture();
    const firstEncoded = encodeRBProject(fixture);
    const baselineProject = decodeRBProject(firstEncoded);
    const baselineFingerprint = digestCircuit(baselineProject.circuit);
    const baselineHash = sha256(firstEncoded);

    let encoded = firstEncoded;
    for (let cycle = 0; cycle < 10; cycle += 1) {
      const decoded = decodeRBProject(encoded);
      const fingerprint = digestCircuit(decoded.circuit);
      expect(fingerprint).toBe(baselineFingerprint);
      encoded = encodeRBProject(decoded);
      expect(sha256(encoded)).toBe(baselineHash);
    }

    expect(encoded).toBe(firstEncoded);
  });

  it('canonicalizes deterministic ordering for circuit/probe/hdl arrays during encoding', () => {
    const fixture = loadFixture();
    const canonicalInput: RBProject = {
      ...fixture,
      circuit: {
        nodes: [...fixture.circuit.nodes],
        connections: [...fixture.circuit.connections],
      },
      probes: fixture.probes
        ? [...fixture.probes]
        : [
            {
              id: 'probe-1',
              nodeId: 'n1',
              portName: 'out',
              label: 'Probe A',
              color: '#00ffff',
              enabled: true,
            },
            {
              id: 'probe-2',
              nodeId: 'n2',
              portName: 'out',
              label: 'Probe B',
              color: '#ff00ff',
              enabled: true,
            },
          ],
      hdl: fixture.hdl
        ? {
            ...fixture.hdl,
            sources: [...fixture.hdl.sources],
          }
        : {
            sources: [
              { path: 'a.v', language: 'verilog', text: 'module a; endmodule' },
              { path: 'z.v', language: 'verilog', text: 'module z; endmodule' },
            ],
            top: 'top',
          },
      meta: {
        ...(fixture.meta ?? {}),
        tags: ['alpha', 'beta', 'zeta'],
      },
    };

    const reversed: RBProject = {
      ...canonicalInput,
      circuit: {
        nodes: [...canonicalInput.circuit.nodes].reverse(),
        connections: [...canonicalInput.circuit.connections].reverse(),
      },
      probes: [...(canonicalInput.probes ?? [])].reverse(),
      hdl: canonicalInput.hdl
        ? {
            ...canonicalInput.hdl,
            sources: [...canonicalInput.hdl.sources].reverse(),
          }
        : undefined,
      meta: {
        ...(canonicalInput.meta ?? {}),
        tags: [...(canonicalInput.meta?.tags ?? [])].reverse(),
      },
    };

    const canonicalEncoded = encodeRBProject(canonicalInput);
    const reversedEncoded = encodeRBProject(reversed);
    expect(reversedEncoded).toBe(canonicalEncoded);
  });
});
