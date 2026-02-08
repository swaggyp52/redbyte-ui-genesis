// Copyright Ac 2025 Connor Angiel - RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { create } from 'zustand';
const STORAGE_KEY = 'rb.playground.layout';
const DEFAULT_SPLIT_RATIO = 0.5;
const PERSPECTIVE_PRESETS = {
    // NEW PRESETS - Primary workflow layouts
    build: {
        splitScreenMode: 'single',
        activeViews: ['circuit'],
        rightDockState: 'expanded',
        rightDockTab: 'inspector',
        showHelpDock: false,
    },
    analyze: {
        splitScreenMode: 'horizontal',
        activeViews: ['circuit', 'oscilloscope'],
        rightDockState: 'peek',
        rightDockTab: 'probes',
        showHelpDock: false,
    },
    explain: {
        splitScreenMode: 'horizontal',
        activeViews: ['circuit', 'schematic'],
        rightDockState: 'peek',
        rightDockTab: 'inspector',
        showHelpDock: false,
    },
    explore: {
        splitScreenMode: 'horizontal',
        activeViews: ['circuit', '3d'],
        rightDockState: 'collapsed',
        rightDockTab: 'inspector',
        showHelpDock: false,
    },
    quad: {
        splitScreenMode: 'quad',
        activeViews: ['circuit', 'schematic', '3d', 'oscilloscope'],
        rightDockState: 'collapsed',
        rightDockTab: 'probes',
        showHelpDock: false,
    },
    // SINGLE-VIEW FOCUS - Fullscreen individual tools
    'circuit-only': {
        splitScreenMode: 'single',
        activeViews: ['circuit'],
        rightDockState: 'collapsed',
        rightDockTab: 'inspector',
        showHelpDock: false,
    },
    'schematic-only': {
        splitScreenMode: 'single',
        activeViews: ['schematic'],
        rightDockState: 'collapsed',
        rightDockTab: 'inspector',
        showHelpDock: false,
    },
    'scope-only': {
        splitScreenMode: 'single',
        activeViews: ['oscilloscope'],
        rightDockState: 'collapsed',
        rightDockTab: 'probes',
        showHelpDock: false,
    },
    '3d-only': {
        splitScreenMode: 'single',
        activeViews: ['3d'],
        rightDockState: 'collapsed',
        rightDockTab: 'inspector',
        showHelpDock: false,
    },
    'code-only': {
        splitScreenMode: 'single',
        activeViews: ['code'],
        rightDockState: 'collapsed',
        rightDockTab: 'inspector',
        showHelpDock: false,
    },
    // LEGACY PRESETS - Kept for backward compatibility
    inspect: {
        splitScreenMode: 'single',
        activeViews: ['circuit'],
        rightDockState: 'expanded',
        rightDockTab: 'inspector',
        showHelpDock: false,
    },
    debug: {
        splitScreenMode: 'horizontal',
        activeViews: ['circuit', 'oscilloscope'],
        rightDockState: 'collapsed',
        rightDockTab: 'probes',
        showHelpDock: false,
    },
    schematic: {
        splitScreenMode: 'vertical',
        activeViews: ['schematic', 'circuit'],
        rightDockState: 'peek',
        rightDockTab: 'inspector',
        showHelpDock: false,
    },
    learn: {
        splitScreenMode: 'single',
        activeViews: ['circuit'],
        rightDockState: 'collapsed',
        rightDockTab: 'learn',
        showHelpDock: true,
    },
};
function saveLayoutState(state) {
    if (typeof localStorage === 'undefined')
        return;
    try {
        const data = {
            perspective: state.perspective,
            splitRatio: state.splitRatio,
            schematicMiniEnabled: state.schematicMiniEnabled,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
    catch (error) {
        // Ignore persistence errors.
    }
}
export function loadLayoutState() {
    if (typeof localStorage === 'undefined')
        return null;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw)
            return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object')
            return null;
        if (!parsed.perspective || typeof parsed.perspective !== 'string')
            return null;
        if (!(parsed.perspective in PERSPECTIVE_PRESETS))
            return null;
        return parsed;
    }
    catch (error) {
        return null;
    }
}
function resolveSchematicLayout(schematicMiniEnabled) {
    if (!schematicMiniEnabled) {
        return {
            splitScreenMode: 'single',
            activeViews: ['schematic'],
        };
    }
    return {
        splitScreenMode: 'vertical',
        activeViews: ['schematic', 'circuit'],
    };
}
function applyPreset(perspective, splitRatio, schematicMiniEnabled) {
    const preset = PERSPECTIVE_PRESETS[perspective];
    const schematicLayout = perspective === 'schematic' ? resolveSchematicLayout(schematicMiniEnabled) : null;
    return {
        perspective,
        splitRatio,
        schematicMiniEnabled,
        splitScreenMode: schematicLayout?.splitScreenMode ?? preset.splitScreenMode,
        activeViews: schematicLayout?.activeViews ?? preset.activeViews,
        rightDockState: preset.rightDockState,
        rightDockTab: preset.rightDockTab,
        learnSubview: 'lessons',
        learnHelpErrorCode: null,
        showHelpDock: preset.showHelpDock,
        helpDockSection: null,
    };
}
function loadInitialState() {
    const persisted = loadLayoutState();
    const perspective = persisted?.perspective ?? 'build';
    const rawRatio = typeof persisted?.splitRatio === 'number' ? persisted.splitRatio : DEFAULT_SPLIT_RATIO;
    const splitRatio = Math.min(Math.max(rawRatio, 0.2), 0.8);
    const schematicMiniEnabled = persisted?.schematicMiniEnabled ?? true;
    return applyPreset(perspective, splitRatio, schematicMiniEnabled);
}
// Lazy-init singleton to prevent TDZ crash from circular imports
let _store = null;
function createLayoutStore() {
    return create((set, get) => ({
        ...loadInitialState(),
        setPerspective: (perspective) => {
            set((state) => {
                const next = applyPreset(perspective, state.splitRatio, state.schematicMiniEnabled);
                saveLayoutState(next);
                return next;
            });
        },
        setRightDockState: (state) => {
            set((current) => {
                const next = { ...current, rightDockState: state };
                saveLayoutState(next);
                return next;
            });
        },
        setRightDockTab: (tab) => {
            set((current) => ({ ...current, rightDockTab: tab }));
        },
        setLearnSubview: (subview) => {
            set((current) => ({ ...current, learnSubview: subview }));
        },
        openDock: (tab, subview, errorCode) => {
            set((current) => {
                const next = { ...current, rightDockTab: tab };
                if (next.rightDockState === 'collapsed') {
                    next.rightDockState = 'expanded';
                }
                if (tab === 'learn' && subview) {
                    next.learnSubview = subview;
                }
                next.learnHelpErrorCode = (tab === 'learn' && subview === 'help' && errorCode) ? errorCode : null;
                return next;
            });
        },
        setShowHelpDock: (visible) => {
            set((current) => ({ ...current, showHelpDock: visible }));
        },
        setHelpDockSection: (section) => {
            set((current) => ({ ...current, helpDockSection: section }));
        },
        setSplitRatio: (ratio) => {
            const clamped = Math.min(Math.max(ratio, 0.2), 0.8);
            set((current) => {
                const next = { ...current, splitRatio: clamped };
                saveLayoutState(next);
                return next;
            });
        },
        toggleSchematicMini: () => {
            set((current) => {
                const nextMini = !current.schematicMiniEnabled;
                const next = applyPreset('schematic', current.splitRatio, nextMini);
                saveLayoutState(next);
                return next;
            });
        },
        resetLayout: () => {
            const next = applyPreset('build', DEFAULT_SPLIT_RATIO, true);
            saveLayoutState(next);
            set(next);
        },
    }));
}
export const useLayoutStore = ((...args) => {
    if (!_store)
        _store = createLayoutStore();
    return _store(...args);
});
useLayoutStore.getState = () => {
    if (!_store)
        _store = createLayoutStore();
    return _store.getState();
};
useLayoutStore.setState = (...a) => {
    if (!_store)
        _store = createLayoutStore();
    return _store.setState(...a);
};
useLayoutStore.subscribe = (...a) => {
    if (!_store)
        _store = createLayoutStore();
    return _store.subscribe(...a);
};
