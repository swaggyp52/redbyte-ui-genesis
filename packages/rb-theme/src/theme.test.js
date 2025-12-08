import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { applyTheme, getActiveTheme } from './applyTheme';
describe('@rb/rb-theme', () => {
    beforeEach(() => {
        // Clear localStorage and DOM state before each test
        window.localStorage.clear();
        document.documentElement.removeAttribute('data-rb-theme');
        // Clear all CSS custom properties
        const styles = document.documentElement.style;
        for (let i = styles.length - 1; i >= 0; i--) {
            const property = styles[i];
            if (property.startsWith('--rb-')) {
                document.documentElement.style.removeProperty(property);
            }
        }
    });
    afterEach(() => {
        window.localStorage.clear();
        document.documentElement.removeAttribute('data-rb-theme');
    });
    describe('applyTheme', () => {
        it('sets CSS variables on the root element', () => {
            const root = document.documentElement;
            applyTheme(root, 'dark-neon');
            // Check that CSS variables were set
            expect(root.style.getPropertyValue('--rb-color-accent-500')).toBe('#f43f5e');
            expect(root.style.getPropertyValue('--rb-color-neutral-900')).toBe('#0f172a');
            expect(root.style.getPropertyValue('--rb-radius-md')).toBe('0.375rem');
            expect(root.style.getPropertyValue('--rb-spacing-4')).toBe('1rem');
            expect(root.style.getPropertyValue('--rb-font-size-base')).toBe('1rem');
            expect(root.style.getPropertyValue('--rb-duration-fast')).toBe('150ms');
        });
        it('sets data-rb-theme attribute', () => {
            const root = document.documentElement;
            applyTheme(root, 'dark-neon');
            expect(root.getAttribute('data-rb-theme')).toBe('dark-neon');
        });
        it('persists theme to localStorage by default', () => {
            const root = document.documentElement;
            applyTheme(root, 'light-frost');
            expect(window.localStorage.getItem('rb-theme-variant')).toBe('light-frost');
        });
        it('does not persist when persist option is false', () => {
            const root = document.documentElement;
            applyTheme(root, 'dark-neon', { persist: false });
            expect(window.localStorage.getItem('rb-theme-variant')).toBeNull();
        });
        it('switches themes correctly', () => {
            const root = document.documentElement;
            // Apply dark theme
            applyTheme(root, 'dark-neon');
            expect(root.style.getPropertyValue('--rb-color-accent-500')).toBe('#f43f5e');
            expect(root.style.getPropertyValue('--rb-color-neutral-900')).toBe('#0f172a');
            // Switch to light theme
            applyTheme(root, 'light-frost');
            expect(root.style.getPropertyValue('--rb-color-accent-500')).toBe('#3b82f6');
            expect(root.style.getPropertyValue('--rb-color-neutral-900')).toBe('#f8fafc');
        });
        it('handles localStorage errors gracefully', () => {
            const root = document.documentElement;
            // Mock localStorage to throw
            const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
            setItemSpy.mockImplementation(() => {
                throw new Error('QuotaExceededError');
            });
            // Should not throw
            expect(() => {
                applyTheme(root, 'dark-neon');
            }).not.toThrow();
            // Theme should still be applied via data attribute
            expect(root.getAttribute('data-rb-theme')).toBe('dark-neon');
            setItemSpy.mockRestore();
        });
    });
    describe('getActiveTheme', () => {
        it('returns null when no theme is active', () => {
            expect(getActiveTheme()).toBeNull();
        });
        it('returns theme from data attribute', () => {
            document.documentElement.setAttribute('data-rb-theme', 'dark-neon');
            expect(getActiveTheme()).toBe('dark-neon');
        });
        it('returns theme from localStorage when data attribute is missing', () => {
            window.localStorage.setItem('rb-theme-variant', 'light-frost');
            expect(getActiveTheme()).toBe('light-frost');
        });
        it('prefers data attribute over localStorage', () => {
            document.documentElement.setAttribute('data-rb-theme', 'dark-neon');
            window.localStorage.setItem('rb-theme-variant', 'light-frost');
            expect(getActiveTheme()).toBe('dark-neon');
        });
        it('returns null for invalid data attribute values', () => {
            document.documentElement.setAttribute('data-rb-theme', 'invalid-theme');
            expect(getActiveTheme()).toBeNull();
        });
        it('returns null for invalid localStorage values', () => {
            window.localStorage.setItem('rb-theme-variant', 'invalid-theme');
            expect(getActiveTheme()).toBeNull();
        });
        it('handles localStorage errors gracefully', () => {
            const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
            getItemSpy.mockImplementation(() => {
                throw new Error('SecurityError');
            });
            // Should return null without throwing
            expect(getActiveTheme()).toBeNull();
            getItemSpy.mockRestore();
        });
    });
    describe('theme integration', () => {
        it('applies and retrieves theme correctly', () => {
            const root = document.documentElement;
            // Apply theme
            applyTheme(root, 'dark-neon');
            // Retrieve theme
            const activeTheme = getActiveTheme();
            expect(activeTheme).toBe('dark-neon');
        });
        it('maintains theme across multiple calls', () => {
            const root = document.documentElement;
            // Apply theme multiple times
            applyTheme(root, 'dark-neon');
            applyTheme(root, 'light-frost');
            applyTheme(root, 'dark-neon');
            // Should have the last applied theme
            expect(getActiveTheme()).toBe('dark-neon');
            expect(root.getAttribute('data-rb-theme')).toBe('dark-neon');
        });
    });
});
