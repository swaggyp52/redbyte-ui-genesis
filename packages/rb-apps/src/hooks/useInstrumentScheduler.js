import React from 'react';
import { useSettingsStore } from '@redbyte/rb-utils';
import { usePageVisibility } from './usePageVisibility';
import { useWindowActivity } from './useWindowActivity';
import { computeInstrumentHz } from '../instruments/computeInstrumentHz';
const selectPerformanceMode = (s) => s.performanceMode;
export function useInstrumentScheduler(opts) {
    const performanceMode = useSettingsStore(selectPerformanceMode);
    const pageVisible = usePageVisibility();
    const { isVisible: windowVisible, isFocused: windowFocused } = useWindowActivity(opts.windowId);
    const baseHz = computeInstrumentHz({
        performanceMode,
        focused: windowFocused,
        minimized: !pageVisible || !windowVisible,
    });
    const hz = React.useMemo(() => {
        if (opts.maxHz && Number.isFinite(opts.maxHz)) {
            return Math.max(0, Math.min(baseHz, Math.floor(opts.maxHz)));
        }
        return baseHz;
    }, [baseHz, opts.maxHz]);
    const isActive = opts.enabled && hz > 0;
    const tickMs = isActive ? Math.max(1, Math.round(1000 / hz)) : null;
    const tickRef = React.useRef(opts.onTick);
    React.useEffect(() => {
        tickRef.current = opts.onTick;
    }, [opts.onTick]);
    React.useEffect(() => {
        if (!isActive || !tickMs)
            return;
        const id = window.setInterval(() => tickRef.current(), tickMs);
        return () => window.clearInterval(id);
    }, [isActive, tickMs]);
    return { hz, tickMs, isActive };
}

