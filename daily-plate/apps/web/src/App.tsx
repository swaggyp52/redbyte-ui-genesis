import { useEffect, useState } from 'react';
import { AppProvider, useApp } from './lib/store.js';
import { BottomNav } from './components/BottomNav.js';
import { Toasts } from './components/Toasts.js';
import { Today } from './screens/Today.js';
import { AddFood } from './screens/AddFood.js';
import { MyFoods } from './screens/MyFoods.js';
import { Settings } from './screens/Settings.js';
import { Welcome, takeInviteFromUrl } from './screens/Welcome.js';
import { Unlock } from './screens/Unlock.js';
import { Setup } from './screens/Setup.js';
import { PlateMark } from './components/PlateMark.js';

export function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}

function Shell() {
  const app = useApp();
  const { auth, user, route, navigate, updateReady, applyUpdate, setUpdateHooks, sync, outbox, setupActive } = app;
  const [inviteToken, setInviteToken] = useState<string | null>(() => takeInviteFromUrl());
  const [peekLocked, setPeekLocked] = useState(false);

  // An invite fragment must never linger in the URL, even on a hash-only navigation.
  useEffect(() => {
    const onHash = (): void => {
      const t = takeInviteFromUrl();
      if (t) setInviteToken(t);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
    let cancelled = false;
    import('virtual:pwa-register')
      .then(({ registerSW }) => {
        const update = registerSW({
          immediate: true,
          onNeedRefresh() {
            if (!cancelled) setUpdateHooks(true, () => void update(true));
          },
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [setUpdateHooks]);

  if (auth === 'checking') {
    return (
      <main className="screen" aria-busy="true">
        <div className="hero" style={{ marginTop: 40 }}>
          <PlateMark size={56} />
          <p className="muted">Opening your journal…</p>
        </div>
      </main>
    );
  }

  if (auth === 'signed-out' || (auth === 'locked' && inviteToken)) return <Welcome inviteToken={inviteToken} />;
  if (auth === 'locked' && !peekLocked) return <Unlock onPeek={() => setPeekLocked(true)} />;
  if (auth === 'signed-in' && user && (!user.setupConfirmedAt || setupActive)) return <Setup />;

  const attention = outbox.filter((o) => o.status === 'attention');

  return (
    <>
      {updateReady && (
        <div className="banner banner-teal" role="status" style={{ margin: '8px 16px 0', maxWidth: 608, alignSelf: 'center', width: 'calc(100% - 32px)' }}>
          <div className="grow">A new version of Daily Plate is ready. Your entries are safe.</div>
          <button type="button" className="btn btn-primary" style={{ minHeight: 44 }} onClick={applyUpdate}>
            Update now
          </button>
        </div>
      )}
      {auth === 'locked' && (
        <div className="banner banner-gold" role="status" style={{ margin: '8px 16px 0', maxWidth: 608, alignSelf: 'center', width: 'calc(100% - 32px)' }}>
          <div className="grow">Viewing only. Unlock to save {sync.pending > 0 ? `${sync.pending} waiting entr${sync.pending === 1 ? 'y' : 'ies'}` : 'new entries'}.</div>
          <button type="button" className="btn btn-primary" style={{ minHeight: 44 }} onClick={() => setPeekLocked(false)}>
            Unlock
          </button>
        </div>
      )}
      {attention.length > 0 && route === 'today' && <AttentionList items={attention} />}
      {route === 'today' && <Today />}
      {route === 'add' && <AddFood />}
      {route === 'foods' && <MyFoods />}
      {route === 'settings' && <Settings />}
      {route !== 'settings' && (
        <button type="button" className="btn btn-quiet" style={{ position: 'fixed', top: 'calc(var(--safe-top) + 8px)', right: 8, minHeight: 44, zIndex: 10 }} onClick={() => navigate('settings')} aria-label="Settings">
          ⚙︎
        </button>
      )}
      <BottomNav />
      <Toasts />
    </>
  );
}

function AttentionList({ items }: { items: ReturnType<typeof useApp>['outbox'] }) {
  const { engine } = useApp();
  return (
    <div className="stack-sm" style={{ margin: '8px 16px 0', maxWidth: 608, alignSelf: 'center', width: 'calc(100% - 32px)' }}>
      {items.map((item) => (
        <div className="banner banner-coral" key={item.mutationId} role="alert">
          <div className="grow">
            <b>{item.mutation.payload.type.startsWith('diary') ? 'A diary change' : 'A change'} needs a decision.</b> {item.lastError ?? 'It was changed elsewhere.'}
          </div>
          {item.conflictCurrent !== undefined ? (
            <>
              <button type="button" className="btn btn-primary" style={{ minHeight: 44 }} onClick={() => void engine.retryAttentionOnCurrent(item.mutationId)}>
                Keep mine
              </button>
              <button type="button" className="btn btn-secondary" style={{ minHeight: 44 }} onClick={() => void engine.discardAttention(item.mutationId)}>
                Keep the Pi's
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-secondary" style={{ minHeight: 44 }} onClick={() => void engine.discardAttention(item.mutationId)}>
              Discard
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
