// @vitest-environment jsdom
import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { IdeBlockedState, IdeButton } from '../components/IdePrimitives';
import { PRODUCT_UI_STANDARDS } from '../productUiStandards';

describe('professional RedByte UI standards', () => {
  it('keeps action, status, type, and target limits executable in source', () => {
    expect(PRODUCT_UI_STANDARDS.actionHierarchy.maximumPrimaryActions).toBe(1);
    expect(PRODUCT_UI_STANDARDS.statusHierarchy.maximumDominantIndicators).toBe(2);
    expect(PRODUCT_UI_STANDARDS.visualTone.bodyTextMinimumPx).toBe(14);
    expect(PRODUCT_UI_STANDARDS.visualTone.routineControlMinimumPx).toBe(36);
    expect(PRODUCT_UI_STANDARDS.visualTone.primaryControlMinimumPx).toBe(40);
    expect(PRODUCT_UI_STANDARDS.visualTone.visibleBorderNestingLimit).toBe(2);
  });

  it('renders a blocker with one direct repair owner and action', () => {
    const onRepair = vi.fn();
    const view = render(
      <IdeBlockedState
        title="Mapping is incomplete"
        body="Assign the remaining logical signals before building a trusted package."
        owner="Map Pins"
        primaryAction={<IdeButton tone="primary" onClick={onRepair}>Open Map Pins</IdeButton>}
        testId="professional-blocker"
      />
    );

    expect(view.getByTestId('professional-blocker').textContent).toContain('Resolve in Map Pins');
    expect(view.getAllByRole('button')).toHaveLength(1);
    fireEvent.click(view.getByRole('button', { name: 'Open Map Pins' }));
    expect(onRepair).toHaveBeenCalledTimes(1);
  });

  it('defines the restrained professional theme without decorative gradients or glow', () => {
    const themeRoot = resolve('packages/rb-apps/src/apps/ide/theme');
    const theme = readFileSync(resolve(themeRoot, 'redbyte-theme.css'), 'utf8');
    const primitives = readFileSync(resolve(themeRoot, 'redbyte-primitives.css'), 'utf8');

    expect(theme).toContain('--rb-canvas: #0f141a');
    expect(theme).toContain('--rb-action: #356fa8');
    expect(theme).toContain('--rb-type-body: 14px');
    expect(theme).toContain('--rb-control-h: 36px');
    expect(theme).toContain('--rb-control-h-lg: 40px');
    expect(theme).not.toContain('linear-gradient');
    expect(theme).not.toContain('text-shadow');
    expect(primitives).toContain('box-shadow: none');
    expect(primitives).toContain('animation: none');
    expect(primitives).not.toContain('!important');
    expect(primitives).not.toContain('[data-testid');
    expect(primitives).not.toContain('[class*=');
    expect(primitives).not.toContain('infinite');
    expect(primitives).not.toContain('text-shadow');
    expect(primitives).not.toContain('drop-shadow');
  });
});
