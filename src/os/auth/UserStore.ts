/**
 * UserStore
 *
 * Front-end only identity layer for RedByte OS.
 * This is NOT cryptographically secure, NOT server-validated.
 * It is meant for:
 *   - Multi-user demos
 *   - User switching
 *   - Remembering profiles on this device
 */

export interface UserProfile {
  id: string;
  name: string;
  tag: string; // e.g. "ADMIN", "GUEST", "ENGINEER"
  color: string;
  createdAt: number;
  lastLoginAt: number;
}

const STORAGE_KEY = "redbyte_users_v1";

const DEFAULT_USERS: UserProfile[] = [
  {
    id: "user-admin",
    name: "Admin",
    tag: "ADMIN",
    color: "#38bdf8",
    createdAt: Date.now(),
    lastLoginAt: Date.now(),
  },
];

function randomColor() {
  const palette = [
    "#38bdf8", // sky
    "#a855f7", // purple
    "#22c55e", // emerald
    "#f97316", // orange
    "#ec4899", // pink
  ];
  return palette[Math.floor(Math.random() * palette.length)];
}

function makeId() {
  return "user-" + Math.random().toString(36).slice(2);
}

export function loadUsers(): UserProfile[] {
  if (typeof window === "undefined") return DEFAULT_USERS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_USERS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_USERS;
    return parsed;
  } catch {
    return DEFAULT_USERS;
  }
}

export function saveUsers(users: UserProfile[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
  } catch {
    // ignore storage errors
  }
}

export function createUser(name: string): UserProfile {
  const trimmed = name.trim() || "User";
  const baseTag = trimmed.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  const tag = baseTag || "USER";
  const now = Date.now();
  return {
    id: makeId(),
    name: trimmed,
    tag,
    color: randomColor(),
    createdAt: now,
    lastLoginAt: now,
  };
}

export function touchUser(users: UserProfile[], id: string): UserProfile[] {
  const now = Date.now();
  return users.map((u) =>
    u.id === id
      ? {
          ...u,
          lastLoginAt: now,
        }
      : u
  );
}
