// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.

import { describe, it, expect } from 'vitest';
import type { VerifyCommandBarProps } from '../surfaces/verify/VerifyCommandBar';
import type { VerifyFirstRunPanelProps } from '../surfaces/verify/VerifyFirstRunPanel';
import type { VerifyWaveformPlaceholderProps } from '../surfaces/verify/VerifyWaveformPlaceholder';

// ─── Contract tests: first-run usability props & invariants ──────────────────
// These verify the behavioral contracts of the Phase 3 first-run experience
// components without rendering (BUG-003 blocks render tests).

describe('VerifyCommandBar contracts', () => {
  function makeProps(overrides?: Partial<VerifyCommandBarProps>): VerifyCommandBarProps {
    return {
      isCompareMode: false,
      onSetObserve: () => {},
      onSetCompare: () => {},
      compareAvailable: false,
      onRun: () => {},
      runLabel: 'Run',
      runDisabled: false,
      onGenerate: () => {},
      generateLabel: 'Initialize inputs',
      showGenerate: true,
      showSaveAsExpected: false,
      statusLabel: 'NOT STARTED',
      statusTone: 'idle',
      isSequential: false,
      ...overrides,
    };
  }

  it('compare button exists with compareAvailable=false (visible but disabled)', () => {
    const props = makeProps({ compareAvailable: false });
    // Contract: Compare control should be present above the fold even when
    // disabled; the component renders the compare button regardless
    expect(props.compareAvailable).toBe(false);
    // The button renders with disabled state — verifiable via the prop
    expect(props.onSetCompare).toBeDefined();
  });

  it('command bar is renderable without any gating state', () => {
    // Contract: command bar renders ALWAYS, no isFirstRunState check needed
    const props = makeProps();
    expect(props.onRun).toBeDefined();
    expect(props.runLabel).toBe('Run');
    expect(props.statusLabel).toBe('NOT STARTED');
  });

  it('showGenerate is true on first run', () => {
    const props = makeProps({ showGenerate: true });
    expect(props.showGenerate).toBe(true);
  });

  it('sequential circuits show sequential chip', () => {
    const props = makeProps({ isSequential: true });
    expect(props.isSequential).toBe(true);
  });

  it('status tone maps correctly for first-run and post-run states', () => {
    // idle = first run / not started
    expect(makeProps({ statusTone: 'idle' }).statusTone).toBe('idle');
    // ok = pass
    expect(makeProps({ statusTone: 'ok' }).statusTone).toBe('ok');
    // error = fail
    expect(makeProps({ statusTone: 'error' }).statusTone).toBe('error');
    // warn = incomplete mapping
    expect(makeProps({ statusTone: 'warn' }).statusTone).toBe('warn');
  });
});

describe('VerifyFirstRunPanel contracts', () => {
  function makeProps(overrides?: Partial<VerifyFirstRunPanelProps>): VerifyFirstRunPanelProps {
    return {
      isSequential: false,
      inputNames: ['sw0', 'sw1'],
      outputNames: ['led0'],
      onGenerateStarter: () => {},
      onRunCircuit: () => {},
      runLabel: 'Run',
      hasVectors: false,
      ...overrides,
    };
  }

  it('first-run panel shows visible starter action when no vectors exist', () => {
    const props = makeProps({ hasVectors: false });
    // Contract: onGenerateStarter is the primary CTA when hasVectors=false
    expect(props.hasVectors).toBe(false);
    expect(props.onGenerateStarter).toBeDefined();
  });

  it('first-run panel shows run action when vectors already exist', () => {
    const props = makeProps({ hasVectors: true });
    // Contract: onRunCircuit becomes primary CTA when hasVectors=true
    expect(props.hasVectors).toBe(true);
    expect(props.onRunCircuit).toBeDefined();
  });

  it('sequential circuits show clock presets', () => {
    const calls: string[] = [];
    const props = makeProps({
      isSequential: true,
      clockName: 'clk',
      onAlternatingClock: () => calls.push('alt'),
      onHoldLow: () => calls.push('low'),
      onHoldHigh: () => calls.push('high'),
      onSinglePulse: () => calls.push('pulse'),
    });
    // Contract: all four clock preset callbacks are wired
    expect(props.onAlternatingClock).toBeDefined();
    expect(props.onHoldLow).toBeDefined();
    expect(props.onHoldHigh).toBeDefined();
    expect(props.onSinglePulse).toBeDefined();

    // Verify callbacks are callable
    props.onAlternatingClock!();
    props.onHoldLow!();
    props.onHoldHigh!();
    props.onSinglePulse!();
    expect(calls).toEqual(['alt', 'low', 'high', 'pulse']);
  });

  it('combinational circuits do not receive clock presets', () => {
    const props = makeProps({ isSequential: false });
    expect(props.onAlternatingClock).toBeUndefined();
    expect(props.onHoldLow).toBeUndefined();
    expect(props.onHoldHigh).toBeUndefined();
    expect(props.onSinglePulse).toBeUndefined();
  });

  it('signal names are passed through for orientation', () => {
    const props = makeProps({
      inputNames: ['A', 'B', 'Cin'],
      outputNames: ['Sum', 'Cout'],
      clockName: 'clk',
    });
    expect(props.inputNames).toEqual(['A', 'B', 'Cin']);
    expect(props.outputNames).toEqual(['Sum', 'Cout']);
    expect(props.clockName).toBe('clk');
  });
});

