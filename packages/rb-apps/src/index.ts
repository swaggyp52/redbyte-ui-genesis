export * from './types';
export * from './AppRegistry';
export * from './stores/filesStore';
export * from './examples';

export { TerminalApp } from './apps/TerminalApp';
export { SettingsApp } from './apps/SettingsApp';
export { FilesApp } from './apps/FilesApp';
export { LogicPlaygroundApp } from './apps/LogicPlaygroundApp';

// Auto-register all apps
import { registerApp } from './AppRegistry';
import { TerminalApp } from './apps/TerminalApp';
import { SettingsApp } from './apps/SettingsApp';
import { FilesApp } from './apps/FilesApp';
import { LogicPlaygroundApp } from './apps/LogicPlaygroundApp';

registerApp(TerminalApp);
registerApp(SettingsApp);
registerApp(FilesApp);
registerApp(LogicPlaygroundApp);
