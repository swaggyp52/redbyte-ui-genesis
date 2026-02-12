export type RedByteUiMode = 'student' | 'ta';

export const RB_UI_MODE_STORAGE_KEY = 'rb:mode:v1';
export const RB_UI_MODE_QUERY_KEY = 'rb:mode';
export const RB_UI_MODE_CHANGE_EVENT = 'rb:mode-changed';
export const RB_CLASSROOM_LOCKDOWN_STORAGE_KEY = 'rb:classroom-lockdown:v1';
export const RB_CLASSROOM_LOCKDOWN_CHANGE_EVENT = 'rb:classroom-lockdown-changed';
const RB_TA_ESCAPE_QUERY_KEY = 'ta';

export interface ClassroomLockdownState {
  enabled: boolean;
}

function normalizeUiMode(value: unknown): RedByteUiMode | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'student' || normalized === 'ta') return normalized;
  return null;
}

function getSearchParams(search?: string): URLSearchParams | null {
  if (typeof search === 'string') {
    return new URLSearchParams(search);
  }
  if (typeof window !== 'undefined' && typeof window.location?.search === 'string') {
    return new URLSearchParams(window.location.search);
  }
  return null;
}

function normalizeTaEscapeFlag(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function decodeClassroomLockdown(raw: string | null | undefined): ClassroomLockdownState {
  if (!raw || typeof raw !== 'string') {
    return { enabled: false };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<ClassroomLockdownState> | boolean;
    if (typeof parsed === 'boolean') return { enabled: parsed };
    if (typeof parsed?.enabled === 'boolean') return { enabled: parsed.enabled };
    return { enabled: false };
  } catch {
    return { enabled: false };
  }
}

export function getClassroomLockdownState(options?: {
  storage?: Pick<Storage, 'getItem'> | null;
}): ClassroomLockdownState {
  const storage =
    options?.storage ??
    (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined' ? window.localStorage : null);
  return decodeClassroomLockdown(storage?.getItem?.(RB_CLASSROOM_LOCKDOWN_STORAGE_KEY));
}

export function setClassroomLockdownEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  const nextState: ClassroomLockdownState = { enabled };
  window.localStorage.setItem(RB_CLASSROOM_LOCKDOWN_STORAGE_KEY, JSON.stringify(nextState));
  window.dispatchEvent(new CustomEvent(RB_CLASSROOM_LOCKDOWN_CHANGE_EVENT, { detail: nextState }));
}

export function getRedByteUiMode(options?: {
  search?: string;
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
}): RedByteUiMode {
  const params = getSearchParams(options?.search);
  const storage =
    options?.storage ??
    (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined' ? window.localStorage : null);
  const queryMode = normalizeUiMode(params?.get(RB_UI_MODE_QUERY_KEY));
  if (queryMode) {
    storage?.setItem?.(RB_UI_MODE_STORAGE_KEY, queryMode);
  }

  const storedMode = normalizeUiMode(storage?.getItem?.(RB_UI_MODE_STORAGE_KEY));
  const taEscapeFromQuery = normalizeTaEscapeFlag(params?.get(RB_TA_ESCAPE_QUERY_KEY));
  if (taEscapeFromQuery) {
    storage?.setItem?.(RB_UI_MODE_STORAGE_KEY, 'ta');
  }

  const requestedMode: RedByteUiMode = taEscapeFromQuery
    ? 'ta'
    : queryMode ?? storedMode ?? 'student';
  const lockdown = getClassroomLockdownState({ storage }).enabled;
  if (!lockdown) return requestedMode;
  return requestedMode === 'ta' ? 'ta' : 'student';
}

export function setRedByteUiMode(mode: RedByteUiMode): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(RB_UI_MODE_STORAGE_KEY, mode);
  window.dispatchEvent(new CustomEvent(RB_UI_MODE_CHANGE_EVENT, { detail: { mode } }));
}

export function isTaModeEnabled(options?: {
  search?: string;
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
}): boolean {
  return getRedByteUiMode(options) === 'ta';
}

export function isStudentModeEnabled(options?: {
  search?: string;
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
}): boolean {
  return getRedByteUiMode(options) === 'student';
}
