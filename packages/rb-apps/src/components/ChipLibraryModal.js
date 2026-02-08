import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { useState, useMemo, useRef } from 'react';
import { Modal, Input, Select, Button, GuardrailConfirmModal } from '@redbyte/rb-primitives';
export const ChipLibraryModal = ({ isOpen, onClose, chips, onSelectChip, onDeleteChip, onDragStart, }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedLayer, setSelectedLayer] = useState(null);
    const searchInputRef = useRef(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    // Filter chips by search query and layer
    const filteredChips = useMemo(() => {
        return chips.filter((chip) => {
            const matchesSearch = searchQuery === '' ||
                chip.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                chip.description.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesLayer = selectedLayer === null || chip.layer === selectedLayer;
            return matchesSearch && matchesLayer;
        });
    }, [chips, searchQuery, selectedLayer]);
    // Group chips by layer
    const chipsByLayer = useMemo(() => {
        const grouped = {};
        filteredChips.forEach((chip) => {
            if (!grouped[chip.layer]) {
                grouped[chip.layer] = [];
            }
            grouped[chip.layer].push(chip);
        });
        return grouped;
    }, [filteredChips]);
    // Get unique layers
    const layers = useMemo(() => {
        const layerSet = new Set(chips.map((c) => c.layer));
        return Array.from(layerSet).sort((a, b) => a - b);
    }, [chips]);
    const handleSelectChip = (chipId) => {
        onSelectChip(chipId);
        onClose();
    };
    const exportChip = (chip) => {
        try {
            const blob = new Blob([JSON.stringify(chip, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const safeName = chip.name.replace(/[\\/:*?"<>|]+/g, '_');
            a.download = `${safeName}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
        catch (error) {
            console.error('[ChipLibrary] Export failed:', error);
        }
    };
    const handleDeleteChip = (e, chipId) => {
        e.stopPropagation();
        const chip = chips.find((item) => item.id === chipId) ?? null;
        if (!onDeleteChip || !chip)
            return;
        setDeleteTarget(chip);
    };
    return (_jsxs(Modal, { isOpen: isOpen, onClose: onClose, title: "Chip Library", variant: "center", size: "xl", closeOnEsc: true, closeOnBackdrop: true, initialFocusRef: searchInputRef, children: [deleteTarget && (_jsx(GuardrailConfirmModal, { isOpen: Boolean(deleteTarget), title: "Delete Chip?", message: `This will permanently remove "${deleteTarget.name}".`, lossItems: ['Chip definition', 'Associated references'], confirmLabel: "Delete Chip", confirmTone: "danger", onConfirm: () => {
                    onDeleteChip?.(deleteTarget.id);
                    setDeleteTarget(null);
                }, onCancel: () => setDeleteTarget(null), onExport: () => exportChip(deleteTarget), exportLabel: "Export First" })), _jsxs("div", { className: "flex flex-col max-h-[60vh]", children: [_jsxs("div", { className: "flex gap-3 mb-4", children: [_jsx(Input, { ref: searchInputRef, type: "text", placeholder: "Search chips...", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), size: "md", "aria-label": "Search chips", className: "flex-1" }), _jsxs(Select, { value: selectedLayer ?? '', onChange: (e) => setSelectedLayer(e.target.value === '' ? null : Number(e.target.value)), size: "md", "aria-label": "Filter by layer", children: [_jsx("option", { value: "", children: "All Layers" }), layers.map((layer) => (_jsxs("option", { value: layer, children: ["Layer ", layer] }, layer)))] })] }), _jsx("div", { className: "flex-1 overflow-y-auto", children: filteredChips.length === 0 ? (_jsx("div", { className: "text-center py-12 text-gray-400", children: chips.length === 0 ? (_jsxs(_Fragment, { children: [_jsx("p", { className: "text-lg mb-2", children: "No chips saved yet" }), _jsx("p", { className: "text-sm", children: "Build a circuit and click \"Save as Chip\" to create your first reusable component!" })] })) : (_jsx("p", { children: "No chips match your search" })) })) : (_jsx("div", { className: "space-y-6", children: Object.entries(chipsByLayer)
                                .sort(([a], [b]) => Number(a) - Number(b))
                                .map(([layer, layerChips]) => (_jsxs("div", { children: [_jsxs("h3", { className: "text-sm font-semibold text-gray-400 mb-3", children: ["Layer ", layer] }), _jsx("div", { className: "space-y-2", children: layerChips.map((chip) => (_jsx("button", { draggable: !!onDragStart, onDragStart: (e) => {
                                                if (onDragStart) {
                                                    e.stopPropagation();
                                                    onDragStart(chip.name, e);
                                                }
                                            }, onDragEnd: () => {
                                                onClose();
                                            }, onClick: () => {
                                                handleSelectChip(chip.id);
                                            }, className: "w-full bg-slate-700 hover:bg-slate-650 rounded-lg p-4 cursor-move transition-colors group text-left focus:outline-none focus:ring-2 focus:ring-cyan-500", children: _jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { className: "flex-1", children: [_jsxs("div", { className: "flex items-center gap-2 mb-1", children: [_jsx("h4", { className: "text-white font-medium", children: chip.name }), _jsxs("span", { className: "text-xs text-gray-400", children: ["L", chip.layer] })] }), _jsx("p", { className: "text-sm text-gray-400 mb-2", children: chip.description }), _jsxs("div", { className: "flex gap-4 text-xs mb-2", children: [_jsxs("div", { className: "flex items-center gap-1", children: [_jsx("span", { className: "text-green-400", children: "\u2192" }), _jsx("span", { className: "text-gray-500", children: "In:" }), _jsx("span", { className: "text-gray-300 font-mono", children: chip.inputs.map(i => i.name).join(', ') || 'none' })] }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx("span", { className: "text-orange-400", children: "\u2190" }), _jsx("span", { className: "text-gray-500", children: "Out:" }), _jsx("span", { className: "text-gray-300 font-mono", children: chip.outputs.map(o => o.name).join(', ') || 'none' })] })] }), _jsxs("div", { className: "flex gap-4 text-xs text-gray-500", children: [_jsxs("span", { children: [chip.subcircuit.nodes.length, " gates"] }), _jsxs("span", { children: [chip.subcircuit.connections.length, " wires"] })] })] }), onDeleteChip && (_jsx("button", { onClick: (e) => handleDeleteChip(e, chip.id), className: "text-gray-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity ml-4 focus:outline-none focus:ring-2 focus:ring-red-500 rounded p-1", "aria-label": `Delete ${chip.name}`, children: _jsx("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" }) }) }))] }) }, chip.id))) })] }, layer))) })) }), _jsxs("div", { className: "pt-4 border-t border-slate-700 flex justify-between items-center", children: [_jsxs("div", { className: "text-sm text-gray-400", children: [filteredChips.length, " ", filteredChips.length === 1 ? 'chip' : 'chips', selectedLayer !== null && ` in Layer ${selectedLayer}`] }), _jsx(Button, { onClick: onClose, variant: "secondary", size: "md", children: "Close" })] })] })] }));
};
