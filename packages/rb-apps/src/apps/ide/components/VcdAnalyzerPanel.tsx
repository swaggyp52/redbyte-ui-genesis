import React, { useRef } from 'react';
import type { ProviderWaveform } from '../simulationProvider';
import { evidenceCaption } from '../simulationProvider';
import {
  VCD_RADIXES,
  analyzerMeasurements,
  clampCursorTime,
  radixForSignal,
  visibleSignals,
  type VcdAnalyzerConfig,
  type VcdRadix,
} from '../vcdAnalyzer';
import { VcdWaveformView } from './VcdWaveformView';

/**
 * Imported-VCD Analyzer — the real Simulate view for waveform evidence produced
 * by an *external* simulator. It integrates the existing bounded VCD reader and
 * the simulation-provider model (never a second parser or store) into a
 * three-zone workbench:
 *
 *   SIGNALS       — searchable signal list; pin signals and pick a per-signal radix.
 *   WAVEFORM      — the existing {@link VcdWaveformView} over the visible signals,
 *                   with a measurement cursor.
 *   MEASUREMENTS  — each visible signal's value at the cursor, formatted per radix.
 *
 * The provider identity and evidence tier are always shown, so an imported
 * waveform is never mistaken for RedByte's own browser simulation. RedByte
 * executes nothing here — it replays what the file already recorded.
 */

export interface VcdAnalyzerPanelProps {
  /** The imported waveform, or null when nothing has been loaded. */
  readonly waveform: ProviderWaveform | null;
  /** Analyzer view configuration (owned by the runtime store). */
  readonly config: VcdAnalyzerConfig;
  /** Name of the loaded VCD file, for the header. */
  readonly sourceName?: string | null;
  /** A fatal load/parse message (e.g. "not a usable VCD"), shown as an error banner. */
  readonly parseError?: string | null;
  /** Emit the raw text of a chosen `.vcd` file for the container to parse + store. */
  readonly onImportVcd: (fileName: string, text: string) => void;
  /** Patch the Analyzer view configuration. */
  readonly onConfigChange: (patch: Partial<VcdAnalyzerConfig>) => void;
  /** Clear the imported waveform. */
  readonly onClear: () => void;
  /**
   * Whether the imported-VCD provider is the currently selected simulation
   * provider. When false, the Analyzer stays readable but shows a muted "not the
   * active provider" strip so the current run-of-record is never ambiguous.
   * Defaults to true (the Analyzer is self-contained without a provider bar).
   */
  readonly isActiveProvider?: boolean;
}

export const VcdAnalyzerPanel: React.FC<VcdAnalyzerPanelProps> = ({
  waveform,
  config,
  sourceName,
  parseError,
  onImportVcd,
  onConfigChange,
  onClear,
  isActiveProvider = true,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const openFilePicker = () => fileInputRef.current?.click();

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset so re-selecting the same file re-triggers onChange.
    event.target.value = '';
    if (!file) return;
    const text = await file.text();
    onImportVcd(file.name, text);
  };

  const showError = !!parseError || (!!waveform && waveform.signals.length === 0);

  return (
    <section
      className={`ide-vcd-analyzer${isActiveProvider ? '' : ' is-inactive-provider'}`}
      data-testid="ide-vcd-analyzer"
      data-active-provider={isActiveProvider ? 'true' : 'false'}
      aria-label="Imported waveform Analyzer"
    >
      {waveform && !isActiveProvider ? (
        <div className="ide-vcd-analyzer-inactive" data-testid="ide-vcd-analyzer-inactive">
          Imported VCD is not the active provider — select it in the provider bar to make this
          the current view.
        </div>
      ) : null}
      <header className="ide-vcd-analyzer-head">
        <div className="ide-vcd-analyzer-identity">
          <span className="ide-vcd-analyzer-title">Imported waveform Analyzer</span>
          <span className="ide-vcd-analyzer-provider" data-testid="ide-vcd-analyzer-provider">
            Provider: Imported VCD
          </span>
          <span className="ide-vcd-analyzer-evidence" data-testid="ide-vcd-analyzer-evidence">
            {waveform
              ? evidenceCaption(waveform.provider)
              : 'Imported evidence — waveform generated outside RedByte'}
          </span>
        </div>
        <div className="ide-vcd-analyzer-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept=".vcd,.txt,text/plain"
            hidden
            data-testid="ide-vcd-analyzer-file-input"
            onChange={handleFileSelected}
          />
          <button
            type="button"
            className="ide-vcd-analyzer-load"
            data-testid="ide-vcd-analyzer-load"
            onClick={openFilePicker}
          >
            {waveform ? 'Load another .vcd' : 'Load .vcd file'}
          </button>
          {waveform ? (
            <button
              type="button"
              className="ide-vcd-analyzer-clear"
              data-testid="ide-vcd-analyzer-clear"
              onClick={onClear}
            >
              Clear
            </button>
          ) : null}
        </div>
      </header>

      <p className="ide-vcd-analyzer-honesty" data-testid="ide-vcd-analyzer-honesty">
        This is external evidence — a waveform recorded by another simulator. RedByte
        replays it and executes nothing. It is not a browser simulation and never runs
        imported HDL or Tcl.
      </p>

      {showError ? (
        <div className="ide-vcd-analyzer-error" role="alert" data-testid="ide-vcd-analyzer-error">
          {parseError ?? 'No signals found — this file is not a usable VCD.'}
        </div>
      ) : null}

      {!waveform && !showError ? (
        <div className="ide-vcd-analyzer-empty" data-testid="ide-vcd-analyzer-empty">
          <p>No imported waveform yet.</p>
          <p>
            Load a <code>.vcd</code> produced by an external simulator to inspect its signals,
            waveform, and per-cursor measurements here.
          </p>
        </div>
      ) : null}

      {waveform && waveform.signals.length > 0 ? (
        <AnalyzerBody
          waveform={waveform}
          config={config}
          sourceName={sourceName}
          onConfigChange={onConfigChange}
        />
      ) : null}
    </section>
  );
};

