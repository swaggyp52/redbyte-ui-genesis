// Shared harness for the RedByte browser journeys.
//
// Every journey used to carry the same line:
//
//   chromium.launch(process.platform === 'linux' ? { executablePath: '/opt/pw-browsers/chromium' } : {})
//
// which is not Linux portability. It is one cloud image's path applied to every Linux
// host, so the journeys only ran where that path happened to exist and behaved
// differently there than on Windows. Resolution is now the same everywhere: ask
// Playwright for the browser it installed. A host that genuinely needs a different
// binary says so explicitly through RB_CHROMIUM_PATH, and a path that does not exist is
// reported by name instead of failing somewhere deeper.
import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const REPO_ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));

/** Where the app under test is served. Configurable so a journey can run against a build. */
export const BASE_URL = (process.env.RB_BASE_URL ?? 'http://localhost:5173/').replace(/\/?$/, '/');

/**
 * An explicit, validated browser override. Unset on an ordinary machine, where Playwright's
 * own installed browser is correct on Windows, Linux and macOS alike.
 */
export function chromiumExecutablePath() {
  const override = process.env.RB_CHROMIUM_PATH?.trim();
  if (!override) return undefined;
  if (!existsSync(override)) {
    throw new Error(
      `RB_CHROMIUM_PATH points at ${override}, which does not exist. ` +
        'Unset it to use the browser Playwright installed, or point it at a real Chromium binary.'
    );
  }
  return override;
}

/** Launch Chromium the same way on every platform. */
export async function launchChromium(options = {}) {
  const executablePath = chromiumExecutablePath();
  return chromium.launch(executablePath ? { ...options, executablePath } : options);
}

/**
 * Evidence goes under the repo, not under whatever absolute path the machine that first
 * wrote the journey happened to have. `.redbyte/` is gitignored.
 */
export function evidenceDir(...segments) {
  const dir = path.join(REPO_ROOT, '.redbyte', 'e2e-evidence', ...segments);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * A bounded wait helper so journeys do not invent their own timeout conventions.
 * Playwright's own default is generous; journeys want to fail fast and say why.
 */
export const DEFAULT_TIMEOUT_MS = Number(process.env.RB_E2E_TIMEOUT_MS ?? 15000);
