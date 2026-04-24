import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Repo contract: canonical lab batch Tcl must exist and encode the full synth → bitstream path.
 * Vivado itself is not invoked in CI.
 */
describe('Vivado batch build script contract', () => {
  it('redbyte_batch_synth_impl_bitstream.tcl documents the non-interactive certification flow', () => {
    const repoRoot = join(__dirname, '..', '..', '..', '..');
    const tclPath = join(repoRoot, 'scripts', 'vivado', 'redbyte_batch_synth_impl_bitstream.tcl');
    const text = readFileSync(tclPath, 'utf8');
    expect(text).toContain('open_project');
    expect(text).toContain('launch_runs synth_1');
    expect(text).toContain('launch_runs impl_1');
    expect(text).toContain('write_bitstream');
    expect(text).toContain('wait_on_run synth_1');
    expect(text).toContain('wait_on_run impl_1');
    expect(text).toContain('synth_design Complete!');
    expect(text).toContain('write_bitstream Complete!');
  });

  it('redbyte_program_device.tcl documents batch programming for E2 certification', () => {
    const repoRoot = join(__dirname, '..', '..', '..', '..');
    const tclPath = join(repoRoot, 'scripts', 'vivado', 'redbyte_program_device.tcl');
    const text = readFileSync(tclPath, 'utf8');
    expect(text).toContain('open_hw_manager');
    expect(text).toContain('connect_hw_server');
    expect(text).toContain('refresh_hw_server');
    expect(text).toContain('get_hw_servers');
    expect(text).toContain('get_hw_targets');
    expect(text).toContain('open_hw_target');
    expect(text).toContain('PROGRAM.FILE');
    expect(text).toContain('program_hw_devices');
  });
});
