import { useEffect, useState } from 'react';
import { shiftLocalDate, weekdayOf } from '@daily-plate/domain';
import { longDate } from '../lib/format.js';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface WeekStripProps {
  selected: string;
  today: string;
  datesWithEntries: Set<string>;
  onSelect: (localDate: string) => void;
}

/** Viewport width measured in root ems, so large text narrows the strip rather than crushing it. */
function useRemWidth(): number {
  const read = (): number => (typeof window === 'undefined' ? 24 : window.innerWidth / (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16));
  const [w, setW] = useState(read);
  useEffect(() => {
    const on = (): void => setW(read());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return w;
}

/**
 * The days around the selected day, always visible on Today. Tap a day to
 * open it; the arrows step a window. A full calendar week at normal text;
 * five or three days when the text is large. Days after today cannot be opened.
 */
export function WeekStrip({ selected, today, datesWithEntries, onSelect }: WeekStripProps) {
  const remWidth = useRemWidth();
  const count = remWidth >= 21 ? 7 : remWidth >= 13 ? 5 : 3;
  let start: string;
  if (count === 7) start = shiftLocalDate(selected, -weekdayOf(selected));
  else {
    const wantedEnd = shiftLocalDate(selected, Math.floor(count / 2));
    const end = wantedEnd > today ? today : wantedEnd;
    start = shiftLocalDate(end, -(count - 1));
  }
  const days = Array.from({ length: count }, (_, i) => shiftLocalDate(start, i));
  const yesterday = shiftLocalDate(today, -1);
  const laterDisabled = shiftLocalDate(start, count) > today;
  const nameFor = (d: string): string => {
    const base = d === today ? `Today, ${longDate(d)}` : d === yesterday ? `Yesterday, ${longDate(d)}` : longDate(d);
    return datesWithEntries.has(d) ? `${base}, has entries` : base;
  };
  const later = (): void => {
    const next = shiftLocalDate(selected, count);
    onSelect(next > today ? today : next);
  };
  return (
    <div className="week" role="group" aria-label="Pick a day">
      <button type="button" className="week-arrow" aria-label={count === 7 ? 'Earlier week' : 'Earlier days'} onClick={() => onSelect(shiftLocalDate(selected, -count))}>
        ‹
      </button>
      <div className="week-days" role="group" aria-label={count === 7 ? 'Days this week' : 'Days'} style={{ gridTemplateColumns: `repeat(${count}, 1fr)` }}>
        {days.map((d) => (
          <button key={d} type="button" aria-pressed={d === selected} disabled={d > today} aria-label={nameFor(d)} onClick={() => onSelect(d)}>
            <span>{DAY_NAMES[weekdayOf(d)]}</span>
            <span className="num">{Number(d.slice(8))}</span>
            <span className={datesWithEntries.has(d) ? 'dot' : 'dot dot-none'} aria-hidden="true" />
          </button>
        ))}
      </div>
      <button type="button" className="week-arrow" aria-label={count === 7 ? 'Later week' : 'Later days'} disabled={laterDisabled} onClick={later}>
        ›
      </button>
    </div>
  );
}
