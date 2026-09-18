import { useEffect, useState } from 'react';
import { useApp } from '../lib/store.js';
import { ApiError, OfflineError } from '../lib/api.js';
import { loginWithPasskey, passkeysAvailable } from '../lib/passkeys.js';
import { PlateMark } from '../components/PlateMark.js';

export function Unlock({ onPeek }: { onPeek: () => void }) {
  const { api, refreshSession, sync, user } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canPasskey, setCanPasskey] = useState<boolean | null>(null);
  useEffect(() => {
    void passkeysAvailable().then(setCanPasskey);
  }, []);

  const unlock = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await loginWithPasskey(api);
      await refreshSession();
    } catch (err) {
      setError(err instanceof OfflineError ? 'No connection right now. Your diary is still here; unlock when you are back online.' : err instanceof ApiError ? err.message : 'That did not work. Try again, or ask for a new invitation link.');
      setBusy(false);
    }
  };

  return (
    <main className="screen" style={{ paddingBottom: 40 }}>
      <div className="stack" style={{ marginTop: 24 }}>
        <div className="hero">
          <PlateMark size={64} title="Daily Plate" />
          <div>
            <h1>Welcome back{user ? `, ${user.displayName}` : ''}</h1>
            <p className="muted">Unlock to keep saving to your journal.</p>
          </div>
        </div>
        {sync.pending > 0 && (
          <div className="banner banner-gold">
            {sync.pending} entr{sync.pending === 1 ? 'y is' : 'ies are'} on this phone waiting to save. They will be sent after you unlock.
          </div>
        )}
        <div className="card stack">
          {canPasskey === false && <p className="muted small">This phone has no passkey for Daily Plate. Ask for a new invitation link to reconnect.</p>}
          <button type="button" className="btn btn-primary btn-lg" disabled={busy || canPasskey === false} onClick={() => void unlock()}>
            {busy ? 'Unlocking…' : 'Unlock'}
          </button>
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          <button type="button" className="btn btn-quiet" onClick={onPeek}>
            See my diary without saving
          </button>
        </div>
      </div>
    </main>
  );
}
