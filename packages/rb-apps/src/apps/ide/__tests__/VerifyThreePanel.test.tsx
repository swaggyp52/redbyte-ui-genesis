// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { VerifyThreePanel } from '../surfaces/VerifyThreePanel';

describe('VerifyThreePanel', () => {
  it('renders left, center, and right panels as siblings', () => {
    const { getByTestId } = render(
      <VerifyThreePanel
        leftPanel={<div data-testid="left-content">left</div>}
        centerPanel={<div data-testid="center-content">center</div>}
        rightPanel={<div data-testid="right-content">right</div>}
      />
    );

    expect(getByTestId('ide-verify-three-panel-left').contains(getByTestId('left-content'))).toBe(true);
    expect(getByTestId('ide-verify-three-panel-center').contains(getByTestId('center-content'))).toBe(true);
    expect(getByTestId('ide-verify-three-panel-center').tagName).toBe('SECTION');
    expect(getByTestId('ide-verify-three-panel-center')).toHaveAttribute('aria-label', 'Simulation results');
    expect(getByTestId('ide-verify-three-panel-right').contains(getByTestId('right-content'))).toBe(true);
  });
});
