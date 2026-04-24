import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('hw_probe.tcl contract', () => {
  it('provides a no-bitstream bench visibility check for TAs', () => {
    const repoRoot = join(__dirname, '..', '..', '..', '..');
    const tclPath = join(repoRoot, 'scripts', 'vivado', 'hw_probe.tcl');
    const text = readFileSync(tclPath, 'utf8');
    expect(text).toContain('open_hw_manager');
    expect(text).toContain('connect_hw_server');
    expect(text).toContain('refresh_hw_server');
    expect(text).toContain('get_hw_targets');
  });
});
