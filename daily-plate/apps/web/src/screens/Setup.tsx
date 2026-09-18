import { useEffect, useState } from 'react';
import { DAY_TYPE_LABELS, isDecimal, type DayType } from '@daily-plate/domain';
import { useApp } from '../lib/store.js';
import { setDayType, updateGoals, updateUser } from '../lib/actions.js';
import { registerPasskey, isIos, isStandalone } from '../lib/passkeys.js';
import { PlateMark } from '../components/PlateMark.js';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** One-time confirmation of her own targets; no questionnaire. */
export function Setup() {
  const { db, api, engine, user, goals, today, toast, session, setSetupActive, navigate } = useApp();
  const [step, setStep] = useState<'targets' | 'passkey' | 'install'>('targets');
  const [rest, setRest] = useState(goals?.rest ?? { protein: '140', carbs: '130', fat: '45' });
  const [training, setTraining] = useState(goals?.training ?? { protein: '145', carbs: '165', fat: '40' });
  const [dayType, setDay] = useState<DayType>('rest');
  const [weekdays, setWeekdays] = useState<number[]>(user?.trainingWeekdays ?? []);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setSetupActive(true);
  }, [setSetupActive]);
  if (!user || !goals) return null;

  const confirm = async (): Promise<void> => {
    setError(null);
    for (const t of [rest, training]) for (const v of Object.values(t)) if (!isDecimal(v) || Number(v) <= 0) return setError('Targets must be numbers above zero.');
    setBusy(true);
    try {
      const changed = JSON.stringify(rest) !== JSON.stringify(goals.rest) || JSON.stringify(training) !== JSON.stringify(goals.training);
      if (changed) await updateGoals(db, goals, { rest, training, secondary: goals.secondary });
      await updateUser(db, user, { trainingWeekdays: weekdays, setupConfirmed: true });
      await setDayType(db, today, dayType);
      void engine.notifyLocalChange();
      setStep((session?.passkeyCount ?? 0) > 0 ? 'install' : 'passkey');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  const addPasskey = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await registerPasskey(api, 'This phone');
      toast('Unlock is set up on this phone.');
      setStep('install');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not set up unlock. You can try again under Settings.');
    } finally {
      setBusy(false);
    }
  };

  const numField = (label: string, value: string, onChange: (v: string) => void, id: string) => (
    <div className="field grow">
      <label htmlFor={id}>{label}</label>
      <input id={id} className="input" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );

  return (
    <main className="screen" style={{ paddingBottom: 40 }}>
      <div className="stack" style={{ marginTop: 16 }}>
        <div className="hero">
          <PlateMark size={56} />
          <h1>Hi {user.displayName}</h1>
        </div>

        {step === 'targets' && (
          <>
            <div className="card stack">
              <h2>Your daily goals</h2>
              <p className="muted small">These are the numbers you gave. Change anything that's off. The 165 g on training days is taken as carbohydrates.</p>
              <h3>Rest day</h3>
              <div className="row">
                {numField('Protein g', rest.protein, (v) => setRest({ ...rest, protein: v }), 'rest-p')}
                {numField('Carbs g', rest.carbs, (v) => setRest({ ...rest, carbs: v }), 'rest-c')}
                {numField('Fat g', rest.fat, (v) => setRest({ ...rest, fat: v }), 'rest-f')}
              </div>
              <h3>Training day</h3>
              <div className="row">
                {numField('Protein g', training.protein, (v) => setTraining({ ...training, protein: v }), 'tr-p')}
                {numField('Carbs g', training.carbs, (v) => setTraining({ ...training, carbs: v }), 'tr-c')}
                {numField('Fat g', training.fat, (v) => setTraining({ ...training, fat: v }), 'tr-f')}
              </div>
              <p className="muted small">Fiber and sugar are shown every day without a target unless you set one later.</p>
            </div>
            <div className="card stack">
              <h2>Today is a…</h2>
              <div className="segmented" role="group" aria-label="Today's day type">
                {(['rest', 'training'] as DayType[]).map((t) => (
                  <button key={t} type="button" aria-pressed={dayType === t} onClick={() => setDay(t)}>
                    {DAY_TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
              <p className="small muted">Usual training days (optional; you can always switch a day on Today):</p>
              <div className="chips" role="group" aria-label="Training weekdays">
                {WEEKDAYS.map((d, i) => (
                  <button key={d} type="button" className="chip" aria-pressed={weekdays.includes(i)} onClick={() => setWeekdays(weekdays.includes(i) ? weekdays.filter((x) => x !== i) : [...weekdays, i].sort())}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
            {error && (
              <p className="error-text" role="alert">
                {error}
              </p>
            )}
            <button type="button" className="btn btn-primary btn-lg" disabled={busy} onClick={() => void confirm()}>
              Looks right
            </button>
          </>
        )}

        {step === 'passkey' && (
          <div className="card stack">
            <h2>Quick unlock</h2>
            <p>Set up Face ID or Touch ID so opening the app never asks for a password. This uses your phone's own passkey.</p>
            {error && (
              <p className="error-text" role="alert">
                {error}
              </p>
            )}
            <button type="button" className="btn btn-primary btn-lg" disabled={busy} onClick={() => void addPasskey()}>
              Set up unlock
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => setStep('install')}>
              Later
            </button>
          </div>
        )}

        {step === 'install' && (
          <div className="card stack">
            <h2>Put it on your Home Screen</h2>
            {isStandalone() ? (
              <p>Done. You're using the Home Screen app.</p>
            ) : isIos() ? (
              <ol style={{ paddingLeft: 22, margin: 0 }} className="stack-sm">
                <li>Tap the Share button at the bottom of Safari.</li>
                <li>Choose <b>Add to Home Screen</b>.</li>
                <li>Tap <b>Add</b>. Open Daily Plate from the icon from now on.</li>
              </ol>
            ) : (
              <p>In your browser's menu choose "Add to Home Screen" or "Install app".</p>
            )}
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={() => {
                setSetupActive(false);
                navigate('today');
              }}
            >
              Start logging
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
