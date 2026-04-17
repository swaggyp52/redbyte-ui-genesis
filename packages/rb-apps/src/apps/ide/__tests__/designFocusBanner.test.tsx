// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import {
  DesignFocusBanner,
  type DesignFocusContext,
} from '../components/DesignFocusBanner';

const MACRO_CONTEXT: DesignFocusContext = {
  kind: 'macro',
  macroId: 'm1',
  name: 'Adder4',
  ioSummary: '2 in · 1 out',
  description: 'Ripple-carry adder',
};

const COMPONENT_CONTEXT: DesignFocusContext = {
  kind: 'custom-component',
  componentName: 'ALU',
  description: 'Arithmetic logic unit',
};

describe('DesignFocusBanner', () => {
  it('renders macro kind, name, and io summary without duplicating the long description', () => {
    const { getByTestId, queryByTestId } = render(
      <DesignFocusBanner context={MACRO_CONTEXT} onClear={vi.fn()} />
    );
    expect(getByTestId('ide-design-focus-banner-kind').textContent).toBe('Macro');
    expect(getByTestId('ide-design-focus-banner-name').textContent).toBe('Adder4');
    const banner = getByTestId('ide-design-focus-banner');
    expect(banner.textContent).toContain('2 in · 1 out');
    expect(queryByTestId('ide-design-focus-banner-description')).toBeNull();
    expect(banner.textContent).not.toContain('Ripple-carry adder');
  });

  it('shows the armed badge and placement hint when isPlacementArmed is true', () => {
    const { getByTestId } = render(
      <DesignFocusBanner
        context={MACRO_CONTEXT}
        onClear={vi.fn()}
        isPlacementArmed
      />
    );
    expect(getByTestId('ide-design-focus-banner-armed').textContent).toBe(
      'Armed for placement'
    );
    expect(getByTestId('ide-design-focus-banner-hint').textContent).toContain(
      'canvas HUD'
    );
    const banner = getByTestId('ide-design-focus-banner');
    expect(banner.getAttribute('data-placement-armed')).toBe('1');
  });

  it('shows the palette-filter hint when macro is not armed', () => {
    const { getByTestId } = render(
      <DesignFocusBanner context={MACRO_CONTEXT} onClear={vi.fn()} />
    );
    expect(getByTestId('ide-design-focus-banner-hint').textContent).toContain(
      'click its card in the palette'
    );
  });

  it('renders custom-component kind without an io summary or armed badge', () => {
    const { getByTestId, queryByTestId } = render(
      <DesignFocusBanner context={COMPONENT_CONTEXT} onClear={vi.fn()} />
    );
    expect(getByTestId('ide-design-focus-banner-kind').textContent).toBe(
      'Custom component'
    );
    expect(getByTestId('ide-design-focus-banner-name').textContent).toBe('ALU');
    expect(queryByTestId('ide-design-focus-banner-armed')).toBeNull();
    const banner = getByTestId('ide-design-focus-banner');
    expect(banner.textContent.toLowerCase()).toContain('drag from the palette onto the canvas');
  });

  it('invokes onClear when the Clear focus button is clicked', () => {
    const onClear = vi.fn();
    const { getByTestId } = render(
      <DesignFocusBanner context={MACRO_CONTEXT} onClear={onClear} />
    );
    fireEvent.click(getByTestId('ide-design-focus-banner-clear'));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('invokes onBackToProject when provided, hides it otherwise', () => {
    const onBackToProject = vi.fn();
    const { getByTestId, rerender, queryByTestId } = render(
      <DesignFocusBanner
        context={MACRO_CONTEXT}
        onClear={vi.fn()}
        onBackToProject={onBackToProject}
      />
    );
    fireEvent.click(getByTestId('ide-design-focus-banner-back-to-project'));
    expect(onBackToProject).toHaveBeenCalledTimes(1);

    rerender(
      <DesignFocusBanner context={MACRO_CONTEXT} onClear={vi.fn()} />
    );
    expect(queryByTestId('ide-design-focus-banner-back-to-project')).toBeNull();
  });

  it('omits the description block when none is provided', () => {
    const { queryByTestId } = render(
      <DesignFocusBanner
        context={{
          kind: 'macro',
          macroId: 'm1',
          name: 'Adder4',
          ioSummary: '2 in · 1 out',
        }}
        onClear={vi.fn()}
      />
    );
    expect(queryByTestId('ide-design-focus-banner-description')).toBeNull();
  });

  it('encodes focus kind and armed state in data attributes', () => {
    const { getByTestId, rerender } = render(
      <DesignFocusBanner
        context={MACRO_CONTEXT}
        onClear={vi.fn()}
        isPlacementArmed
      />
    );
    const armed = getByTestId('ide-design-focus-banner');
    expect(armed.getAttribute('data-focus-kind')).toBe('macro');
    expect(armed.getAttribute('data-placement-armed')).toBe('1');

    rerender(
      <DesignFocusBanner context={COMPONENT_CONTEXT} onClear={vi.fn()} />
    );
    const component = getByTestId('ide-design-focus-banner');
    expect(component.getAttribute('data-focus-kind')).toBe('custom-component');
    expect(component.getAttribute('data-placement-armed')).toBe('0');
  });
});