interface AnalyzerBodyProps {
  waveform: ProviderWaveform;
  config: VcdAnalyzerConfig;
  sourceName?: string | null;
  onConfigChange: (patch: Partial<VcdAnalyzerConfig>) => void;
}

/** Bounded row rendering keeps a 500-signal VCD from exploding the DOM; the count
 *  and a "filter to narrow" hint make the cap explicit — never a silent truncation. */
const SIGNAL_RENDER_CAP = 200;

const AnalyzerBody: React.FC<AnalyzerBodyProps> = ({ waveform, config, sourceName, onConfigChange }) => {
  const filtered = filteredForList(waveform, config.search);
  const shownSignals = filtered.slice(0, SIGNAL_RENDER_CAP);
  const hiddenSignalCount = filtered.length - shownSignals.length;
  const selected = new Set(config.selectedKeys);
  // Bound the WAVEFORM + MEASUREMENTS zones to the same cap so an unfiltered
  // 500-signal VCD cannot explode the DOM; the hint tells the user to pin/filter.
  const visible = visibleSignals(waveform, config);
  const boundedVisible = visible.slice(0, SIGNAL_RENDER_CAP);
  const boundedKeys = new Set(boundedVisible.map((s) => s.key));
  const visibleCount = visible.length;
  const visibleHidden = visible.length - boundedVisible.length;
  const narrowed = {
    ...waveform,
    signals: boundedVisible,
    changes: waveform.changes.filter((c) => boundedKeys.has(c.key)),
  };
  const measurements = analyzerMeasurements(waveform, config).filter((m) => boundedKeys.has(m.key));

  const toggleSignal = (key: string) => {
    const next = new Set(config.selectedKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onConfigChange({ selectedKeys: [...next] });
  };

  const setRadix = (key: string, radix: VcdRadix) => {
    onConfigChange({ radixByKey: { ...config.radixByKey, [key]: radix } });
  };

  const setCursor = (raw: number) => {
    onConfigChange({ cursorTime: clampCursorTime(waveform, raw) });
  };

  return (
    <div className="ide-vcd-analyzer-body">
      <div className="ide-vcd-analyzer-meta" data-testid="ide-vcd-analyzer-meta">
        <span>
          <strong data-testid="ide-vcd-analyzer-signal-count">{waveform.signals.length}</strong> signals
        </span>
        <span>ends t={waveform.endTime}</span>
        {waveform.timescaleLabel ? <span>{waveform.timescaleLabel}</span> : null}
        {sourceName ? <span className="ide-vcd-analyzer-source">{sourceName}</span> : null}
        <span>{visibleCount} shown</span>
      </div>

      {/* ── SIGNALS zone ── */}
      <section className="ide-vcd-analyzer-zone ide-vcd-analyzer-signals" data-zone="signals" data-testid="ide-vcd-analyzer-signals" aria-label="Signals">
        <header className="ide-vcd-analyzer-zone-head">
          <span>Signals</span>
          <input
            type="search"
            className="ide-vcd-analyzer-search"
            data-testid="ide-vcd-analyzer-search"
            placeholder="Filter signals…"
            value={config.search}
            onChange={(event) => onConfigChange({ search: event.target.value })}
            aria-label="Filter signals"
          />
          {config.selectedKeys.length > 0 ? (
            <button
              type="button"
              className="ide-vcd-analyzer-clear-selection"
              data-testid="ide-vcd-analyzer-clear-selection"
              onClick={() => onConfigChange({ selectedKeys: [] })}
            >
              Show all
            </button>
          ) : null}
        </header>
        <ul className="ide-vcd-analyzer-signal-list">
          {filtered.length === 0 ? (
            <li className="ide-vcd-analyzer-signal-empty" data-testid="ide-vcd-analyzer-signal-empty">
              No signals match “{config.search}”.
            </li>
          ) : (
            shownSignals.map((signal) => {
              const isSelected = selected.size === 0 || selected.has(signal.key);
              return (
                <li
                  key={signal.key}
                  className={`ide-vcd-analyzer-signal-row${selected.has(signal.key) ? ' is-pinned' : ''}`}
                  data-testid={`ide-vcd-analyzer-signal-${signal.key}`}
                >
                  <label className="ide-vcd-analyzer-signal-pick">
                    <input
                      type="checkbox"
                      checked={selected.has(signal.key)}
                      onChange={() => toggleSignal(signal.key)}
                      aria-label={`Pin ${signal.name}`}
                      data-testid={`ide-vcd-analyzer-pin-${signal.key}`}
                    />
                    <code className="ide-vcd-analyzer-signal-name">{signal.name}</code>
                    {signal.width > 1 ? <small>[{signal.width}]</small> : null}
                  </label>
                  <select
                    className="ide-vcd-analyzer-radix"
                    data-testid={`ide-vcd-analyzer-radix-${signal.key}`}
                    value={radixForSignal(config, signal)}
                    onChange={(event) => setRadix(signal.key, event.target.value as VcdRadix)}
                    aria-label={`Radix for ${signal.name}`}
                    disabled={!isSelected}
                  >
                    {VCD_RADIXES.map((radix) => (
                      <option key={radix} value={radix}>
                        {radix}
                      </option>
                    ))}
                  </select>
                </li>
              );
            })
          )}
          {hiddenSignalCount > 0 ? (
            <li className="ide-vcd-analyzer-signal-more" data-testid="ide-vcd-analyzer-signal-more">
              Showing {shownSignals.length} of {filtered.length} — filter to narrow the list.
            </li>
          ) : null}
        </ul>
      </section>

      {/* ── WAVEFORM zone ── */}
      <section className="ide-vcd-analyzer-zone ide-vcd-analyzer-waveform-zone" data-zone="waveform" data-testid="ide-vcd-analyzer-waveform-zone" aria-label="Waveform">
        <header className="ide-vcd-analyzer-zone-head">
          <span>Waveform</span>
          <div className="ide-vcd-analyzer-cursor-control">
            <label htmlFor="ide-vcd-analyzer-cursor">Cursor t=</label>
            <input
              id="ide-vcd-analyzer-cursor"
              type="range"
              min={0}
              max={Math.max(1, waveform.endTime)}
              step={1}
              value={config.cursorTime}
              onChange={(event) => setCursor(Number(event.target.value))}
              data-testid="ide-vcd-analyzer-cursor"
              aria-label="Measurement cursor time"
            />
            <input
              type="number"
              className="ide-vcd-analyzer-cursor-value"
              min={0}
              max={waveform.endTime}
              value={config.cursorTime}
              onChange={(event) => setCursor(Number(event.target.value))}
              data-testid="ide-vcd-analyzer-cursor-value"
              aria-label="Cursor time value"
            />
          </div>
        </header>
        <VcdWaveformView waveform={narrowed} />
      </section>

      {/* ── MEASUREMENTS zone ── */}
      <section className="ide-vcd-analyzer-zone ide-vcd-analyzer-measurements" data-zone="measurements" data-testid="ide-vcd-analyzer-measurements" aria-label="Measurements">
        <header className="ide-vcd-analyzer-zone-head">
          <span>Measurements</span>
          <small>at cursor t={config.cursorTime}</small>
        </header>
        <table className="ide-vcd-analyzer-measure-table">
          <thead>
            <tr>
              <th scope="col">Signal</th>
              <th scope="col">Value</th>
              <th scope="col">Radix</th>
              <th scope="col">Changes</th>
            </tr>
          </thead>
          <tbody>
            {measurements.map((measurement) => (
              <tr key={measurement.key} data-testid={`ide-vcd-analyzer-measure-${measurement.key}`}>
                <th scope="row">
                  <code>{measurement.name}</code>
                  {measurement.width > 1 ? <small>[{measurement.width}]</small> : null}
                </th>
                <td className="ide-vcd-analyzer-measure-value" data-testid={`ide-vcd-analyzer-measure-value-${measurement.key}`}>
                  {measurement.formatted}
                </td>
                <td>{measurement.radix}</td>
                <td>{measurement.changeCount}</td>
              </tr>
            ))}
            {visibleHidden > 0 ? (
              <tr data-testid="ide-vcd-analyzer-measure-more">
                <td colSpan={4} className="ide-vcd-analyzer-measure-more">
                  Showing {boundedVisible.length} of {visibleCount} signals — pin or filter signals to focus.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
};

function filteredForList(waveform: ProviderWaveform, search: string) {
  const needle = search.trim().toLowerCase();
  if (!needle) return waveform.signals;
  return waveform.signals.filter((signal) => signal.name.toLowerCase().includes(needle));
}
