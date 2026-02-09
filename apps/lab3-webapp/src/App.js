import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { TruthTableEditor } from './truth-table';
import { Simulator } from './simulator';
import { VerilogExporter } from './verilog';
import { KMapViewer } from './kmap-viewer';
import { WaveformViewer } from './waveform-viewer';
import { LiveValidation } from './live-validation';
import { useLabStore } from './store';
import { Settings, Download, Upload } from 'lucide-react';
export const App = () => {
    const [tab, setTab] = useState('overview');
    const [showSettings, setShowSettings] = useState(false);
    const reset = useLabStore((s) => s.reset);
    const exportJSON = useLabStore((s) => s.exportJSON);
    const importJSON = useLabStore((s) => s.importJSON);
    const handleExportJSON = () => {
        const json = exportJSON();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lab3-workspace-${new Date().getTime()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };
    const handleImportJSON = (event) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const json = e.target?.result;
                importJSON(json);
            };
            reader.readAsText(file);
        }
    };
    return (_jsxs("div", { className: "min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-slate-50", children: [_jsx("header", { className: "bg-gradient-to-r from-slate-950 to-slate-900 border-b border-slate-700 shadow-lg sticky top-0 z-40", children: _jsxs("div", { className: "max-w-7xl mx-auto px-6 py-6", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-4xl font-bold bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent", children: "Lab 3: Seven-Segment Display Driver" }), _jsx("p", { className: "text-slate-400 mt-1", children: "Design a 4-bit to 7-segment decoder (active-low, digits 0\u20139)" })] }), _jsx("button", { onClick: () => setShowSettings(!showSettings), className: "p-2 hover:bg-slate-800 rounded-lg transition-colors", title: "Settings", children: _jsx(Settings, { size: 24, className: "text-slate-300 hover:text-slate-50" }) })] }), showSettings && (_jsxs("div", { className: "bg-slate-800/50 border border-slate-700 rounded-lg p-4 mb-4 space-y-3", children: [_jsx("h3", { className: "font-semibold text-sm text-slate-200", children: "Workspace" }), _jsxs("div", { className: "flex gap-2 flex-wrap", children: [_jsxs("button", { onClick: handleExportJSON, className: "px-3 py-2 bg-emerald-700 hover:bg-emerald-600 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors", children: [_jsx(Download, { size: 16 }), "Export JSON"] }), _jsxs("label", { className: "px-3 py-2 bg-emerald-700 hover:bg-emerald-600 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors cursor-pointer", children: [_jsx(Upload, { size: 16 }), "Import JSON", _jsx("input", { type: "file", accept: ".json", onChange: handleImportJSON, hidden: true })] }), _jsx("button", { onClick: reset, className: "px-3 py-2 bg-red-700 hover:bg-red-600 rounded-lg text-sm font-medium transition-colors ml-auto", children: "Reset All" })] })] })), _jsx("div", { className: "flex gap-2 overflow-x-auto pb-2", children: [
                                { id: 'overview', label: '📊 Overview' },
                                { id: 'table', label: '📋 Truth Table' },
                                { id: 'kmaps', label: '🎯 K-Maps' },
                                { id: 'simulator', label: '⚙️ Simulator' },
                                { id: 'verilog', label: '💾 Verilog & Export' },
                            ].map((item) => (_jsx("button", { onClick: () => setTab(item.id), className: `px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${tab === item.id
                                    ? 'bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-900 shadow-lg'
                                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`, children: item.label }, item.id))) })] }) }), _jsxs("main", { className: "max-w-7xl mx-auto px-6 py-8", children: [tab === 'overview' && (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-6", children: [_jsxs("div", { className: "bg-slate-800 border border-slate-700 rounded-lg p-6", children: [_jsx("h2", { className: "text-2xl font-bold text-cyan-400 mb-4", children: "Getting Started" }), _jsxs("ol", { className: "space-y-3 text-slate-300 text-sm", children: [_jsxs("li", { className: "flex gap-3", children: [_jsx("span", { className: "flex-shrink-0 w-6 h-6 bg-cyan-500 text-slate-900 rounded-full flex items-center justify-center font-bold", children: "1" }), _jsxs("span", { children: ["Fill the ", _jsx("strong", { children: "Truth Table" }), " with segment patterns for digits 0\u20139"] })] }), _jsxs("li", { className: "flex gap-3", children: [_jsx("span", { className: "flex-shrink-0 w-6 h-6 bg-cyan-500 text-slate-900 rounded-full flex items-center justify-center font-bold", children: "2" }), _jsxs("span", { children: ["Review and edit ", _jsx("strong", { children: "K-Maps" }), " to see optimal groupings and simplified boolean expressions"] })] }), _jsxs("li", { className: "flex gap-3", children: [_jsx("span", { className: "flex-shrink-0 w-6 h-6 bg-cyan-500 text-slate-900 rounded-full flex items-center justify-center font-bold", children: "3" }), _jsxs("span", { children: ["Check ", _jsx("strong", { children: "Live Validation" }), " to ensure expressions match your truth table"] })] }), _jsxs("li", { className: "flex gap-3", children: [_jsx("span", { className: "flex-shrink-0 w-6 h-6 bg-cyan-500 text-slate-900 rounded-full flex items-center justify-center font-bold", children: "4" }), _jsxs("span", { children: ["Use the ", _jsx("strong", { children: "Simulator" }), " to test all 16 input combinations"] })] }), _jsxs("li", { className: "flex gap-3", children: [_jsx("span", { className: "flex-shrink-0 w-6 h-6 bg-cyan-500 text-slate-900 rounded-full flex items-center justify-center font-bold", children: "5" }), _jsxs("span", { children: ["Export to ", _jsx("strong", { children: "Verilog" }), " and download your lab report"] })] })] })] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "bg-gradient-to-br from-cyan-950/50 to-emerald-950/50 border border-cyan-700/50 rounded-lg p-6", children: [_jsx("h3", { className: "text-lg font-bold text-cyan-300 mb-3", children: "Key Concepts" }), _jsxs("ul", { className: "space-y-2 text-sm text-slate-300", children: [_jsxs("li", { children: [_jsx("strong", { children: "Active-Low Logic:" }), " 0 = segment ON (lit), 1 = segment OFF (dark)"] }), _jsxs("li", { children: [_jsx("strong", { children: "Don't-Cares:" }), " Inputs 10\u201315 can be any value; use them to simplify logic"] }), _jsxs("li", { children: [_jsx("strong", { children: "Karnaugh Map:" }), " Visual tool to find minimal boolean expressions"] }), _jsxs("li", { children: [_jsx("strong", { children: "Gray Code:" }), " Adjacent cells differ by 1 bit (easier grouping)"] })] })] }), _jsxs("div", { className: "bg-gradient-to-br from-emerald-950/50 to-slate-900 border border-emerald-700/50 rounded-lg p-6", children: [_jsx("h3", { className: "text-lg font-bold text-emerald-300 mb-3", children: "Digit Patterns (Active-Low)" }), _jsx("div", { className: "grid grid-cols-5 gap-2 text-xs", children: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (_jsxs("div", { className: "text-center", children: [_jsx("div", { className: "text-lg font-bold text-slate-200", children: digit }), _jsx("div", { className: "text-xs text-slate-400", children: "segments: a b c d e f g" })] }, digit))) })] })] })] }), _jsx(LiveValidation, {})] })), tab === 'table' && (_jsxs("div", { className: "space-y-6", children: [_jsx(TruthTableEditor, {}), _jsx(LiveValidation, {})] })), tab === 'kmaps' && (_jsxs("div", { className: "space-y-6", children: [_jsx(KMapViewer, {}), _jsx(LiveValidation, {})] })), tab === 'simulator' && (_jsxs("div", { className: "space-y-6", children: [_jsx(Simulator, {}), _jsx(WaveformViewer, {})] })), tab === 'verilog' && (_jsx("div", { className: "space-y-6", children: _jsx(VerilogExporter, {}) }))] }), _jsx("footer", { className: "border-t border-slate-700 bg-slate-900/50 mt-12 py-6", children: _jsxs("div", { className: "max-w-7xl mx-auto px-6 text-center text-sm text-slate-400", children: [_jsx("p", { children: "Lab 3 Webapp v2.0 | Seven-Segment Display Driver Design Tool" }), _jsx("p", { className: "text-xs mt-2", children: "Tips: Use your boolean expressions from K-maps. Verify all 16 inputs pass in Simulator." })] }) })] }));
};
