import { WindowManager } from '@rb/rb-windowing';
import LogicLabApp from './apps/LogicLabApp';
export const apps = [
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
export function getApp(id) {
    return apps.find(app => app.id === id);
}
// default export still valid
export default apps;
