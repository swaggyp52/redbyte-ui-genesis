import { useMemo, useState } from 'react';
import { buildDiarySnapshot, type DiaryEntry, type Food, type FoodVersion, type MealSlot, type Quantity } from '@daily-plate/contracts';
import { MACRO_KEYS, MEAL_SLOT_LABELS, NUTRIENT_KEYS, NUTRIENT_LABELS, add, formatDisplay, isDecimal, resolveQuantity, sub, valueCopy, type NutrientKey } from '@daily-plate/domain';
import { Sheet } from './Sheet.js';
import { basisLabel, unitName } from '../lib/format.js';
import type { DayView } from '../lib/selectors.js';

export interface PortionSheetProps {
  version: FoodVersion;
  food?: Food | undefined;
  dayView: DayView;
  initialQuantity?: Quantity | undefined;
  initialMealSlot: MealSlot;
  mode: 'add' | 'edit';
  entry?: DiaryEntry | undefined;
  onConfirm: (quantity: Quantity, mealSlot: MealSlot) => Promise<void> | void;
  onClose: () => void;
  onDelete?: (() => void) | undefined;
  onMove?: (() => void) | undefined;
  /** Secondary action such as "Check label" for a database result. */
  secondary?: { label: string; run: () => void } | undefined;
  /** Short provenance/notes shown under the name (e.g. source, warnings). */
  notes?: string[] | undefined;
}

interface UnitOption {
  key: string;
  label: string;
  unit: Quantity['unit'];
  step: string;
}

function unitOptions(version: FoodVersion): UnitOption[] {
  const out: UnitOption[] = [];
  const probe = (unit: Quantity['unit']): boolean => resolveQuantity({ basis: version.basis, portions: version.portions }, { amount: '1', unit }).ok;
  for (const p of version.portions) out.push({ key: `portion:${p.id}`, label: p.name, unit: { kind: 'portion', portionId: p.id }, step: '0.5' });
  if (version.basis.kind === 'serving' && version.portions.length === 0) out.push({ key: 'serving', label: 'serving', unit: { kind: 'serving' }, step: '0.5' });
  else if (version.basis.kind === 'serving' && !version.portions.some((p) => p.servings === '1')) out.push({ key: 'serving', label: 'serving', unit: { kind: 'serving' }, step: '0.5' });
  if (probe({ kind: 'mass', unit: 'g' })) {
    out.push({ key: 'g', label: 'g', unit: { kind: 'mass', unit: 'g' }, step: '10' });
    out.push({ key: 'oz', label: 'oz', unit: { kind: 'mass', unit: 'oz' }, step: '1' });
  }
  if (probe({ kind: 'volume', unit: 'ml' })) {
    out.push({ key: 'ml', label: 'ml', unit: { kind: 'volume', unit: 'ml' }, step: '10' });
    out.push({ key: 'floz', label: 'fl oz', unit: { kind: 'volume', unit: 'floz' }, step: '1' });
  }
  return out;
}

function unitKey(unit: Quantity['unit']): string {
  switch (unit.kind) {
    case 'serving':
      return 'serving';
    case 'portion':
      return `portion:${unit.portionId}`;
    case 'mass':
      return unit.unit;
    case 'volume':
      return unit.unit;
  }
}

