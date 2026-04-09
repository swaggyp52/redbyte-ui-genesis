import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { VerifyAuthorVector, VerifyVectorDraftInput } from '../surfaces/ScenarioBuilderPanel';

const LABEL_W = 148;
const TICK_W = 64;
const ROW_H = 36;
const GROUP_H = 22;
const ADD_COL_W = 40;

type LaneKind = 'input' | 'expected';
type PaintSession = { kind: LaneKind; value: 0 | 1 | null };
type LaneOption = { key: string; kind: LaneKind; fieldId: string; label: string };

export interface StimulusCanvasProps {
  inputFields: VerifyVectorDraftInput[];
  outputFields: VerifyVectorDraftInput[];
  authoredVectors: VerifyAuthorVector[];
  onVectorsChange: (vectors: VerifyAuthorVector[]) => void;
  onNavigateToMapping?: () => void;
  /** When true, expected-output lanes are hidden so students can only paint inputs (Observe mode). */
  readOnlyOutputs?: boolean;
  initialScrollTarget?: 'top' | 'expected';
}

function makeId(): string {
  return `sc_${Math.random().toString(36).slice(2, 9)}`;
}

function sortVectors(vectors: VerifyAuthorVector[]): VerifyAuthorVector[] {
  return [...vectors].sort((a, b) => a.tick - b.tick);
}

function uniqueSortedTicks(vectors: VerifyAuthorVector[]): number[] {
  return [...new Set(vectors.map((vector) => vector.tick))].sort((a, b) => a - b);
}

function emptyInputs(inputFields: VerifyVectorDraftInput[]): Record<string, 0 | 1> {
  const next: Record<string, 0 | 1> = {};
  for (const field of inputFields) next[field.id] = 0;
  return next;
}

function ensureTick(
  vectors: VerifyAuthorVector[],
  inputFields: VerifyVectorDraftInput[],
  tick: number
): VerifyAuthorVector[] {
  if (vectors.some((vector) => vector.tick === tick)) return vectors;
  return sortVectors([
    ...vectors,
    { id: makeId(), tick, inputs: emptyInputs(inputFields), expected: {} },
  ]);
}

function ensureTicks(
  vectors: VerifyAuthorVector[],
  inputFields: VerifyVectorDraftInput[],
  ticks: number[]
): VerifyAuthorVector[] {
  return ticks.reduce((current, tick) => ensureTick(current, inputFields, tick), vectors);
}

function getInputValue(vectors: VerifyAuthorVector[], tick: number, fieldId: string): 0 | 1 {
  return vectors.find((vector) => vector.tick === tick)?.inputs[fieldId] ?? 0;
}

function getExpectedValue(
  vectors: VerifyAuthorVector[],
  tick: number,
  fieldId: string
): 0 | 1 | null {
  const value = vectors.find((vector) => vector.tick === tick)?.expected[fieldId];
  return value == null ? null : value;
}

function setInputValue(
  vectors: VerifyAuthorVector[],
  inputFields: VerifyVectorDraftInput[],
  tick: number,
  fieldId: string,
  value: 0 | 1
): VerifyAuthorVector[] {
  return ensureTick(vectors, inputFields, tick).map((vector) =>
    vector.tick === tick ? { ...vector, inputs: { ...vector.inputs, [fieldId]: value } } : vector
  );
}

function setExpectedValue(
  vectors: VerifyAuthorVector[],
  inputFields: VerifyVectorDraftInput[],
  tick: number,
  fieldId: string,
  value: 0 | 1 | null
): VerifyAuthorVector[] {
  return ensureTick(vectors, inputFields, tick).map((vector) => {
    if (vector.tick !== tick) return vector;
    const expected = { ...vector.expected };
    if (value == null) delete expected[fieldId];
    else expected[fieldId] = value;
    return { ...vector, expected };
  });
}

function appendTick(
  vectors: VerifyAuthorVector[],
  inputFields: VerifyVectorDraftInput[]
): VerifyAuthorVector[] {
  const ticks = uniqueSortedTicks(vectors);
  return ensureTick(vectors, inputFields, ticks.length > 0 ? ticks[ticks.length - 1] + 1 : 0);
}

function removeTick(vectors: VerifyAuthorVector[], tick: number): VerifyAuthorVector[] {
  return vectors.filter((vector) => vector.tick !== tick);
}

