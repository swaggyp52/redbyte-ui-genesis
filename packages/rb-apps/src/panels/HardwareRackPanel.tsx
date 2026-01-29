
import React, { useEffect, useState } from 'react';
import { useLabStore, TransportRouter, BridgeTransport } from '@redbyte/rb-logic-3d';
import { toast } from '@redbyte/rb-primitives';

export const HardwareRackPanel: React.FC = () => {
    const activeTransport = useLabStore(state => state.activeTransport);
    const [statuses, setStatuses] = useState<Record<string, any>>({});

    useEffect(() => {
        const interval = setInterval(() => {
            if (activeTransport.getDetailedStatuses) {
                setStatuses(activeTransport.getDetailedStatuses());
            } else {
                setStatuses({ 'default': activeTransport.getStatus() });
            }
        }, 500);
        return () => clearInterval(interval);
    }, [activeTransport]);

    const handleVerifyDevice = async (id: string) => {
        const router = activeTransport as TransportRouter;
        const transport = router.getTransport(id);
        if (transport && transport.verifyDevice) {
            try {
                const res = await transport.verifyDevice();
                if (res.verified) {
                    toast.success({ message: `${id.toUpperCase()} VERIFIED: ${res.board}` });
                } else {
                    toast.error({ message: `${id.toUpperCase()} VERIFICATION FAILED` });
                }
            } catch (err: any) {
                toast.error({ message: err.message });
            }
        }
    };

    const handleDeploy = async (id: string) => {
        // Logic for deploying firmware/bitstream to specific board
        toast.info({ message: `Deploying to ${id.toUpperCase()}...` });
    };

    return (
        <div className="flex flex-col h-full bg-[#0a0a0a] text-[11px] text-gray-400 select-none">
            <div className="p-3 border-b border-white/5 bg-[#111] flex justify-between items-center">
                <span className="text-[10px] uppercase font-black text-gray-500 tracking-widest">Hardware Rack</span>
                <span className="text-[8px] text-gray-600">multi-device // bridge-v1</span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin p-4 space-y-6">
                {Object.entries(statuses).map(([id, status]) => (
                    <div key={id} className="bg-black/40 border border-white/5 rounded-lg p-4 space-y-4">
                        <div className="flex justify-between items-start">
                            <div className="flex flex-col">
                                <span className="text-[12px] font-black text-white tracking-widest">{id.toUpperCase()}</span>
                                <span className="text-[8px] text-gray-600 font-mono tracking-tighter">
                                    {status.port || 'VIRTUAL'} // {status.protocol || '---'}
                                </span>
                            </div>
                            <div className={`px-2 py-0.5 rounded-full text-[7px] font-black tracking-widest uppercase ${status.connected ? (status.deviceVerified ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500') : 'bg-red-500/10 text-red-500'}`}>
                                {status.connected ? (status.deviceVerified ? 'Verified' : 'Unverified') : 'Offline'}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => handleVerifyDevice(id)}
                                className="py-2 rounded bg-white/5 hover:bg-white/10 text-[9px] font-black transition-all border border-white/5"
                            >
                                VERIFY LINK
                            </button>
                            <button
                                onClick={() => handleDeploy(id)}
                                className="py-2 rounded bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 text-[9px] font-black transition-all border border-blue-500/20"
                            >
                                DEPLOY BITS
                            </button>
                        </div>

                        {status.deviceVerified && (
                            <div className="pt-2 border-t border-white/5 text-[8px] text-gray-500 font-mono">
                                <div className="flex justify-between">
                                    <span>Sync Tick:</span>
                                    <span className="text-gray-400">{useLabStore.getState().simulation.tick}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Latency:</span>
                                    <span className="text-gray-400">~2ms</span>
                                </div>
                            </div>
                        )}
                    </div>
                ))}

                {Object.keys(statuses).length === 0 && (
                    <div className="text-center py-8 text-gray-600 italic">
                        No active transports in bridge mode.
                    </div>
                )}
            </div>

            <div className="p-3 bg-black border-t border-white/5 text-[8px] text-gray-600 font-black flex justify-between">
                <span>RACK_READY_OK</span>
                <span className="animate-pulse">● LIVE</span>
            </div>
        </div>
    );
};
