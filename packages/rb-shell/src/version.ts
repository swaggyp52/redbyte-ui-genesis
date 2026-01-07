// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Build-time version metadata for RedByte OS.
 *
 * - VERSION: from package.json (semantic version)
 * - GIT_SHA: injected at build time via Vite env define (fallback "dev")
 * - BUILD_DATE: build timestamp (YYYY-MM-DD format)
 */

export const VERSION = '1.0.0';

// @ts-expect-error - GIT_SHA is injected at build time via Vite define
export const GIT_SHA: string = typeof __GIT_SHA__ !== 'undefined' ? __GIT_SHA__ : 'dev';

export const BUILD_DATE = '2026-01-07';

export function getVersionString(): string {
  return `v${VERSION} (${GIT_SHA.substring(0, 7)})`;
}

export function getFullVersionString(): string {
  return `RedByte OS v${VERSION} (${GIT_SHA.substring(0, 7)}) - ${BUILD_DATE}`;
}
