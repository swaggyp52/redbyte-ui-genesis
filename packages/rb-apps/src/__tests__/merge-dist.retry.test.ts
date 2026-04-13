// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

describe('merge-dist cleanup retries', () => {
  it('retries Windows EPERM removals before succeeding', async () => {
    const remove = vi
      .fn<() => void>()
      .mockImplementationOnce(() => {
        const error = Object.assign(new Error('EPERM: operation not permitted'), { code: 'EPERM' });
        throw error;
      })
      .mockImplementationOnce(() => {
        const error = Object.assign(new Error('EPERM: operation not permitted'), { code: 'EPERM' });
        throw error;
      })
      .mockImplementationOnce(() => undefined);
    const wait = vi.fn<(delayMs: number) => Promise<void>>().mockResolvedValue(undefined);

    const { removeDirWithRetries } = await import('../../../../scripts/merge-dist-lib.mjs');

    await expect(
      removeDirWithRetries('dist', {
        platform: 'win32',
        maxRetries: 3,
        baseDelayMs: 25,
        remove,
        wait,
      })
    ).resolves.toBeUndefined();

    expect(remove).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenNthCalledWith(1, 25);
    expect(wait).toHaveBeenNthCalledWith(2, 50);
  });

  it('falls back to a staged output directory when canonical dist stays locked', async () => {
    const remove = vi.fn<() => void>().mockImplementation(() => {
      const error = Object.assign(new Error('EPERM: operation not permitted'), { code: 'EPERM' });
      throw error;
    });
    const wait = vi.fn<(delayMs: number) => Promise<void>>().mockResolvedValue(undefined);
    const exists = vi.fn<(dirPath: string) => boolean>().mockImplementation((dirPath) => dirPath === 'dist');
    const mkdir = vi.fn<(dirPath: string) => void>();
    const logger = { warn: vi.fn<(message: string) => void>() };

    const { prepareEmptyOutputDir } = await import('../../../../scripts/merge-dist-lib.mjs');

    await expect(
      prepareEmptyOutputDir('dist', {
        platform: 'win32',
        maxRetries: 2,
        baseDelayMs: 25,
        fallbackDir: 'dist.staged',
        remove,
        wait,
        exists,
        mkdir,
        logger,
      })
    ).resolves.toEqual({ outputDir: 'dist.staged', usedFallback: true });

    expect(remove).toHaveBeenCalledTimes(2);
    expect(mkdir).toHaveBeenCalledWith('dist.staged');
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });
});