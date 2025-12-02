import React, { useEffect, useState } from "react";
import {
  ADMIN_USERNAME_CONST,
  GUEST_USERNAME_CONST,
  UserProfile,
  ensureCoreUsers,
  getUserSecret,
  updateLastLogin,
  upsertUserSecret,
} from "./UserStore";

interface LoginOverlayProps {
  currentUser: UserProfile | null;
  onLogin: (user: UserProfile) => void;
}

type Phase = "loading" | "admin-setup" | "login";

function makeSalt() {
  return (
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2)
  );
}

async function hashSecret(secret: string, salt: string): Promise<string> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    // fallback (dev only)
    return btoa(secret + ":" + salt);
  }
  const enc = new TextEncoder();
  const data = enc.encode(secret + ":" + salt);
  const buf = await crypto.subtle.digest("SHA-256", data);
  const bytes = Array.from(new Uint8Array(buf));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

/**
 * LoginOverlay
 *
 * Realistic OS login flow:
 * - First run: enforce admin password/PIN setup.
 * - Normal runs: username + password/PIN.
 * - Only admin and guest are pre-initialized.
 * - No visible user list; no ability to see other accounts.
 */
export function LoginOverlay({ currentUser, onLogin }: LoginOverlayProps) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [secrets, setSecrets] = useState<Record<string, any>>({});
  const [adminUser, setAdminUser] = useState<UserProfile | null>(null);
  const [guestUser, setGuestUser] = useState<UserProfile | null>(null);
  const [adminHasPassword, setAdminHasPassword] = useState(false);

  const [adminSecret, setAdminSecret] = useState("");
  const [adminSecretConfirm, setAdminSecretConfirm] = useState("");
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminBusy, setAdminBusy] = useState(false);

  const [username, setUsername] = useState("");
  const [secretInput, setSecretInput] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginBusy, setLoginBusy] = useState(false);

  // Load core users and determine phase
  useEffect(() => {
    try {
      const { users, secrets, admin, guest, adminHasPassword } =
        ensureCoreUsers();
      setUsers(users);
      setSecrets(secrets);
      setAdminUser(admin);
      setGuestUser(guest);
      setAdminHasPassword(adminHasPassword);
      setPhase(adminHasPassword ? "login" : "admin-setup");
    } catch {
      // fallback: still allow login UI, but mark as login (no setup)
      setPhase("login");
    }
  }, []);

  // Once logged in, overlay disappears
  if (currentUser) return null;

  async function handleAdminSetup() {
    setAdminError(null);
    if (!adminUser) {
      setAdminError("Internal error: admin account not initialized.");
      return;
    }
    const value = adminSecret.trim();
    const confirm = adminSecretConfirm.trim();
    if (!value || value.length < 4) {
      setAdminError("Choose a password or PIN with at least 4 characters.");
      return;
    }
    if (value !== confirm) {
      setAdminError("The two entries do not match.");
      return;
    }

    setAdminBusy(true);
    try {
      const salt = makeSalt();
      const hash = await hashSecret(value, salt);
      const nextSecrets = upsertUserSecret(secrets, adminUser.id, hash, salt);
      setSecrets(nextSecrets);
      setAdminHasPassword(true);
      setPhase("login");

      // Optionally auto-login admin after setup
      const updatedUsers = updateLastLogin(users, adminUser.id);
      setUsers(updatedUsers);
      onLogin({ ...adminUser, role: "ADMIN", tag: "ADMIN" });
    } catch (e) {
      setAdminError("Failed to save admin credential.");
    } finally {
      setAdminBusy(false);
    }
  }

  async function handleLogin() {
    setLoginError(null);
    const uname = username.trim().toLowerCase();
    const secret = secretInput.trim();

    if (!uname) {
      setLoginError("Enter a username.");
      return;
    }

    // Guest: no password required
    if (uname === GUEST_USERNAME_CONST.toLowerCase()) {
      if (!guestUser) {
        setLoginError("Guest account is not available.");
        return;
      }
      const updatedUsers = updateLastLogin(users, guestUser.id);
      setUsers(updatedUsers);
      onLogin({ ...guestUser, role: "GUEST", tag: "GUEST" });
      return;
    }

    if (!secret) {
      setLoginError("Enter your password or PIN.");
      return;
    }

    const user =
      users.find((u) => u.username.toLowerCase() === uname) ?? null;

    if (!user) {
      setLoginError("Unknown user. Ask the administrator to create an account.");
      return;
    }

    const secretRecord = getUserSecret(secrets, user.id);
    if (!secretRecord || !secretRecord.passwordHash) {
      setLoginError(
        "This account does not have a password set. Ask the administrator."
      );
      return;
    }

    setLoginBusy(true);
    try {
      const hash = await hashSecret(secret, secretRecord.salt);
      if (hash !== secretRecord.passwordHash) {
        setLoginError("Incorrect password or PIN.");
        return;
      }
      const updatedUsers = updateLastLogin(users, user.id);
      setUsers(updatedUsers);
      onLogin({
        ...user,
        tag:
          user.role === "ADMIN"
            ? "ADMIN"
            : user.role === "GUEST"
            ? "GUEST"
            : "USER",
      });
    } catch {
      setLoginError("Login failed. Try again.");
    } finally {
      setLoginBusy(false);
    }
  }

  function handleEnterKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      if (phase === "admin-setup") {
        void handleAdminSetup();
      } else if (phase === "login") {
        void handleLogin();
      }
    }
  }

  // ----- Render phases -----

  if (phase === "loading") {
    return (
      <div className="absolute inset-0 z-[999] bg-slate-950/95 backdrop-blur-2xl flex items-center justify-center">
        <div className="rb-glass rounded-3xl border border-slate-800/80 bg-slate-950/90 px-6 py-4 flex flex-col items-center gap-3">
          <div className="text-sm text-slate-200">Preparing login…</div>
          <div className="h-1.5 w-40 rounded-full bg-slate-900 overflow-hidden">
            <div className="h-full w-1/2 animate-pulse bg-slate-500" />
          </div>
        </div>
      </div>
    );
  }

  if (phase === "admin-setup") {
    return (
      <div className="absolute inset-0 z-[999] bg-slate-950/95 backdrop-blur-2xl flex items-center justify-center">
        <div className="w-full max-w-md rb-glass rounded-3xl border border-slate-800/80 bg-slate-950/90 p-5 flex flex-col gap-4 shadow-2xl">
          <div className="flex flex-col gap-1">
            <div className="text-sm font-semibold text-slate-100">
              Set up administrator account
            </div>
            <p className="text-[0.75rem] text-slate-400">
              This is the first time RedByte OS is running on this device.
              Choose a password or PIN for the <span className="font-mono text-slate-200">{ADMIN_USERNAME_CONST}</span> account.
              You&apos;ll use this account to manage other users and settings.
            </p>
          </div>

          <div className="flex flex-col gap-2 text-[0.8rem]">
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Administrator username</span>
              <span className="font-mono text-slate-400">
                {ADMIN_USERNAME_CONST}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[0.75rem] text-slate-400">
                Password or PIN
              </label>
              <input
                type="password"
                className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-3 py-1.5 text-[0.8rem] text-slate-100 focus:outline-none focus:border-sky-500/80"
                value={adminSecret}
                onChange={(e) => setAdminSecret(e.target.value)}
                onKeyDown={handleEnterKey}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[0.75rem] text-slate-400">
                Confirm
              </label>
              <input
                type="password"
                className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-3 py-1.5 text-[0.8rem] text-slate-100 focus:outline-none focus:border-sky-500/80"
                value={adminSecretConfirm}
                onChange={(e) => setAdminSecretConfirm(e.target.value)}
                onKeyDown={handleEnterKey}
              />
            </div>
            {adminError && (
              <div className="text-[0.7rem] text-rose-400">{adminError}</div>
            )}
          </div>

          <div className="flex items-center justify-between text-[0.7rem]">
            <span className="text-slate-500">
              You can change this later from an admin console.
            </span>
            <button
              onClick={() => void handleAdminSetup()}
              disabled={adminBusy}
              className="px-3 py-1.5 rounded-full border border-sky-500/80 text-sky-100 text-[0.75rem] hover:bg-sky-500/10 disabled:opacity-50"
            >
              {adminBusy ? "Saving…" : "Save & continue"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // phase === "login"
  return (
    <div className="absolute inset-0 z-[999] bg-slate-950/95 backdrop-blur-2xl flex items-center justify-center">
      <div className="w-full max-w-md rb-glass rounded-3xl border border-slate-800/80 bg-slate-950/90 p-5 flex flex-col gap-4 shadow-2xl">
        <div className="flex flex-col gap-1">
          <div className="text-xl font-semibold text-slate-100">
            Sign in to RedByte OS
          </div>
          <p className="text-[0.75rem] text-slate-400">
            Enter your username and password or PIN. The administrator account
            uses the username <span className="font-mono text-slate-200">{ADMIN_USERNAME_CONST}</span>. A limited
            guest session is available.
          </p>
        </div>

        <div className="flex flex-col gap-2 text-[0.8rem]">
          <div className="flex flex-col gap-1">
            <label className="text-[0.75rem] text-slate-400">Username</label>
            <input
              className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-3 py-1.5 text-[0.8rem] text-slate-100 focus:outline-none focus:border-sky-500/80"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={handleEnterKey}
              autoComplete="username"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[0.75rem] text-slate-400">
              Password or PIN
            </label>
            <input
              type="password"
              className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-3 py-1.5 text-[0.8rem] text-slate-100 focus:outline-none focus:border-sky-500/80"
              value={secretInput}
              onChange={(e) => setSecretInput(e.target.value)}
              onKeyDown={handleEnterKey}
              autoComplete="current-password"
            />
          </div>
          {loginError && (
            <div className="text-[0.7rem] text-rose-400">{loginError}</div>
          )}
        </div>

        <div className="flex items-center justify-between text-[0.75rem]">
          <button
            onClick={() => void handleLogin()}
            disabled={loginBusy}
            className="px-3 py-1.5 rounded-full border border-sky-500/80 text-sky-100 hover:bg-sky-500/10 disabled:opacity-50"
          >
            {loginBusy ? "Signing in…" : "Sign in"}
          </button>
          <button
            onClick={() => {
              setUsername(GUEST_USERNAME_CONST);
              setSecretInput("");
              void handleLogin();
            }}
            className="px-3 py-1.5 rounded-full border border-slate-600/80 text-slate-200 hover:bg-slate-800/80"
          >
            Continue as guest
          </button>
        </div>

        <div className="text-[0.65rem] text-slate-500">
          This is a local development build. In a full installation, user
          accounts and permissions would be enforced by the underlying OS and
          backend services.
        </div>
      </div>
    </div>
  );
}















