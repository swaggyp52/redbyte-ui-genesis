import { afterEach, describe, expect, it, vi } from 'vitest';
import { getToolchainBackend } from '../fpga/toolchainBackend';

describe('toolchain probe source fields', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('preserves bundled/system source values from probe response', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (!url.endsWith('/api/toolchain/probe')) {
        throw new Error(`Unexpected URL: ${url}`);
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          schema_version: 'toolchain_probe_v1',
          ok: true,
          run_id: 'probe-source-1',
          tools: [
            {
              name: 'openFPGALoader',
              ok: true,
              status: 'ok',
              source: 'bundled',
              integrity: 'verified',
              version: '0.13.0',
              path: '.redbyte/tools/win32/openfpgaloader/openFPGALoader.exe',
              alternates: [
                {
                  source: 'system',
                  status: 'ok',
                  integrity: 'unknown',
                  version: '0.12.0',
                  path: 'openFPGALoader.exe',
                },
              ],
            },
            {
              name: 'vivado',
              ok: true,
              status: 'ok',
              source: 'system',
              integrity: 'unknown',
              version: '2024.2',
              path: 'vivado.bat',
            },
          ],
          logs: [],
        }),
      } as any;
    });

    vi.stubGlobal('fetch', fetchMock as any);

    const backend = getToolchainBackend('vivado');
    const probe = await backend.probeTools();

    const loader = probe.tools.find((tool) => tool.name === 'openFPGALoader');
    const vivado = probe.tools.find((tool) => tool.name === 'vivado');

    expect(loader?.source).toBe('bundled');
    expect(loader?.integrity).toBe('verified');
    expect(loader?.alternates?.[0]?.source).toBe('system');
    expect(vivado?.source).toBe('system');
  });
});
