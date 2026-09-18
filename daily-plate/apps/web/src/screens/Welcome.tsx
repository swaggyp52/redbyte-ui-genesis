import { useEffect, useState } from 'react';
import { useApp } from '../lib/store.js';
import { ApiError, OfflineError } from '../lib/api.js';
import { loginWithPasskey, passkeysAvailable } from '../lib/passkeys.js';
import { PlateMark } from '../components/PlateMark.js';

/** Reads and immediately removes an invite token from the URL fragment. */
export function takeInviteFromUrl(): string | null {
  const m = /[#&]invite=([A-Za-z0-9_-]{20,})/.exec(window.location.hash);
  if (!m) return null;
  window.history.replaceState(null, '', window.location.pathname);
  return m[1] ?? null;
}

export function Welcome({ inviteToken }: { inviteToken: string | null }) {
  const { api, refreshSession, timeZone } = useApp();
  const [peek, setPeek] = useState<{ valid: boolean; recovery: boolean; displayName: string | null } | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canPasskey, setCanPasskey] = useState(false);

  useEffect(() => {
    void passkeysAvailable().then(setCanPasskey);
    if (!inviteToken) return;
    api
      .peekInvite(inviteToken)
      .then((p) => {
        setPeek(p);
        if (p.displayName) setName(p.displayName);
      })
      .catch(() => setPeek({ valid: false, recovery: false, displayName: null }));
  }, [api, inviteToken]);

  const connect = async (): Promise<void> => {
    if (!inviteToken) return;
    setBusy(true);
    setError(null);
    try {
      await api.redeemInvite(inviteToken, name.trim() || undefined, timeZone);
      await refreshSession();
    } catch (err) {
      setError(err instanceof OfflineError ? 'No connection right now. Try again when you are online.' : err instanceof ApiError ? err.message : 'Could not connect.');
      setBusy(false);
    }
  };

  const unlock = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await loginWithPasskey(api);
      await refreshSession();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not unlock with a passkey on this phone.');
      setBusy(false);
    }
  };

  return (
    <main className="screen" style={{ paddingBottom: 40 }}>
      <div className="stack" style={{ marginTop: 24 }}>
        <div className="hero">
          <PlateMark size={72} title="Daily Plate" />
          <div>
            <h1>Daily Plate</h1>
            <p className="muted">Log what you had. See where you stand. Get on with your day.</p>
          </div>
        </div>

        {inviteToken && peek === null && <p className="muted">Checking your invitation…</p>}
        {inviteToken && peek && !peek.valid && <div className="banner banner-coral">This invitation is no longer valid. Ask for a new link.</div>}
        {inviteToken && peek?.valid && (
          <div className="card stack">
            <h2>{peek.recovery ? 'Reconnect this phone' : 'Set up this phone'}</h2>
            {!peek.recovery && (
              <div className="field">
                <label htmlFor="welcome-name">What should we call you?</label>
                <input id="welcome-name" className="input input-lg" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
              </div>
            )}
            <p className="small muted">Your food journal is kept on a computer at home, not on a company's server. The person who runs that computer can technically see its data.</p>
            {error && (
              <p className="error-text" role="alert">
                {error}
              </p>
            )}
            <button type="button" className="btn btn-primary btn-lg" disabled={busy} onClick={() => void connect()}>
              {busy ? 'Connecting…' : 'Connect this phone'}
            </button>
          </div>
        )}

        {!inviteToken && (
          <div className="card stack">
            <p>This is a private journal. To start, open the invitation link you were sent on this phone.</p>
            {canPasskey && (
              <button type="button" className="btn btn-primary btn-lg" disabled={busy} onClick={() => void unlock()}>
                Unlock
              </button>
            )}
            {error && (
              <p className="error-text" role="alert">
                {error}
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
