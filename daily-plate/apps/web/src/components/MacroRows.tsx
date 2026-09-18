import { MACRO_KEYS, NUTRIENT_LABELS, formatDisplay, totalCopy, type MacroKey } from '@daily-plate/domain';
import type { DayView } from '../lib/selectors.js';

export function MacroRows({ view }: { view: DayView }) {
  return (
    <div className="stack" role="list" aria-label="Daily targets">
      {MACRO_KEYS.map((key) => (
        <MacroRow key={key} macro={key} view={view} />
      ))}
    </div>
  );
}

function MacroRow({ macro, view }: { macro: MacroKey; view: DayView }) {
  const p = view.progress[macro];
  const t = view.totals[macro];
  const consumed = formatDisplay(p.consumed, 0);
  const target = formatDisplay(p.target, 0);
  const pct = Math.round(p.fraction * 100);
  let note: string;
  if (p.over) note = `${formatDisplay(p.overBy, 0)} g above your target`;
  else note = `${formatDisplay(p.remaining, 0)} g remaining`;
  if (p.provisional) note += t.unknownCount > 0 ? ` · ${t.unknownCount} item${t.unknownCount === 1 ? '' : 's'} missing ${NUTRIENT_LABELS[macro].toLowerCase()}` : ' · some items give only a bound';
  const label = `${NUTRIENT_LABELS[macro]}: ${p.approximate ? 'about ' : ''}${consumed} of ${target} grams. ${note}`;
  return (
    <div className="macro" role="listitem" aria-label={label}>
      <span className="macro-name">{NUTRIENT_LABELS[macro]}</span>
      <span className="macro-nums num" aria-hidden="true">
        {p.approximate ? '~' : ''}
        {consumed} <small>of {target} g</small>
      </span>
      <div className="macro-track" aria-hidden="true">
        <div className={`macro-fill${p.over ? ' over' : ''}${p.provisional ? ' provisional' : ''}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`macro-note${p.over ? ' over' : ''}`} aria-hidden="true">
        {note}
      </span>
    </div>
  );
}

export function SecondaryTotals({ view }: { view: DayView }) {
  const fiber = totalCopy('fiber', view.totals.fiber, 0);
  const sugar = totalCopy('sugar', view.totals.sugar, 0);
  const cal = totalCopy('calories', view.totals.calories, 0);
  const tile = (label: string, c: typeof fiber, target?: string) => (
    <div className="tile" role="listitem" aria-label={`${label}: ${c.approximate ? 'about ' : ''}${c.value} ${c.unit}${target ? ` of ${target}` : ''}${c.note ? `. ${c.note}` : ''}`}>
      <div className="small muted">{label}</div>
      <div>
        <b className="num">
          {c.approximate ? '~' : ''}
          {c.value}
        </b>{' '}
        <span className="small muted">
          {c.unit}
          {target ? ` of ${target}` : ''}
        </span>
      </div>
      {c.note && <div className="small muted">{c.note}</div>}
    </div>
  );
  return (
    <div className="secondary-totals" role="list" aria-label="Also tracked">
      {tile('Fiber', fiber, view.day.secondary.fiber)}
      {tile('Sugar', sugar, view.day.secondary.sugar)}
      {view.totals.calories.itemCount > 0 && tile('Calories (from sources)', cal)}
    </div>
  );
}
