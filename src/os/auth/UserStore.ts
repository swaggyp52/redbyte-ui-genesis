export interface UserProfile {
  id: string;
  name: string;
  tag: string; // e.g. "ROOT", "ADMIN", "USER"
  color: string;
  createdAt: number;
  lastLoginAt: number;
}

const STORAGE_KEY = "redbyte_users_v1";

function now() {
  return Date.now();
}

const ROOT_USER_ID = "user-root";

function defaultUsers(): UserProfile[] {
  const t = now();
  return [
    {
      id: ROOT_USER_ID,
      name: "Connor (root)",
      tag: "ROOT",
      color: "#ec4899",
      createdAt: t,
      lastLoginAt: t,
    },
    {
      id: "user-admin",
      name: "Admin",
      tag: "ADMIN",
      color: "#38bdf8",
      createdAt: t,
      lastLoginAt: t,
    },
  ];
}

function randomColor() {
  const palette = [
    "#38bdf8",
    "#a855f7",
    "#22c55e",
    "#f97316",
    "#ec4899",
  ];
  return palette[Math.floor(Math.random() * palette.length)];
}

function makeId() {
  return "user-" + Math.random().toString(36).slice(2);
}

export function loadUsers(): UserProfile[] {
  if (typeof window === "undefined") return defaultUsers();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultUsers();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaultUsers();

    let users = parsed as UserProfile[];

    // Ensure root user always exists
    if (!users.some((u) => u.id === ROOT_USER_ID)) {
      const rootTemplate = defaultUsers()[0];
      users = [rootTemplate, ...users];
    }

    return users;
  } catch {
    return defaultUsers();
  }
}

export function saveUsers(users: UserProfile[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
  } catch {
    // ignore
  }
}

export function createUser(name: string): UserProfile {
  const trimmed = name.trim() || "User";
  const baseTag = trimmed.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  const tag = baseTag || "USER";
  const t = now();
  return {
    id: makeId(),
    name: trimmed,
    tag,
    color: randomColor(),
    createdAt: t,
    lastLoginAt: t,
  };
}

export function touchUser(users: UserProfile[], id: string): UserProfile[] {
  const t = now();
  return users.map((u) =>
    u.id === id
      ? {
          ...u,
          lastLoginAt: t,
        }
      : u
  );
}

export const ROOT_USER_ID_CONST = ROOT_USER_ID;
