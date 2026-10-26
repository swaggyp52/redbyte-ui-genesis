import React, { useEffect, useMemo, useRef } from 'react';
import type { Circuit } from '@redbyte/rb-logic-core';
import type { SceneSymbol } from '@redbyte/rb-logic-view/scene';
import { deriveTruthTable, type LogicValue } from '@redbyte/rb-studio-kernel';
import { sceneMetadata } from '../metadata';

/**
 * Logical perspective: what the selected part computes, derived from topology and labelled as
 * derived. For a register it is the next-state function of its D input; for a gate, the cone
 * behind its output. The row that matches the values at the Moment is marked; nothing here is
 * an observation.
 */
export interface LogicLensProps {
  readonly circuit: Circuit;
  readonly symbol: SceneSymbol | null;
  readonly values: ReadonlyMap<string, LogicValue>;
  readonly valuesShown: boolean;
  readonly nodeLabel: (nodeId: string) => string;
  /** What the marked row is, in words (the recorded tick, or the step inside it). */
  readonly caption: string | null;
}

const OPERATORS: readonly (readonly [string, string])[] = [['⊕', '⊕ = XOR'], ['·', '· = AND'], ['+', '+ = OR'], ['¬', '¬ = NOT']];

export const LogicLens: React.FC<LogicLensProps> = ({ circuit, symbol, values, valuesShown, nodeLabel, caption }) => {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const derived = useMemo(() => {
    if (!symbol) return null;
    const kind = symbol.geometry.kind;
    const label = (nodeId: string) => nodeLabel(nodeId);
    if (kind === 'register') {
      const data = symbol.geometry.pins.find((pin) => pin.direction === 'in' && !pin.clock && /^(D|d|in|T|J)$/.test(pin.id));
      if (!data) return { heading: 'Next state', result: { ok: false as const, reason: 'No data input on this register' } };
      return { heading: `Next state of ${nodeLabel(symbol.nodeId)} (captured at the clock edge)`, outLabel: `${nodeLabel(symbol.nodeId)} next`, result: deriveTruthTable(circuit, { nodeId: symbol.nodeId, port: data.id }, { label, getMetadata: sceneMetadata }) };
    }
    if (kind === 'io-out') {
      return { heading: `${nodeLabel(symbol.nodeId)} shows`, outLabel: nodeLabel(symbol.nodeId), result: deriveTruthTable(circuit, { nodeId: symbol.nodeId, port: 'in' }, { label, getMetadata: sceneMetadata }) };
    }
    if (kind === 'io-in' || kind === 'clock') return { heading: `${nodeLabel(symbol.nodeId)} is a boundary input`, result: null };
    const output = symbol.geometry.pins.find((pin) => pin.direction === 'out');
    if (!output) return null;
    return { heading: `${nodeLabel(symbol.nodeId)} computes`, outLabel: nodeLabel(symbol.nodeId), result: deriveTruthTable(circuit, { nodeId: symbol.nodeId, port: output.id }, { label, fromDriver: true, getMetadata: sceneMetadata }) };
  }, [circuit, nodeLabel, symbol]);

  const table = derived?.result && derived.result.ok ? derived.result.table : null;
  const current = table
    ? table.leaves.map((leaf) => (valuesShown ? values.get(`${leaf.nodeId}.${leaf.port}`) : undefined))
    : [];
  const currentKnown = table !== null && current.every((value) => value === 0 || value === 1);
  const currentKey = currentKnown ? `${symbol?.nodeId}:${current.join('')}` : '';
  // The table scrolls inside its own frame so the expression and column names stay in view. It
  // centres the current row when that row changes, and otherwise leaves the student's scroll alone.
  useEffect(() => {
    const frame = frameRef.current;
    const row = frame?.querySelector<HTMLElement>('[data-current="1"]');
    if (!frame || !row) return;
    const head = frame.querySelector('thead')?.getBoundingClientRect().height ?? 0;
    frame.scrollTop = Math.max(0, row.offsetTop - head - (frame.clientHeight - head - row.offsetHeight) / 2);
  }, [currentKey]);

  if (!symbol || !derived) return <div className="mrd-lens-empty">Select a gate, register or output to see what it computes.</div>;
  if (!derived.result) {
    return (
      <div className="mrd-logic" data-testid="meridian-logic">
        <div className="mrd-logic-expr">{derived.heading}</div>
        <div className="mrd-logic-note">Driven from outside the circuit; its value comes from the stimulus or the board.</div>
      </div>
    );
  }
  if (!derived.result.ok) {
    return (
      <div className="mrd-logic" data-testid="meridian-logic">
        <div className="mrd-logic-note">{derived.heading}</div>
        <div className="mrd-logic-expr" data-testid="meridian-logic-stop">Derivation stops: {derived.result.reason}.</div>
      </div>
    );
  }
  if (!table) return null;
  const operators = OPERATORS.filter(([glyph]) => table.expression.includes(glyph)).map(([, words]) => words);
  return (
    <div className="mrd-logic mrd-logic-split" data-testid="meridian-logic">
      <div>
        <div className="mrd-logic-note">{derived.heading}</div>
        <div className="mrd-logic-expr" data-testid="meridian-logic-expression">{table.expression}</div>
        {operators.length ? <div className="mrd-logic-note" data-testid="meridian-logic-operators">{operators.join(', ')}</div> : null}
        <div className="mrd-logic-note">Derived from the circuit's structure · not an observation{valuesShown ? '' : ' · values withheld at this moment'}</div>
        {valuesShown && caption && currentKnown ? <div className="mrd-logic-note mrd-logic-caption" data-testid="meridian-logic-caption">{caption}</div> : null}
      </div>
      <div className="mrd-truth-frame" ref={frameRef}>
      <table className="mrd-truth" data-testid="meridian-truth-table">
        <thead>
          <tr>
            {table.leaves.map((leaf) => <th key={`${leaf.nodeId}.${leaf.port}`} scope="col">{leaf.label}</th>)}
            <th scope="col">{derived.outLabel ?? 'out'}</th>
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => {
            const isCurrent = currentKnown && row.inputs.every((bit, index) => bit === current[index]);
            return (
              <tr key={rowIndex} data-current={isCurrent ? '1' : undefined}>
                {row.inputs.map((bit, index) => <td key={index}>{bit}</td>)}
                <td className="mrd-truth-out">{row.output}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
};
