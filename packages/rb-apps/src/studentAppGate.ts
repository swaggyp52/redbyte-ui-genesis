import { useCapabilitiesStore } from './stores/capabilitiesStore';

export const STUDENT_VISIBLE_APP_ALLOWLIST = Object.freeze([
  'home',
  'lab-workspace',
  'logic-playground',
  'settings',
  'files',
]);

export const STUDENT_SYSTEM_APP_ALLOWLIST = Object.freeze([
  'launcher',
  'first-run-wizard',
  'text-viewer',
]);

const studentVisibleApps = new Set(STUDENT_VISIBLE_APP_ALLOWLIST);
const studentSystemApps = new Set(STUDENT_SYSTEM_APP_ALLOWLIST);

export function isStudentModeActive(): boolean {
  return useCapabilitiesStore.getState().studentMode;
}

export function isStudentVisibleApp(appId: string): boolean {
  return studentVisibleApps.has(appId);
}

export function canOpenAppInStudentMode(appId: string): boolean {
  return studentVisibleApps.has(appId) || studentSystemApps.has(appId);
}

export function canOpenAppForCurrentMode(appId: string): boolean {
  if (!isStudentModeActive()) return true;
  return canOpenAppInStudentMode(appId);
}
