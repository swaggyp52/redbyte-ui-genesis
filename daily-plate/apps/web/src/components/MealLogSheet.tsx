import { useState } from 'react';
import type { MealSlot, Quantity } from '@daily-plate/contracts';
import { isDecimal } from '@daily-plate/domain';
import { Sheet } from './Sheet.js';
import { useApp } from '../lib/store.js';
import { addFoodEntry } from '../lib/actions.js';
import { quantityLabel } from '../lib/format.js';

export interface MealLike {
  name: string;
  items: Array<{ foodId: string; foodVersionId: string; quantity: Quantity }>;
}

interface Props {
  meal: MealLike;
  slot: MealSlot;
  localDate: string;
  title?: string | undefined;
  onClose: () => void;
  onDone: (count: number, entryIds: string[]) => void;
}

/**
 * Preview a saved meal (or a past day's meal) and log it: untick a part,
 * change an amount, add. The source meal is never modified.
 */
export function MealLogSheet({ meal, slot, localDate, title, onClose, onDone }: Props) {
  const { db, versions, foodMap, timeZone } = useApp();
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [amounts, setAmounts] = useState<Record<string, string>>(() => Object.fromEntries(meal.items.map((i) => [i.foodId + i.foodVersionId, i.quantity.amount])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toggle = (id: string): void => {
    const next = new Set(skipped);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSkipped(next);
  };
  const included = meal.items.filter((i) => !skipped.has(i.foodId));

  const add = async (): Promise<void> => {
    setError(null);
    for (const item of included) {
      const a = amounts[item.foodId + item.foodVersionId] ?? item.quantity.amount;
      if (!isDecimal(a) || Number(a) <= 0) return setError('Every amount must be a number above zero.');
    }
    setBusy(true);
    try {
      const groupId = crypto.randomUUID();
      const ids: string[] = [];
      for (const item of included) {
        const version = versions.get(item.foodVersionId);
        if (!version) throw new Error(`${foodMap.get(item.foodId)?.name ?? 'A food'} is not on this phone yet.`);
        const amount = amounts[item.foodId + item.foodVersionId] ?? item.quantity.amount;
        const { entry } = await addFoodEntry(db, { version, quantity: { amount, unit: item.quantity.unit }, mealSlot: slot, localDate, timeZone, groupId });
        ids.push(entry.id);
      }
      onDone(ids.length, ids);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add.');
      setBusy(false);
    }
  };

  return (
    <Sheet title={title ?? meal.name} onClose={onClose}>
      <div className="stack">
        <p className="muted small">Untick anything you didn't have. Change an amount if it was different this time.</p>
        <div className="list">
          {meal.items.map((item) => {
            const key = item.foodId + item.foodVersionId;
            const v = versions.get(item.foodVersionId);
            const f = foodMap.get(item.foodId);
            const on = !skipped.has(item.foodId);
            return (
              <div key={key} className="list-row" style={{ flexWrap: 'nowrap' }}>
                <input type="checkbox" checked={on} onChange={() => toggle(item.foodId)} style={{ width: 28, height: 28 }} aria-label={`Include ${f?.name ?? v?.name ?? 'item'}`} />
                <span>
                  <span className="name wrap">{f?.name ?? v?.name ?? 'Food'}</span>
                  <br />
                  <span className="sub">{v ? quantityLabel({ amount: amounts[key] ?? item.quantity.amount, unit: item.quantity.unit }, v) : 'not on this phone yet'}</span>
                </span>
                <input className="input" style={{ width: 84 }} inputMode="decimal" disabled={!on} value={amounts[key] ?? item.quantity.amount} onChange={(e) => setAmounts({ ...amounts, [key]: e.target.value.replace(',', '.') })} aria-label={`Amount of ${f?.name ?? 'item'}`} />
              </div>
            );
          })}
        </div>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <div className="sheet-actions">
          <button type="button" className="btn btn-primary btn-lg btn-block" disabled={busy || included.length === 0} onClick={() => void add()}>
            Add {included.length} item{included.length === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
