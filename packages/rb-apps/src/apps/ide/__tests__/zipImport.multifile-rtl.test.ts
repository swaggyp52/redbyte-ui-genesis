import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { importVivadoZipBytes } from '../zipImport';

describe('zipImport — multi-file RTL preservation', () => {
  it('embeds companion VHDL in project.hdl.sources, skips testbenches, prefers *_top.vhd', async () => {
    const zip = new JSZip();
    zip.file(
      'vhdl/security_lock_pkg.vhd',
      `library ieee; use ieee.std_logic_1164.all;
package security_lock_pkg is constant X : natural := 1; end package;`
    );
    zip.file(
      'vhdl/helper.vhd',
      `library ieee; use ieee.std_logic_1164.all;
entity helper is port (x: in std_logic); end helper;
architecture a of helper is begin end a;`
    );
    zip.file(
      'vhdl/security_lock_top.vhd',
      `library ieee; use ieee.std_logic_1164.all;
entity security_lock_top is
  port (a: in std_logic; b: out std_logic);
end security_lock_top;
architecture rtl of security_lock_top is
begin
  b <= a;
end rtl;`
    );
    zip.file('vhdl/tb_system.vhd', 'library ieee; entity tb is end tb;');
    zip.file(
      'vhdl/board.xdc',
      `set_property PACKAGE_PIN V17 [get_ports a]
set_property PACKAGE_PIN U16 [get_ports b]`
    );
    const bytes = new Uint8Array(await zip.generateAsync({ type: 'arraybuffer' }));
    const result = await importVivadoZipBytes(bytes, { sourceName: 'multi.zip' });
    expect(result.detectedTopPath).toBe('vhdl/security_lock_top.vhd');
    expect(result.preservedRtlCompanionPaths.sort()).toEqual(['vhdl/helper.vhd', 'vhdl/security_lock_pkg.vhd']);
    expect(result.detectedTestbenchPaths).toEqual(['vhdl/tb_system.vhd']);
    expect(result.project.hdl?.sources?.length).toBe(3);
    expect(result.project.meta?.projectKind).toBe('import');
    expect(result.project.meta?.tags).toContain('multi-file-hdl');
    const paths = result.project.hdl!.sources.map((s) => s.path);
    expect(paths[0]).toBe('vhdl/security_lock_pkg.vhd');
    expect(paths[1]).toBe('vhdl/helper.vhd');
    expect(paths[2]).toBe('vhdl/security_lock_top.vhd');
  });
});
