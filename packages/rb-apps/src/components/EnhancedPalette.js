import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
/**
 * Enhanced Component Palette for PR3
 *
 * Features:
 * - Search input at top
 * - Collapsible categories
 * - Favorites + Recent components row
 * - Keyboard: / to focus search, Enter to place
 * - Drag/drop preserved from original
 */
import { useState, useRef, useEffect } from 'react';
import { REPLAY_LOCK_MESSAGE } from '../utils/replayLock';
export const EnhancedPalette = ({ primitiveNodes, compositeNodes, chips, onNodeDragStart, onAddNode, onChipLibraryOpen, getChipMetadata, getNodeDescription, isReplayMode = false, }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [collapsedCategories, setCollapsedCategories] = useState(() => {
        const saved = localStorage.getItem('rb-palette-collapsed');
        return saved ? new Set(JSON.parse(saved)) : new Set();
    });
    const [favorites, setFavorites] = useState(() => {
        const saved = localStorage.getItem('rb-component-favorites');
        return saved ? new Set(JSON.parse(saved)) : new Set(['Switch', 'Lamp', 'AND', 'OR', 'NOT']);
    });
    const [recentComponents, setRecentComponents] = useState(() => {
        const saved = localStorage.getItem('rb-component-recent');
        return saved ? JSON.parse(saved) : [];
    });
    const searchInputRef = useRef(null);
    // Build searchable component list (primitives + composites + chips)
    const allComponents = [
        ...Object.entries(primitiveNodes).flatMap(([category, nodes]) => nodes.map(type => ({
            type,
            category,
            description: getNodeDescription(type),
            layer: getChipMetadata(type)?.layer,
        }))),
        ...compositeNodes.map(type => ({
            type,
            category: 'Composite',
            description: getNodeDescription(type),
            layer: getChipMetadata(type)?.layer,
        })),
        ...chips.map(chip => ({
            type: chip.name,
            category: 'Chips',
            description: chip.description || '',
            layer: chip.layer,
        })),
    ];
    // Filter components by search query
    const filteredComponents = searchQuery
        ? allComponents.filter((comp) => comp.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
            comp.description.toLowerCase().includes(searchQuery.toLowerCase()))
        : [];
    // Keyboard shortcut: / to focus search
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);
    const toggleCategory = (category) => {
        const newCollapsed = new Set(collapsedCategories);
        if (newCollapsed.has(category)) {
            newCollapsed.delete(category);
        }
        else {
            newCollapsed.add(category);
        }
        setCollapsedCategories(newCollapsed);
        localStorage.setItem('rb-palette-collapsed', JSON.stringify([...newCollapsed]));
    };
    const toggleFavorite = (type) => {
        const newFavorites = new Set(favorites);
        if (newFavorites.has(type)) {
            newFavorites.delete(type);
        }
        else {
            newFavorites.add(type);
        }
        setFavorites(newFavorites);
        localStorage.setItem('rb-component-favorites', JSON.stringify([...newFavorites]));
    };
    const addToRecent = (type) => {
        const newRecent = [type, ...recentComponents.filter(t => t !== type)].slice(0, 12);
        setRecentComponents(newRecent);
        localStorage.setItem('rb-component-recent', JSON.stringify(newRecent));
    };
    const handleDragStart = (type, e) => {
        if (isReplayMode)
            return;
        addToRecent(type);
        onNodeDragStart(type, e);
    };
    const handleComponentClick = (type) => {
        if (isReplayMode)
            return;
        addToRecent(type);
        // Add node at default center position
        onAddNode(type, { x: 400, y: 300 });
    };
    const renderComponentButton = (type, extraClass = '') => {
        const metadata = getChipMetadata(type);
        const description = getNodeDescription(type);
        const isFavorite = favorites.has(type);
        const layerColors = {
            0: 'bg-blue-900/20 border-blue-700/30',
            1: 'bg-green-900/20 border-green-700/30',
            2: 'bg-teal-900/20 border-teal-700/30',
            3: 'bg-pink-900/20 border-pink-700/30',
            4: 'bg-orange-900/20 border-orange-700/30',
        };
        const layerColor = metadata?.layer !== undefined ? layerColors[metadata.layer] || 'bg-gray-800' : 'bg-gray-800';
        return (_jsxs("div", { draggable: !isReplayMode, onDragStart: (e) => handleDragStart(type, e), onClick: () => handleComponentClick(type), "data-component-type": type, className: `w-full text-left px-2 py-1 text-xs bg-gray-800 rounded transition-colors border ${layerColor} group relative ${extraClass} ${isReplayMode ? 'cursor-not-allowed opacity-60' : 'hover:bg-gray-700 cursor-move'}`, title: isReplayMode ? REPLAY_LOCK_MESSAGE : description, children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "flex-1", children: type }), _jsxs("div", { className: "flex items-center gap-1", children: [metadata && metadata.layer !== undefined && (_jsxs("span", { className: "text-[10px] text-gray-500", children: ["L", metadata.layer] })), _jsx("button", { onClick: (e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        toggleFavorite(type);
                                    }, className: "text-xs hover:scale-125 transition-transform", title: isFavorite ? 'Remove from favorites' : 'Add to favorites', children: isFavorite ? '⭐' : '☆' })] })] }), _jsx("div", { className: "hidden group-hover:block absolute left-full ml-2 top-0 bg-gray-900 border border-gray-600 rounded p-2 text-xs whitespace-nowrap z-50 shadow-xl max-w-xs", children: description })] }, type));
    };
    return (_jsxs("div", { className: "w-48 min-h-0 min-w-0 border-r border-gray-700 overflow-y-auto p-2 bg-gray-850 flex flex-col gap-3", children: [_jsx("div", { children: _jsx("input", { ref: searchInputRef, type: "text", placeholder: "Search components... (/)", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), className: "w-full px-2 py-1.5 text-xs bg-gray-800 border border-gray-700 rounded focus:border-cyan-500 focus:outline-none text-white placeholder-gray-500" }) }), searchQuery && (_jsxs("div", { children: [_jsxs("h3", { className: "text-xs font-semibold mb-2 text-gray-400", children: ["SEARCH RESULTS (", filteredComponents.length, ")"] }), _jsx("div", { className: "space-y-1", children: filteredComponents.length === 0 ? (_jsx("p", { className: "text-xs text-gray-500 italic px-2 py-1", children: "No matches found" })) : (filteredComponents.map((comp) => renderComponentButton(comp.type))) })] })), !searchQuery && (_jsxs(_Fragment, { children: [favorites.size > 0 && (_jsxs("div", { children: [_jsx("h3", { className: "text-xs font-semibold mb-2 text-yellow-400", children: "\u2B50 FAVORITES" }), _jsx("div", { className: "space-y-1", children: [...favorites].map((type) => renderComponentButton(type)) })] })), recentComponents.length > 0 && (_jsxs("div", { children: [_jsx("h3", { className: "text-xs font-semibold mb-2 text-gray-400", children: "\uD83D\uDD52 RECENT" }), _jsx("div", { className: "space-y-1", children: recentComponents.map((type) => renderComponentButton(type)) })] }))] })), !searchQuery && (_jsxs(_Fragment, { children: [Object.entries(primitiveNodes).map(([category, nodes]) => (_jsxs("div", { children: [_jsxs("button", { onClick: () => toggleCategory(category), className: "w-full flex items-center justify-between text-xs font-semibold mb-2 text-gray-400 hover:text-white transition-colors", children: [_jsx("span", { children: category.toUpperCase() }), _jsx("span", { className: "text-xs", children: collapsedCategories.has(category) ? '▶' : '▼' })] }), !collapsedCategories.has(category) && (_jsx("div", { className: "space-y-1 mb-2", children: nodes.map((type) => renderComponentButton(type)) }))] }, category))), _jsxs("div", { children: [_jsxs("button", { onClick: () => toggleCategory('Composite'), className: "w-full flex items-center justify-between text-xs font-semibold mb-2 text-gray-400 hover:text-white transition-colors", children: [_jsx("span", { children: "COMPOSITE" }), _jsx("span", { className: "text-xs", children: collapsedCategories.has('Composite') ? '▶' : '▼' })] }), !collapsedCategories.has('Composite') && (_jsx("div", { className: "space-y-1 mb-2", children: compositeNodes.map((type) => renderComponentButton(type)) }))] }), _jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("h3", { className: "text-xs font-semibold text-gray-400", children: "MY CHIPS" }), _jsx("button", { onClick: onChipLibraryOpen, className: "text-xs text-cyan-400 hover:text-cyan-300", title: "Browse chip library", children: "Browse" })] }), _jsx("div", { className: "space-y-1", children: chips.length === 0 ? (_jsx("p", { className: "text-xs text-gray-500 italic px-2 py-1", children: "No saved chips yet" })) : (chips.map((chip) => (_jsx("button", { draggable: true, onDragStart: (e) => onNodeDragStart(chip.name, e), className: "w-full text-left px-2 py-1 text-xs bg-purple-900/30 hover:bg-purple-800/40 rounded cursor-move transition-colors border border-purple-700/30", title: `${chip.description} • Layer ${chip.layer} • Drag to canvas`, children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "truncate", children: chip.name }), _jsxs("span", { className: "text-[10px] text-purple-400 ml-1", children: ["L", chip.layer] })] }) }, chip.id)))) })] })] }))] }));
};
