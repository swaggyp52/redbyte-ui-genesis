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

import React, { useState, useRef, useEffect } from 'react';

interface ComponentInfo {
  type: string;
  category: string;
  description: string;
  layer?: number;
}

interface EnhancedPaletteProps {
  primitiveNodes: Record<string, readonly string[]>;
  compositeNodes: readonly string[];
  chips: Array<{ id: string; name: string; description?: string; layer?: number }>;
  onNodeDragStart: (type: string, e: React.DragEvent) => void;
  onAddNode: (type: string, position: { x: number; y: number }) => void;
  onChipLibraryOpen: () => void;
  getChipMetadata: (type: string) => any;
  getNodeDescription: (type: string) => string;
}

export const EnhancedPalette: React.FC<EnhancedPaletteProps> = ({
  primitiveNodes,
  compositeNodes,
  chips,
  onNodeDragStart,
  onAddNode,
  onChipLibraryOpen,
  getChipMetadata,
  getNodeDescription,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('rb-palette-collapsed');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('rb-component-favorites');
    return saved ? new Set(JSON.parse(saved)) : new Set(['Switch', 'Lamp', 'AND', 'OR', 'NOT']);
  });
  const [recentComponents, setRecentComponents] = useState<string[]>(() => {
    const saved = localStorage.getItem('rb-component-recent');
    return saved ? JSON.parse(saved) : [];
  });

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Build searchable component list (primitives + composites + chips)
  const allComponents: ComponentInfo[] = [
    ...Object.entries(primitiveNodes).flatMap(([category, nodes]) =>
      nodes.map(type => ({
        type,
        category,
        description: getNodeDescription(type),
        layer: getChipMetadata(type)?.layer,
      }))
    ),
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
    ? allComponents.filter(
        (comp) =>
          comp.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
          comp.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  // Keyboard shortcut: / to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleCategory = (category: string) => {
    const newCollapsed = new Set(collapsedCategories);
    if (newCollapsed.has(category)) {
      newCollapsed.delete(category);
    } else {
      newCollapsed.add(category);
    }
    setCollapsedCategories(newCollapsed);
    localStorage.setItem('rb-palette-collapsed', JSON.stringify([...newCollapsed]));
  };

  const toggleFavorite = (type: string) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(type)) {
      newFavorites.delete(type);
    } else {
      newFavorites.add(type);
    }
    setFavorites(newFavorites);
    localStorage.setItem('rb-component-favorites', JSON.stringify([...newFavorites]));
  };

  const addToRecent = (type: string) => {
    const newRecent = [type, ...recentComponents.filter(t => t !== type)].slice(0, 12);
    setRecentComponents(newRecent);
    localStorage.setItem('rb-component-recent', JSON.stringify(newRecent));
  };

  const handleDragStart = (type: string, e: React.DragEvent) => {
    addToRecent(type);
    onNodeDragStart(type, e);
  };

  const handleComponentClick = (type: string) => {
    addToRecent(type);
    // Add node at default center position
    onAddNode(type, { x: 400, y: 300 });
  };

  const renderComponentButton = (type: string, extraClass: string = '') => {
    const metadata = getChipMetadata(type);
    const description = getNodeDescription(type);
    const isFavorite = favorites.has(type);

    const layerColors: Record<number, string> = {
      0: 'bg-blue-900/20 border-blue-700/30',
      1: 'bg-green-900/20 border-green-700/30',
      2: 'bg-teal-900/20 border-teal-700/30',
      3: 'bg-pink-900/20 border-pink-700/30',
      4: 'bg-orange-900/20 border-orange-700/30',
    };
    const layerColor = metadata?.layer !== undefined ? layerColors[metadata.layer] || 'bg-gray-800' : 'bg-gray-800';

    return (
      <button
        key={type}
        draggable
        onDragStart={(e) => handleDragStart(type, e)}
        onClick={() => handleComponentClick(type)}
        className={`w-full text-left px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 rounded cursor-move transition-colors border ${layerColor} group relative ${extraClass}`}
        title={description}
      >
        <div className="flex items-center justify-between">
          <span className="flex-1">{type}</span>
          <div className="flex items-center gap-1">
            {metadata && metadata.layer !== undefined && (
              <span className="text-[10px] text-gray-500">L{metadata.layer}</span>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                toggleFavorite(type);
              }}
              className="text-xs hover:scale-125 transition-transform"
              title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              {isFavorite ? '⭐' : '☆'}
            </button>
          </div>
        </div>
        {/* Tooltip */}
        <div className="hidden group-hover:block absolute left-full ml-2 top-0 bg-gray-900 border border-gray-600 rounded p-2 text-xs whitespace-nowrap z-50 shadow-xl max-w-xs">
          {description}
        </div>
      </button>
    );
  };

  return (
    <div className="w-48 border-r border-gray-700 overflow-y-auto p-2 bg-gray-850 flex flex-col gap-3">
      {/* Search Input */}
      <div>
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search components... (/)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-2 py-1.5 text-xs bg-gray-800 border border-gray-700 rounded focus:border-cyan-500 focus:outline-none text-white placeholder-gray-500"
        />
      </div>

      {/* Search Results (if searching) */}
      {searchQuery && (
        <div>
          <h3 className="text-xs font-semibold mb-2 text-gray-400">
            SEARCH RESULTS ({filteredComponents.length})
          </h3>
          <div className="space-y-1">
            {filteredComponents.length === 0 ? (
              <p className="text-xs text-gray-500 italic px-2 py-1">No matches found</p>
            ) : (
              filteredComponents.map((comp) => renderComponentButton(comp.type))
            )}
          </div>
        </div>
      )}

      {/* Favorites + Recent (when not searching) */}
      {!searchQuery && (
        <>
          {/* Favorites */}
          {favorites.size > 0 && (
            <div>
              <h3 className="text-xs font-semibold mb-2 text-yellow-400">⭐ FAVORITES</h3>
              <div className="space-y-1">
                {[...favorites].map((type) => renderComponentButton(type))}
              </div>
            </div>
          )}

          {/* Recent */}
          {recentComponents.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold mb-2 text-gray-400">🕒 RECENT</h3>
              <div className="space-y-1">
                {recentComponents.map((type) => renderComponentButton(type))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Categories (when not searching) */}
      {!searchQuery && (
        <>
          {Object.entries(primitiveNodes).map(([category, nodes]) => (
            <div key={category}>
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between text-xs font-semibold mb-2 text-gray-400 hover:text-white transition-colors"
              >
                <span>{category.toUpperCase()}</span>
                <span className="text-xs">{collapsedCategories.has(category) ? '▶' : '▼'}</span>
              </button>
              {!collapsedCategories.has(category) && (
                <div className="space-y-1 mb-2">
                  {nodes.map((type) => renderComponentButton(type))}
                </div>
              )}
            </div>
          ))}

          {/* Composite */}
          <div>
            <button
              onClick={() => toggleCategory('Composite')}
              className="w-full flex items-center justify-between text-xs font-semibold mb-2 text-gray-400 hover:text-white transition-colors"
            >
              <span>COMPOSITE</span>
              <span className="text-xs">{collapsedCategories.has('Composite') ? '▶' : '▼'}</span>
            </button>
            {!collapsedCategories.has('Composite') && (
              <div className="space-y-1 mb-2">
                {compositeNodes.map((type) => renderComponentButton(type))}
              </div>
            )}
          </div>

          {/* My Chips */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-400">MY CHIPS</h3>
              <button
                onClick={onChipLibraryOpen}
                className="text-xs text-cyan-400 hover:text-cyan-300"
                title="Browse chip library"
              >
                Browse
              </button>
            </div>
            <div className="space-y-1">
              {chips.length === 0 ? (
                <p className="text-xs text-gray-500 italic px-2 py-1">No saved chips yet</p>
              ) : (
                chips.map((chip) => (
                  <button
                    key={chip.id}
                    draggable
                    onDragStart={(e) => onNodeDragStart(chip.name, e)}
                    className="w-full text-left px-2 py-1 text-xs bg-purple-900/30 hover:bg-purple-800/40 rounded cursor-move transition-colors border border-purple-700/30"
                    title={`${chip.description} • Layer ${chip.layer} • Drag to canvas`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate">{chip.name}</span>
                      <span className="text-[10px] text-purple-400 ml-1">L{chip.layer}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
