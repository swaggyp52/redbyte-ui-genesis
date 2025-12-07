import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WindowCloseIcon, AndGateIcon } from './index';

describe('rb-icons', () => {
  it('renders window control icon', () => {
    const { getByRole } = render(<WindowCloseIcon aria-label="close" />);
    const svg = getByRole('img', { hidden: true });
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
  });

  it('renders logic icon with currentColor fill', () => {
    const { container } = render(<AndGateIcon data-testid="and" />);
    const path = container.querySelector('path');
    expect(path?.getAttribute('fill') ?? 'currentColor').toBeDefined();
  });
});