export function PortionSheet(props: PortionSheetProps) {
  const { version, dayView, mode, onClose } = props;
  const options = useMemo(() => unitOptions(version), [version]);
  const initial = props.initialQuantity ?? version.defaultQuantity ?? (options[0] ? { amount: options[0].unit.kind === 'mass' || options[0].unit.kind === 'volume' ? '100' : '1', unit: options[0].unit } : { amount: '1', unit: { kind: 'serving' as const } });
  const [amountText, setAmountText] = useState(initial.amount);
  const [unit, setUnit] = useState<Quantity['unit']>(initial.unit);
  const [mealSlot, setMealSlot] = useState<MealSlot>(props.initialMealSlot);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = options.find((o) => o.key === unitKey(unit)) ?? options[0];
  const amountValid = isDecimal(amountText) && Number(amountText) > 0;
  const quantity: Quantity | null = amountValid ? { amount: amountText, unit } : null;
  const built = quantity ? buildDiarySnapshot(version, quantity) : null;

  const previewLine = useMemo(() => {
    if (!built || !built.ok) return null;
    const parts: string[] = [];
    for (const key of MACRO_KEYS) {
      const v = built.snapshot.nutrients[key];
      if (v.status === 'unknown') parts.push(`${NUTRIENT_LABELS[key].toLowerCase()} not known`);
      else parts.push(`${v.status === 'estimated' ? 'about ' : ''}${formatDisplay(v.amount, 1)} g ${NUTRIENT_LABELS[key].toLowerCase()}`);
    }
    return `Adds ${parts.slice(0, 2).join(' and ')}${parts[2] ? `, ${parts[2]}` : ''}.`;
  }, [built]);

  const step = (dir: 1 | -1): void => {
    const s = selected?.step ?? '0.5';
    const base = amountValid ? amountText : '0';
    const next = dir === 1 ? add(base, s) : sub(base, s);
    if (Number(next) <= 0) return;
    setAmountText(formatDisplay(next, 3));
  };

  const confirm = async (): Promise<void> => {
    if (!quantity || !built || !built.ok) return;
    setBusy(true);
    setError(null);
    try {
      await props.onConfirm(quantity, mealSlot);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
      setBusy(false);
    }
  };

  const quick = selected && (selected.unit.kind === 'portion' || selected.unit.kind === 'serving') ? ['0.5', '1', '1.5', '2'] : [];
  const uName = selected ? unitName(selected.unit, version, amountText) : '';

  return (
    <Sheet title={mode === 'add' ? 'How much?' : 'Change this entry'} onClose={onClose} closeLabel="Cancel">
      <div className="stack">
        <div>
          <h3 className="wrap">{version.name}</h3>
          <p className="muted small wrap">
            {version.brand ? `${version.brand} · ` : ''}
            {basisLabel(version)}
            {version.preparation !== 'unspecified' && version.preparation !== 'as-sold' ? ` · ${version.preparation}` : ''}
          </p>
          {props.notes?.map((n) => (
            <p key={n} className="small" style={{ marginTop: 6, color: 'var(--gold-ink)' }}>
              {n}
            </p>
          ))}
        </div>

        <div className="field">
          <label htmlFor="portion-amount">Amount</label>
          <div className="stepper">
            <button type="button" onClick={() => step(-1)} aria-label="Less">
              −
            </button>
            <input id="portion-amount" className="input" inputMode="decimal" value={amountText} onChange={(e) => setAmountText(e.target.value.replace(',', '.'))} aria-describedby="portion-unit-help" />
            <button type="button" onClick={() => step(1)} aria-label="More">
              +
            </button>
          </div>
          <div id="portion-unit-help" className="help">
            {amountValid ? `${amountText} ${uName}` : 'Enter a number greater than zero.'}
          </div>
          {quick.length > 0 && (
            <div className="chips" role="group" aria-label="Quick amounts">
              {quick.map((q) => (
                <button key={q} type="button" className="chip" aria-pressed={amountText === q} onClick={() => setAmountText(q)}>
                  {q === '0.5' ? '½' : q === '1.5' ? '1½' : q}
                </button>
              ))}
            </div>
          )}
        </div>

        {options.length > 1 && (
          <div className="field">
            <span className="label">Unit</span>
            <div className="chips" role="group" aria-label="Unit">
              {options.map((o) => (
                <button key={o.key} type="button" className="chip" aria-pressed={selected?.key === o.key} onClick={() => setUnit(o.unit)}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {built && !built.ok && <p className="error-text">{built.error.message}</p>}

        {built && built.ok && (
          <div className="card card-tint stack-sm" aria-live="polite">
            <p>
              <b>{previewLine}</b>
            </p>
            <div className="preview">
              {MACRO_KEYS.map((key) => {
                const p = dayView.progress[key];
                const v = built.snapshot.nutrients[key];
                const after = v.status === 'unknown' ? null : sub(p.remaining, v.amount);
                return (
                  <div className="cell" key={key}>
                    <b className="num">{after === null ? '?' : formatDisplay(after, 0)}</b>
                    <span>{NUTRIENT_LABELS[key]} left after</span>
                  </div>
                );
              })}
            </div>
            <details>
              <summary className="small">All nutrients for this amount</summary>
              <dl className="nutrients small" style={{ marginTop: 8 }}>
                {NUTRIENT_KEYS.map((key: NutrientKey) => (
                  <div key={key} style={{ display: 'contents' }}>
                    <dt>{NUTRIENT_LABELS[key]}</dt>
                    <dd>{valueCopy(key, built.snapshot.nutrients[key])}</dd>
                  </div>
                ))}
              </dl>
            </details>
          </div>
        )}

        <div className="field">
          <label htmlFor="portion-meal">Meal</label>
          <select id="portion-meal" className="select" value={mealSlot} onChange={(e) => setMealSlot(e.target.value as MealSlot)}>
            {(Object.keys(MEAL_SLOT_LABELS) as MealSlot[]).map((slot) => (
              <option key={slot} value={slot}>
                {MEAL_SLOT_LABELS[slot]}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="error-text" role="alert">{error}</p>}

        <div className="sheet-actions stack-sm">
          <button type="button" className="btn btn-primary btn-lg btn-block" disabled={!built || !built.ok || busy} onClick={() => void confirm()}>
            {mode === 'add' ? 'Add to this day' : 'Save change'}
          </button>
          {props.secondary && (
            <button type="button" className="btn btn-secondary btn-block" onClick={props.secondary.run}>
              {props.secondary.label}
            </button>
          )}
          {mode === 'edit' && (
            <div className="row">
              {props.onMove && (
                <button type="button" className="btn btn-secondary grow" onClick={props.onMove}>
                  Move to another day
                </button>
              )}
              {props.onDelete && (
                <button type="button" className="btn btn-danger grow" onClick={props.onDelete}>
                  Remove
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </Sheet>
  );
}
