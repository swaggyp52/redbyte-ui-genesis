import { useApp } from '../lib/store.js';

/**
 * One honest line about where the diary stands with the Pi, shown only when
 * something is not simply saved. Nothing to say means nothing shown.
 */
export function SyncLine() {
  const { sync, engine, auth, refreshSession } = useApp();
  if (auth === 'locked') {
    return (
      <button type="button" className="badge badge-coral" style={{ border: 0, minHeight: 36 }} onClick={() => void refreshSession()}>
        Unlock to save
      </button>
    );
  }
  if (sync.attention > 0) return <span className="badge badge-coral">{sync.attention} need{sync.attention === 1 ? 's' : ''} a decision</span>;
  if (sync.pending > 0) {
    return (
      <button type="button" className="badge badge-gold" style={{ border: 0, minHeight: 36 }} onClick={() => void engine.sync()} aria-label={`${sync.pending} waiting to save. Tap to retry`}>
        {sync.pending} waiting to save
      </button>
    );
  }
  if (sync.state === 'offline') return <span className="badge">Offline · saved foods work</span>;
  if (sync.state === 'syncing') return <span className="badge">Saving…</span>;
  if (sync.state === 'error') return <span className="badge badge-gold">Will retry</span>;
  return null;
}
