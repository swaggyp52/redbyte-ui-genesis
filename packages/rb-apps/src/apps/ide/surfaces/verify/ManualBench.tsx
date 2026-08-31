import React, { useMemo, useState } from 'react';
import {
  BUS_INPUT_MEMBER_TYPES,
  BUS_OUTPUT_MEMBER_TYPES,
  busIndices,
  busRangeLabel,
  busWidth,
  type BusDeclaration,
  type Node as CircuitNode,
} from '@redbyte/rb-logic-core';
import { IdeButton } from '../../components/IdePrimitives';
import { useProjectRuntime } from '../../projectRuntime';
import { planBusWordDrive, readBusMemberBit, readBusValue } from '../../sim/busValues';
import type { RuntimeLogicValue } from '../../sim/simTypes';
import type { ScenarioStepDraft } from '../../verifyScenarioSteps';

/**
 * Manual Bench — a live, direct instrument over the ONE ephemeral experiment
 * (`useProjectRuntime().sim`). It drives inputs through `actions.sim.setInput`
 * and reads observed values from `sim.signals`, exactly the substrate the
 * Design canvas and Virtual Board already share. Because all three read and
 * write the same store, driving here is instantly reflected on the Virtual
 * Board and vice-versa — no second authority, no synchronization glue.
 *
 * This bench never touches the persistent Testbench (scenarios) or Run history.
 * The only durable writes are explicit, opt-in commands the student presses:
 * "Add to sequence" appends one step to the active scenario through the
 * existing scenario authority.
 */

export interface ManualBenchProps {
  /** Navigate to the Virtual Board (Board & Constraints) — same live state. */
  readonly onOpenVirtualBoard?: () => void;
  /** Navigate to the waveform/analyzer view. */
  readonly onOpenAnalyzer?: () => void;
  /**
   * Explicit durable boundary: append the current stimulus as a scenario step
   * through the existing scenario authority. Absent → the action is hidden.
   */
  readonly onAddToSequence?: (draft: ScenarioStepDraft) => void;
}

type Radix = 'hex' | 'dec' | 'bin';

const RADIX_LABEL: Record<Radix, string> = { hex: 'Hex', dec: 'Dec', bin: 'Bin' };

const INPUT_TYPES = new Set<string>(BUS_INPUT_MEMBER_TYPES);
const OUTPUT_TYPES = new Set<string>(BUS_OUTPUT_MEMBER_TYPES);

// Stable fallbacks: selecting `state.circuit.buses ?? []` inline would return a
// fresh array every render and drive an infinite useSyncExternalStore loop.
const EMPTY_BUSES: readonly BusDeclaration[] = Object.freeze([]);

function nodeLabel(node: CircuitNode): string {
  const label = node.label?.trim();
  return label && label.length > 0 ? label : node.id;
}

function testSlug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Parse a user-entered word for a bus of the given width and radix. */
function parseWord(raw: string, radix: Radix, width: number): number | null {
  const text = raw.trim();
  if (text.length === 0) return null;
  let parsed: number;
  if (radix === 'hex') {
    const body = text.replace(/^0x/i, '');
    if (!/^[0-9a-fA-F]+$/.test(body)) return null;
    parsed = parseInt(body, 16);
  } else if (radix === 'bin') {
    const body = text.replace(/^0b/i, '');
    if (!/^[01]+$/.test(body)) return null;
    parsed = parseInt(body, 2);
  } else {
    if (!/^\d+$/.test(text)) return null;
    parsed = parseInt(text, 10);
  }
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  const max = width >= 31 ? Number.MAX_SAFE_INTEGER : (1 << width) - 1;
  if (parsed > max) return null;
  return parsed;
}

function bitChipClass(value: RuntimeLogicValue | undefined): string {
  if (value === 1) return 'is-high';
  if (value === 0) return 'is-low';
  return 'is-unknown';
}

function bitChipText(value: RuntimeLogicValue | undefined): string {
  if (value === 1) return '1';
  if (value === 0) return '0';
  return value === undefined ? '–' : String(value);
}

