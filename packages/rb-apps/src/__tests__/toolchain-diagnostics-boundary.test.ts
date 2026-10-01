import { afterEach, describe, expect, it, vi } from 'vitest';
import { createVivadoCLIBackend } from '../fpga/toolchainBackend';

describe('external toolchain diagnostics boundary', () => {
  afterEach(() => vi.unstubAllGlobals());
  function withDiagnostics(payload: unknown) {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/diagnostics')) return { ok: true, status: 200, json: async () => payload };
      throw new Error('No bridge connected in this unit test');
    }));
  }
  it('retains verified fields and rejects malformed field types', async () => {
    withDiagnostics({ reachable:true, version:'1.2.3', uptimeMs:123, activeRunCount:2,
      programmer:{ found:true, version:'0.12', pathHash:'example', capabilities:{program:true,detect:false} } });
    const report = await createVivadoCLIBackend().doctorReportV2();
    expect(report.bridge).toMatchObject({reachable:true, version:'1.2.3', uptimeMs:123, activeRunCount:2});
    expect(report.programmer).toMatchObject({found:true, version:'0.12', capabilities:{program:true,detect:false}});
    withDiagnostics({ reachable:'yes', version:42, uptimeMs:'123', activeRunCount:[],
      lastErrorCode:{}, programmer:{found:'true', version:12, capabilities:{program:1,detect:'yes'}} });
    const malformed = await createVivadoCLIBackend().doctorReportV2();
    expect(malformed.bridge.reachable).toBe(false);
    expect(malformed.bridge.version).toBeUndefined();
    expect(malformed.bridge.uptimeMs).toBeUndefined();
    expect(malformed.programmer.found).toBe(false);
    expect(malformed.programmer.capabilities).toEqual({program:false,detect:false});
  });
  it.each([null, 42, 'offline', []])('handles non-object or incomplete diagnostics without claiming reachability: %s', async (value) => {
    withDiagnostics(value);
    const report = await createVivadoCLIBackend().doctorReportV2();
    expect(report.bridge.reachable).toBe(false);
    expect(report.programmer.found).toBe(false);
  });
});
