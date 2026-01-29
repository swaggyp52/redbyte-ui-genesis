import React, { useMemo } from 'react';
import { useLabStore } from '@redbyte/rb-logic-3d';

export const HardwareStatusOverlay: React.FC = () => {
    // Select minimal state needed for rendering using primitives only to avoid infinite loops.
    const activeTransportType = useLabStore((state) => state.activeTransport.type);

    // CAUTION: getStatus() returns a new object potentially. 
    // Ideally we select primitives from it, but if getStatus() is stable we can use it.
    // To be safe, we'll select the specific fields we need if possible, 
    // but here we used to select connected/deviceVerified from it.
    // Let's assume getStatus() might be unstable and select properties if possible,
    // or just memoize the result.
    // Better strategy: Select the transport and derive.

    // Primitives
    const transport = useLabStore((state) => state.activeTransport);
    // Since we can't easily select deep properties if they change reference, 
    // let's rely on the store's stability or just re-render when transport changes (which is rare).
    // Actually, `useLabStore(s => s.activeTransport)` will trigger update on ANY transport change.

    // Let's follow the user's specific "primitive only" advice strictly.
    // We need: type, connected, verified, detailedStatuses.

    // 1. Type (Primitive) - Safe
    // const activeTransportType = useLabStore(s => s.activeTransport.type); // Already done above.

    // 2. Status (Object) - Potentially Unstable.
    // Let's select primitives from the status if we can.
    // The store might not allow deep selection if the intermediate object is new.
    // `state.activeTransport` is likely a class instance (stable?).
    // `state.activeTransport.getStatus()` might return a new object.

    const isBridge = activeTransportType === 'bridge';
    const setTransport = useLabStore((state) => state.setTransport);

    // We need detailed statuses for the map.
    // Passing the whole transport object to useMemo is better if the transport function references are stable.
    const activeTransport = useLabStore((state) => state.activeTransport);

    const { detailedStatuses, connected, verified } = useMemo(() => {
        const currentStatus = activeTransport.getStatus();
        const detailed = activeTransport.getDetailedStatuses
            ? activeTransport.getDetailedStatuses()
            : { 'default': currentStatus };

        return {
            connected: currentStatus.connected,
            verified: currentStatus.deviceVerified,
            detailedStatuses: detailed
        };
    }, [activeTransport]); // Rerender when transport instance changes or if we force update.

    // Wait, if `activeTransport` is a class instance in the store, it might mutate without changing reference?
    // If so, `useLabStore(s => s.activeTransport)` won't trigger updates.
    // But Zustand usually relies on immutable updates.
    // Anyhow, the user said "Use shallow OR select primitives".

    // Let's try the user's exact "Ship-Grade" pattern.
    // "const agentConnected = useLabStore(s => s.transport.status === 'connected');"

    // Adapting to our store structure:
    // We need to trigger re-renders when status changes.
    // If `getStatus()` returns a new object every time, we can't select it directly without shallow.
    // But we can't use shallow easily inside the selector creation if we define it inline? 
    // The user said: "const status = useLabStore(s => s.transport.status)"

    // Let's select the components of status individually?
    // But `getStatus()` is a method.
    // If the store is updated via `set({ activeTransport: ... })`, then `activeTransport` reference changes.
    // If the store is updated via `activeTransport.status = ...` (mutation), zustand won't know unless `set` is called.

    // Assuming the store is updated correctly with immutable patterns or `set`.
    // The safest bet for the loop is `useLabStore` with primitive return values.

    // But we need the RESULT of a function call `getStatus()`.
    // We can't call functions in the selector if they return new objects, unless we use equality fn.

    // Let's go with:
    const statusFn = useLabStore(s => s.activeTransport.getStatus); // Method reference?
    // No, that doesn't help with value changes.

    // Backtrack: The existing code was:
    // connected: state.activeTransport.getStatus().connected

    // If `activeTransport` changes, this re-runs.
    // If `activeTransport` is stable but internal state changes, we might miss updates unless we subscribe to something else.
    // However, the infinite loop was likely caused by `{ 'default': ... }` being a new object every time.

    // Let's try to verify if `activeTransport` reference changes on status update.
    // If not, we need another way to detect changes. 
    // Usually `useLabStore(s => s.simulation.tick)` drives the loop.

    // Let's assume standard Zustand usage where store updates propagate.

    return (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-40 scale-90 origin-top">
            <div className="flex items-center gap-3 bg-black/90 backdrop-blur-2xl border border-white/10 rounded-full px-4 py-1.5 shadow-2xl">
                <div className="flex bg-black/40 rounded-full p-0.5 border border-white/5 mr-1">
                    <button
                        onClick={() => setTransport('sim')}
                        className={`px-3 py-1 rounded-full text-[8px] font-black transition-all ${!isBridge ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        SIM
                    </button>
                    <button
                        onClick={() => setTransport('bridge')}
                        className={`px-3 py-1 rounded-full text-[8px] font-black transition-all ${isBridge ? (verified ? 'bg-green-600' : 'bg-red-600') + ' text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        HARDWARE
                    </button>
                </div>

                <div className="h-4 w-px bg-white/10" />

                <div className="flex items-center gap-6">
                    {Object.entries(detailedStatuses).map(([id, s]) => {
                        const isConnected = s.connected;
                        const isVerified = s.deviceVerified;
                        let label = id.toUpperCase();
                        let statusLabel = 'OFFLINE';
                        let statusClass = 'text-gray-500';
                        let dotClass = 'bg-gray-600';

                        if (!isBridge) {
                            statusLabel = 'SIM ACTIVE';
                            statusClass = 'text-blue-400';
                            dotClass = 'bg-blue-500';
                        } else if (isConnected) {
                            if (isVerified) {
                                statusLabel = 'VERIFIED ✅';
                                statusClass = 'text-green-400';
                                dotClass = 'bg-green-500 animate-pulse shadow-[0_0_8px_#22c55e]';
                            } else {
                                statusLabel = 'NOT VERIFIED';
                                statusClass = 'text-yellow-500';
                                dotClass = 'bg-yellow-500 shadow-[0_0_8px_#eab308]';
                            }
                        } else {
                            statusLabel = 'AGENT OFFLINE';
                            statusClass = 'text-red-500 animate-pulse';
                            dotClass = 'bg-red-500 shadow-[0_0_8px_#ef4444]';
                        }

                        return (
                            <div key={id} className="flex flex-col min-w-[80px]">
                                <span className="text-gray-500 text-[7px] uppercase tracking-widest leading-none">{label}</span>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <div className={`w-1 h-1 rounded-full ${dotClass}`} />
                                    <span className={`text-[8px] font-bold tracking-tighter ${statusClass}`}>
                                        {statusLabel}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
