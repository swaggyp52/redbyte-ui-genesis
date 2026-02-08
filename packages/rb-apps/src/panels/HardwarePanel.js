import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState, useRef } from 'react';
import { useLabStore } from '@redbyte/rb-logic-3d';
import { VIRTUAL_LAB_TEMPLATES } from '../apps/virtual-lab-templates';
import { toast } from '@redbyte/rb-primitives';
import { getFriendlyErrorMessage } from '../utils/studentErrors';
import { isWebDemoEnvironment } from '../utils/env';
export const HardwarePanel = () => {
    if (isWebDemoEnvironment()) {
        return (_jsxs("div", { className: "flex flex-col items-center justify-center h-full p-6 text-center text-gray-400 select-none", children: [_jsx("div", { className: "text-amber-500 text-4xl mb-4", children: "\u26A0\uFE0F" }), _jsx("h3", { className: "text-lg font-bold text-gray-200 mb-2", children: "Simulation Only" }), _jsxs("p", { className: "text-sm", children: ["Hardware access is disabled in the Web Demo.", _jsx("br", {}), "Install RedByte OS locally to connect to physical FPGA boards."] })] }));
    }
    const playbackMode = useLabStore(state => state.simulation.playbackMode);
    const serial = useLabStore(state => state.sketch.serial);
    const [status, setStatus] = useState(useLabStore.getState().getTransportStatus());
    const [target, setTarget] = useState('arduino-uno');
    const [port, setPort] = useState('COM6');
    const [devices, setDevices] = useState([]);
    const [selectedSketchId, setSelectedSketchId] = useState(VIRTUAL_LAB_TEMPLATES.find(t => t.hardware_target === 'arduino-uno')?.lab_id || '');
    const [isUploading, setIsUploading] = useState(false);
    // Workflow State
    const [isAttemptingVerification, setIsAttemptingVerification] = useState(false);
    const [verificationData, setVerificationData] = useState(null);
    const [uploadSuccess, setUploadSuccess] = useState(false);
    const serialEndRef = useRef(null);
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
                }
                else {
                    toast.error({ message: "VERIFICATION FAILED" });
                }
            }
        }
        catch (err) {
            toast.error({ message: getFriendlyErrorMessage(err, 'Verification Error') });
        }
        finally {
            setIsAttemptingVerification(false);
        }
    };
    const handleUpload = async () => {
        const t = useLabStore.getState().activeTransport;
        const template = VIRTUAL_LAB_TEMPLATES.find(t => t.lab_id === selectedSketchId);
        if (!t.uploadSketch)
            return;
        if (!template?.firmware_path)
            return;
        setIsUploading(true);
        setUploadSuccess(false);
        try {
            const response = await fetch(`/api/firmware?path=${encodeURIComponent(template.firmware_path)}`);
            if (!response.ok)
                throw new Error("Could not fetch firmware source.");
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
            }
            else {
                toast.error({ message: getFriendlyErrorMessage(result.message || "Upload failed", 'Upload Error') });
            }
        }
        catch (err) {
            toast.error({ message: getFriendlyErrorMessage(err, 'Upload Error') });
        }
        finally {
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
    // Web Demo Hardening: Hide hardware panel in browser mode
    // @ts-ignore
    const isBrowserDemo = typeof window !== 'undefined' && !window.electron;
    if (isBrowserDemo) {
        return (_jsxs("div", { className: "flex flex-col h-full bg-[#0a0a0a] text-[#444] items-center justify-center p-6 text-center select-none", children: [_jsx("div", { className: "text-4xl mb-4 opacity-20", children: "\uD83D\uDD0C" }), _jsx("div", { className: "text-xs font-bold uppercase tracking-widest mb-2 opacity-50", children: "Local Only" }), _jsxs("p", { className: "text-[10px] max-w-[200px] leading-relaxed", children: ["Hardware connection requires the ", _jsx("strong", { children: "Local RedByte OS" }), "."] }), _jsxs("div", { className: "mt-6 p-3 bg-[#111] rounded border border-white/5 w-full", children: [_jsx("div", { className: "text-[9px] font-mono text-cyan-500/50 mb-1", children: "DEMO MODE" }), _jsx("div", { className: "text-[9px] text-gray-600", children: "Simulation is fully enabling." })] })] }));
    }
    return (_jsxs("div", { className: "flex flex-col h-full bg-[#0a0a0a] text-[11px] text-gray-400 select-none", children: [_jsx("div", { className: "p-3 border-b border-white/5 bg-[#111]", children: _jsx("span", { className: "text-[10px] uppercase font-black text-gray-500 tracking-widest", children: "Hardware Workflow" }) }), _jsxs("div", { className: "flex-1 min-h-0 overflow-y-auto scrollbar-thin", children: [_jsxs("div", { className: `p-4 border-b border-white/5 space-y-3 ${isVerified ? 'opacity-50' : ''}`, children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: `w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${isVerified ? 'bg-green-500 text-black' : 'bg-white/10 text-white'}`, children: isVerified ? '✓' : '1' }), _jsx("span", { className: "font-bold text-gray-200 uppercase", children: "Device Initialization" })] }), !isVerified && (_jsxs("div", { className: "space-y-3 pl-6", children: [_jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsxs("div", { className: "space-y-1", children: [_jsx("span", { className: "text-[9px] text-gray-600 uppercase font-bold", children: "Target" }), _jsx("select", { className: "w-full bg-black border border-white/10 rounded px-2 py-1 outline-none text-white text-[10px]", value: target, onChange: (e) => setTarget(e.target.value), title: "Target Board", children: _jsx("option", { value: "arduino-uno", children: "Arduino UNO (AVR)" }) })] }), _jsxs("div", { className: "space-y-1", children: [_jsx("span", { className: "text-[9px] text-gray-600 uppercase font-bold", children: "Serial Port" }), _jsxs("select", { className: "w-full bg-black border border-white/10 rounded px-2 py-1 outline-none font-mono text-white text-[10px]", value: port, onChange: (e) => setPort(e.target.value), title: "Serial Port", children: [devices.map(d => _jsx("option", { value: d.port, children: d.port }, d.port)), devices.length === 0 && _jsx("option", { value: "COM6", children: "COM6 (Default)" })] })] })] }), _jsx("button", { onClick: handleVerify, disabled: isAttemptingVerification, className: `w-full py-1.5 rounded font-black text-[10px] transition-all ${isAttemptingVerification ? 'bg-gray-800 text-gray-500' : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'}`, children: isAttemptingVerification ? 'PROBING...' : 'VERIFY DEVICE' })] })), isVerified && (_jsxs("div", { className: "pl-6 text-[10px]", children: [_jsx("div", { className: "text-green-400 font-bold tracking-widest", children: "\u2705 UNO VERIFIED" }), _jsxs("div", { className: "text-gray-600 font-mono mt-1", children: ["SN: ", verificationData.port, " \u00B7 ", verificationData.timestamp] }), _jsx("button", { onClick: () => useLabStore.getState().activeTransport.disconnect(), className: "text-red-500/60 hover:text-red-500 mt-2 text-[8px] uppercase font-black", children: "DEREGISTER DEVICE" })] }))] }), _jsxs("div", { className: `p-4 border-b border-white/5 space-y-3 ${!isVerified ? 'opacity-30 pointer-events-none' : uploadSuccess ? 'opacity-50' : ''}`, children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: `w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${uploadSuccess ? 'bg-green-500 text-black' : 'bg-white/10 text-white'}`, children: uploadSuccess ? '✓' : '2' }), _jsx("span", { className: "font-bold text-gray-200 uppercase", children: "Deploy Firmware" })] }), isVerified && !uploadSuccess && (_jsxs("div", { className: "space-y-3 pl-6", children: [_jsx("select", { className: "w-full bg-black border border-white/10 rounded px-2 py-1 outline-none text-white text-[10px]", value: selectedSketchId, onChange: (e) => setSelectedSketchId(e.target.value), disabled: isUploading, title: "Firmware File", children: VIRTUAL_LAB_TEMPLATES.filter(l => l.hardware_target === 'arduino-uno').map(lab => (_jsx("option", { value: lab.lab_id, children: lab.name }, lab.lab_id))) }), _jsx("button", { onClick: handleUpload, disabled: isUploading, className: `w-full py-1.5 rounded font-black text-[10px] transition-all bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/40`, children: isUploading ? 'WIRING BITS...' : 'UPLOAD TO UNO' })] })), uploadSuccess && _jsx("div", { className: "pl-6 text-green-500/80 font-bold text-[9px] uppercase tracking-widest", children: "READY TO OBSERVE" })] }), _jsxs("div", { className: `p-4 border-b border-white/5 space-y-3 ${!uploadSuccess ? 'opacity-30 pointer-events-none' : ''}`, children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: `w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${uploadSuccess && serial.length > 0 ? 'bg-green-500 text-black' : 'bg-white/10 text-white'}`, children: uploadSuccess && serial.length > 0 ? '✓' : '3' }), _jsx("span", { className: "font-bold text-gray-200 uppercase", children: "Live Stream" })] }), uploadSuccess && (_jsx("div", { className: "pl-6 flex flex-col h-32", children: _jsxs("div", { className: "flex-1 bg-black/60 border border-white/5 rounded p-2 font-mono text-[9px] overflow-y-auto scrollbar-thin", children: [serial.length === 0 ? _jsx("span", { className: "text-gray-700 italic animate-pulse", children: "Waiting for handshake..." }) : serial.map((l, i) => (_jsx("div", { className: "text-cyan-400/80 border-b border-white/5 pb-1 mb-1 last:border-0", children: l }, i))), _jsx("div", { ref: serialEndRef })] }) }))] }), _jsxs("div", { className: `p-4 space-y-3 ${!uploadSuccess ? 'opacity-30 pointer-events-none' : ''}`, children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold bg-white/10 text-white", children: "4" }), _jsx("span", { className: "font-bold text-gray-200 uppercase", children: "Data Export" })] }), uploadSuccess && (_jsx("div", { className: "pl-6", children: _jsx("button", { onClick: handleSnapshot, className: "w-full py-1.5 rounded bg-white/5 hover:bg-white/10 text-white border border-white/10 text-[9px] font-black uppercase tracking-widest", children: "Snapshot Physical Evidence" }) }))] })] }), _jsxs("div", { className: "p-2 bg-black border-t border-white/5 flex justify-between items-center text-[8px] text-gray-600 font-black tracking-widest uppercase", children: [_jsx("span", { children: "Ref: 0xDEADBEEF" }), _jsx("span", { children: "rb-uno.v1 // Secure" })] })] }));
};
