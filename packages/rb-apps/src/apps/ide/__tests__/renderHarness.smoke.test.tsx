import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

afterEach(() => cleanup());

describe('React component render harness', () => {
  it('renders and cleans up a basic component under the workspace testing-library version', () => {
    render(
      <section aria-label="render harness smoke">
        <button type="button">Harness ready</button>
      </section>,
    );

    expect(screen.getByRole('button', { name: 'Harness ready' })).toBeTruthy();
  });
});
