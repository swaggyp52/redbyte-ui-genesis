import React, { useEffect, useState, useRef } from 'react';
import { useLabStore } from '@redbyte/rb-logic-3d';
import { VIRTUAL_LAB_TEMPLATES } from '../apps/virtual-lab-templates';
import { toast } from '@redbyte/rb-primitives';
import { getFriendlyErrorMessage } from '../utils/studentErrors';

export const HardwarePanel: React.FC = () => {
    const playbackMode = useLabStore(state => state.simulation.playbackMode);
    const serial = useLabStore(state => state.sketch.serial);

    const [status, setStatus] = useState(useLabStore.getState().getTransportStatus());
    const [target, setTarget] = useState<'basys3' | 'arduino-uno'>('arduino-uno');
    const [port, setPort] = useState('COM6');
    const [devices, setDevices] = useState<any[]>([]);
    const [selectedSketchId, setSelectedSketchId] = useState(VIRTUAL_LAB_TEMPLATES.find(t => t.hardware_target === 'arduino-uno')?.lab_id || '');
    const [isUploading, setIsUploading] = useState(false);

    // Workflow State
    const [isAttemptingVerification, setIsAttemptingVerification] = useState(false);
    const [verificationData, setVerificationData] = useState<any>(null);
    const [uploadSuccess, setUploadSuccess] = useState(false);

    const serialEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const interval = setInterval(() => {
            setStatus(useLabStore.getState().getTransportStatus());
        }, 500);
        refreshDevices();
        return () => clearInterval(interval);
    }, []);

    const refreshDevices = async () => {
        const t = useLabStore.getState().activeTransport;
        if (t.listDevices) {
            const list = await t.listDevices();
            setDevices(list || []);
            if (list?.length > 0 && !port) {
                setPort(list[0].port);
            }
        }
    };

    const handleVerify = async () => {
        const t = useLabStore.getState().activeTransport;
        setIsAttemptingVerification(true);
        try {
            await t.connect({ target, port });
            if (t.verifyDevice) {
                const res = await t.verifyDevice();
                setVerificationData(res);
                if (res.verified) {
                    toast.success({ message: "UNO VERIFIED: " + res.details });
                } else {
                    toast.error({ message: "VERIFICATION FAILED" });
                }
            }
        } catch (err: any) {
            toast.error({ message: getFriendlyErrorMessage(err, 'Verification Error') });
        } finally {
            setIsAttemptingVerification(false);
        }
    };

    const handleUpload = async () => {
        const t = useLabStore.getState().activeTransport;
        const template = VIRTUAL_LAB_TEMPLATES.find(t => t.lab_id === selectedSketchId);

        if (!t.uploadSketch) return;
        if (!template?.firmware_path) return;

        setIsUploading(true);
        setUploadSuccess(false);
        try {
            const response = await fetch(`/api/firmware?path=${encodeURIComponent(template.firmware_path)}`);
            if (!response.ok) throw new Error("Could not fetch firmware source.");
            const text = await response.text();

            const result = await t.uploadSketch({
                target: 'arduino-uno',
                port,
                fqbn: 'arduino:avr:uno',
                sketchText: text
            });

            if (result.ok) {
                setUploadSuccess(true);
                toast.success({ message: "BITSTREAM DEPLOYED OK" });
            } else {
                toast.error({ message: getFriendlyErrorMessage(result.message || "Upload failed", 'Upload Error') });
            }
        } catch (err: any) {
            toast.error({ message: getFriendlyErrorMessage(err, 'Upload Error') });
        } finally {
            setIsUploading(false);
        }
    };

    const handleSnapshot = async () => {
        const { exportEvidence } = await import('../utils/evidenceExport');
        await exportEvidence({
            source: 'hardware_panel_snapshot',
            pinStates: useLabStore.getState().simulation.pinStates,
            serial: useLabStore.getState().sketch.serial.slice(-20)
        });
        toast.success({ message: "PHYSICAL EVIDENCE SNAPSHOTTED" });
    };

    const isVerified = verificationData?.verified && status.connected;

    return (
        <div className="flex flex-col h-full bg-[#0a0a0a] text-[11px] text-gray-400 select-none">
            {/* Workflow Header */}
            <div className="p-3 border-b border-white/5 bg-[#111]">
                <span className="text-[10px] uppercase font-black text-gray-500 tracking-widest">Hardware Workflow</span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
                {/* Step 1: Initialize */}
                <div className={`p-4 border-b border-white/5 space-y-3 ${isVerified ? 'opacity-50' : ''}`}>
                    <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${isVerified ? 'bg-green-500 text-black' : 'bg-white/10 text-white'}`}>
                            {isVerified ? '✓' : '1'}
                        </div>
                        <span className="font-bold text-gray-200 uppercase">Device Initialization</span>
                    </div>

                    {!isVerified && (
                        <div className="space-y-3 pl-6">
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                    <span className="text-[9px] text-gray-600 uppercase font-bold">Target</span>
                                    <select className="w-full bg-black border border-white/10 rounded px-2 py-1 outline-none text-white text-[10px]" value={target} onChange={(e) => setTarget(e.target.value as any)} title="Target Board">
                                        <option value="arduino-uno">Arduino UNO (AVR)</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[9px] text-gray-600 uppercase font-bold">Serial Port</span>
                                    <select className="w-full bg-black border border-white/10 rounded px-2 py-1 outline-none font-mono text-white text-[10px]" value={port} onChange={(e) => setPort(e.target.value)} title="Serial Port">
                                        {devices.map(d => <option key={d.port} value={d.port}>{d.port}</option>)}
                                        {devices.length === 0 && <option value="COM6">COM6 (Default)</option>}
                                    </select>
                                </div>
                            </div>
                            <button
                                onClick={handleVerify}
                                disabled={isAttemptingVerification}
                                className={`w-full py-1.5 rounded font-black text-[10px] transition-all ${isAttemptingVerification ? 'bg-gray-800 text-gray-500' : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'}`}
                            >
                                {isAttemptingVerification ? 'PROBING...' : 'VERIFY DEVICE'}
                            </button>
                        </div>
                    )}
                    {isVerified && (
                        <div className="pl-6 text-[10px]">
                            <div className="text-green-400 font-bold tracking-widest">✅ UNO VERIFIED</div>
                            <div className="text-gray-600 font-mono mt-1">SN: {verificationData.port} · {verificationData.timestamp}</div>
                            <button onClick={() => useLabStore.getState().activeTransport.disconnect()} className="text-red-500/60 hover:text-red-500 mt-2 text-[8px] uppercase font-black">DEREGISTER DEVICE</button>
                        </div>
                    )}
                </div>

                {/* Step 2: Protocol Flash */}
                <div className={`p-4 border-b border-white/5 space-y-3 ${!isVerified ? 'opacity-30 pointer-events-none' : uploadSuccess ? 'opacity-50' : ''}`}>
                    <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${uploadSuccess ? 'bg-green-500 text-black' : 'bg-white/10 text-white'}`}>
                            {uploadSuccess ? '✓' : '2'}
                        </div>
                        <span className="font-bold text-gray-200 uppercase">Deploy Firmware</span>
                    </div>

                    {isVerified && !uploadSuccess && (
                        <div className="space-y-3 pl-6">
                            <select className="w-full bg-black border border-white/10 rounded px-2 py-1 outline-none text-white text-[10px]" value={selectedSketchId} onChange={(e) => setSelectedSketchId(e.target.value)} disabled={isUploading} title="Firmware File">
                                {VIRTUAL_LAB_TEMPLATES.filter(l => l.hardware_target === 'arduino-uno').map(lab => (
                                    <option key={lab.lab_id} value={lab.lab_id}>{lab.name}</option>
                                ))}
                            </select>
                            <button
                                onClick={handleUpload}
                                disabled={isUploading}
                                className={`w-full py-1.5 rounded font-black text-[10px] transition-all bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/40`}
                            >
                                {isUploading ? 'WIRING BITS...' : 'UPLOAD TO UNO'}
                            </button>
                        </div>
                    )}
                    {uploadSuccess && <div className="pl-6 text-green-500/80 font-bold text-[9px] uppercase tracking-widest">READY TO OBSERVE</div>}
                </div>

                {/* Step 3: Observe */}
                <div className={`p-4 border-b border-white/5 space-y-3 ${!uploadSuccess ? 'opacity-30 pointer-events-none' : ''}`}>
                    <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${uploadSuccess && serial.length > 0 ? 'bg-green-500 text-black' : 'bg-white/10 text-white'}`}>
                            {uploadSuccess && serial.length > 0 ? '✓' : '3'}
                        </div>
                        <span className="font-bold text-gray-200 uppercase">Live Stream</span>
                    </div>
                    {uploadSuccess && (
                        <div className="pl-6 flex flex-col h-32">
                            <div className="flex-1 bg-black/60 border border-white/5 rounded p-2 font-mono text-[9px] overflow-y-auto scrollbar-thin">
                                {serial.length === 0 ? <span className="text-gray-700 italic animate-pulse">Waiting for handshake...</span> : serial.map((l, i) => (
                                    <div key={i} className="text-cyan-400/80 border-b border-white/5 pb-1 mb-1 last:border-0">{l}</div>
                                ))}
                                <div ref={serialEndRef} />
                            </div>
                        </div>
                    )}
                </div>

                {/* Step 4: Record */}
                <div className={`p-4 space-y-3 ${!uploadSuccess ? 'opacity-30 pointer-events-none' : ''}`}>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold bg-white/10 text-white">4</div>
                        <span className="font-bold text-gray-200 uppercase">Data Export</span>
                    </div>
                    {uploadSuccess && (
                        <div className="pl-6">
                            <button
                                onClick={handleSnapshot}
                                className="w-full py-1.5 rounded bg-white/5 hover:bg-white/10 text-white border border-white/10 text-[9px] font-black uppercase tracking-widest"
                            >
                                Snapshot Physical Evidence
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Sub-footer */}
            <div className="p-2 bg-black border-t border-white/5 flex justify-between items-center text-[8px] text-gray-600 font-black tracking-widest uppercase">
                <span>Ref: 0xDEADBEEF</span>
                <span>rb-uno.v1 // Secure</span>
            </div>
        </div>
    );
};
