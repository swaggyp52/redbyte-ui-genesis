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
import { REPLAY_LOCK_MESSAGE } from '../utils/replayLock';
import styles from './EnhancedPalette.module.css';

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
  onAddNode: (type: string, position?: { x: number; y: number }) => void;
  onChipLibraryOpen: () => void;
  getChipMetadata: (type: string) => any;
  getNodeDescription: (type: string) => string;
  isReplayMode?: boolean;
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
  isReplayMode = false,
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
    if (isReplayMode) return;
    addToRecent(type);
    onNodeDragStart(type, e);
  };

  const handleComponentClick = (type: string) => {
    if (isReplayMode) return;
    addToRecent(type);
    // Let the parent decide position (smart spawn at camera center)
    onAddNode(type);
  };

  const renderComponentButton = (type: string) => {
    const metadata = getChipMetadata(type);
    const description = getNodeDescription(type);
    const isFavorite = favorites.has(type);

    const layerClassMap: Record<number, string> = {
      0: styles.layer0,
      1: styles.layer1,
      2: styles.layer2,
      3: styles.layer3,
      4: styles.layer4,
    };
    const layerClass =
      metadata?.layer !== undefined ? layerClassMap[metadata.layer] ?? '' : '';

    const btnClasses = [
      styles.componentBtn,
      layerClass,
      isReplayMode ? styles.disabled : '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div
        key={type}
        draggable={!isReplayMode}
        onDragStart={(e) => handleDragStart(type, e)}
        onClick={() => handleComponentClick(type)}
        data-component-type={type}
        className={btnClasses}
        title={isReplayMode ? REPLAY_LOCK_MESSAGE : description}
      >
        <div className={styles.componentInner}>
          <span className={styles.componentLabel}>{type}</span>
          <div className={styles.componentMeta}>
            {metadata && metadata.layer !== undefined && (
              <span className={styles.layerBadge}>L{metadata.layer}</span>
            )}
            <button
              className={[styles.favBtn, isFavorite ? styles.active : ''].filter(Boolean).join(' ')}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                toggleFavorite(type);
              }}
              title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              {isFavorite ? '★' : '☆'}
            </button>
          </div>
        </div>
        {/* Tooltip */}
        <div className={styles.tooltip}>{description}</div>
      </div>
    );
  };

  return (
    <div className={styles.root}>
      {/* Search Input */}
      <div className={styles.searchWrap}>
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search components... (/)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={styles.searchInput}
        />
      </div>

      {/* Search Results (if searching) */}
      {searchQuery && (
        <div className={styles.section}>
          <span className={styles.searchResultsHeader}>
            Search Results ({filteredComponents.length})
          </span>
          <div className={styles.componentList}>
            {filteredComponents.length === 0 ? (
              <p className={styles.emptyMsg}>No matches found</p>
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
            <div className={styles.section}>
              <span className={styles.sectionHeader}>Favorites</span>
              <div className={styles.componentList}>
                {[...favorites].map((type) => renderComponentButton(type))}
              </div>
            </div>
          )}

          {/* Recent */}
          {recentComponents.length > 0 && (
            <div className={styles.section}>
              <span className={styles.sectionHeader}>Recent</span>
              <div className={styles.componentList}>
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
            <div key={category} className={styles.section}>
              <button
                onClick={() => toggleCategory(category)}
                className={styles.sectionHeaderBtn}
              >
                <span>{category.toUpperCase()}</span>
                <span className={styles.sectionHeaderChevron}>
                  {collapsedCategories.has(category) ? '▶' : '▼'}
                </span>
              </button>
              {!collapsedCategories.has(category) && (
                <div className={styles.componentList}>
                  {nodes.map((type) => renderComponentButton(type))}
                </div>
              )}
            </div>
          ))}

          {/* Composite */}
          <div className={styles.section}>
            <button
              onClick={() => toggleCategory('Composite')}
              className={styles.sectionHeaderBtn}
            >
              <span>COMPOSITE</span>
              <span className={styles.sectionHeaderChevron}>
                {collapsedCategories.has('Composite') ? '▶' : '▼'}
              </span>
            </button>
            {!collapsedCategories.has('Composite') && (
              <div className={styles.componentList}>
                {compositeNodes.map((type) => renderComponentButton(type))}
              </div>
            )}
          </div>

          {/* My Chips */}
          <div className={styles.section}>
            <div className={styles.sectionHeaderRow}>
              <span className={styles.sectionHeader} style={{ margin: 0 }}>My Chips</span>
              <button
                onClick={onChipLibraryOpen}
                className={styles.browseLink}
                title="Browse chip library"
              >
                Browse
              </button>
            </div>
            <div className={styles.componentList}>
              {chips.length === 0 ? (
                <p className={styles.emptyMsg}>No saved chips yet</p>
              ) : (
                chips.map((chip) => (
                  <button
                    key={chip.id}
                    draggable
                    onDragStart={(e) => onNodeDragStart(chip.name, e)}
                    className={styles.chipBtn}
                    title={`${chip.description} • Layer ${chip.layer} • Drag to canvas`}
                  >
                    <div className={styles.componentInner}>
                      <span className={styles.componentLabel}>{chip.name}</span>
                      <span className={styles.chipLayerBadge}>L{chip.layer}</span>
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
