import { shiftLocalDate, weekdayOf } from '@daily-plate/domain';
import { Sheet } from './Sheet.js';
import { longDate } from '../lib/format.js';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface DayPickerProps {
  selected: string;
  today: string;
  datesWithEntries: Set<string>;
  onSelect: (localDate: string) => void;
  onClose: () => void;
}

/** A simple week strip; older days by stepping weeks. */
export function DayPicker({ selected, today, datesWithEntries, onSelect, onClose }: DayPickerProps) {
  const start = shiftLocalDate(selected, -weekdayOf(selected));
  const days = Array.from({ length: 7 }, (_, i) => shiftLocalDate(start, i));
  return (
    <Sheet title="Pick a day" onClose={onClose}>
      <div className="stack">
        <div className="row-between">
          <button type="button" className="btn btn-secondary" onClick={() => onSelect(shiftLocalDate(selected, -7))}>
            ‹ Earlier week
          </button>
          <button type="button" className="btn btn-secondary" disabled={shiftLocalDate(start, 7) > today} onClick={() => onSelect(shiftLocalDate(selected, 7) > today ? today : shiftLocalDate(selected, 7))}>
            Later week ›
          </button>
        </div>
        <div className="week-strip" role="group" aria-label="Days this week">
          {days.map((d) => (
            <button key={d} type="button" aria-pressed={d === selected} disabled={d > today} aria-label={`${longDate(d)}${datesWithEntries.has(d) ? ', has entries' : ''}`} onClick={() => onSelect(d)}>
              <span>{DAY_NAMES[weekdayOf(d)]}</span>
              <span>{Number(d.slice(8))}</span>
              {datesWithEntries.has(d) ? <span className="dot" aria-hidden="true" /> : <span style={{ height: 6 }} aria-hidden="true" />}
            </button>
          ))}
        </div>
        <p className="muted small">{longDate(selected)}</p>
        <div className="row">
          <button type="button" className="btn btn-secondary grow" onClick={() => onSelect(shiftLocalDate(today, -1))}>
            Yesterday
          </button>
          <button type="button" className="btn btn-primary grow" onClick={() => onSelect(today)}>
            Today
          </button>
        </div>
      </div>
    </Sheet>
  );
}
