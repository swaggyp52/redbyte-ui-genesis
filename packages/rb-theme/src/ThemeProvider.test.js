import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider, useTheme } from './ThemeProvider';
import React from 'react';
function TestConsumer() {
    const { variant } = useTheme();
    return (_jsx("div", { children: _jsx("span", { "data-testid": "theme-variant", children: variant }) }));
}
function ThemeToggle() {
    const { variant, setVariant } = useTheme();
    return (_jsxs("div", { children: [_jsx("span", { "data-testid": "current-variant", children: variant }), _jsx("button", { onClick: () => setVariant(variant === 'dark-neon' ? 'light-frost' : 'dark-neon'), children: "Toggle" })] }));
}
describe('ThemeProvider', () => {
    beforeEach(() => {
        window.localStorage.clear();
        document.documentElement.removeAttribute('data-rb-theme');
    });
    afterEach(() => {
        window.localStorage.clear();
        document.documentElement.removeAttribute('data-rb-theme');
    });
    it('provides default dark-neon theme when no saved theme exists', () => {
        render(_jsx(ThemeProvider, { children: _jsx(TestConsumer, {}) }));
        expect(screen.getByTestId('theme-variant').textContent).toBe('dark-neon');
    });
    it('applies theme CSS variables to document.documentElement', async () => {
        render(_jsx(ThemeProvider, { children: _jsx(TestConsumer, {}) }));
        await waitFor(() => {
            const root = document.documentElement;
            expect(root.style.getPropertyValue('--rb-color-accent-500')).toBe('#f43f5e');
            expect(root.getAttribute('data-rb-theme')).toBe('dark-neon');
        });
    });
    it('restores theme from localStorage on mount', () => {
        window.localStorage.setItem('rb-theme-variant', 'light-frost');
        render(_jsx(ThemeProvider, { children: _jsx(TestConsumer, {}) }));
        expect(screen.getByTestId('theme-variant').textContent).toBe('light-frost');
    });
    it('allows switching themes via setVariant', async () => {
        const { getByText } = render(_jsx(ThemeProvider, { children: _jsx(ThemeToggle, {}) }));
        // Initial theme should be dark-neon
        expect(screen.getByTestId('current-variant').textContent).toBe('dark-neon');
        // Click toggle button
        getByText('Toggle').click();
        // Theme should switch to light-frost
        await waitFor(() => {
            expect(screen.getByTestId('current-variant').textContent).toBe('light-frost');
            expect(document.documentElement.getAttribute('data-rb-theme')).toBe('light-frost');
        });
    });
    it('throws error when useTheme is used outside ThemeProvider', () => {
        const consoleError = console.error;
        console.error = () => { };
        expect(() => {
            render(_jsx(TestConsumer, {}));
        }).toThrow('useTheme must be used within ThemeProvider');
        console.error = consoleError;
    });
    it('persists theme changes to localStorage', async () => {
        const { getByText } = render(_jsx(ThemeProvider, { children: _jsx(ThemeToggle, {}) }));
        // Click toggle to switch theme
        getByText('Toggle').click();
        await waitFor(() => {
            expect(window.localStorage.getItem('rb-theme-variant')).toBe('light-frost');
        });
    });
});
