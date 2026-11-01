// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { LabPanelLayout } from '../LabPanelLayout';

describe('retained guided-lab presentation contract', () => {
  it('keeps the header outside the single scrolling body and preserves consumer overrides', () => {
    const view = render(<LabPanelLayout className="w-80" headerClassName="custom-header" bodyClassName="custom-body" header={<h2>Instructions</h2>}><p>Checkpoint content</p></LabPanelLayout>);
    const root = view.container.firstElementChild;
    const header = view.getByText('Instructions').parentElement;
    const body = view.getByText('Checkpoint content').parentElement;
    expect(root?.classList.contains('w-80')).toBe(true);
    expect(header?.parentElement).toBe(root);
    expect(body?.parentElement).toBe(root);
    expect(header?.classList.contains('shrink-0')).toBe(true);
    expect(header?.classList.contains('custom-header')).toBe(true);
    expect(header?.classList.contains('overflow-auto')).toBe(false);
    expect(body?.classList.contains('custom-body')).toBe(true);
    expect(body?.classList.contains('overflow-auto')).toBe(true);
    expect(root?.querySelectorAll('.overflow-auto').length).toBe(1);
    view.rerender(<LabPanelLayout><p>Checkpoint content</p></LabPanelLayout>);
    expect(view.queryByText('Instructions')).toBeNull();
    expect(view.container.firstElementChild?.children.length).toBe(1);
  });
});
