export type BootMode = "cinematic" | "instant";

export interface GlobalSettings {
  bootMode: BootMode;
}

export interface UserSettings {
  userId: string;
  preferredTheme: "neon" | "midnight" | "carbon" | "system";
  showHints: boolean;
  favoriteApps: string[];
}

const GLOBAL_KEY = "redbyte_global_settings_v1";
const USER_KEY_PREFIX = "redbyte_user_settings_v1_";

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed as T;
  } catch {
    return null;
  }
}

function defaultGlobalSettings(): GlobalSettings {
  return {
    bootMode: "cinematic",
  };
}

export function loadGlobalSettings(): GlobalSettings {
  if (typeof window === "undefined") return defaultGlobalSettings();
  const parsed = safeParse<GlobalSettings>(window.localStorage.getItem(GLOBAL_KEY));
  if (!parsed || (parsed.bootMode !== "cinematic" && parsed.bootMode !== "instant")) {
    return defaultGlobalSettings();
  }
  return parsed;
}

export function saveGlobalSettings(settings: GlobalSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(GLOBAL_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

function defaultUserSettings(userId: string): UserSettings {
  return {
    userId,
    preferredTheme: "neon",
    showHints: true,
    favoriteApps: [
      "file-explorer",
      "redstone-lab",
      "logic-workspace",
      "cpu-designer",
    ],
  };
}

export function loadUserSettings(userId: string): UserSettings {
  if (typeof window === "undefined") return defaultUserSettings(userId);
  const parsed = safeParse<UserSettings>(
    window.localStorage.getItem(USER_KEY_PREFIX + userId)
  );
  if (!parsed || parsed.userId !== userId) {
    return defaultUserSettings(userId);
  }
  return {
    ...defaultUserSettings(userId),
    ...parsed,
    userId,
  };
}

export function saveUserSettings(userId: string, settings: UserSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      USER_KEY_PREFIX + userId,
      JSON.stringify({ ...settings, userId })
    );
  } catch {
    // ignore
  }
}
