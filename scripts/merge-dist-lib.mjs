import fs from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';

export async function removeDirWithRetries(dirPath, options = {}) {
  const {
    platform = process.platform,
    maxRetries = 3,
    baseDelayMs = 250,
    remove = removeDir,
    wait = delay,
  } = options;

  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      remove(dirPath);
      return;
    } catch (error) {
      const isRetryable = isRetryableWindowsLockError(error, platform);
      const hasRetriesRemaining = attempt < maxRetries - 1;
      if (!isRetryable || !hasRetriesRemaining) {
        throw error;
      }

      const waitMs = baseDelayMs * (2 ** attempt);
      await wait(waitMs);
      attempt += 1;
    }
  }
}

export async function prepareEmptyOutputDir(targetDir, options = {}) {
  const {
    fallbackDir = `${targetDir}.staged`,
    exists = fs.existsSync,
    mkdir = createDir,
    logger = console,
  } = options;

  if (!exists(targetDir)) {
    mkdir(targetDir);
    return { outputDir: targetDir, usedFallback: false };
  }

  try {
    await removeDirWithRetries(targetDir, options);
    mkdir(targetDir);
    return { outputDir: targetDir, usedFallback: false };
  } catch (error) {
    if (!isRetryableWindowsLockError(error, options.platform)) {
      throw error;
    }

    logger.warn(`⚠️ ${formatLockedDirectoryGuidance(targetDir)}`);
    if (exists(fallbackDir)) {
      await removeDirWithRetries(fallbackDir, options);
    }
    mkdir(fallbackDir);
    return { outputDir: fallbackDir, usedFallback: true };
  }
}

export function isRetryableWindowsLockError(error, platform = process.platform) {
  if (platform !== 'win32') return false;
  const errorCode = typeof error === 'object' && error !== null && 'code' in error ? error.code : null;
  return errorCode === 'EPERM' || errorCode === 'EBUSY';
}

export function formatLockedDirectoryGuidance(dirPath) {
  return [
    `Cannot remove ${dirPath} because Windows is holding a lock on the directory.`,
    'Close any preview/dev servers or file watchers using dist/ and try again.',
    'If needed, stop Node processes with: Get-Process node | Stop-Process -Force',
  ].join('\n');
}

function removeDir(dirPath) {
  fs.rmSync(dirPath, { recursive: true, force: true });
}

function createDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}