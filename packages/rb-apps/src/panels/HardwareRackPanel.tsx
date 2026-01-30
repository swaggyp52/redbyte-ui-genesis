import React, { useEffect } from 'react';
import { useHardwareSessionStore, Target } from '../stores/hardwareSessionStore';
import { toast } from '@redbyte/rb-primitives';
import { getFriendlyErrorMessage } from '../utils/studentErrors';

export const HardwareRackPanel: React.FC = () => {
    const { devices, sessions, bridge, ensureSession, disconnect, refreshDevices } = useHardwareSessionStore();

    // Auto-refresh when panel is open
    useEffect(() => {
        refreshDevices();
        const interval = setInterval(refreshDevices, 5000);
        return () => clearInterval(interval);
    }, [refreshDevices]);

    const handleConnect = async (target: Target) => {
        try {
            await ensureSession(target);
            toast.success({ message: `Connecting to ${target.toUpperCase()}...` });
        } catch (err: any) {
            toast.error({ message: getFriendlyErrorMessage(err, 'Connection Failed') });
        }
    };

    const handleDisconnect = async (target: Target) => {
        await disconnect(target);
        toast.info({ message: `Disconnected ${target.toUpperCase()}` });
    };

    return (
        <div className="flex flex-col h-full bg-[#0a0a0a] text-[11px] text-gray-400 select-none font-mono">
            {/* Header */}
            <div className="p-3 border-b border-white/5 bg-[#111] flex justify-between items-center">
                <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-black text-gray-400 tracking-widest">Hardware Reality</span>
                    <span className={`text-[8px] tracking-tight ${bridge.status === 'online' ? 'text-green-500' : 'text-red-500'}`}>
                        {bridge.status.toUpperCase()} // v{bridge.version || '???'}
                    </span>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => refreshDevices()} className="hover:text-white transition-colors">
                        ↻
                    </button>
                    <div className={`w-1.5 h-1.5 rounded-full ${bridge.status === 'online' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin p-3 space-y-6">

                {/* Active Sessions */}
                <div className="space-y-2">
                    <div className="text-[9px] uppercase font-bold text-gray-600 tracking-wider mb-2">Active Sessions</div>
                    {Object.entries(sessions).map(([target, session]) => (
                        <div key={target} className={`group border rounded-md p-3 transition-all ${session.status === 'connected' ? 'border-green-500/20 bg-green-500/5' : 'border-white/5 bg-white/5'}`}>
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <div className="text-[10px] font-black text-white tracking-wide uppercase">{target}</div>
                                    <div className="text-[8px] text-gray-500">
                                        {session.deviceId ? `ID: ${session.deviceId}` : 'No Device'}
                                        {session.port && ` @ ${session.port}`}
                                    </div>
                                </div>
                                <div className={`px-1.5 py-0.5 rounded text-[7px] font-bold uppercase tracking-wider ${session.status === 'connected' ? 'bg-green-500/10 text-green-400' :
                                    session.status === 'connecting' ? 'bg-yellow-500/10 text-yellow-400 animate-pulse' :
                                        session.status === 'error' ? 'bg-red-500/10 text-red-400' :
                                            'bg-white/5 text-gray-600'
                                    }`}>
                                    {session.status}
                                </div>
                            </div>

                            {session.error && (
                                <div className="mb-2 text-[8px] text-red-400 bg-red-400/5 p-1 rounded border border-red-500/10">
                                    {session.error}
                                </div>
                            )}

                            <div className="flex gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                                {session.status !== 'connected' && session.status !== 'connecting' ? (
                                    <button
                                        onClick={() => handleConnect(target as Target)}
                                        className="flex-1 py-1 bg-white/5 hover:bg-white/10 text-white rounded text-[8px] font-bold border border-white/5 transition-colors"
                                    >
                                        CONNECT
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleDisconnect(target as Target)}
                                        className="flex-1 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded text-[8px] font-bold border border-red-500/10 transition-colors"
                                    >
                                        DISCONNECT
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Discovered Devices */}
                <div className="space-y-2">
                    <div className="text-[9px] uppercase font-bold text-gray-600 tracking-wider mb-2">Discovered Hardware</div>
                    {devices.length === 0 ? (
                        <div className="flex flex-col gap-3 p-4 border border-white/5 bg-white/5 rounded-lg text-center">
                            <div className="text-2xl animate-pulse grayscale opacity-50">🔌</div>
                            <div className="space-y-1">
                                <div className="text-[10px] font-bold text-gray-300">No Hardware Found</div>
                                <div className="text-[9px] text-gray-500 leading-relaxed">
                                    Connect your Arduino or FPGA via USB.
                                    <br />
                                    <span className="opacity-75">Ensure the RedByte Bridge is running.</span>
                                </div>
                            </div>

                            {/* Troubleshooting Actions */}
                            {bridge.status !== 'online' && (
                                <div className="mt-2 pt-3 border-t border-white/10">
                                    <div className="text-[9px] text-red-400 font-bold mb-1">⚠️ BRIDGE OFFLINE</div>
                                    <button
                                        className="w-full py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded text-[9px] font-bold transition-all border border-red-500/20"
                                        onClick={() => window.open('https://redbyte.os/docs/bridge', '_blank')}
                                    >
                                        LAUNCH BRIDGE
                                    </button>
                                </div>
                            )}

                            {bridge.status === 'online' && (
                                <div className="mt-2 pt-3 border-t border-white/10">
                                    <div className="text-[8px] text-gray-600 mb-2">TROUBLESHOOTING</div>
                                    <ul className="text-[8px] text-gray-500 text-left space-y-1 list-disc pl-4">
                                        <li>Check USB cable connection</li>
                                        <li>Try a different USB port</li>
                                        <li>Ensure drivers are installed</li>
                                    </ul>
                                </div>
                            )}
                        </div>
                    ) : (
                        devices.map((device, idx) => (
                            <div key={(device as any).deviceId + idx} className="border border-white/5 bg-black/20 rounded p-2 flex justify-between items-center opacity-75 hover:opacity-100 transition-opacity group">
                                <div>
                                    <div className="text-[9px] font-bold text-gray-300 group-hover:text-white transition-colors">{(device as any).model || 'Unknown Device'}</div>
                                    <div className="text-[8px] text-gray-600 group-hover:text-gray-500">
                                        {(device as any).deviceId} • {(device as any).transport?.port || 'VIRTUAL'}
                                    </div>
                                </div>
                                <div className="text-[8px] font-mono text-gray-600 bg-white/5 px-1.5 py-0.5 rounded">
                                    {(device as any).target || 'idle'}
                                </div>
                            </div>
                        ))
                    )}
                </div>

            </div>

            {/* Footer / Heartbeat */}
            <div className="p-2 bg-black border-t border-white/5 flex justify-between items-center text-[8px] text-gray-600">
                <a href="https://redbyte.os/docs/hardware" target="_blank" rel="noreferrer noopener" className="hover:text-gray-400 transition-colors cursor-pointer">
                    NEED HELP?
                </a>
                <span className={bridge.lastSeenAt && Date.now() - bridge.lastSeenAt < 2000 ? "text-green-500" : "text-gray-700"}>
                    ● HBEAT
                </span>
            </div>
        </div>
    );
};
