export interface RBAppDefinition {
  id: string;
  name: string;
  icon?: string;
  component: React.ComponentType;
}

import { LogicLabApp } from './apps/LogicLabApp';
import { WindowManager } from '@redbyte/rb-windowing';
import { Launcher } from './Launcher';

export const appRegistry: RBAppDefinition[] = [
  {
    id: 'logic-lab',
    name: 'Logic Lab',
    component: LogicLabApp
  },
  {
    id: 'window-manager',
    name: 'Window Manager',
    component: WindowManager
  }
];

export function getApps() {
  return appRegistry;
}

export function getApp(id: string) {
  return appRegistry.find(app => app.id === id) || null;
}

export { Launcher };
