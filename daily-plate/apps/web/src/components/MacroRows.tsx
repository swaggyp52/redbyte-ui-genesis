import { MACRO_KEYS, NUTRIENT_LABELS, formatDisplay, totalCopy, type MacroKey, type NutrientTotal } from '@daily-plate/domain';
import type { DayView } from '../lib/selectors.js';

/**
 * The home screen's reason to exist: for each of protein, carbs and fat,
 * how much she has eaten and how much is left, in words, with a track to
 * reinforce it. The text is authoritative; the bar is decoration.
 */
export function MacroBoard({ view }: { view: DayView }) {
  return (
    <div className="macro-board" role="list" aria-label="Daily goals">
      {MACRO_KEYS.map((key) => (
        <MacroRow key={key} macro={key} view={view} />
      ))}
    </div>
  );
}

function foodsWord(n: number): string {
  return `${n} food${n === 1 ? '' : 's'}`;
}

function MacroRow({ macro, view }: { macro: MacroKey; view: DayView }) {
  const p = view.progress[macro];
  const t = view.totals[macro];
  const name = NUTRIENT_LABELS[macro];
  const eaten = formatDisplay(p.consumed, 0);
  const goal = formatDisplay(p.target, 0);
  const pct = Math.round(p.fraction * 100);
  const second = p.over ? { value: formatDisplay(p.overBy, 0), word: 'over' } : { value: formatDisplay(p.remaining, 0), word: 'left' };
  let note: string | null = null;
  if (p.provisional) note = t.unknownCount > 0 ? `${foodsWord(t.unknownCount)} missing ${name.toLowerCase()}, so this is provisional` : 'Some foods give only an upper bound';
  const label = `${name}: ${p.approximate ? 'about ' : ''}${eaten} of ${goal} grams. ${second.value} g ${second.word}${note ? `. ${note}` : ''}`;
  return (
    <div className="macro" role="listitem" aria-label={label}>
      <div className="macro-head" aria-hidden="true">
        <span className="macro-name">{name}</span>
        <span className="macro-goal">goal {goal} g</span>
      </div>
      <div className="macro-figures" aria-hidden="true">
        <span className="macro-fig">
          <b className="num">
            {p.approximate ? '~' : ''}
            {eaten} g
          </b>
          <small>eaten</small>
        </span>
        <span className={`macro-fig right${p.over ? ' over' : ''}`}>
          <b className="num">{second.value} g</b>
          <small>{second.word}</small>
        </span>
      </div>
      <div className="macro-track" aria-hidden="true">
        <div className={`macro-fill${p.over ? ' over' : ''}${p.provisional ? ' provisional' : ''}`} style={{ width: `${pct}%` }} />
      </div>
      {note && (
        <span className="macro-note" aria-hidden="true">
          {note}
        </span>
      )}
    </div>
  );
}

function secondaryText(key: 'fiber' | 'sugar' | 'calories', total: NutrientTotal, target?: string): { visible: string; detail: string | null; label: string } {
  const c = totalCopy(key, total, 0);
  const name = NUTRIENT_LABELS[key];
  const value = `${c.approximate ? '~' : ''}${c.value} ${c.unit}`;
  const goal = target ? ` of ${target}` : '';
  const detail = total.unknownCount > 0 ? `${foodsWord(total.unknownCount)} unknown` : total.lessThanCount > 0 ? `plus a little more` : null;
  const known = total.unknownCount > 0 ? ' known' : '';
  return { visible: `${value}${goal}`, detail, label: `${name}: ${c.approximate ? 'about ' : ''}${c.value} ${c.unit}${known}${goal}${detail ? `, ${detail}` : ''}` };
}

/** Fiber and sugar matter to her but have no goals; calories only when a source gave them. Small and subordinate. */
export function SecondaryLine({ view }: { view: DayView }) {
  const items: Array<{ key: 'fiber' | 'sugar' | 'calories'; target?: string }> = [{ key: 'fiber', ...(view.day.secondary.fiber ? { target: view.day.secondary.fiber } : {}) }, { key: 'sugar', ...(view.day.secondary.sugar ? { target: view.day.secondary.sugar } : {}) }];
  if (view.totals.calories.itemCount > 0) items.push({ key: 'calories' });
  return (
    <div className="secondary-line" role="list" aria-label="Also today">
      {items.map(({ key, target }) => {
        const s = secondaryText(key, view.totals[key], target);
        return (
          <span className="secondary-item" role="listitem" aria-label={s.label} key={key}>
            <span className="secondary-name">{NUTRIENT_LABELS[key]}</span>
            <b className="num">{s.visible}</b>
            {s.detail && <small>{s.detail}</small>}
          </span>
        );
      })}
    </div>
  );
}
