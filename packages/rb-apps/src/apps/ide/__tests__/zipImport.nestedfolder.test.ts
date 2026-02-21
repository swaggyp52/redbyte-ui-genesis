import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { importVivadoZipBytes } from '../zipImport';

async function buildNestedVivadoZip(): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file(
    'project.srcs/sources_1/new/top.vhd',
    `library ieee; use ieee.std_logic_1164.all;
entity top is
  port (sw0 : in std_logic; sw1 : in std_logic; ld0 : out std_logic);
end top;
architecture rtl of top is
begin
  ld0 <= sw0 and sw1;
end rtl;`
  );
  zip.file(
    'project.srcs/constrs_1/new/basys3.xdc',
    `set_property PACKAGE_PIN V17 [get_ports {sw0}]
set_property PACKAGE_PIN V16 [get_ports {sw1}]
set_property PACKAGE_PIN U16 [get_ports {ld0}]`
  );
  zip.file('project.runs/impl_1/top.bit', 'dummy bitstream');
  const buffer = await zip.generateAsync({ type: 'arraybuffer' });
  return new Uint8Array(buffer);
}

describe('zipImport — nested Vivado folder structure', () => {
  it('detects HDL in sources_1/new/', async () => {
    const bytes = await buildNestedVivadoZip();
    const result = await importVivadoZipBytes(bytes, { sourceName: 'project.zip' });
    expect(result.detectedTopPath).toBe('project.srcs/sources_1/new/top.vhd');
  });

  it('detects XDC in constrs_1/new/', async () => {
    const bytes = await buildNestedVivadoZip();
    const result = await importVivadoZipBytes(bytes, { sourceName: 'project.zip' });
    expect(result.detectedXdcPath).toBe('project.srcs/constrs_1/new/basys3.xdc');
  });

  it('populates ioRows with all 3 ports', async () => {
    const bytes = await buildNestedVivadoZip();
    const result = await importVivadoZipBytes(bytes, { sourceName: 'project.zip' });
    const allRows = [
      ...result.project.ioMapping.inputs,
      ...result.project.ioMapping.outputs,
    ];
    expect(allRows).toHaveLength(3);
  });

  it('returns hdlCandidates list with the correct entry', async () => {
    const bytes = await buildNestedVivadoZip();
    const result = await importVivadoZipBytes(bytes, { sourceName: 'project.zip' });
    expect(result.hdlCandidates[0]).toBe('project.srcs/sources_1/new/top.vhd');
  });

  it('returns xdcCandidates list with the correct entry first', async () => {
    const bytes = await buildNestedVivadoZip();
    const result = await importVivadoZipBytes(bytes, { sourceName: 'project.zip' });
    expect(result.xdcCandidates[0]).toBe('project.srcs/constrs_1/new/basys3.xdc');
  });
});
