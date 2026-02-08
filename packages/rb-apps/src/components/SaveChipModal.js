import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { useRef, useState } from 'react';
import { Modal, Input, Button } from '@redbyte/rb-primitives';
import { suggestChipPorts, validateChipPorts } from '../utils/chipUtils';
export const SaveChipModal = ({ circuit, recognizedPattern, onSave, onCancel, }) => {
    const nameInputRef = useRef(null);
    // Initialize with pattern data if available
    const [name, setName] = useState(recognizedPattern?.name || 'My Chip');
    const [description, setDescription] = useState(recognizedPattern?.description || '');
    const [layer, setLayer] = useState(recognizedPattern?.layer || 1);
    const [error, setError] = useState(null);
    // Auto-detect ports from circuit
    const suggestedPorts = suggestChipPorts(circuit);
    const [inputs] = useState(suggestedPorts.inputs);
    const [outputs] = useState(suggestedPorts.outputs);
    const handleSave = () => {
        // Validate inputs
        if (!name.trim()) {
            setError('Chip name is required');
            return;
        }
        if (inputs.length === 0 && outputs.length === 0) {
            setError('Chip must have at least one input or output port');
            return;
        }
        const validation = validateChipPorts(circuit, inputs, outputs);
        if (!validation.valid) {
            setError(validation.errors.join(', '));
            return;
        }
        onSave(name.trim(), description.trim(), layer, inputs, outputs);
    };
    const handleKeyDown = (event) => {
        if (event.key === 'Enter' && event.ctrlKey) {
            event.preventDefault();
            handleSave();
        }
    };
    const layerColors = {
        0: 'bg-gray-500',
        1: 'bg-blue-500',
        2: 'bg-green-500',
        3: 'bg-amber-500',
        4: 'bg-red-500',
        5: 'bg-purple-500',
        6: 'bg-pink-500',
    };
    return (_jsx(Modal, { isOpen: true, onClose: onCancel, title: "Save as Chip", variant: "center", size: "md", closeOnEsc: true, closeOnBackdrop: true, initialFocusRef: nameInputRef, children: _jsxs("div", { onKeyDown: handleKeyDown, children: [recognizedPattern && (_jsxs("div", { className: "mb-4 px-3 py-2 bg-cyan-900/30 border border-cyan-700/50 rounded text-sm text-cyan-300", children: ["Recognized pattern: ", _jsx("span", { className: "font-semibold", children: recognizedPattern.name })] })), _jsxs("div", { className: "space-y-4 mb-4", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "chip-name", className: "block text-sm text-slate-300 mb-2", children: "Chip Name" }), _jsx(Input, { id: "chip-name", ref: nameInputRef, type: "text", value: name, onChange: (e) => {
                                        setName(e.target.value);
                                        setError(null);
                                    }, placeholder: "XOR Gate", size: "md", "aria-label": "Chip name" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "chip-description", className: "block text-sm text-slate-300 mb-2", children: "Description" }), _jsx("textarea", { id: "chip-description", value: description, onChange: (e) => setDescription(e.target.value), className: "w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white focus:outline-none focus:border-cyan-500 resize-none", rows: 2, placeholder: "What does this chip do?" })] }), _jsxs("fieldset", { className: "border-0 p-0 m-0", children: [_jsx("legend", { className: "block text-sm text-slate-300 mb-2", children: "Layer" }), _jsx("div", { className: "flex gap-2", children: [0, 1, 2, 3, 4, 5, 6].map((l) => (_jsxs("label", { className: `px-3 py-1 rounded text-sm font-semibold transition-all cursor-pointer ${layer === l
                                            ? `${layerColors[l]} text-white`
                                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`, children: [_jsx("input", { type: "radio", name: "chip-layer", value: l, checked: layer === l, onChange: () => setLayer(l), className: "sr-only" }), l] }, l))) })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm text-slate-300 mb-2", children: "Ports (auto-detected)" }), _jsx("div", { className: "bg-slate-800 border border-slate-600 rounded p-3 text-sm", children: _jsxs("div", { className: "flex gap-4", children: [_jsxs("div", { className: "flex-1", children: [_jsx("span", { className: "text-cyan-400 font-semibold", children: "Inputs:" }), ' ', _jsx("span", { className: "text-white", children: inputs.length > 0 ? inputs.map((i) => i.name).join(', ') : 'None' })] }), _jsxs("div", { className: "flex-1", children: [_jsx("span", { className: "text-amber-400 font-semibold", children: "Outputs:" }), ' ', _jsx("span", { className: "text-white", children: outputs.length > 0 ? outputs.map((o) => o.name).join(', ') : 'None' })] })] }) })] })] }), error && _jsx("p", { className: "text-red-400 text-sm mb-4", children: error }), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx(Button, { onClick: onCancel, variant: "secondary", size: "md", children: "Cancel" }), _jsx(Button, { onClick: handleSave, variant: "primary", size: "md", children: "Save Chip" })] }), _jsxs("div", { className: "mt-3 text-xs text-slate-500 text-center", children: [_jsx("kbd", { className: "px-1.5 py-0.5 bg-slate-800 rounded", children: "Ctrl+Enter" }), " Save", ' ', _jsx("kbd", { className: "px-1.5 py-0.5 bg-slate-800 rounded", children: "Esc" }), " Cancel"] })] }) }));
};
