import React, { useEffect, useState } from 'react';
import { useLabStore } from '@redbyte/rb-logic-3d';

export const HardwareStatusOverlay: React.FC = () => {
    const activeTransport = useLabStore(state => state.activeTransport);
    const [status, setStatus] = useState(useLabStore.getState().getTransportStatus());

    useEffect(() => {
        const interval = setInterval(() => {
            const current = useLabStore.getState().getTransportStatus();
            setStatus(current);
        }, 500);
        return () => clearInterval(interval);
    }, []);

    const isBridge = status.type === 'bridge';
    const detailedStatuses: Record<string, any> = activeTransport.getDetailedStatuses ? activeTransport.getDetailedStatuses() : { 'default': status };

    return (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-40 scale-90 origin-top">
            <div className="flex items-center gap-3 bg-black/90 backdrop-blur-2xl border border-white/10 rounded-full px-4 py-1.5 shadow-2xl">
                <div className="flex bg-black/40 rounded-full p-0.5 border border-white/5 mr-1">
                    <button
                        onClick={() => useLabStore.getState().setTransport('sim')}
                        className={`px-3 py-1 rounded-full text-[8px] font-black transition-all ${!isBridge ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        SIM
                    </button>
                    <button
                        onClick={() => useLabStore.getState().setTransport('bridge')}
                        className={`px-3 py-1 rounded-full text-[8px] font-black transition-all ${isBridge ? (status.deviceVerified ? 'bg-green-600' : 'bg-red-600') + ' text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
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
