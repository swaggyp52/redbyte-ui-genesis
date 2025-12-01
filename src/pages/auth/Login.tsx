import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAppState } from "../../state/AppState";

export default function Login() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, user } = useAppState();
  const navigate = useNavigate();
  const location = useLocation() as any;
  const from = location.state?.from || "/";

  useEffect(() => {
    if (user) navigate(from, { replace: true });
  }, [user, from, navigate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setTimeout(() => {
      login(email);
      navigate(from, { replace: true });
    }, 500);
  };

  return (
    <div className="flex items-center justify-center min-h-[80vh] px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-950/90 p-8 text-white shadow-xl"
      >
        <h1 className="text-2xl font-black mb-2">Sign in</h1>
        <p className="text-xs text-neutral-400 mb-6">
          Demo login only. Any email works.
        </p>

        <label className="text-xs font-semibold mb-1 block">Email</label>
        <input
          className="w-full px-3 py-2 mb-4 bg-neutral-900 rounded-xl border border-neutral-800 text-xs outline-none focus:border-red-500"
          placeholder="you@redbyte.dev"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <button
          type="submit"
          disabled={loading || !email}
          className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-xs font-semibold"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

