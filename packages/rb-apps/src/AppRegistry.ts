import { AppDefinition } from './types';

const registry: Record<string, AppDefinition> = {};

export function registerApp(app: AppDefinition) {
  registry[app.id] = app;
}

export function getApp(id: string) {
  return registry[id] ?? null;
}

export function listApps() {
  return Object.values(registry);
}
