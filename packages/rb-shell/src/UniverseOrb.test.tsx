import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { UniverseOrb } from './UniverseOrb';
import React from 'react';

describe('UniverseOrb', () => {
  it('renders without progress prop', () => {
    const { container } = render(<UniverseOrb />);
    const orb = container.querySelector('.relative.w-56');
    expect(orb).toBeInTheDocument();
  });

  it('displays progress percentage', () => {
    const { container } = render(<UniverseOrb progress={0.5} />);
    expect(container.textContent).toContain('sync 50%');
  });

  it('clamps progress to 0-100 range', () => {
    const { container: over } = render(<UniverseOrb progress={1.5} />);
    expect(over.textContent).toContain('sync 100%');

    const { container: under } = render(<UniverseOrb progress={-0.5} />);
    expect(under.textContent).toContain('sync 0%');
  });

  it('shows redbyte core label', () => {
    const { container } = render(<UniverseOrb />);
    expect(container.textContent).toContain('redbyte core');
  });
});
