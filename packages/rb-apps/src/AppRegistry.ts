// Copyright © 2025 Connor Angel — RedByte OS Genesis
// All rights reserved. Unauthorized use, reproduction or distribution is prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { RedByteApp } from './types';

const registry = new Map<string, RedByteApp>();

export function registerApp(app: RedByteApp): void {
  registry.set(app.manifest.id, app);
}

export function getApp(id: string): RedByteApp | null {
  return registry.get(id) ?? null;
}

export function listApps(): RedByteApp[] {
  return Array.from(registry.values());
}
