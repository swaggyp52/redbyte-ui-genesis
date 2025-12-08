import { create } from "zustand";

/* ============================================================
   RedByte OS • Global + User Settings Store
   Fully rewritten to fix missing exports + boot logic
============================================================ */

// ---------- Types ----------
export interface UserAccount {
  id: string;
  username: string;
  isAdmin: boolean;
  pin: string;
}

export interface GlobalSettings {
  bootMode: "cinematic" | "instant";
}

export interface RedByteSettingsState {
  global: GlobalSettings;
  users: Record<string, UserAccount>;
  currentUserId: string | null;

  // Actions
  loadGlobalSettings: () => GlobalSettings;
  saveGlobalSettings: (s: GlobalSettings) => void;

  loadUserSettings: () => UserAccount | null;
  saveUserSettings: (u: UserAccount) => void;

  loginWithPin: (username: string, pin: string) => UserAccount | null;
  logout: () => void;
}

// ---------- Default admin account ----------
const DEFAULT_ADMIN: UserAccount = {
  id: "root-admin",
  username: "Connor",
  isAdmin: true,
  pin: "1642"
};

// ---------- Zustand Store ----------
export const useSettings = create<RedByteSettingsState>((set, get) => ({
  global: {
    bootMode: "cinematic",
  },

  users: {
    [DEFAULT_ADMIN.id]: DEFAULT_ADMIN,
  },

  currentUserId: null,

  // ------- Global settings -------
  loadGlobalSettings: () => get().global,

  saveGlobalSettings: (s) =>
    set({
      global: { ...get().global, ...s },
    }),

  // ------- User settings -------
  loadUserSettings: () => {
    const { currentUserId, users } = get();
    if (!currentUserId) return null;
    return users[currentUserId] ?? null;
  },

  saveUserSettings: (user) =>
    set({
      users: {
        ...get().users,
        [user.id]: user,
      },
    }),

  // ------- Login system -------
  loginWithPin: (username, pin) => {
    const { users } = get();
    const all = Object.values(users);

    const found = all.find(
      (u) =>
        u.username.toLowerCase() === username.toLowerCase() &&
        u.pin === pin
    );

    if (!found) return null;

    set({ currentUserId: found.id });
    return found;
  },

  logout: () => set({ currentUserId: null }),
}));

