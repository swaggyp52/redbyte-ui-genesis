import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, resolveThemeVariant } from '../applyTheme';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('workbench theme authority', () => {
  it('resolves System through the active color-scheme preference', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) });
    expect(resolveThemeVariant('system')).toBe('light');

    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
    expect(resolveThemeVariant('system')).toBe('dark');
  });

  it('applies selected and resolved theme attributes together', () => {
    const attributes = new Map<string, string>();
    const root = {
      style: {} as CSSStyleDeclaration,
      setAttribute(name: string, value: string) {
        attributes.set(name, value);
      },
    } as unknown as HTMLElement;
    const setItem = vi.fn();
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
    vi.stubGlobal('document', {});
    vi.stubGlobal('localStorage', { setItem });

    applyTheme(root, 'system');

    expect(attributes.get('data-theme')).toBe('dark');
    expect(attributes.get('data-rb-theme')).toBe('dark');
    expect(attributes.get('data-rb-theme-setting')).toBe('system');
    expect(root.style.colorScheme).toBe('dark');
    expect(setItem).toHaveBeenCalledWith('rb-theme-variant', 'system');
  });
});
