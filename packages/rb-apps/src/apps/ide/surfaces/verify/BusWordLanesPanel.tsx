import React from 'react';
import { busWordAtTick, type BusWordLane } from '../../sim/busWordLanes';

export interface BusWordLanesPanelProps {
  lanes: BusWordLane[];
  selectedTick: number | null;
  onSelectTick?: (tick: number) => void;
}

function laneTestId(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

/**
 * Word-level readout for first-class buses over the Simulate timeline. Each
 * declared bus collapses its member bit lanes into one observed word — the
 * value at the selected tick is shown large (hex), with binary and unsigned
 * decimal beneath, and a compact per-tick strip mirrors the waveform so a
 * student reads `A[3:0] = 0xA` instead of decoding four separate 0/1 rails.
 */
export const BusWordLanesPanel: React.FC<BusWordLanesPanelProps> = ({
  lanes,
  selectedTick,
  onSelectTick,
}) => {
  if (lanes.length === 0) return null;
  return (
    <section className="ide-verify-bus-words" data-testid="ide-verify-bus-words">
      <header className="ide-verify-bus-words-header">
        <span className="ide-verify-bus-words-title">Bus words</span>
        <span className="ide-verify-bus-words-hint">
          {selectedTick === null ? 'latest tick' : `tick t${selectedTick}`}
        </span>
      </header>
      <ul className="ide-verify-bus-words-list">
        {lanes.map((lane) => {
          const cell = busWordAtTick(lane, selectedTick);
          return (
            <li
              key={`${lane.direction}-${lane.name}`}
              className={`ide-verify-bus-word-lane${lane.direction === 'input' ? ' is-input' : ' is-output'}`}
              data-testid={`ide-verify-bus-word-${laneTestId(lane.name)}`}
            >
              <div className="ide-verify-bus-word-id">
                <code>{lane.rangeLabel}</code>
                <span className="ide-verify-bus-word-dir">
                  {lane.direction === 'input' ? 'stimulus' : 'observed'} · {lane.width}b
                </span>
              </div>
              <div className="ide-verify-bus-word-value" data-known={cell?.known ? 'true' : 'false'}>
                <strong data-testid={`ide-verify-bus-word-hex-${laneTestId(lane.name)}`}>
                  {cell ? cell.hex : '—'}
                </strong>
                <span className="ide-verify-bus-word-detail">
                  {cell ? `${cell.binary}₂` : '—'}
                  {cell && cell.decimal !== null ? ` · ${cell.decimal}` : ''}
                </span>
              </div>
              <div className="ide-verify-bus-word-strip" aria-hidden="true">
                {lane.cells.map((stripCell) => (
                  <button
                    key={stripCell.tick}
                    type="button"
                    className={`ide-verify-bus-word-cell${stripCell.tick === selectedTick ? ' is-selected' : ''}${stripCell.known ? '' : ' is-unknown'}`}
                    onClick={() => onSelectTick?.(stripCell.tick)}
                    title={`t${stripCell.tick}: ${stripCell.binary}${stripCell.decimal !== null ? ` = ${stripCell.decimal}` : ''}`}
                    tabIndex={-1}
                  >
                    {stripCell.known ? stripCell.hex.replace(/^0x/, '') : 'x'}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
