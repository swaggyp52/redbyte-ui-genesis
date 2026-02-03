// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Shared Interaction State Machine — Prevents divergence across canvas views
import { useCallback, useState } from 'react';
export function useCanvasInteraction() {
    const [state, setState] = useState('idle');
    const enterState = useCallback((newState) => {
        setState(newState);
    }, []);
    const cancelGesture = useCallback(() => {
        // ESC always cancels current gesture first (cancel-first, then deselect)
        setState('idle');
    }, []);
    // Capability checks based on current state
    const canPan = state !== 'wiring' && state !== 'blocked';
    const canWire = state === 'idle';
    const canSelect = state === 'idle' || state === 'boxSelect';
    const canDrag = state === 'idle';
    return {
        state,
        canPan,
        canWire,
        canSelect,
        canDrag,
        enterState,
        cancelGesture,
    };
}
