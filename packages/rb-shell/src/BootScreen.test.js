import { jsx as _jsx } from "react/jsx-runtime";
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BootScreen } from './BootScreen';
describe('BootScreen', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });
    it('renders boot screen with initial progress', () => {
        const onComplete = vi.fn();
        render(_jsx(BootScreen, { onComplete: onComplete }));
        expect(screen.getByText(/booting redbyte os/i)).toBeInTheDocument();
        expect(screen.getByText('0%')).toBeInTheDocument();
    });
    it('displays boot log messages', () => {
        const onComplete = vi.fn();
        render(_jsx(BootScreen, { onComplete: onComplete }));
        expect(screen.getByText('[  ok ] boot sequence started')).toBeInTheDocument();
        expect(screen.getByText('[  ok ] video: tailwind compositor online')).toBeInTheDocument();
    });
    it('shows boot tips cycling through messages', () => {
        const onComplete = vi.fn();
        render(_jsx(BootScreen, { onComplete: onComplete }));
        expect(screen.getByText('power-on self test')).toBeInTheDocument();
    });
    it('includes UniverseOrb component', () => {
        const onComplete = vi.fn();
        const { container } = render(_jsx(BootScreen, { onComplete: onComplete }));
        const orbContainer = container.querySelector('.animate-\\[spin_48s_linear_infinite\\]');
        expect(orbContainer).toBeInTheDocument();
    });
});
