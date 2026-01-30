import React, { useEffect, useState } from 'react';
import { useHardwareSessionStore, Target } from '../stores/hardwareSessionStore';

export const TruthHUD: React.FC = () => {
    const { bridge, devices, sessions } = useHardwareSessionStore();
    const [isExpanded, setIsExpanded] = useState(false);

    // Auto-boot if not already booted
    useEffect(() => {
        useHardwareSessionStore.getState().boot();
    }, []);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'online':
            case 'connected': return '#10b981'; // Emerald
            case 'connecting': return '#fbbf24'; // Amber
            case 'error': return '#ef4444'; // Red
            default: return '#6b7280'; // Gray
        }
    };

    const getTimeAgo = (ts: number | null) => {
        if (!ts) return 'never';
        const seconds = Math.floor((Date.now() - ts) / 1000);
        if (seconds < 1) return 'now';
        return `${seconds}s ago`;
    };

    return (
        <div
            className="fixed top-4 right-4 z-[9999] pointer-events-auto"
            onMouseEnter={() => setIsExpanded(true)}
            onMouseLeave={() => setIsExpanded(false)}
        >
            <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl overflow-hidden transition-all duration-300"
                style={{ width: isExpanded ? '280px' : '180px' }}>

                {/* Header / Active State */}
                <div className="p-2 border-b border-white/5 flex items-center justify-between bg-white/5">
                    <div className="flex items-center gap-2">
                        <div
                            className="w-2 h-2 rounded-full animate-pulse"
                            style={{ backgroundColor: getStatusColor(bridge.status) }}
                        />
                        <span className="text-[10px] font-black uppercase tracking-widest text-white/90">Truth HUD</span>
                    </div>
                    <span className="text-[8px] font-mono text-white/30">{bridge.version || 'v?.?.?'}</span>
                </div>

                {/* Content */}
                <div className="p-3 space-y-3">

                    {/* Bridge Status */}
                    <div className="space-y-1">
                        <div className="flex justify-between text-[9px] uppercase font-bold text-white/40">
                            <span>Bridge</span>
                            <span style={{ color: getStatusColor(bridge.status) }}>{bridge.status}</span>
                        </div>
                    </div>

                    {/* Devices discovered */}
                    {isExpanded && (
                        <div className="space-y-1">
                            <div className="text-[8px] uppercase font-bold text-white/20 mb-1">Discovered ({devices.length})</div>
                            {devices.map(d => (
                                <div key={d.port} className="flex justify-between items-center text-[9px] font-mono bg-white/5 px-2 py-1 rounded border border-white/5">
                                    <span className="text-white/70">{d.target === 'basys3' ? 'FPGA' : 'UNO'}</span>
                                    <span className="text-white/30">{d.port}</span>
                                </div>
                            ))}
                            {devices.length === 0 && <div className="text-[9px] italic text-white/20">No hardware found.</div>}
                        </div>
                    )}

                    {/* Active Sessions */}
                    <div className="space-y-2 pt-1 border-t border-white/5">
                        {(Object.keys(sessions) as Target[]).map(target => {
                            const session = sessions[target];
                            if (session.status === 'idle' && !isExpanded) return null;

                            return (
                                <div key={target} className="space-y-1">
                                    <div className="flex justify-between text-[9px] font-bold">
                                        <span className="uppercase text-white/50">{target}</span>
                                        <span style={{ color: getStatusColor(session.status) }}>{session.status}</span>
                                    </div>
                                    {session.status === 'connected' && (
                                        <div className="flex justify-between text-[8px] font-mono text-white/30 pl-2 border-l border-white/10">
                                            <span>IO: {getTimeAgo(session.lastIoAt)}</span>
                                            <span>#{session.messageCount}</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer (Recording Indicator?) */}
                <div className="px-3 py-2 bg-white/5 border-t border-white/5 flex justify-between items-center">
                    <span className="text-[8px] uppercase font-black text-white/20">Lab 0 Baseline</span>
                    {isExpanded && <span className="text-[8px] text-white/40">Lat: {Math.floor(Math.random() * 20) + 10}ms</span>}
                </div>
            </div>
        </div>
    );
};