export const ManualBench: React.FC<ManualBenchProps> = ({
  onOpenVirtualBoard,
  onOpenAnalyzer,
  onAddToSequence,
}) => {
  // Read-model over the single authority. No local mirror of experiment state.
  const sim = useProjectRuntime((state) => state.sim);
  const nodes = useProjectRuntime((state) => state.circuit.nodes);
  const busesRaw = useProjectRuntime((state) => state.circuit.buses);
  const buses = busesRaw ?? EMPTY_BUSES;
  const setInput = useProjectRuntime((state) => state.actions.sim.setInput);
  const resetSim = useProjectRuntime((state) => state.actions.sim.reset);

  // UI-interaction state only: draft word text + radix per input bus.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [radices, setRadices] = useState<Record<string, Radix>>({});

  const model = useMemo(() => {
    const memberNodeIds = new Set<string>();
    for (const bus of buses) {
      for (const bit of bus.bits) memberNodeIds.add(bit.nodeId);
    }
    const inputBuses = buses.filter((bus) => bus.direction === 'input');
    const outputBuses = buses.filter((bus) => bus.direction === 'output');
    const inputScalars = nodes.filter(
      (node) => INPUT_TYPES.has(node.type) && !memberNodeIds.has(node.id)
    );
    const outputScalars = nodes.filter(
      (node) => OUTPUT_TYPES.has(node.type) && !memberNodeIds.has(node.id)
    );
    return { inputBuses, outputBuses, inputScalars, outputScalars };
  }, [buses, nodes]);

  const radixOf = (busId: string): Radix => radices[busId] ?? 'hex';

  const driveBusWord = (bus: BusDeclaration, value: number) => {
    // planBusWordDrive expands the word into per-member (nodeId, bit) writes;
    // each goes through the ONE input authority so trace/recompute stay single.
    for (const write of planBusWordDrive(bus, value)) {
      setInput(write.nodeId, write.bit);
    }
  };

  const commitDraft = (bus: BusDeclaration) => {
    const width = busWidth(bus);
    const parsed = parseWord(drafts[bus.id] ?? '', radixOf(bus.id), width);
    if (parsed === null) return;
    driveBusWord(bus, parsed);
  };

  const toggleBusBit = (bus: BusDeclaration, nodeId: string, current: RuntimeLogicValue | undefined) => {
    setInput(nodeId, current === 1 ? 0 : 1);
  };

  const hasExperiment =
    model.inputBuses.length > 0 ||
    model.outputBuses.length > 0 ||
    model.inputScalars.length > 0 ||
    model.outputScalars.length > 0;

  const addBusToSequence = (bus: BusDeclaration) => {
    if (!onAddToSequence) return;
    const row = readBusValue(bus, sim);
    if (row.word.value === null) return;
    onAddToSequence({
      kind: 'set_bus',
      targetRef: bus.name,
      value: Object.fromEntries(
        row.bits.map((bit) => [String(bit.index), bit.value === 1 ? 1 : 0])
      ) as Record<string, 0 | 1>,
      label: `${busRangeLabel(bus)} = ${row.hex}`,
      origin: 'explicit',
    });
  };

  const addScalarToSequence = (node: CircuitNode) => {
    if (!onAddToSequence) return;
    const value = readBusMemberBit(sim, node.id);
    onAddToSequence({
      kind: 'set_input',
      targetRef: nodeLabel(node),
      value: value === 1 ? 1 : 0,
      label: `${nodeLabel(node)} = ${value === 1 ? '1' : '0'}`,
      origin: 'explicit',
    });
  };

  return (
    <section className="ide-manual-bench" data-testid="ide-manual-bench" aria-label="Manual Bench">
      <header className="ide-manual-bench-head">
        <div className="ide-manual-bench-title">
          <span className="ide-manual-bench-kicker">Live experiment</span>
          <h3>Manual Bench</h3>
        </div>
        <p className="ide-manual-bench-sub" data-testid="ide-manual-bench-sub">
          Drives the same live state as the Virtual Board — Browser E0 simulation.
          Changes here appear on the Virtual Board instantly and never touch the
          saved testbench or run history.
        </p>
        <div className="ide-manual-bench-actions" data-testid="ide-manual-bench-actions">
          <IdeButton
            tone="ghost"

            testId="ide-manual-bench-reset"
            onClick={() => resetSim()}
          >
            Reset experiment
          </IdeButton>
          {onOpenVirtualBoard ? (
            <IdeButton
              tone="ghost"

              testId="ide-manual-bench-open-board"
              onClick={onOpenVirtualBoard}
            >
              Open Virtual Board
            </IdeButton>
          ) : null}
          {onOpenAnalyzer ? (
            <IdeButton
              tone="ghost"

              testId="ide-manual-bench-open-analyzer"
              onClick={onOpenAnalyzer}
            >
              Open Analyzer
            </IdeButton>
          ) : null}
        </div>
      </header>

      {!hasExperiment ? (
        <p className="ide-manual-bench-empty" data-testid="ide-manual-bench-empty">
          No boundary signals yet. Add input/output ports or buses in Design to
          drive and observe them here.
        </p>
      ) : (
        <div className="ide-manual-bench-body">
          <div className="ide-manual-bench-column ide-manual-bench-drive" data-testid="ide-manual-bench-drive">
            <h4 className="ide-manual-bench-col-title">Drive</h4>
            {model.inputBuses.length === 0 && model.inputScalars.length === 0 ? (
              <p className="ide-manual-bench-col-empty">No inputs to drive.</p>
            ) : null}

            {model.inputBuses.map((bus) => {
              const row = readBusValue(bus, sim);
              const radix = radixOf(bus.id);
              const slug = testSlug(bus.name);
              return (
                <div
                  className="ide-manual-bench-bus"
                  key={bus.id}
                  data-testid={`ide-manual-bench-drive-bus-${slug}`}
                >
                  <div className="ide-manual-bench-bus-head">
                    <code className="ide-manual-bench-bus-range">{busRangeLabel(bus)}</code>
                    <span
                      className="ide-manual-bench-bus-word"
                      data-testid={`ide-manual-bench-drive-word-${slug}`}
                    >
                      {row.hex}
                    </span>
                  </div>
                  <div className="ide-manual-bench-bus-controls">
                    <div className="ide-manual-bench-radix" role="group" aria-label={`${bus.name} radix`}>
                      {(['hex', 'dec', 'bin'] as const).map((option) => (
                        <button
                          key={option}
                          type="button"
                          className={`ide-manual-bench-radix-btn${radix === option ? ' is-active' : ''}`}
                          data-testid={`ide-manual-bench-radix-${slug}-${option}`}
                          aria-pressed={radix === option}
                          onClick={() => setRadices((prev) => ({ ...prev, [bus.id]: option }))}
                        >
                          {RADIX_LABEL[option]}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      className="ide-manual-bench-word-input"
                      data-testid={`ide-manual-bench-word-input-${slug}`}
                      aria-label={`Drive ${bus.name}`}
                      placeholder={radix === 'hex' ? '0x0' : radix === 'bin' ? '0000' : '0'}
                      value={drafts[bus.id] ?? ''}
                      onChange={(event) =>
                        setDrafts((prev) => ({ ...prev, [bus.id]: event.target.value }))
                      }
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          commitDraft(bus);
                        }
                      }}
                    />
                    <IdeButton
                      tone="secondary"

                      testId={`ide-manual-bench-drive-apply-${slug}`}
                      onClick={() => commitDraft(bus)}
                    >
                      Drive
                    </IdeButton>
                  </div>
                  <div className="ide-manual-bench-bits" data-testid={`ide-manual-bench-drive-bits-${slug}`}>
                    {busIndices(bus)
                      .slice()
                      .reverse()
                      .map((index) => {
                        const bit = row.bits.find((entry) => entry.index === index);
                        const nodeId = bit?.nodeId ?? '';
                        return (
                          <button
                            key={index}
                            type="button"
                            className={`ide-manual-bench-bit ${bitChipClass(bit?.value)}`}
                            data-testid={`ide-manual-bench-drive-bit-${slug}-${index}`}
                            aria-label={`${bus.name} bit ${index}`}
                            onClick={() => nodeId && toggleBusBit(bus, nodeId, bit?.value)}
                          >
                            <span className="ide-manual-bench-bit-index">{index}</span>
                            <span className="ide-manual-bench-bit-value">{bitChipText(bit?.value)}</span>
                          </button>
                        );
                      })}
                  </div>
                  {onAddToSequence ? (
                    <button
                      type="button"
                      className="ide-manual-bench-sequence-link"
                      data-testid={`ide-manual-bench-drive-sequence-${slug}`}
                      onClick={() => addBusToSequence(bus)}
                    >
                      Add to sequence
                    </button>
                  ) : null}
                </div>
              );
            })}

            {model.inputScalars.map((node) => {
              const value = readBusMemberBit(sim, node.id);
              const slug = testSlug(nodeLabel(node));
              return (
                <div
                  className="ide-manual-bench-scalar"
                  key={node.id}
                  data-testid={`ide-manual-bench-drive-scalar-${slug}`}
                >
                  <span className="ide-manual-bench-scalar-label">{nodeLabel(node)}</span>
                  <button
                    type="button"
                    className={`ide-manual-bench-switch ${bitChipClass(value)}`}
                    role="switch"
                    aria-checked={value === 1}
                    data-testid={`ide-manual-bench-drive-toggle-${slug}`}
                    onClick={() => setInput(node.id, value === 1 ? 0 : 1)}
                  >
                    {bitChipText(value)}
                  </button>
                  {onAddToSequence ? (
                    <button
                      type="button"
                      className="ide-manual-bench-sequence-link"
                      data-testid={`ide-manual-bench-drive-scalar-sequence-${slug}`}
                      onClick={() => addScalarToSequence(node)}
                    >
                      Add to sequence
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="ide-manual-bench-column ide-manual-bench-measure" data-testid="ide-manual-bench-measure">
            <h4 className="ide-manual-bench-col-title">Measure</h4>
            {model.outputBuses.length === 0 && model.outputScalars.length === 0 ? (
              <p className="ide-manual-bench-col-empty">No outputs to observe.</p>
            ) : null}

            {model.outputBuses.map((bus) => {
              const row = readBusValue(bus, sim);
              const slug = testSlug(bus.name);
              return (
                <div
                  className="ide-manual-bench-bus is-observed"
                  key={bus.id}
                  data-testid={`ide-manual-bench-measure-bus-${slug}`}
                >
                  <div className="ide-manual-bench-bus-head">
                    <code className="ide-manual-bench-bus-range">{busRangeLabel(bus)}</code>
                    <strong
                      className="ide-manual-bench-bus-observed"
                      data-known={row.word.hasUnknown ? 'false' : 'true'}
                      data-testid={`ide-manual-bench-measure-word-${slug}`}
                    >
                      {row.hex}
                    </strong>
                  </div>
                  <div className="ide-manual-bench-observed-detail" data-testid={`ide-manual-bench-measure-detail-${slug}`}>
                    <span>{row.word.binary}₂</span>
                    {row.word.value !== null ? <span>· {row.word.value}</span> : null}
                  </div>
                  <div className="ide-manual-bench-bits is-observed" aria-hidden="true">
                    {busIndices(bus)
                      .slice()
                      .reverse()
                      .map((index) => {
                        const bit = row.bits.find((entry) => entry.index === index);
                        return (
                          <span
                            key={index}
                            className={`ide-manual-bench-bit ${bitChipClass(bit?.value)}`}
                            data-testid={`ide-manual-bench-measure-bit-${slug}-${index}`}
                          >
                            <span className="ide-manual-bench-bit-index">{index}</span>
                            <span className="ide-manual-bench-bit-value">{bitChipText(bit?.value)}</span>
                          </span>
                        );
                      })}
                  </div>
                </div>
              );
            })}

            {model.outputScalars.map((node) => {
              const value = readBusMemberBit(sim, node.id);
              const slug = testSlug(nodeLabel(node));
              return (
                <div
                  className="ide-manual-bench-scalar is-observed"
                  key={node.id}
                  data-testid={`ide-manual-bench-measure-scalar-${slug}`}
                >
                  <span className="ide-manual-bench-scalar-label">{nodeLabel(node)}</span>
                  <span
                    className={`ide-manual-bench-lamp ${bitChipClass(value)}`}
                    data-known={value === undefined ? 'false' : 'true'}
                    data-testid={`ide-manual-bench-measure-value-${slug}`}
                  >
                    {bitChipText(value)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};
