// @vitest-environment jsdom
import React from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { deriveIdeBlockingDesignIssue, useProjectRuntime } from '@redbyte/rb-apps/runtime';
import { planStudioRun } from '@redbyte/rb-apps/domain';
import { MeridianStudio } from '../MeridianStudio';

// A wire leaving a module instance carries the value recorded inside the instance. The 4-bit
// hierarchical adder chains four FullAdderCell instances through their carries; the sheet drew
// those carry wires (u-fa0.COUT -> u-fa1.CIN, ...) with no value, because the recording keys the
// elaborated cell (u-fa0__o1.out), never the instance's port.

const originalGetContext = HTMLCanvasElement.prototype.getContext;
const originalScrollIntoView = Element.prototype.scrollIntoView;
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
  Element.prototype.scrollIntoView = () => {};
});
afterAll(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext;
  Element.prototype.scrollIntoView = originalScrollIntoView;
});

describe('Meridian sheet: wires from a module instance carry its recorded value', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useProjectRuntime.persist.clearStorage();
    useProjectRuntime.setState(useProjectRuntime.getInitialState(), true);
    window.history.replaceState({}, '', '/?studio=meridian&stage=simulate');
  });

  afterEach(() => {
    cleanup();
    useProjectRuntime.persist.clearStorage();
    useProjectRuntime.setState(useProjectRuntime.getInitialState(), true);
    localStorage.clear();
    sessionStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('draws every carry of the hierarchical 4-bit adder as the ripple carry worked by hand', async () => {
    const view = render(<MeridianStudio />);
    await act(async () => {
      useProjectRuntime.getState().loadExample('four-bit-adder-hierarchical');
    });
    await act(async () => {
      const plan = planStudioRun(useProjectRuntime.getState(), { captureEvaluations: true, resolveBlockingIssue: deriveIdeBlockingDesignIssue });
      useProjectRuntime.getState().runVerification(plan.input);
    });
    const run = useProjectRuntime.getState().verifyLastRun;
    expect(run?.status).toBe('pass');
    await waitFor(() => expect(view.getByTestId('meridian-time').getAttribute('data-run-id')).toBe(run!.runId));

    const drawn = (net: string) => view.container.querySelector(`[data-testid="meridian-sheet"] [data-net-id="${net}"]`)?.getAttribute('data-value');
    let carriesSeen = 0;
    for (const { tick } of run!.waveform) {
      fireEvent.click(view.getByTestId(`meridian-tick-${tick}`));
      expect(view.getByTestId('meridian-time').getAttribute('data-tick')).toBe(String(tick));
      const unvalued = Array.from(view.container.querySelectorAll('[data-testid="meridian-sheet"] [data-net-id]'))
        .filter((net) => net.getAttribute('data-value') === 'none')
        .map((net) => net.getAttribute('data-net-id'));
      expect(unvalued, `t${tick}: wires drawn without a value`).toEqual([]);
      // By hand: cell i adds A_i, B_i and the carry in; cell 0's carry in is ground.
      let carry = 0;
      for (let i = 0; i < 4; i += 1) {
        const a = Number(drawn(`a${i}.out`));
        const b = Number(drawn(`b${i}.out`));
        expect([0, 1], `t${tick}: A${i}/B${i} are drawn`).toContain(a);
        expect([0, 1]).toContain(b);
        expect(drawn(`u-fa${i}.SUM`), `t${tick}: SUM${i}`).toBe(String(a ^ b ^ carry));
        carry = (a & b) | (carry & (a ^ b));
        carriesSeen += carry;
        expect(drawn(`u-fa${i}.COUT`), `t${tick}: COUT${i}`).toBe(String(carry));
      }
    }
    expect(carriesSeen, 'the starter cases exercise the carry chain').toBeGreaterThan(0);
  }, 60_000);
});
