// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

export * from './types';
export * from './AppRegistry';
export * from './stores/filesStore';
export * from './stores/fileAssociationsStore';
export * from './stores/fileSystemStore';
export * from './apps/files/fileActionTargets';
export * from './apps/files/modals';
export * from './examples';

// DEFERRED EXPORTS: Do NOT import app modules at the module level.
// This prevents circular dependencies and temporal dead zone errors
// when heavy modules like Three.js are imported.
// 
// Instead of:
//   export { LogicPlaygroundApp } from './apps/LogicPlaygroundApp';
// 
// Apps will be registered dynamically via registerAllApps()

// DEFERRED: Auto-registration moved to a separate function to avoid circular deps + TDZ errors
// when Three.js or other heavy modules are imported at the module level.
// Call registerAllApps() explicitly when the app is ready to initialize apps.

export async function registerAllApps() {
  // Dynamic imports: only load app modules when explicitly requested
  const { registerApp } = await import('./AppRegistry');
  
  const { TerminalApp } = await import('./apps/TerminalApp');
  const { SettingsApp } = await import('./apps/SettingsApp');
  const { FilesApp } = await import('./apps/FilesApp');
  const { LogicPlaygroundApp } = await import('./apps/LogicPlaygroundApp');
  const { AppStoreApp } = await import('./apps/AppStoreApp');
  const { WelcomeApp } = await import('./apps/WelcomeApp');
  const { LauncherApp } = await import('./apps/LauncherApp');
  const { TextViewerApp } = await import('./apps/TextViewerApp');
  const LogicHelpApp = (await import('./apps/LogicHelpApp')).default;
  const { UserManualApp } = await import('./apps/UserManualApp');

  registerApp(TerminalApp);
  registerApp(SettingsApp);
  registerApp(FilesApp);
  console.log('[AppRegistry] Registering LogicPlaygroundApp', {
    hasApp: !!LogicPlaygroundApp,
    hasComponent: !!LogicPlaygroundApp?.component,
    componentType: typeof LogicPlaygroundApp?.component,
  });
  registerApp(LogicPlaygroundApp);
  registerApp(AppStoreApp);
  registerApp(WelcomeApp);
  registerApp(LauncherApp);
  registerApp(TextViewerApp);
  registerApp(LogicHelpApp);
  registerApp(UserManualApp);
}
