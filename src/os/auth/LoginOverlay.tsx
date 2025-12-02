import React, { useEffect, useState } from "react";
import {
  UserProfile,
  createUser,
  loadUsers,
  saveUsers,
  touchUser,
} from "./UserStore";

interface LoginOverlayProps {
  currentUser: UserProfile | null;
  onLogin: (user: UserProfile) => void;
}

/**
 * LoginOverlay
 *
 * Front-end only login shell.
 * - Blocks interaction until a user is chosen
 * - Remembers all users on this device
 * - Shows &quot;secure OS&quot; vibes without real auth
 */
export function LoginOverlay({ currentUser, onLogin }: LoginOverlayProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [newName, setNewName] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const u = loadUsers();
    setUsers(u);
    if (u.length > 0) {
      setSelectedId(u[0].id);
    }
  }, []);

  // Once logged in, overlay disappears completely
  if (currentUser) return null;

  function handleLogin(user: UserProfile) {
    const updated = touchUser(users, user.id);
    setUsers(updated);
    saveUsers(updated);
    onLogin(updated.find((u) => u.id === user.id) ?? user);
  }

  function handleConfirm() {
    const user = users.find((u) => u.id === selectedId);
    if (!user) return;
    handleLogin(user);
  }

  function handleCreate() {
    if (!newName.trim()) return;
    const user = createUser(newName);
    const updated = [...users, user];
    setUsers(updated);
    saveUsers(updated);
    setNewName("");
    setSelectedId(user.id);
    handleLogin(user);
  }

  const sortedUsers = [...users].sort(
    (a, b) => b.lastLoginAt - a.lastLoginAt
  );

  return (
    <div className="absolute inset-0 z-[999] bg-slate-950/95 backdrop-blur-2xl flex items-center justify-center">
      <div className="w-full max-w-3xl rb-glass rounded-3xl border border-slate-800/80 bg-slate-950/90 p-5 flex flex-col gap-4 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-2xl font-semibold bg-gradient-to-r from-sky-400 via-fuchsia-400 to-emerald-400 text-transparent bg-clip-text">
              RedByte Secure Shell
            </div>
            <p className="text-[0.75rem] text-slate-400 max-w-md mt-1">
              Choose a user profile to enter the OS. Profiles are stored
              locally on this device so you can keep different workspaces
              separate. This is a demo identity layer — not real authentication.
            </p>
          </div>
          <div className="flex flex-col items-end text-[0.7rem] text-slate-500 font-mono">
            <span>IDENTITY LAYER v37</span>
            <span>LOCAL-ONLY • NON-CRYPTO</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1.1fr] gap-4">
          {/* Existing users */}
          <section className="rb-glass rounded-2xl border border-slate-800/80 bg-slate-950/90 p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-[0.8rem] font-semibold text-slate-100">
                Users on this device
              </h2>
              <span className="text-[0.65rem] text-slate-500">
                {sortedUsers.length} profile
                {sortedUsers.length === 1 ? "" : "s"}
              </span>
            </div>
            {sortedUsers.length === 0 ? (
              <div className="text-[0.75rem] text-slate-500">
                No profiles yet. Create your first user on the right.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {sortedUsers.map((u) => {
                  const isSelected = selectedId === u.id;
                  return (
                    <button
                      key={u.id}
                      onClick={() => setSelectedId(u.id)}
                      className={`text-left rb-glass rounded-2xl border px-3 py-2 flex flex-col gap-1 hover:border-sky-500/80 ${
                        isSelected
                          ? "border-sky-500/80 ring-1 ring-sky-500/60 bg-slate-900/80"
                          : "border-slate-800/80 bg-slate-950/80"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="h-8 w-8 rounded-2xl flex items-center justify-center text-sm font-semibold text-slate-950"
                          style={{ backgroundColor: u.color }}
                        >
                          {u.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[0.8rem] text-slate-100">
                            {u.name}
                          </span>
                          <span className="text-[0.65rem] text-slate-400 font-mono">
                            {u.tag}
                          </span>
                        </div>
                      </div>
                      <div className="text-[0.65rem] text-slate-500 font-mono">
                        Last login:{" "}
                        {new Date(u.lastLoginAt).toLocaleString()}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="mt-2 flex items-center justify-between text-[0.7rem]">
              <span className="text-slate-500">
                Select a profile and press{" "}
                <span className="text-slate-200">Enter OS</span>.
              </span>
              <button
                onClick={handleConfirm}
                disabled={!selectedId}
                className="px-3 py-1 rounded-full border text-[0.7rem] disabled:opacity-40 border-sky-500/80 text-sky-200 hover:bg-sky-500/10"
              >
                Enter OS
              </button>
            </div>
          </section>

          {/* New user */}
          <section className="rb-glass rounded-2xl border border-slate-800/80 bg-slate-950/90 p-3 flex flex-col gap-2">
            <h2 className="text-[0.8rem] font-semibold text-slate-100 mb-1">
              Create new user
            </h2>
            <p className="text-[0.7rem] text-slate-400 mb-1">
              This creates a local profile with its own sessions and &quot;last
              login&quot; history. No passwords, no backend — it is meant for
              teaching, demos and OS vibes.
            </p>
            <input
              className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-3 py-1.5 text-[0.8rem] text-slate-100 focus:outline-none focus:border-sky-500/80"
              placeholder="New user name (e.g. Connor, Teaching Lab, Guest)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <button
              onClick={handleCreate}
              disabled={!newName.trim()}
              className="mt-2 px-3 py-1.5 rounded-full border border-emerald-500/80 text-[0.8rem] text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-40"
            >
              Create & enter as new user
            </button>

            <div className="mt-auto text-[0.65rem] text-slate-500">
              For real deployments, this layer would plug into proper auth
              (OAuth, email login, etc.). Here it is intentionally lightweight
              so you can show the OS to anyone without configuration.
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
