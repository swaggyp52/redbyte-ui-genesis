/**
 * Public contract for the synchronous filesystem callbacks used by merge-dist.
 * remove/mkdir results are deliberately unused; only retry wait is awaited.
 */
export interface RemovalRetryOptions {
  platform?: string;
  maxRetries?: number;
  baseDelayMs?: number;
  remove?: (dirPath: string) => void;
  wait?: (delayMs: number) => PromiseLike<unknown>;
}
export interface EmptyOutputOptions extends RemovalRetryOptions {
  fallbackDir?: string;
  exists?: (dirPath: string) => boolean;
  mkdir?: (dirPath: string) => void;
  logger?: { warn(message: string): void };
}
export interface PreparedOutputDirectory {
  outputDir: string;
  usedFallback: boolean;
}
export function removeDirWithRetries(dirPath: string, options?: RemovalRetryOptions): Promise<void>;
export function prepareEmptyOutputDir(targetDir: string, options?: EmptyOutputOptions): Promise<PreparedOutputDirectory>;
export function isRetryableWindowsLockError(error: unknown, platform?: string): boolean;
export function formatLockedDirectoryGuidance(dirPath: string): string;
