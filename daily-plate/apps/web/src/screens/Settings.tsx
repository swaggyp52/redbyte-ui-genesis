import { useEffect, useState } from 'react';
import { isDecimal } from '@daily-plate/domain';
import { useApp } from '../lib/store.js';
import { updateGoals, updateUser } from '../lib/actions.js';
import { clearAll } from '../lib/db.js';
import { registerPasskey, isIos, isStandalone } from '../lib/passkeys.js';
import { Sheet } from '../components/Sheet.js';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
declare const __APP_VERSION__: string;

export function Settings() {
  const { db, api, engine, user, goals, sync, toast, signOut, session, storagePersisted, navigate } = useApp();
  const [rest, setRest] = useState(goals?.rest ?? { protein: '140', carbs: '130', fat: '45' });
  const [training, setTraining] = useState(goals?.training ?? { protein: '145', carbs: '165', fat: '40' });
  const [fiber, setFiber] = useState(goals?.secondary.fiber ?? '');
  const [sugar, setSugar] = useState(goals?.secondary.sugar ?? '');
  const [weekdays, setWeekdays] = useState<number[]>(user?.trainingWeekdays ?? []);
  const [passkeys, setPasskeys] = useState<Array<{ id: string; label: string | null; createdAt: string }>>([]);
  const [confirmOut, setConfirmOut] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    api
      .request<{ passkeys: Array<{ id: string; label: string | null; createdAt: string }> }>('GET', '/api/v1/auth/passkeys')
      .then((r) => setPasskeys(r.passkeys))
      .catch(() => undefined);
  }, [api, session]);

  if (!user || !goals) return null;

  const saveTargets = async (): Promise<void> => {
    setMsg(null);
    for (const t of [rest, training]) for (const v of Object.values(t)) if (!isDecimal(v) || Number(v) <= 0) return setMsg('Goals must be numbers above zero.');
    for (const v of [fiber, sugar]) if (v.trim() && (!isDecimal(v.trim()) || Number(v) <= 0)) return setMsg('Fiber and sugar goals must be numbers, or left blank.');
    await updateGoals(db, goals, { rest, training, secondary: { ...(fiber.trim() ? { fiber: fiber.trim() } : {}), ...(sugar.trim() ? { sugar: sugar.trim() } : {}) } });
    await updateUser(db, user, { trainingWeekdays: weekdays });
    void engine.notifyLocalChange();
    toast('Saved. Applies from today onward; past days keep their goals.');
  };

  const exportData = async (): Promise<void> => {
    try {
      const data = await api.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'daily-plate-export.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast('Export needs a connection to your Pi.');
    }
  };

  const numField = (label: string, value: string, onChange: (v: string) => void, id: string) => (
    <div className="field grow">
      <label htmlFor={id}>{label}</label>
      <input id={id} className="input" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );

  return (
    <main className="screen" aria-labelledby="settings-title">
      <header className="screen-head">
        <h1 id="settings-title">Settings</h1>
        <button type="button" className="btn btn-quiet" onClick={() => navigate('today')}>
          Done
        </button>
      </header>
      <div className="stack">
        <section className="card stack" aria-labelledby="s-targets">
          <h2 id="s-targets">Daily goals</h2>
          <h3>Rest day</h3>
          <div className="row">
            {numField('Protein g', rest.protein, (v) => setRest({ ...rest, protein: v }), 's-rest-p')}
            {numField('Carbs g', rest.carbs, (v) => setRest({ ...rest, carbs: v }), 's-rest-c')}
            {numField('Fat g', rest.fat, (v) => setRest({ ...rest, fat: v }), 's-rest-f')}
          </div>
          <h3>Training day</h3>
          <div className="row">
            {numField('Protein g', training.protein, (v) => setTraining({ ...training, protein: v }), 's-tr-p')}
            {numField('Carbs g', training.carbs, (v) => setTraining({ ...training, carbs: v }), 's-tr-c')}
            {numField('Fat g', training.fat, (v) => setTraining({ ...training, fat: v }), 's-tr-f')}
          </div>
          <h3>Optional</h3>
          <div className="row">
            {numField('Fiber g (blank = none)', fiber, setFiber, 's-fiber')}
            {numField('Sugar g (blank = none)', sugar, setSugar, 's-sugar')}
          </div>
          <div className="field">
            <span className="label">Usual training days</span>
            <div className="chips" role="group" aria-label="Training weekdays">
              {WEEKDAYS.map((d, i) => (
                <button key={d} type="button" className="chip" aria-pressed={weekdays.includes(i)} onClick={() => setWeekdays(weekdays.includes(i) ? weekdays.filter((x) => x !== i) : [...weekdays, i].sort())}>
                  {d}
                </button>
              ))}
            </div>
          </div>
          {msg && (
            <p className="error-text" role="alert">
              {msg}
            </p>
          )}
          <button type="button" className="btn btn-primary" onClick={() => void saveTargets()}>
            Save goals
          </button>
        </section>

        <section className="card stack" aria-labelledby="s-access">
          <h2 id="s-access">Access</h2>
          <p className="small muted">Signed in as {user.displayName}. Time zone {user.timeZone}.</p>
          {passkeys.length === 0 ? <p className="small">No quick unlock on this account yet.</p> : <p className="small">{passkeys.length} passkey{passkeys.length === 1 ? '' : 's'} set up.</p>}
          <div className="row">
            <button type="button" className="btn btn-secondary grow" onClick={() => void registerPasskey(api, 'This phone').then((n) => { setPasskeys((p) => [...p, { id: String(n), label: 'This phone', createdAt: new Date().toISOString() }]); toast('Unlock added'); }).catch((e: unknown) => toast(e instanceof Error ? e.message : 'Could not add unlock'))}>
              Add unlock on this phone
            </button>
            <button type="button" className="btn btn-secondary grow" onClick={() => void api.revokeOthers().then((r) => toast(`Signed out ${r.revoked} other device${r.revoked === 1 ? '' : 's'}`)).catch(() => toast('Needs a connection'))}>
              Sign out other devices
            </button>
          </div>
          <button type="button" className="btn btn-danger" onClick={() => setConfirmOut(true)}>
            Sign out on this phone
          </button>
        </section>

        <section className="card stack" aria-labelledby="s-data">
          <h2 id="s-data">Your data</h2>
          <p className="small">
            Your journal is stored on a home computer, not a company server. The person running it can technically see the data. Nothing is sent anywhere else except a food name or barcode to USDA or Open Food Facts when you search.
          </p>
          <p className="small muted">
            Phone storage: {storagePersisted === true ? 'the browser agreed to keep it' : storagePersisted === false ? 'the browser may clear it if space runs low; entries are safe once saved to the Pi' : 'checking'}.
            {sync.lastSyncAt ? ` Last saved to the Pi ${new Date(sync.lastSyncAt).toLocaleString()}.` : ''}
          </p>
          <button type="button" className="btn btn-secondary" onClick={() => void exportData()}>
            Download everything (JSON)
          </button>
        </section>

        <section className="card stack" aria-labelledby="s-install">
          <h2 id="s-install">Home Screen</h2>
          {isStandalone() ? <p className="small">You're using the Home Screen app.</p> : isIos() ? <p className="small">In Safari tap Share, then "Add to Home Screen", then Add.</p> : <p className="small">Use your browser menu's "Add to Home Screen" or "Install app".</p>}
          <p className="small muted">Daily Plate {typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : ''}</p>
        </section>
      </div>

      {confirmOut && (
        <Sheet title="Sign out?" onClose={() => setConfirmOut(false)}>
          <div className="stack">
            {sync.pending > 0 ? (
              <div className="banner banner-coral">{sync.pending} entr{sync.pending === 1 ? 'y has' : 'ies have'} not reached the Pi yet. Signing out now keeps them on this phone until you sign back in; wiping removes them for good.</div>
            ) : (
              <p>Your saved entries stay on the Pi. This phone will need to unlock again.</p>
            )}
            <button type="button" className="btn btn-primary btn-lg" onClick={() => void signOut().then(() => setConfirmOut(false))}>
              Sign out (keep this phone's copy)
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => void signOut().then(() => clearAll(db)).then(() => { engine.dispose(); window.location.assign('/'); })}
            >
              Sign out and wipe this phone's copy
            </button>
          </div>
        </Sheet>
      )}
    </main>
  );
}