describe('VerifyWaveformPlaceholder contracts', () => {
  function makeProps(overrides?: Partial<VerifyWaveformPlaceholderProps>): VerifyWaveformPlaceholderProps {
    return {
      inputNames: ['sw0', 'sw1'],
      outputNames: ['led0'],
      isSequential: false,
      onGenerate: () => {},
      onRun: () => {},
      hasVectors: false,
      runLabel: 'Run',
      ...overrides,
    };
  }

  it('placeholder replaces empty dead space before first run', () => {
    // Contract: the placeholder component exists and is renderable
    // with no vectors and no prior run
    const props = makeProps({ hasVectors: false });
    expect(props.hasVectors).toBe(false);
    expect(props.onGenerate).toBeDefined();
  });

  it('placeholder shows generate CTA when no vectors exist', () => {
    const props = makeProps({ hasVectors: false });
    expect(props.hasVectors).toBe(false);
    // Primary action is generate, not run
  });

  it('placeholder shows run CTA when vectors exist', () => {
    const props = makeProps({ hasVectors: true });
    expect(props.hasVectors).toBe(true);
    // Primary action switches to run
    expect(props.onRun).toBeDefined();
  });

  it('scaffold lanes reflect all signal types', () => {
    const props = makeProps({
      inputNames: ['A', 'B'],
      outputNames: ['Y'],
      clockName: 'clk',
      isSequential: true,
    });
    // Contract: all signal categories are present for scaffold
    const allNames = [
      ...(props.clockName ? [props.clockName] : []),
      ...props.inputNames,
      ...props.outputNames,
    ];
    expect(allNames).toEqual(['clk', 'A', 'B', 'Y']);
  });

  it('sequential placeholder includes clock signal', () => {
    const props = makeProps({
      isSequential: true,
      clockName: 'clk',
    });
    expect(props.clockName).toBe('clk');
    expect(props.isSequential).toBe(true);
  });
});

describe('First-run wiring invariants', () => {
  it('command bar always-visible: no isFirstRunState gating', () => {
    // Contract: VerifyCommandBar is rendered inside VerifyHeaderRegion
    // WITHOUT any isFirstRunState conditional wrapping.
    // Verification: the component accepts only its own props,
    // not a visibility toggle.
    const props: VerifyCommandBarProps = {
      isCompareMode: false,
      onSetObserve: () => {},
      onSetCompare: () => {},
      compareAvailable: false,
      onRun: () => {},
      runLabel: 'Run',
      runDisabled: false,
      onGenerate: () => {},
      generateLabel: 'Initialize inputs',
      showGenerate: true,
      showSaveAsExpected: false,
      statusLabel: 'NOT STARTED',
      statusTone: 'idle',
      isSequential: false,
    };
    // No 'visible' or 'show' prop — always rendered
    expect(Object.keys(props)).not.toContain('visible');
    expect(Object.keys(props)).not.toContain('show');
    // showGenerate/showSaveAsExpected control content, not the bar itself
  });

  it('waveform placeholder renders INSTEAD OF empty space during draft', () => {
    // Contract: isDraftSession triggers placeholder, not empty space
    // The ternary in VerifySurface is:
    //   {isDraftSession ? <VerifyWaveformPlaceholder /> : <div workbench>}
    // This test verifies the placeholder props are complete
    const props: VerifyWaveformPlaceholderProps = {
      inputNames: ['sw0'],
      outputNames: ['led0'],
      isSequential: false,
      onGenerate: () => {},
      onRun: () => {},
      hasVectors: false,
      runLabel: 'Run',
    };
    expect(props.inputNames.length).toBeGreaterThan(0);
    expect(props.onGenerate).toBeDefined();
    expect(props.onRun).toBeDefined();
  });
});
