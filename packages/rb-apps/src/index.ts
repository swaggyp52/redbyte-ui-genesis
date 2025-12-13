// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// All rights reserved. Unauthorized use, reproduction or distribution is prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

export * from './types';
export * from './AppRegistry';
export * from './stores/filesStore';
export * from './examples';

export { TerminalApp } from './apps/TerminalApp';
export { SettingsApp } from './apps/SettingsApp';
export { FilesApp } from './apps/FilesApp';
export { LogicPlaygroundApp } from './apps/LogicPlaygroundApp';
export { AppStoreApp } from './apps/AppStoreApp';
export { WelcomeApp } from './apps/WelcomeApp';

// Auto-register all apps
import { registerApp } from './AppRegistry';
import { TerminalApp } from './apps/TerminalApp';
import { SettingsApp } from './apps/SettingsApp';
import { FilesApp } from './apps/FilesApp';
import { LogicPlaygroundApp } from './apps/LogicPlaygroundApp';
import { AppStoreApp } from './apps/AppStoreApp';
import { WelcomeApp } from './apps/WelcomeApp';

registerApp(TerminalApp);
registerApp(SettingsApp);
registerApp(FilesApp);
registerApp(LogicPlaygroundApp);
registerApp(AppStoreApp);
registerApp(WelcomeApp);
