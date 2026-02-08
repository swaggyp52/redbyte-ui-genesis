import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { useEffect, useRef, useState, useMemo } from 'react';
import { filterSearchResults } from './searchRegistry';
export const SystemSearch = ({ onExecuteApp, onExecuteCommand, onExecuteIntent, onExecuteMacro, onExecuteFile, onClose, }) => {
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef(null);
    const containerRef = useRef(null);
    const results = useMemo(() => filterSearchResults(query), [query]);
    const allResults = useMemo(() => {
        return [...results.apps, ...results.commands, ...results.intents, ...results.macros, ...results.files];
    }, [results]);
    useEffect(() => {
        inputRef.current?.focus();
    }, []);
    useEffect(() => {
        setSelectedIndex(0);
    }, [query]);
    const handleKeyDown = (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            onClose();
            return;
        }
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setSelectedIndex((prev) => Math.min(prev + 1, allResults.length - 1));
            return;
        }
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            setSelectedIndex((prev) => Math.max(prev - 1, 0));
            return;
        }
        if (event.key === 'Enter') {
            event.preventDefault();
            const selected = allResults[selectedIndex];
            if (!selected)
                return;
            switch (selected.type) {
                case 'app':
                    onExecuteApp(selected.id);
                    break;
                case 'command':
                    onExecuteCommand(selected.id);
                    break;
                case 'intent':
                    onExecuteIntent(selected.id);
                    break;
                case 'macro':
                    onExecuteMacro(selected.id);
                    break;
                case 'file':
                    onExecuteFile(selected.id, event.shiftKey);
                    break;
            }
            onClose();
            return;
        }
    };
    const handleResultClick = (result) => {
        switch (result.type) {
            case 'app':
                onExecuteApp(result.id);
                break;
            case 'command':
                onExecuteCommand(result.id);
                break;
            case 'intent':
                onExecuteIntent(result.id);
                break;
            case 'macro':
                onExecuteMacro(result.id);
                break;
            case 'file':
                onExecuteFile(result.id, false); // Mouse clicks are default-open
                break;
        }
        onClose();
    };
    return (_jsx("div", { className: "fixed inset-0 bg-black/70 flex items-start justify-center pt-32 z-[9999]", onClick: onClose, children: _jsxs("div", { ref: containerRef, onClick: (e) => e.stopPropagation(), className: "bg-slate-900 border border-cyan-500/30 rounded-lg shadow-2xl w-[600px] overflow-hidden", children: [_jsx("div", { className: "p-4 border-b border-slate-800 bg-slate-950", children: _jsx("input", { ref: inputRef, type: "text", value: query, onChange: (e) => setQuery(e.target.value), onKeyDown: handleKeyDown, placeholder: "Search apps, commands, files, and actions...", className: "w-full bg-slate-800 text-white px-4 py-2 rounded outline-none focus:ring-2 focus:ring-cyan-500" }) }), _jsxs("div", { className: "max-h-[500px] overflow-y-auto", children: [results.apps.length > 0 && (_jsxs("div", { children: [_jsx("div", { className: "px-4 py-2 text-xs font-semibold text-slate-400 uppercase bg-slate-950", children: "Apps" }), results.apps.map((app, index) => {
                                    const globalIndex = index;
                                    const isSelected = globalIndex === selectedIndex;
                                    return (_jsxs("button", { onClick: () => handleResultClick(app), className: `w-full text-left p-3 border-b border-slate-800 transition-colors ${isSelected ? 'bg-cyan-900/30 text-cyan-300' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'}`, children: [_jsx("div", { className: "font-medium text-sm", children: app.name }), app.description && (_jsx("div", { className: "text-xs text-slate-500 mt-1", children: app.description }))] }, app.id));
                                })] })), results.commands.length > 0 && (_jsxs("div", { children: [_jsx("div", { className: "px-4 py-2 text-xs font-semibold text-slate-400 uppercase bg-slate-950", children: "Commands" }), results.commands.map((cmd, index) => {
                                    const globalIndex = results.apps.length + index;
                                    const isSelected = globalIndex === selectedIndex;
                                    return (_jsxs("button", { onClick: () => handleResultClick(cmd), className: `w-full text-left p-3 border-b border-slate-800 transition-colors ${isSelected ? 'bg-cyan-900/30 text-cyan-300' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'}`, children: [_jsx("div", { className: "font-medium text-sm", children: cmd.name }), _jsx("div", { className: "text-xs text-slate-500 mt-1", children: cmd.description })] }, cmd.id));
                                })] })), results.intents.length > 0 && (_jsxs("div", { children: [_jsx("div", { className: "px-4 py-2 text-xs font-semibold text-slate-400 uppercase bg-slate-950", children: "Actions" }), results.intents.map((intent, index) => {
                                    const globalIndex = results.apps.length + results.commands.length + index;
                                    const isSelected = globalIndex === selectedIndex;
                                    return (_jsxs("button", { onClick: () => handleResultClick(intent), className: `w-full text-left p-3 border-b border-slate-800 transition-colors ${isSelected ? 'bg-cyan-900/30 text-cyan-300' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'}`, children: [_jsx("div", { className: "font-medium text-sm", children: intent.name }), _jsx("div", { className: "text-xs text-slate-500 mt-1", children: intent.description })] }, intent.id));
                                })] })), results.macros.length > 0 && (_jsxs("div", { children: [_jsx("div", { className: "px-4 py-2 text-xs font-semibold text-slate-400 uppercase bg-slate-950", children: "Macros" }), results.macros.map((macro, index) => {
                                    const globalIndex = results.apps.length + results.commands.length + results.intents.length + index;
                                    const isSelected = globalIndex === selectedIndex;
                                    return (_jsxs("button", { onClick: () => handleResultClick(macro), className: `w-full text-left p-3 border-b border-slate-800 transition-colors ${isSelected ? 'bg-cyan-900/30 text-cyan-300' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'}`, children: [_jsx("div", { className: "font-medium text-sm", children: macro.name }), _jsx("div", { className: "text-xs text-slate-500 mt-1", children: macro.description })] }, macro.id));
                                })] })), results.files.length > 0 && (_jsxs("div", { children: [_jsx("div", { className: "px-4 py-2 text-xs font-semibold text-slate-400 uppercase bg-slate-950", children: "Files" }), results.files.map((file, index) => {
                                    const globalIndex = results.apps.length + results.commands.length + results.intents.length + results.macros.length + index;
                                    const isSelected = globalIndex === selectedIndex;
                                    return (_jsxs("button", { onClick: () => handleResultClick(file), className: `w-full text-left p-3 border-b border-slate-800 transition-colors ${isSelected ? 'bg-cyan-900/30 text-cyan-300' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'}`, children: [_jsx("div", { className: "font-medium text-sm", children: file.name }), _jsx("div", { className: "text-xs text-slate-500 mt-1", children: file.description })] }, file.id));
                                })] })), allResults.length === 0 && (_jsxs("div", { className: "p-8 text-center text-slate-500 text-sm", children: ["No results found for \"", query, "\""] }))] }), _jsxs("div", { className: "p-2 border-t border-slate-800 text-xs text-slate-500 bg-slate-950", children: [_jsx("kbd", { className: "px-1.5 py-0.5 bg-slate-800 rounded", children: "\u2191\u2193" }), " Navigate", ' ', _jsx("kbd", { className: "px-1.5 py-0.5 bg-slate-800 rounded", children: "Enter" }), " Execute", ' ', _jsx("kbd", { className: "px-1.5 py-0.5 bg-slate-800 rounded", children: "Shift+Enter" }), " Open With", ' ', _jsx("kbd", { className: "px-1.5 py-0.5 bg-slate-800 rounded", children: "Esc" }), " Close"] })] }) }));
};
