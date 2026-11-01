// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { WorkbenchStatusBar } from '../components/WorkbenchStatusBar';

/**
 * The status line is red for errors only. In rc.8 it was red for any problem, so six warnings
 * (unmapped board pins and open wiring) read as failures under a passing run (owner acceptance V3).
 */
afterEach(cleanup);

const tone = (props: React.ComponentProps<typeof WorkbenchStatusBar>) => {
  const view = render(<WorkbenchStatusBar {...props} />);
  const button = view.getByTestId('ide-status-problems');
  const result = { tone: button.getAttribute('data-tone'), text: button.textContent };
  view.unmount();
  return result;
};

describe('status line problem tone', () => {
  it('reads warnings as warnings', () => {
    expect(tone({ problemsCount: 6, errorCount: 0 })).toEqual({ tone: 'warn', text: '6 problems' });
  });

  it('is red when there is an error', () => {
    expect(tone({ problemsCount: 6, errorCount: 1 }).tone).toBe('error');
  });

  it('is plain with no problems', () => {
    expect(tone({ problemsCount: 0, errorCount: 0, noteCount: 2 })).toEqual({ tone: null, text: 'No problems · 2 notes' });
  });
});
