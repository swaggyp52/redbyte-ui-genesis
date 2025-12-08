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
