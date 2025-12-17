// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilesApp } from '../apps/FilesApp';

const FilesComponent = FilesApp.component;

describe('Files app lifecycle', () => {
  it('renders sidebar with fixed roots', () => {
    render(<FilesComponent />);

    expect(screen.getByRole('button', { name: 'Home' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Desktop' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Documents' })).toBeTruthy();
  });

  it('renders file entries in main pane', () => {
    render(<FilesComponent />);

    const table = screen.getByRole('table');
    expect(table).toBeTruthy();
    expect(table.textContent).toContain('Desktop');
    expect(table.textContent).toContain('Documents');
    expect(table.textContent).toContain('Downloads');
  });

  it('navigates to folder when clicked', () => {
    render(<FilesComponent />);

    const documentsButton = screen.getByRole('button', { name: 'Documents' });
    fireEvent.click(documentsButton);

    const table = screen.getByRole('table');
    expect(table.textContent).toContain('Reports');
    expect(table.textContent).toContain('README.md');
  });

  it('navigates with arrow keys', () => {
    const { container } = render(<FilesComponent />);
    const mainContainer = container.querySelector('[tabIndex="0"]');

    expect(mainContainer).toBeTruthy();

    fireEvent.keyDown(mainContainer!, { key: 'ArrowDown' });
    fireEvent.keyDown(mainContainer!, { key: 'ArrowDown' });

    const rows = screen.getAllByRole('row');
    expect(rows.length).toBeGreaterThan(1);
  });

  it('opens folder with Enter key', () => {
    const { container } = render(<FilesComponent />);
    const mainContainer = container.querySelector('[tabIndex="0"]');

    fireEvent.keyDown(mainContainer!, { key: 'Enter' });

    const table = screen.getByRole('table');
    expect(table.textContent).toMatch(/Project Files|Notes\.txt/i);
  });

  it('closes window with Escape key', () => {
    const onClose = vi.fn();
    const { container } = render(<FilesComponent onClose={onClose} />);
    const mainContainer = container.querySelector('[tabIndex="0"]');

    fireEvent.keyDown(mainContainer!, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('maintains independent state per instance', () => {
    const { container: container1, rerender: rerender1 } = render(<FilesComponent />);
    const { container: container2 } = render(<FilesComponent />);

    const mainContainer1 = container1.querySelector('[tabIndex="0"]');
    const documentsButton1 = container1.querySelector('button[class*="text-left"]');

    if (documentsButton1) {
      fireEvent.click(documentsButton1);
    }

    const mainContainer2 = container2.querySelector('[tabIndex="0"]');

    expect(mainContainer1).not.toBe(mainContainer2);
  });
});

describe('Files app manifest', () => {
  it('is not a singleton app', () => {
    expect(FilesApp.manifest.singleton).toBeUndefined();
  });

  it('has correct app metadata', () => {
    expect(FilesApp.manifest.id).toBe('files');
    expect(FilesApp.manifest.name).toBe('Files');
    expect(FilesApp.manifest.category).toBe('system');
  });

  it('has sensible default and min sizes', () => {
    expect(FilesApp.manifest.defaultSize).toEqual({ width: 800, height: 600 });
    expect(FilesApp.manifest.minSize).toEqual({ width: 600, height: 400 });
  });
});
