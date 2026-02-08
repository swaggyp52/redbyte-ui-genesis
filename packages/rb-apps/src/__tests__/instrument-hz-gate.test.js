// Copyright Â© 2025 Connor Angiel â€” RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { computeInstrumentHz } from '../instruments/computeInstrumentHz';
import { useInstrumentScheduler } from '../hooks/useInstrumentScheduler';
vi.mock('@redbyte/rb-utils', () => ({
    useSettingsStore: (selector) => selector({ performanceMode: false }),
}));
vi.mock('@redbyte/rb-windowing', () => ({
    useWindowStore: (selector) => selector({ windows: [] }),
}));
describe('instrument update Hz gate', () => {
    it('returns 0 when minimized regardless of focus/perf', () => {
        expect(computeInstrumentHz({ performanceMode: false, focused: true, minimized: true })).toBe(0);
        expect(computeInstrumentHz({ performanceMode: true, focused: false, minimized: true })).toBe(0);
    });
    it('returns 10Hz in performance mode when visible', () => {
        expect(computeInstrumentHz({ performanceMode: true, focused: true, minimized: false })).toBe(10);
        expect(computeInstrumentHz({ performanceMode: true, focused: false, minimized: false })).toBe(10);
    });
    it('returns 15Hz when visible but not focused (perf off)', () => {
        expect(computeInstrumentHz({ performanceMode: false, focused: false, minimized: false })).toBe(15);
    });
    it('returns 60Hz when visible and focused (perf off)', () => {
        expect(computeInstrumentHz({ performanceMode: false, focused: true, minimized: false })).toBe(60);
    });
});
afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    try {
        // Remove any instance override so the prototype getter is used again.
        delete document.visibilityState;
    }
    catch {
        // ignore
    }
});
describe('instrument scheduler gate', () => {
    it('does not schedule timers when minimized', () => {
        Object.defineProperty(document, 'visibilityState', {
            configurable: true,
            get: () => 'hidden',
        });
        const setIntervalSpy = vi.spyOn(window, 'setInterval');
        setIntervalSpy.mockClear();
        function Test() {
            useInstrumentScheduler({ enabled: true, onTick: () => { }, maxHz: 60 });
            return null;
        }
        render(React.createElement(Test));
        expect(setIntervalSpy).not.toHaveBeenCalled();
    });
});
