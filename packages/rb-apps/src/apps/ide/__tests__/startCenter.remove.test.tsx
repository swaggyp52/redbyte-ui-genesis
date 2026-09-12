// @vitest-environment jsdom
//
// Deleting a saved project from Start is two deliberate presses on the item's own preview, the
// second of which names the project. Nothing is deleted on the first press, Keep backs out, and
// the offer exists only for saved items - a lab or a starter has no saved copy to delete.

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { StartCenter } from '../surfaces/project/StartCenter';

afterEach(() => {
  cleanup();
});

const RECENT = [
  { projectId: 'proj-a', projectName: 'Adder Work', savedAtIso: '2026-09-11T10:00:00.000Z', projectHash: 'aaaaaaaa1111' },
  { projectId: 'proj-b', projectName: 'Counter Work', savedAtIso: '2026-09-11T09:00:00.000Z', projectHash: 'bbbbbbbb2222' },
];

function renderStart(onRemove = vi.fn()) {
  const view = render(
    <StartCenter
      recentProjects={RECENT}
      onOpenExample={vi.fn()}
      onOpenRecentProject={vi.fn()}
      onRemoveRecentProject={onRemove}
      onOpenImport={vi.fn()}
      peekRecentProject={() => null}
    />
  );
  return { view, onRemove };
}

describe('StartCenter - deleting a saved project', () => {
  it('asks first, names the project, and only deletes on the second press', () => {
    const { view, onRemove } = renderStart();
    // With saved work, Start opens on Recent with the first project selected.
    fireEvent.click(view.getByTestId('ide-project-recent-proj-a'));
    fireEvent.click(view.getByTestId('ide-project-recent-delete-proj-a'));
    expect(onRemove).not.toHaveBeenCalled();
    const row = view.getByTestId('ide-project-recent-delete-confirm-row');
    expect(row.textContent).toContain('Adder Work');
    expect(row.textContent).toMatch(/from this browser/i);
    fireEvent.click(view.getByTestId('ide-project-recent-delete-confirm'));
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledWith('proj-a');
  });

  it('Keep backs out without deleting, and the offer returns', () => {
    const { view, onRemove } = renderStart();
    fireEvent.click(view.getByTestId('ide-project-recent-proj-b'));
    fireEvent.click(view.getByTestId('ide-project-recent-delete-proj-b'));
    fireEvent.click(view.getByTestId('ide-project-recent-delete-cancel'));
    expect(onRemove).not.toHaveBeenCalled();
    expect(view.queryByTestId('ide-project-recent-delete-confirm-row')).toBeNull();
    expect(view.getByTestId('ide-project-recent-delete-proj-b')).toBeTruthy();
  });

  it('a pending confirmation does not follow the reader to another item', () => {
    const { view } = renderStart();
    fireEvent.click(view.getByTestId('ide-project-recent-proj-a'));
    fireEvent.click(view.getByTestId('ide-project-recent-delete-proj-a'));
    fireEvent.click(view.getByTestId('ide-project-recent-proj-b'));
    expect(view.queryByTestId('ide-project-recent-delete-confirm-row')).toBeNull();
    expect(view.getByTestId('ide-project-recent-delete-proj-b')).toBeTruthy();
  });

  it('offers no deletion for a lab or a starter', () => {
    const { view } = renderStart();
    fireEvent.click(view.getByTestId('ide-project-start-a-lab-primary'));
    expect(view.container.querySelector('[data-testid^="ide-project-recent-delete-"]')).toBeNull();
  });
});
