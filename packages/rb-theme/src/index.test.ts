import { describe, expect, it, vi } from 'vitest';
import { applyTheme, getActiveTheme } from './index';

const getStyleValue = (element: HTMLElement, variable: string): string =>
  element.style.getPropertyValue(variable);

describe('rb-theme', () => {
  it('applies CSS variables to the target root', () => {
    const root = document.createElement('div');
    applyTheme(root, 'dark-neon');

    expect(getStyleValue(root, '--rb-color-accent-500')).not.toBe('');
    expect(root.getAttribute('data-rb-theme')).toBe('dark-neon');
  });

  it('switches between themes and updates values', () => {
    const root = document.createElement('div');
    applyTheme(root, 'light-frost');
    const initialAccent = getStyleValue(root, '--rb-color-accent-500');

    applyTheme(root, 'dark-neon');
    const updatedAccent = getStyleValue(root, '--rb-color-accent-500');

    expect(initialAccent).not.toBe(updatedAccent);
    expect(getActiveTheme()).toBe('dark-neon');
  });

  it('is SSR safe when document is unavailable', () => {
    const originalDocument = globalThis.document;
    const originalWindow = globalThis.window;

    vi.stubGlobal('document', undefined);
    vi.stubGlobal('window', undefined);

    expect(() => applyTheme(null, 'dark-neon')).not.toThrow();
    expect(getActiveTheme()).toBe('dark-neon');

    vi.stubGlobal('document', originalDocument);
    vi.stubGlobal('window', originalWindow);
  });
});
