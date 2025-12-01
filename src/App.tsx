import React, { useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  Navigate,
  useLocation,
} from "react-router-dom";
import Dashboard from "./pages/dashboard/Dashboard";
import Login from "./pages/auth/Login";
import Pricing from "./pages/pricing/Pricing";
import Assistant from "./pages/assistant/Assistant";
import Marketplace from "./pages/marketplace/Marketplace";
import { useAppState } from "./state/AppState";

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { user } = useAppState();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}

function MainNav() {
  const { user, theme, toggleTheme, notifications, markAllRead, logout } =
    useAppState();
  const [openNotifications, setOpenNotifications] = useState(false);
  const [openProfile, setOpenProfile] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const isDark = theme === "dark";

  return (
    <nav
      className={
        "fixed top-0 left-0 right-0 z-50 border-b px-4 sm:px-8 py-3 flex items-center justify-between " +
        (isDark
          ? "bg-black/70 border-neutral-800 text-white"
          : "bg-white/70 border-neutral-200 text-black")
      }
    >
      <Link to="/" className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center text-xs font-black">
          RB
        </div>
        <div className="hidden sm:block">
          <div className="text-sm font-semibold">RedByte UI</div>
          <div className="text-[10px] opacity-70">Genesis • All Ultra</div>
        </div>
      </Link>

      <div className="flex items-center gap-3 sm:gap-6 text-xs sm:text-sm">
        <Link to="/pricing" className="hidden sm:inline opacity-80 hover:opacity-100">
          Pricing
        </Link>
        <Link to="/assistant" className="opacity-80 hover:opacity-100">
          AI
        </Link>
        <Link to="/marketplace" className="hidden sm:inline opacity-80 hover:opacity-100">
          Market
        </Link>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="h-8 w-8 rounded-full flex items-center justify-center border border-neutral-700/60 bg-neutral-900/70 hover:bg-neutral-800/90 text-xs"
        >
          {isDark ? "?" : "¤"}
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => {
              setOpenNotifications((o) => !o);
              markAllRead();
            }}
            className="relative h-8 w-8 rounded-full flex items-center justify-center border border-neutral-700/60 bg-neutral-900/70 hover:bg-neutral-800/90 text-xs"
          >
            ??
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 rounded-full bg-red-600 text-[9px] flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>
          {openNotifications && (
            <div className="absolute right-0 mt-2 w-72 max-h-80 overflow-y-auto rounded-2xl border border-neutral-700 bg-black/90 text-xs p-2 space-y-2 shadow-xl">
              {notifications.length === 0 && (
                <div className="opacity-60 text-center py-4 text-[11px]">
                  No notifications yet.
                </div>
              )}
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={
                    "rounded-xl px-3 py-2 border text-left " +
                    (n.read
                      ? "border-neutral-800 bg-neutral-900/80"
                      : "border-red-600/70 bg-neutral-900")
                  }
                >
                  <div className="text-[11px] font-semibold">{n.title}</div>
                  <div className="text-[10px] opacity-80">{n.body}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Profile */}
        <div className="relative">
          <button
            onClick={() => setOpenProfile((o) => !o)}
            className="h-8 w-8 rounded-full bg-gradient-to-br from-red-500 to-rose-600 text-[11px] font-bold flex items-center justify-center"
          >
            {user ? user[0]?.toUpperCase() : "?"}
          </button>
          {openProfile && (
            <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-neutral-700 bg-black/90 text-xs p-3 space-y-2 shadow-xl">
              <div className="text-[10px] uppercase opacity-60">Account</div>
              <div className="text-[11px] font-semibold truncate">
                {user ?? "Guest"}
              </div>
              <div className="border-t border-neutral-800 my-2" />
              {!user ? (
                <Link
                  to="/login"
                  className="block text-center px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-[11px] font-semibold"
                >
                  Sign in
                </Link>
              ) : (
                <button
                  onClick={logout}
                  className="w-full text-left px-3 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-[11px]"
                >
                  Sign out
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter basename="/redbyte-ui-genesis">
      <MainNav />
      <div className="pt-20 min-h-screen bg-gradient-to-b from-black via-neutral-950 to-black text-white">
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<Login />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route
            path="/assistant"
            element={
              <ProtectedRoute>
                <Assistant />
              </ProtectedRoute>
            }
          />
          <Route
            path="/marketplace"
            element={
              <ProtectedRoute>
                <Marketplace />
              </ProtectedRoute>
            }
          />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