function duplicateTick(
  vectors: VerifyAuthorVector[],
  inputFields: VerifyVectorDraftInput[],
  tick: number
): VerifyAuthorVector[] {
  const source = vectors.find((vector) => vector.tick === tick);
  if (!source) return vectors;
  const shifted = vectors.map((vector) => (vector.tick > tick ? { ...vector, tick: vector.tick + 1 } : vector));
  return sortVectors([
    ...shifted,
    { ...source, id: makeId(), tick: tick + 1, inputs: { ...source.inputs }, expected: { ...source.expected } },
  ]);
}

function buildOperationTicks(vectors: VerifyAuthorVector[], minimumCount: number): number[] {
  const ticks = uniqueSortedTicks(vectors);
  if (ticks.length > 0) return ticks;
  return Array.from({ length: Math.max(1, minimumCount) }, (_, index) => index);
}

function buildClipboardText(
  vectors: VerifyAuthorVector[],
  inputFields: VerifyVectorDraftInput[],
  outputFields: VerifyVectorDraftInput[]
): string {
  const header = [
    'tick',
    ...inputFields.map((field) => field.id),
    ...outputFields.map((field) => `expected:${field.id}`),
  ];
  const rows = sortVectors(vectors).map((vector) => [
    String(vector.tick),
    ...inputFields.map((field) => String(vector.inputs[field.id] ?? 0)),
    ...outputFields.map((field) => {
      const value = vector.expected[field.id];
      return value == null ? '' : String(value);
    }),
  ]);
  return [header, ...rows].map((row) => row.join('\t')).join('\n');
}

function resolveClipboardFieldId(
  rawValue: string,
  fields: VerifyVectorDraftInput[]
): string | null {
  const normalizedValue = rawValue
    .trim()
    .replace(/^expected:/i, '')
    .replace(/^exp:/i, '')
    .replace(/\((?:exp|expected)\)$/i, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_');
  if (!normalizedValue) return null;
  const match = fields.find((field) => {
    const normalizedId = field.id.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const normalizedLabel = field.label.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    return normalizedValue === normalizedId || normalizedValue === normalizedLabel;
  });
  return match?.id ?? null;
}

function parseClipboardText(input: {
  text: string;
  inputFields: VerifyVectorDraftInput[];
  outputFields: VerifyVectorDraftInput[];
}): VerifyAuthorVector[] {
  const lines = input.text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];

  const firstRow = lines[0].split('\t');
  const firstCell = firstRow[0]?.trim().toLowerCase() ?? '';
  const hasHeader = firstCell === 'tick' || Number.isNaN(Number.parseInt(firstCell, 10));
  const dataLines = hasHeader ? lines.slice(1) : lines;
  if (dataLines.length === 0) return [];

  const fallbackColumns = [
    'tick',
    ...input.inputFields.map((field) => field.id),
    ...input.outputFields.map((field) => `expected:${field.id}`),
  ];
  const headerColumns = hasHeader ? firstRow : fallbackColumns;
  const columnDefinitions = headerColumns.map((column, index) => {
    if (index === 0) return { kind: 'tick' as const, fieldId: null };
    const inputFieldId = resolveClipboardFieldId(column, input.inputFields);
    if (inputFieldId) return { kind: 'input' as const, fieldId: inputFieldId };
    const outputFieldId = resolveClipboardFieldId(column, input.outputFields);
    if (outputFieldId) return { kind: 'expected' as const, fieldId: outputFieldId };
    return { kind: 'ignore' as const, fieldId: null };
  });

  const parsedVectors = dataLines.map((line, rowIndex) => {
    const cells = line.split('\t');
    const tickCell = cells[0]?.trim() ?? '';
    const parsedTick = Number.parseInt(tickCell, 10);
    const tick = Number.isFinite(parsedTick) ? Math.max(0, parsedTick) : rowIndex;
    const vector: VerifyAuthorVector = {
      id: makeId(),
      tick,
      inputs: emptyInputs(input.inputFields),
      expected: {},
    };

    for (let columnIndex = 1; columnIndex < columnDefinitions.length; columnIndex += 1) {
      const definition = columnDefinitions[columnIndex];
      const fieldId = definition.fieldId;
      if (!fieldId) continue;
      const rawValue = cells[columnIndex]?.trim() ?? '';
      if (definition.kind === 'input') {
        vector.inputs[fieldId] = rawValue === '1' ? 1 : 0;
        continue;
      }
      if (definition.kind === 'expected') {
        if (rawValue === '0' || rawValue === '1') {
          vector.expected[fieldId] = rawValue === '1' ? 1 : 0;
        }
      }
    }

    return vector;
  });

  return sortVectors(parsedVectors);
}

