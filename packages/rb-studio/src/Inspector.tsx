import React from 'react';
import { describeInputPin, type Node } from '@redbyte/rb-logic-core';
import type { SceneSymbol } from '@redbyte/rb-logic-view/scene';
import type { BoardBinding, Explanation, LogicValue } from '@redbyte/rb-studio-kernel';
import type { SheetMode, ValueState } from './Sheet';

/**
 * The inspector reads the same selection and Moment as every lens. Its explanation is built
 * from the recording only (kernel explainSelection): the previous and current samples, and the
 * retained evaluation that set the value, in a student's words. Where the recording lacks that
 * evidence it says what is missing. The one causal action jumps to that evaluation; Back
 * returns to where the student was.
 */
export interface InspectorAction {
  readonly label: string;
  readonly onClick: () => void;
  readonly testId: string;
  readonly kbd?: string;
}

export interface InspectorProps {
  readonly symbol: SceneSymbol | null;
  readonly title: string;
  readonly kindLabel: string;
  readonly values: ReadonlyMap<string, LogicValue>;
  readonly valueState: ValueState;
  /** Why values are withdrawn (design, pin mapping, or an older recording), in the strip's words. */
  readonly withdrawnReason: string;
  /** The recording shows the clock rising at this Moment. */
  readonly clockRose: boolean;
  /** Where the pin values come from, e.g. "t3" or "t3 · step 34 of 63". */
  readonly momentLabel: string;
  readonly mode: SheetMode;
  readonly binding: BoardBinding | null;
  readonly explanation: Explanation | null;
  readonly unconnected: ReadonlySet<string>;
  /** Pins on a clock net: they show an edge per tick, never a sampled level. */
  readonly clockPins: ReadonlySet<string>;
  readonly wireLabel: string | null;
  readonly actions: readonly InspectorAction[];
  readonly wireActions: readonly InspectorAction[];
}

/**
 * What an unconnected input reads in the simulator, from the engine's own description of the pin
 * (RB-DEBT-028): a gate input reads 0, a DFlipFlop EN reads 1, and a register's EN or reset that
 * its settings disable is not read at all. A pin the engine does not describe (a module instance's
 * input, whose level depends on what it feeds) states no level.
 */
export function unconnectedInputText(node: Pick<Node, 'type' | 'config'>, pin: string): string {
  const description = describeInputPin(node.type, pin, node.config);
  if (!description) return 'unconnected';
  if (!description.used) return `unconnected · not read (off in this part's settings)`;
  return `unconnected · read as ${description.unconnectedLevel}`;
}

/** The status-bar count of unconnected inputs; it names a level only when every one of them reads it. */
export function unconnectedSummaryText(pins: readonly { node: Pick<Node, 'type' | 'config'>; pin: string }[]): string {
  const count = `${pins.length} unconnected input${pins.length === 1 ? '' : 's'}`;
  const levels = new Set(pins.map(({ node, pin }) => {
    const description = describeInputPin(node.type, pin, node.config);
    return description?.used ? description.unconnectedLevel : null;
  }));
  const [level] = levels;
  return levels.size === 1 && level != null ? `${count} · read as ${level}` : count;
}

function ActionButton({ action }: { action: InspectorAction }) {
  return (
    <button type="button" className="mrd-btn" onClick={action.onClick} data-testid={action.testId}>
      {action.label}{action.kbd ? <> <kbd className="mrd-kbd">{action.kbd}</kbd></> : null}
    </button>
  );
}

export const Inspector: React.FC<InspectorProps> = ({
  symbol, title, kindLabel, values, valueState, withdrawnReason, clockRose, momentLabel, mode, binding, explanation, unconnected, clockPins, wireLabel, actions, wireActions,
}) => {
  if (!symbol) {
    return (
      <div className="mrd-insp-empty" data-testid="meridian-inspector-empty">
        {wireLabel ? (
          <>
            <strong>{wireLabel}</strong>
            <p>{mode === 'edit' ? 'A connection. Explore and Simulate draw its value on the sheet.' : 'A connection. Its value at the Moment is drawn on the sheet.'}</p>
            {wireActions.length ? <div className="mrd-insp-actions">{wireActions.map((action) => <ActionButton key={action.testId} action={action} />)}</div> : null}
          </>
        ) : mode === 'edit'
          ? 'Select a part to inspect it. Drag a part to move it · click a pin, then another pin, to wire.'
          : 'Select a part on the sheet, a lane in time, a line of source or a resource on the board.'}
      </div>
    );
  }
  const valuesShown = valueState === 'recorded' || valueState === 'live';
  const pins = symbol.geometry.pins;
  const heading = valueState === 'recorded' ? `Pins at ${momentLabel}` : valueState === 'live' ? 'Pins · live, not recorded' : 'Pins';
  const withheld = valueState === 'withdrawn' ? withdrawnReason
    : mode === 'edit' ? 'Edit shows no values · E explores · Run records.'
      : valueState === 'none' ? 'No recording on screen · Run records values.' : null;
  return (
    <div className="mrd-insp" data-testid="meridian-inspector" data-node-id={symbol.nodeId}>
      <div>
        <h2>{title}</h2>
        <div className="mrd-insp-kind" data-testid="meridian-inspector-kind">{kindLabel}{binding ? ` · ${binding.name}${binding.packagePin ? ` · ${binding.packagePin}` : ''}` : ''}</div>
      </div>
      <section className="mrd-insp-section">
        <h3 data-testid="meridian-pins-heading">{heading}</h3>
        <table className="mrd-pins" data-values={valuesShown ? '1' : '0'}>
          <tbody>
            {pins.map((pin) => {
              const key = `${symbol.nodeId}.${pin.id}`;
              const value = valuesShown ? values.get(key) : undefined;
              const floating = pin.direction === 'in' && unconnected.has(key);
              const clock = clockPins.has(pin.id);
              const note = explanation?.pinNotes.get(pin.id);
              const text = floating ? unconnectedInputText(symbol.node, pin.id)
                : clock && clockRose ? `↑ rose${momentLabel ? ` in ${momentLabel.split(' · ')[0]}` : ''}`
                  : value === undefined ? 'not recorded' : `${value}${note ? ` · ${note}` : ''}`;
              return (
                <tr key={pin.id} data-pin={pin.id}>
                  <td>{pin.name}{pin.direction === 'in' ? '' : ' →'}</td>
                  {valuesShown || floating ? (
                    <td data-value={floating ? 'floating' : clock && clockRose ? 'clock' : value === undefined ? 'none' : String(value)}>{text}</td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
        {withheld ? <p className="mrd-insp-note" data-testid="meridian-values-withheld">{withheld}</p> : null}
      </section>
      {explanation ? (
        <section className="mrd-insp-section" data-testid="meridian-explanation">
          <h3>{explanation.heading}</h3>
          {explanation.lines.map((line, index) => (
            <p key={index} className="mrd-insp-line" data-kind={line.kind}>{line.text}</p>
          ))}
        </section>
      ) : null}
      {actions.length ? <div className="mrd-insp-actions">{actions.map((action) => <ActionButton key={action.testId} action={action} />)}</div> : null}
    </div>
  );
};
