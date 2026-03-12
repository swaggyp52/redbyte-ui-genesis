// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { VerifyVectorListPanel } from '../surfaces/VerifyVectorListPanel';

const rows = [
  {
    key: '1:ld0:ld0:vec-01:0',
    tick: 1,
    signal: 'ld0',
    expected: '1',
    actual: '0',
  },
  {
    key: '5:ld1:ld1:vec-02:1',
    tick: 5,
    signal: 'ld1',
    expected: '0',
    actual: '1',
  },
];

describe('VerifyVectorListPanel', () => {
  it('renders failing rows and allows selecting by click', () => {
    const onSelectFailureKey = vi.fn();
    const { getByTestId } = render(
      <VerifyVectorListPanel rows={rows} selectedKey={rows[0].key} onSelectFailureKey={onSelectFailureKey} />
    );

    fireEvent.click(getByTestId('ide-verify-vector-row-5-ld1-ld1-vec-02-1'));
    expect(onSelectFailureKey).toHaveBeenCalledWith(rows[1].key);
  });

  it('supports Arrow and J/K keyboard navigation', () => {
    const onSelectFailureKey = vi.fn();
    const { getByTestId } = render(
      <VerifyVectorListPanel rows={rows} selectedKey={rows[0].key} onSelectFailureKey={onSelectFailureKey} />
    );

    const scrollRegion = getByTestId('ide-verify-vector-list-scroll');

    fireEvent.keyDown(scrollRegion, { key: 'ArrowDown' });
    expect(onSelectFailureKey).toHaveBeenCalledWith(rows[1].key);

    fireEvent.keyDown(scrollRegion, { key: 'k' });
    expect(onSelectFailureKey).toHaveBeenCalledWith(rows[1].key);
  });
});