function findStimulusButtonAtPoint(
  root: HTMLElement,
  clientX: number,
  clientY: number
): HTMLButtonElement | null {
  const candidates = root.querySelectorAll<HTMLButtonElement>('button');
  for (const candidate of candidates) {
    const rect = candidate.getBoundingClientRect();
    if (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    ) {
      return candidate;
    }
  }
  return null;
}

export const StimulusCanvas: React.FC<StimulusCanvasProps> = ({
  inputFields,
  outputFields,
  authoredVectors,
  onVectorsChange,
  onNavigateToMapping,
  readOnlyOutputs = false,
  initialScrollTarget = 'top',
}) => {
  const latestVectorsRef = useRef(authoredVectors);
  const canvasRootRef = useRef<HTMLDivElement | null>(null);
  const gridScrollRef = useRef<HTMLDivElement | null>(null);
  const expectedGroupRef = useRef<HTMLDivElement | null>(null);
  const firstExpectedCellRef = useRef<HTMLButtonElement | null>(null);
  const lastDirectCellActivationRef = useRef<{ testId: string; at: number } | null>(null);
  const [hoveredTick, setHoveredTick] = useState<number | null>(null);
  const [selectedTick, setSelectedTick] = useState(0);
  const [selectedLaneKey, setSelectedLaneKey] = useState('');
  const [advancedToolsOpen, setAdvancedToolsOpen] = useState(false);
  const [paintSession, setPaintSession] = useState<PaintSession | null>(null);

  useEffect(() => {
    latestVectorsRef.current = authoredVectors;
  }, [authoredVectors]);

  useEffect(() => {
    const stopPainting = () => setPaintSession(null);
    window.addEventListener('pointerup', stopPainting);
    return () => window.removeEventListener('pointerup', stopPainting);
  }, []);

  const ticks = useMemo(() => uniqueSortedTicks(authoredVectors), [authoredVectors]);
  const totalW = LABEL_W + ticks.length * TICK_W + ADD_COL_W;
  const laneOptions = useMemo<LaneOption[]>(
    () => [
      ...inputFields.map((field) => ({ key: `input:${field.id}`, kind: 'input' as const, fieldId: field.id, label: field.label })),
      ...(readOnlyOutputs ? [] : outputFields.map((field) => ({ key: `expected:${field.id}`, kind: 'expected' as const, fieldId: field.id, label: field.label }))),
    ],
    [inputFields, outputFields, readOnlyOutputs]
  );
  const selectedLane = laneOptions.find((option) => option.key === selectedLaneKey) ?? laneOptions[0] ?? null;

  useEffect(() => {
    setSelectedTick((previous) => (ticks.length === 0 ? 0 : ticks.includes(previous) ? previous : ticks[0]));
  }, [ticks]);

  useEffect(() => {
    setSelectedLaneKey((previous) =>
      previous && laneOptions.some((option) => option.key === previous) ? previous : laneOptions[0]?.key ?? ''
    );
  }, [laneOptions]);

  const commitVectors = useCallback(
    (recipe: (vectors: VerifyAuthorVector[]) => VerifyAuthorVector[]) => {
      const nextVectors = recipe(latestVectorsRef.current);
      latestVectorsRef.current = nextVectors;
      onVectorsChange(nextVectors);
    },
    [onVectorsChange]
  );

  const handleRowFill = useCallback((value: 0 | 1) => {
    if (!selectedLane) return;
    const targetTicks = buildOperationTicks(latestVectorsRef.current, 1);
    commitVectors((vectors) => {
      let next = ensureTicks(vectors, inputFields, targetTicks);
      for (const tick of targetTicks) {
        next =
          selectedLane.kind === 'input'
            ? setInputValue(next, inputFields, tick, selectedLane.fieldId, value)
            : setExpectedValue(next, inputFields, tick, selectedLane.fieldId, value);
      }
      return next;
    });
  }, [commitVectors, inputFields, selectedLane]);

  const handleRowToggle = useCallback(() => {
    if (!selectedLane || selectedLane.kind !== 'input') return;
    const targetTicks = buildOperationTicks(latestVectorsRef.current, 1);
    commitVectors((vectors) => {
      let next = ensureTicks(vectors, inputFields, targetTicks);
      for (const tick of targetTicks) {
        const value: 0 | 1 = getInputValue(next, tick, selectedLane.fieldId) === 0 ? 1 : 0;
        next = setInputValue(next, inputFields, tick, selectedLane.fieldId, value);
      }
      return next;
    });
  }, [commitVectors, inputFields, selectedLane]);

  const handleExpectedClear = useCallback(() => {
    if (!selectedLane || selectedLane.kind !== 'expected') return;
    const targetTicks = buildOperationTicks(latestVectorsRef.current, 1);
    commitVectors((vectors) => {
      let next = ensureTicks(vectors, inputFields, targetTicks);
      for (const tick of targetTicks) {
        next = setExpectedValue(next, inputFields, tick, selectedLane.fieldId, null);
      }
      return next;
    });
  }, [commitVectors, inputFields, selectedLane]);

  const handleInputPattern = useCallback((resolver: (index: number) => 0 | 1) => {
    if (!selectedLane || selectedLane.kind !== 'input') return;
    const targetTicks = buildOperationTicks(latestVectorsRef.current, 4);
    commitVectors((vectors) => {
      let next = ensureTicks(vectors, inputFields, targetTicks);
      targetTicks.forEach((tick, index) => {
        next = setInputValue(next, inputFields, tick, selectedLane.fieldId, resolver(index));
      });
      return next;
    });
  }, [commitVectors, inputFields, selectedLane]);

  const handleBinaryCount = useCallback(() => {
    const targetTicks = buildOperationTicks(
      latestVectorsRef.current,
      Math.min(8, Math.max(4, 1 << Math.min(inputFields.length, 3)))
    );
    commitVectors((vectors) => {
      let next = ensureTicks(vectors, inputFields, targetTicks);
      targetTicks.forEach((tick, tickIndex) => {
        inputFields.forEach((field, fieldIndex) => {
          const shift = inputFields.length - fieldIndex - 1;
          const value: 0 | 1 = ((tickIndex >> shift) & 1) === 1 ? 1 : 0;
          next = setInputValue(next, inputFields, tick, field.id, value);
        });
      });
      return next;
    });
  }, [commitVectors, inputFields]);

  const handleColumnChange = useCallback((mode: 'fill0' | 'fill1' | 'toggle') => {
    commitVectors((vectors) => {
      let next = ensureTick(vectors, inputFields, selectedTick);
      for (const field of inputFields) {
        const value =
          mode === 'fill0'
            ? 0
            : mode === 'fill1'
              ? 1
              : getInputValue(next, selectedTick, field.id) === 0
                ? 1
                : 0;
        next = setInputValue(next, inputFields, selectedTick, field.id, value);
      }
      return next;
    });
  }, [commitVectors, inputFields, selectedTick]);

  const handleInputPointerDown = useCallback((tick: number, fieldId: string) => {
    const value: 0 | 1 = getInputValue(latestVectorsRef.current, tick, fieldId) === 0 ? 1 : 0;
    setSelectedTick(tick);
    setSelectedLaneKey(`input:${fieldId}`);
    commitVectors((vectors) => setInputValue(vectors, inputFields, tick, fieldId, value));
    setPaintSession({ kind: 'input', value });
  }, [commitVectors, inputFields]);

  const handleExpectedPointerDown = useCallback((tick: number, fieldId: string) => {
    const current = getExpectedValue(latestVectorsRef.current, tick, fieldId);
    const value: 0 | 1 | null = current == null ? 0 : current === 0 ? 1 : null;
    setSelectedTick(tick);
    setSelectedLaneKey(`expected:${fieldId}`);
    commitVectors((vectors) => setExpectedValue(vectors, inputFields, tick, fieldId, value));
    setPaintSession({ kind: 'expected', value });
  }, [commitVectors, inputFields]);

  const markDirectCellActivation = useCallback((testId: string) => {
    lastDirectCellActivationRef.current = {
      testId,
      at: Date.now(),
    };
  }, []);

  const shouldIgnoreDirectCellClick = useCallback((testId: string) => {
    const lastActivation = lastDirectCellActivationRef.current;
    if (!lastActivation) return false;
    return lastActivation.testId === testId && Date.now() - lastActivation.at < 250;
  }, []);

  useEffect(() => {
    const root = canvasRootRef.current;
    if (!root) return;

    const handleCanvasPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('button')) {
        return;
      }

      const fallbackButton = findStimulusButtonAtPoint(root, event.clientX, event.clientY);
      if (!fallbackButton || fallbackButton.disabled) return;

      event.preventDefault();
      event.stopPropagation();
      window.requestAnimationFrame(() => {
        fallbackButton.click();
      });
    };

    root.addEventListener('pointerdown', handleCanvasPointerDown, { capture: true });
    return () => {
      root.removeEventListener('pointerdown', handleCanvasPointerDown, { capture: true });
    };
  }, []);

  useEffect(() => {
    const scroller = gridScrollRef.current;
    if (!scroller) return;
    let frame = 0;
    let nestedFrame = 0;
    frame = window.requestAnimationFrame(() => {
      nestedFrame = window.requestAnimationFrame(() => {
        if (initialScrollTarget !== 'expected' || readOnlyOutputs || outputFields.length === 0) {
          scroller.scrollTop = 0;
          return;
        }
        const target =
          scroller.querySelector<HTMLElement>('[data-testid^="ide-stimulus-expected-"]') ??
          firstExpectedCellRef.current ??
          expectedGroupRef.current;
        if (!target) {
          scroller.scrollTop = 0;
          return;
        }
        target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      });
    });
    return () => {
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(nestedFrame);
    };
  }, [authoredVectors.length, initialScrollTarget, outputFields.length, readOnlyOutputs]);

  const handleCopyClipboard = useCallback(async () => {
    const text = buildClipboardText(latestVectorsRef.current, inputFields, outputFields);
    await navigator.clipboard?.writeText?.(text);
  }, [inputFields, outputFields]);

  const handlePasteClipboard = useCallback(async () => {
    const text = await navigator.clipboard?.readText?.();
    if (!text) return;
    const nextVectors = parseClipboardText({
      text,
      inputFields,
      outputFields,
    });
    latestVectorsRef.current = nextVectors;
    onVectorsChange(nextVectors);
    if (nextVectors.length > 0) {
      setSelectedTick(nextVectors[0].tick);
    }
  }, [inputFields, onVectorsChange, outputFields]);

  const describeCase = useCallback((tick: number) => `Case ${tick + 1} (t${tick})`, []);
  const selectedCaseLabel = ticks.length > 0 ? describeCase(selectedTick) : 'Case 1 (t0)';

  if (inputFields.length === 0) {
    return (
      <p className="ide-stimulus-empty" data-testid="ide-stimulus-empty">
        No IO mapping yet — add inputs and outputs in{' '}
        <button
          type="button"
          className="ide-stimulus-empty-link"
          onClick={() => onNavigateToMapping?.()}
          data-testid="ide-stimulus-empty-nav"
        >
          Map Pins
        </button>{' '}
        first.
      </p>
    );
  }

  return (
    <div className="ide-stimulus-canvas" data-testid="ide-stimulus-canvas" style={{ userSelect: 'none' }} ref={canvasRootRef}>
      <div className="ide-stimulus-toolbar" data-testid="ide-stimulus-toolbar">
        <div className="ide-stimulus-toolbar-group" data-testid="ide-stimulus-case-actions">
          <span className="ide-stimulus-toolbar-label">Cases</span>
          <span className="ide-stimulus-selection-chip" data-testid="ide-stimulus-selected-case-chip">
            Selected: {selectedCaseLabel}
          </span>
          <select className="ide-stimulus-target-select" value={String(selectedTick)} onChange={(event) => setSelectedTick(Number(event.target.value || '0'))} data-testid="ide-stimulus-tick-target">
            {(ticks.length > 0 ? ticks : [0]).map((tick) => <option key={tick} value={tick}>{describeCase(tick)}</option>)}
          </select>
          <button type="button" className="ide-stimulus-mini-btn ide-stimulus-mini-btn--primary" onClick={() => commitVectors((vectors) => appendTick(vectors, inputFields))} data-testid="ide-stimulus-add-tick">Add case</button>
          <button type="button" className="ide-stimulus-mini-btn" onClick={() => { commitVectors((vectors) => duplicateTick(vectors, inputFields, selectedTick)); setSelectedTick((value) => value + 1); }} data-testid="ide-stimulus-duplicate-tick">Duplicate case</button>
          <button type="button" className="ide-stimulus-mini-btn" onClick={() => commitVectors((vectors) => removeTick(vectors, selectedTick))} disabled={ticks.length === 0} data-testid="ide-stimulus-delete-selected-tick">Delete case</button>
        </div>
        <div className="ide-stimulus-toolbar-group ide-stimulus-toolbar-group--advanced-toggle" data-testid="ide-stimulus-advanced-tools">
          <span className="ide-stimulus-toolbar-label">Advanced</span>
          <button
            type="button"
            className="ide-stimulus-mini-btn"
            aria-expanded={advancedToolsOpen}
            onClick={() => setAdvancedToolsOpen((value) => !value)}
            data-testid="ide-stimulus-advanced-tools-toggle"
          >
            {advancedToolsOpen ? 'Hide advanced tools' : 'Show advanced tools'}
          </button>
          <span className="ide-stimulus-toolbar-note">Patterns, fill, clipboard</span>
        </div>
      </div>
      {advancedToolsOpen ? (
        <div className="ide-stimulus-advanced-tools-panel" data-testid="ide-stimulus-advanced-tools-panel">
          <div className="ide-stimulus-toolbar-group">
            <span className="ide-stimulus-toolbar-label">Case patterns</span>
            <button type="button" className="ide-stimulus-mini-btn" onClick={handleBinaryCount} data-testid="ide-stimulus-pattern-binary">Binary count</button>
          </div>
          <div className="ide-stimulus-toolbar-group" data-testid="ide-stimulus-signal-edit">
            <span className="ide-stimulus-toolbar-label">Edit signal</span>
            <select className="ide-stimulus-target-select" value={selectedLane?.key ?? ''} onChange={(event) => setSelectedLaneKey(event.target.value)} data-testid="ide-stimulus-row-target">
              {laneOptions.map((option) => <option key={option.key} value={option.key}>{option.kind === 'input' ? 'Stimulus' : 'Expected'}: {option.label}</option>)}
            </select>
            <button type="button" className="ide-stimulus-mini-btn" onClick={() => handleRowFill(0)} data-testid="ide-stimulus-row-fill-0">Fill 0</button>
            <button type="button" className="ide-stimulus-mini-btn" onClick={() => handleRowFill(1)} data-testid="ide-stimulus-row-fill-1">Fill 1</button>
            {selectedLane?.kind === 'input' ? (
              <>
                <button type="button" className="ide-stimulus-mini-btn" onClick={handleRowToggle} data-testid="ide-stimulus-row-toggle">Toggle</button>
                <button type="button" className="ide-stimulus-mini-btn" onClick={() => handleInputPattern((index) => index % 2 === 0 ? 0 : 1)} data-testid="ide-stimulus-pattern-alternating">Alternating</button>
                <button type="button" className="ide-stimulus-mini-btn" onClick={() => handleInputPattern((index) => Math.floor(index / 2) % 2 === 0 ? 0 : 1)} data-testid="ide-stimulus-pattern-clock">Clock pattern</button>
              </>
            ) : (
              <button type="button" className="ide-stimulus-mini-btn" onClick={handleExpectedClear} data-testid="ide-stimulus-row-clear">Clear</button>
            )}
          </div>
          <div className="ide-stimulus-toolbar-group" data-testid="ide-stimulus-case-edit">
            <span className="ide-stimulus-toolbar-label">Edit case</span>
            <button type="button" className="ide-stimulus-mini-btn" onClick={() => handleColumnChange('fill0')} data-testid="ide-stimulus-column-fill-0">Fill 0</button>
            <button type="button" className="ide-stimulus-mini-btn" onClick={() => handleColumnChange('fill1')} data-testid="ide-stimulus-column-fill-1">Fill 1</button>
            <button type="button" className="ide-stimulus-mini-btn" onClick={() => handleColumnChange('toggle')} data-testid="ide-stimulus-column-toggle">Toggle</button>
          </div>
          <div className="ide-stimulus-toolbar-group">
            <span className="ide-stimulus-toolbar-label">Clipboard</span>
            <button type="button" className="ide-stimulus-mini-btn" onClick={() => { void handleCopyClipboard(); }} data-testid="ide-stimulus-copy-grid">Copy TSV</button>
            <button type="button" className="ide-stimulus-mini-btn" onClick={() => { void handlePasteClipboard(); }} data-testid="ide-stimulus-paste-grid">Paste TSV</button>
          </div>
        </div>
      ) : null}
      <div className="ide-stimulus-grid-scroll" ref={gridScrollRef}>
        <div style={{ minWidth: totalW, position: 'relative' }}>
        <div className="ide-stimulus-row ide-stimulus-row--header" style={{ display: 'flex', height: GROUP_H + 12, alignItems: 'stretch' }}>
          <div style={{ width: LABEL_W, flexShrink: 0 }} />
          {ticks.map((tick) => (
            <div key={tick} className={`ide-stimulus-tick-header${selectedTick === tick ? ' is-selected' : ''}`} style={{ width: TICK_W, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'center', position: 'relative', fontSize: '0.72em', fontFamily: 'var(--rb-font-mono, monospace)', cursor: 'pointer' }} onMouseEnter={() => setHoveredTick(tick)} onMouseLeave={() => setHoveredTick(null)} onClick={() => setSelectedTick(tick)}>
              <span className="ide-stimulus-tick-title">Case {tick + 1}</span>
              {selectedTick === tick || hoveredTick === tick ? (
                <div className={`ide-stimulus-tick-actions${selectedTick === tick ? ' is-pinned' : ''}`}>
                  <button
                    type="button"
                    aria-label={`Duplicate ${describeCase(tick)}`}
                    title={`Duplicate ${describeCase(tick)}`}
                    onClick={(event) => { event.stopPropagation(); commitVectors((vectors) => duplicateTick(vectors, inputFields, tick)); setSelectedTick(tick + 1); }}
                    data-testid={`ide-stimulus-duplicate-tick-${tick}`}
                  >
                    Dup
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${describeCase(tick)}`}
                    title={`Delete ${describeCase(tick)}`}
                    onClick={(event) => { event.stopPropagation(); commitVectors((vectors) => removeTick(vectors, tick)); }}
                    data-testid={`ide-stimulus-delete-tick-${tick}`}
                  >
                    Del
                  </button>
                </div>
              ) : null}
            </div>
          ))}
          <div style={{ width: ADD_COL_W, flexShrink: 0 }} />
        </div>
        <div className="ide-stimulus-group-header" style={{ display: 'flex', height: GROUP_H, alignItems: 'center' }}>
          <div style={{ width: LABEL_W, flexShrink: 0, paddingLeft: 8, fontSize: '0.68em', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--rb-text-secondary)', fontFamily: 'var(--rb-font-sans, sans-serif)' }}>Stimulus</div>
          {ticks.map((tick) => <div key={tick} style={{ width: TICK_W, flexShrink: 0, height: '100%', borderLeft: '1px solid var(--rb-border)' }} />)}
          <div style={{ width: ADD_COL_W, flexShrink: 0 }} />
        </div>
        {inputFields.map((field, index) => (
          <div key={field.id} className={`ide-stimulus-row${index % 2 === 1 ? ' ide-stimulus-row--stripe' : ''}`} style={{ display: 'flex', height: ROW_H, alignItems: 'center' }}>
            <button type="button" className={`ide-stimulus-label-cell${selectedLane?.key === `input:${field.id}` ? ' is-selected' : ''}`} onClick={() => setSelectedLaneKey(`input:${field.id}`)} data-testid={`ide-stimulus-row-select-${field.id}`} style={{ width: LABEL_W, flexShrink: 0, paddingLeft: 8, paddingRight: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.8em', color: 'var(--rb-text-primary)', fontFamily: 'var(--rb-font-mono, monospace)', background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer' }}>
              {field.label}{field.pin ? <code style={{ marginLeft: 4, fontSize: '0.82em', color: 'var(--rb-text-secondary)' }}>{field.pin}</code> : null}
            </button>
            {ticks.length === 0 && index === 0 ? (
              <div style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'center', paddingLeft: 8, fontSize: '0.75em', color: 'var(--rb-text-secondary)', fontStyle: 'italic' }}>Add a case or use a pattern to start authoring.</div>
            ) : ticks.map((tick) => {
              const value = getInputValue(authoredVectors, tick, field.id);
              const inputCellTestId = `ide-stimulus-cell-${field.id}-t${tick}`;
              return (
                <button key={tick} type="button" className="ide-stimulus-value-cell-button ide-stimulus-value-cell-button--input" onPointerDown={() => { markDirectCellActivation(inputCellTestId); handleInputPointerDown(tick, field.id); }} onClick={() => { if (shouldIgnoreDirectCellClick(inputCellTestId)) return; handleInputPointerDown(tick, field.id); }} onPointerEnter={(event) => {
                  if (!paintSession || paintSession.kind !== 'input' || (event.buttons & 1) === 0) return;
                  setSelectedTick(tick);
                  setSelectedLaneKey(`input:${field.id}`);
                  commitVectors((vectors) => setInputValue(vectors, inputFields, tick, field.id, paintSession.value as 0 | 1));
                }} data-testid={inputCellTestId} title={`${field.label} in ${describeCase(tick)}: ${value} - drag to paint`} style={{ width: TICK_W, flexShrink: 0, height: ROW_H, border: 'none', borderLeft: '1px solid var(--rb-border)', cursor: 'pointer', background: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, position: 'relative', zIndex: 2 }}>
                  <div className={`ide-stimulus-cell${value === 1 ? ' ide-stimulus-cell--hi' : ' ide-stimulus-cell--lo'}`} style={{ width: TICK_W - 8, height: ROW_H - 10, borderRadius: 3, background: value === 1 ? 'var(--rb-accent)' : 'transparent', border: value === 0 ? '1px solid var(--rb-border)' : 'none' }} />
                </button>
              );
            })}
            <div style={{ width: ADD_COL_W, flexShrink: 0 }} />
          </div>
        ))}
        {outputFields.length > 0 && !readOnlyOutputs ? (
          <>
            <div ref={expectedGroupRef} className="ide-stimulus-group-header ide-stimulus-group-header--asserted" style={{ display: 'flex', height: GROUP_H, alignItems: 'center', background: 'var(--rb-surface-2, transparent)' }}>
              <div style={{ width: LABEL_W, flexShrink: 0, paddingLeft: 8, fontSize: '0.68em', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--rb-text-secondary)', fontFamily: 'var(--rb-font-sans, sans-serif)' }}>Expected outputs</div>
              {ticks.map((tick) => <div key={tick} style={{ width: TICK_W, flexShrink: 0, height: '100%', borderLeft: '1px solid var(--rb-border)' }} />)}
              <div style={{ width: ADD_COL_W, flexShrink: 0 }} />
            </div>
            {outputFields.map((field) => (
              <div key={field.id} className="ide-stimulus-row ide-stimulus-row--output" style={{ display: 'flex', height: ROW_H, alignItems: 'center' }}>
                <button type="button" className={`ide-stimulus-label-cell ide-stimulus-label-cell--expected${selectedLane?.key === `expected:${field.id}` ? ' is-selected' : ''}`} onClick={() => setSelectedLaneKey(`expected:${field.id}`)} data-testid={`ide-stimulus-row-select-${field.id}`} style={{ width: LABEL_W, flexShrink: 0, paddingLeft: 8, paddingRight: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.8em', color: 'var(--rb-text-secondary)', fontStyle: 'italic', fontFamily: 'var(--rb-font-mono, monospace)', background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer' }}>{field.label}</button>
                {ticks.map((tick) => {
                  const value = getExpectedValue(authoredVectors, tick, field.id);
                  const expectedCellTestId = `ide-stimulus-expected-${field.id}-t${tick}`;
                  return (
                    <button key={tick} ref={field.id === outputFields[0]?.id && tick === ticks[0] ? firstExpectedCellRef : undefined} type="button" className="ide-stimulus-value-cell-button ide-stimulus-value-cell-button--expected" onPointerDown={() => { markDirectCellActivation(expectedCellTestId); handleExpectedPointerDown(tick, field.id); }} onClick={() => { if (shouldIgnoreDirectCellClick(expectedCellTestId)) return; handleExpectedPointerDown(tick, field.id); }} onPointerEnter={(event) => {
                      if (!paintSession || paintSession.kind !== 'expected' || (event.buttons & 1) === 0) return;
                      setSelectedTick(tick);
                      setSelectedLaneKey(`expected:${field.id}`);
                      commitVectors((vectors) => setExpectedValue(vectors, inputFields, tick, field.id, paintSession.value));
                    }} data-testid={expectedCellTestId} title={`${field.label} in ${describeCase(tick)}: ${value != null ? value : 'not set'} - drag to paint`} style={{ width: TICK_W, flexShrink: 0, height: ROW_H, borderTop: 'none', borderRight: 'none', borderBottom: 'none', borderLeft: '1px solid var(--rb-border)', background: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, position: 'relative', zIndex: 2 }}>
                      {value != null ? <div style={{ width: TICK_W - 8, height: ROW_H - 10, borderRadius: 3, background: value === 1 ? 'var(--rb-accent)' : 'transparent', border: value === 0 ? '1px solid var(--rb-border)' : 'none' }} /> : <span style={{ fontSize: '0.72em', color: 'var(--rb-text-secondary)' }}>-</span>}
                    </button>
                  );
                })}
                <div style={{ width: ADD_COL_W, flexShrink: 0 }} />
              </div>
            ))}
          </>
        ) : null}
        </div>
      </div>
    </div>
  );
};
