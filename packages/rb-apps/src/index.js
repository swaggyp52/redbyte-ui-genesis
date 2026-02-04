// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
export * from './types';
export * from './AppRegistry';
export * from './stores/capabilitiesStore';
export * from './stores/classroomModeStore';
export * from './stores/filesStore';
export * from './stores/fileAssociationsStore';
export * from './stores/fileSystemStore';
export * from './stores/systemLogStore';
export * from './apps/files/fileActionTargets';
export * from './apps/files/modals';
export * from './examples';
export * from './components/EmptyState';
export * from './components/IntegrityBadge';
export { stableSerialize, stableHash, hashBytes } from './utils/stableSerialize';
export { loadSnapshot, wasLastShutdownClean, clearAllSnapshots } from './utils/snapshotSystem';
export { hashBytesOffThread, stableHashOffThread, stableSerializeOffThread, terminateComputeWorker, } from './utils/computeWorker';
export { installErrorHandlers, reportError, reportPerfViolation, addBreadcrumb, getBreadcrumbs, setReportSink, setPerfSampleRate, } from './utils/errorReporting';
export { buildEvidenceManifest, verifyEvidenceManifest, serializeManifest, } from './utils/evidenceManifest';
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
export async function registerAllApps(options) {
    const mode = options?.mode ?? 'full';
    // Dynamic imports: only load app modules when explicitly requested
    const { registerApp } = await import('./AppRegistry');
    // E2E-lite: keep startup lean and avoid importing 3D-heavy modules that can
    // crash headless Chromium or slow boot-time smoke tests.
    if (mode === 'e2e-lite') {
        const { SettingsApp } = await import('./apps/SettingsApp');
        const { FilesApp } = await import('./apps/FilesApp');
        const { LogicPlaygroundApp } = await import('./apps/LogicPlaygroundApp');
        const { LauncherApp } = await import('./apps/LauncherApp');
        const { SystemLogApp } = await import('./apps/SystemLogApp');
        registerApp(SettingsApp);
        registerApp(FilesApp);
        registerApp(LogicPlaygroundApp);
        registerApp(LauncherApp);
        registerApp(SystemLogApp);
        return;
    }
    const { TerminalApp } = await import('./apps/TerminalApp');
    const { SettingsApp } = await import('./apps/SettingsApp');
    const { FilesApp } = await import('./apps/FilesApp');
    const { LogicPlaygroundApp } = await import('./apps/LogicPlaygroundApp');
    const { ECELabApp } = await import('./apps/ECELabManifest');
    const { AppStoreApp } = await import('./apps/AppStoreApp');
    const { WelcomeApp } = await import('./apps/WelcomeApp');
    const { StartHereApp } = await import('./apps/StartHereApp');
    const { LauncherApp } = await import('./apps/LauncherApp');
    const { SystemLogApp } = await import('./apps/SystemLogApp');
    const { StatusPanelApp } = await import('./apps/StatusPanelApp');
    const { TextViewerApp } = await import('./apps/TextViewerApp');
    const LogicHelpApp = (await import('./apps/LogicHelpApp')).default;
    const { UserManualApp } = await import('./apps/UserManualApp');
    const { HardwarePanelApp } = await import('./apps/HardwarePanelApp');
    const { FpgaProofViewerApp } = await import('./apps/FpgaProofViewerApp');
    const LabExaminerAppRegistry = (await import('./apps/LabExaminerAppRegistry')).default;
    const { InstructorApp } = await import('./apps/InstructorApp');
    const { InstructorRunDetailApp } = await import('./apps/InstructorRunDetailApp');
    // const { StudentLabApp } = await import('./apps/StudentLabApp'); // RB_UNIFY_02: DEPRECATED — use Lab Assignment
    const { SubmissionInspectorApp } = await import('./apps/SubmissionInspectorApp');
    const { VirtualLabApp } = await import('./apps/VirtualLabApp');
    const { LabWorkspaceApp } = await import('./apps/LabWorkspaceApp');
    const { LabsApp } = await import('./apps/LabsApp');
    registerApp(TerminalApp);
    registerApp(SettingsApp);
    registerApp(FilesApp);
    if (import.meta.env.DEV) {
        console.log('[AppRegistry] Registering LogicPlaygroundApp', {
            hasApp: !!LogicPlaygroundApp,
            hasComponent: !!LogicPlaygroundApp?.component,
            componentType: typeof LogicPlaygroundApp?.component,
        });
    }
    registerApp(LogicPlaygroundApp);
    registerApp(ECELabApp);
    registerApp(AppStoreApp);
    registerApp(WelcomeApp);
    registerApp(StartHereApp);
    registerApp(LauncherApp);
    registerApp(SystemLogApp);
    registerApp(StatusPanelApp);
    registerApp(TextViewerApp);
    registerApp(LogicHelpApp);
    registerApp(UserManualApp);
    registerApp(HardwarePanelApp);
    registerApp(FpgaProofViewerApp);
    registerApp(LabExaminerAppRegistry);
    registerApp(InstructorApp);
    registerApp(InstructorRunDetailApp);
    // registerApp(StudentLabApp); // LEGACY: Replaced by ECELabApp (ECE 347 Lab)
    registerApp(SubmissionInspectorApp);
    registerApp(VirtualLabApp);
    registerApp(LabWorkspaceApp); // RB_UNIFY: Lab Engine vertical slice
    registerApp(LabsApp);
}
export { PlaygroundGoldenPath } from './dev/PlaygroundGoldenPath';
