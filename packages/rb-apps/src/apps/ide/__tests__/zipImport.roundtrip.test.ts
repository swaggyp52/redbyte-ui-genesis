import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importVivadoZipBytes } from '../zipImport';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = resolve(
  __dirname,
  '../../../fixtures/import/zip/02-vivado-nested-andgate.zip'
);

function loadFixture02(): Uint8Array {
  return new Uint8Array(readFileSync(FIXTURE_PATH));
}

async function buildRoundtripZip(
  original: Awaited<ReturnType<typeof importVivadoZipBytes>>
): Promise<Uint8Array> {
  const zip = new JSZip();
  const hdlSource = original.project.hdl.sources[0];
  const xdcConstraints = original.project.fpga.constraints;
  zip.file('top.vhd', hdlSource.text);
  if (xdcConstraints?.text) {
    zip.file('top.xdc', xdcConstraints.text);
  }
  return new Uint8Array(await zip.generateAsync({ type: 'arraybuffer' }));
}

describe('zipImport — round-trip guarantee', () => {
  it('re-imported project has same entity name', async () => {
    const originalBytes = loadFixture02();
    const original = await importVivadoZipBytes(originalBytes, { sourceName: 'original.zip' });

    const roundtripBytes = await buildRoundtripZip(original);
    const roundtrip = await importVivadoZipBytes(roundtripBytes, { sourceName: 'roundtrip.zip' });

    expect(roundtrip.parsedHdl.entityName.toLowerCase()).toBe(
      original.parsedHdl.entityName.toLowerCase()
    );
  });

  it('re-imported project has same port count', async () => {
    const originalBytes = loadFixture02();
    const original = await importVivadoZipBytes(originalBytes, { sourceName: 'original.zip' });

    const roundtripBytes = await buildRoundtripZip(original);
    const roundtrip = await importVivadoZipBytes(roundtripBytes, { sourceName: 'roundtrip.zip' });

    expect(roundtrip.parsedHdl.ports.length).toBe(original.parsedHdl.ports.length);
  });

  it('re-imported project preserves port names and directions', async () => {
    const originalBytes = loadFixture02();
    const original = await importVivadoZipBytes(originalBytes, { sourceName: 'original.zip' });

    const roundtripBytes = await buildRoundtripZip(original);
    const roundtrip = await importVivadoZipBytes(roundtripBytes, { sourceName: 'roundtrip.zip' });

    const originalPorts = original.parsedHdl.ports
      .map((p) => ({ name: p.name.toLowerCase(), dir: p.direction }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const roundtripPorts = roundtrip.parsedHdl.ports
      .map((p) => ({ name: p.name.toLowerCase(), dir: p.direction }))
      .sort((a, b) => a.name.localeCompare(b.name));

    expect(roundtripPorts).toEqual(originalPorts);
  });

  it('re-imported project preserves IO pin mappings for strong pins', async () => {
    const originalBytes = loadFixture02();
    const original = await importVivadoZipBytes(originalBytes, { sourceName: 'original.zip' });

    const roundtripBytes = await buildRoundtripZip(original);
    const roundtrip = await importVivadoZipBytes(roundtripBytes, { sourceName: 'roundtrip.zip' });

    const originalPins = new Map([
      ...original.project.ioMapping.inputs.map(
        (r) => [r.label.toLowerCase(), r.pin] as [string, string]
      ),
      ...original.project.ioMapping.outputs.map(
        (r) => [r.label.toLowerCase(), r.pin] as [string, string]
      ),
    ]);
    const roundtripPins = new Map([
      ...roundtrip.project.ioMapping.inputs.map(
        (r) => [r.label.toLowerCase(), r.pin] as [string, string]
      ),
      ...roundtrip.project.ioMapping.outputs.map(
        (r) => [r.label.toLowerCase(), r.pin] as [string, string]
      ),
    ]);

    for (const [portName, pin] of originalPins) {
      if (!pin) continue; // skip unmapped ports
      expect(roundtripPins.get(portName)).toBe(pin);
    }
  });

  it('re-imported project has >=1 HDL source', async () => {
    const originalBytes = loadFixture02();
    const original = await importVivadoZipBytes(originalBytes, { sourceName: 'original.zip' });

    const roundtripBytes = await buildRoundtripZip(original);
    const roundtrip = await importVivadoZipBytes(roundtripBytes, { sourceName: 'roundtrip.zip' });

    expect(roundtrip.project.hdl.sources.length).toBeGreaterThanOrEqual(1);
  });
});
