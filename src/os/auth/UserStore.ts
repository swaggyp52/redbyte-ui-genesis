export type UserRole = "ADMIN" | "USER" | "GUEST";

export interface UserProfile {
  id: string;
  username: string;
  name: string; // display name
  role: UserRole;
  color: string;
  createdAt: number;
  lastLoginAt: number;
  tag?: string; // kept for legacy consumers (ADMIN/USER/GUEST)
}

export interface UserSecret {
  userId: string;
  salt: string;
  passwordHash: string | null;
}

const USERS_KEY = "redbyte_users_v2";
const SECRETS_KEY = "redbyte_user_secrets_v2";

const ADMIN_USERNAME = "admin";
const ADMIN_ID = "user-admin";

const GUEST_USERNAME = "guest";
const GUEST_ID = "user-guest";

function nowMs() {
  return Date.now();
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed as T;
  } catch {
    return null;
  }
}

function randomColor() {
  const palette = [
    "#38bdf8",
    "#a855f7",
    "#22c55e",
    "#f97316",
    "#ec4899",
    "#64748b",
  ];
  return palette[Math.floor(Math.random() * palette.length)];
}

export function loadUsers(): UserProfile[] {
  if (typeof window === "undefined") return [];
  const parsed = safeParse<UserProfile[]>(window.localStorage.getItem(USERS_KEY));
  if (!parsed || !Array.isArray(parsed)) return [];
  return parsed.map((u) => ({
    ...u,
    // backfill defaults
    role: u.role || (u.tag === "ROOT" || u.tag === "ADMIN" ? "ADMIN" : "USER"),
    tag: u.tag || (u.role === "ADMIN" ? "ADMIN" : u.role === "GUEST" ? "GUEST" : "USER"),
  }));
}

export function saveUsers(users: UserProfile[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch {
    // ignore
  }
}

export function loadSecrets(): Record<string, UserSecret> {
  if (typeof window === "undefined") return {};
  const parsed = safeParse<Record<string, UserSecret>>(
    window.localStorage.getItem(SECRETS_KEY)
  );
  if (!parsed || typeof parsed !== "object") return {};
  return parsed;
}

export function saveSecrets(secrets: Record<string, UserSecret>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SECRETS_KEY, JSON.stringify(secrets));
  } catch {
    // ignore
  }
}

function findUserByUsername(users: UserProfile[], username: string) {
  const target = username.trim().toLowerCase();
  return users.find((u) => u.username.toLowerCase() === target);
}

export function ensureCoreUsers() {
  let users = loadUsers();
  let secrets = loadSecrets();

  const now = nowMs();

  let admin = findUserByUsername(users, ADMIN_USERNAME);
  if (!admin) {
    admin = {
      id: ADMIN_ID,
      username: ADMIN_USERNAME,
      name: "System Administrator",
      role: "ADMIN",
      tag: "ADMIN",
      color: "#f97316",
      createdAt: now,
      lastLoginAt: now,
    };
    users = [admin, ...users];
  } else {
    admin.role = "ADMIN";
    admin.tag = "ADMIN";
  }

  let guest = findUserByUsername(users, GUEST_USERNAME);
  if (!guest) {
    guest = {
      id: GUEST_ID,
      username: GUEST_USERNAME,
      name: "Guest",
      role: "GUEST",
      tag: "GUEST",
      color: "#64748b",
      createdAt: now,
      lastLoginAt: now,
    };
    users = [...users, guest];
  } else {
    guest.role = "GUEST";
    guest.tag = "GUEST";
  }

  saveUsers(users);

  const adminSecret = secrets[admin.id];
  const adminHasPassword = !!(adminSecret && adminSecret.passwordHash);

  return {
    users,
    secrets,
    admin,
    guest,
    adminHasPassword,
  };
}

export function updateLastLogin(users: UserProfile[], userId: string) {
  const t = nowMs();
  const updated = users.map((u) =>
    u.id === userId
      ? {
          ...u,
          lastLoginAt: t,
        }
      : u
  );
  saveUsers(updated);
  return updated;
}

export function upsertUserSecret(
  secrets: Record<string, UserSecret>,
  userId: string,
  passwordHash: string | null,
  salt: string
) {
  const next: Record<string, UserSecret> = { ...secrets };
  next[userId] = {
    userId,
    salt,
    passwordHash,
  };
  saveSecrets(next);
  return next;
}

export function getUserSecret(
  secrets: Record<string, UserSecret>,
  userId: string
): UserSecret | undefined {
  return secrets[userId];
}

export const ADMIN_USERNAME_CONST = ADMIN_USERNAME;
export const GUEST_USERNAME_CONST = GUEST_USERNAME;
