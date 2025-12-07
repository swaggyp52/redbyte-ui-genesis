import { WindowManager } from '@rb/rb-windowing';
import LogicLabApp from './apps/LogicLabApp';

export interface RBAppDefinition {
  id: string;
  name: string;
  launch?: any;
}

export const apps: RBAppDefinition[] = [
  {
    id: 'logic-lab',
    name: 'Logic Lab',
    launch: LogicLabApp
  },
  {
    id: 'window-manager',
    name: 'Window Manager',
    launch: WindowManager
  }
];

// getApp() used by rb-shell
export function getApp(id: string): RBAppDefinition | undefined {
  return apps.find(app => app.id === id);
}

// default export still valid
export default apps;
