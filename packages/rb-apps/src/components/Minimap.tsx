
import React, { useRef, useEffect } from 'react';
import type { ViewportControls } from '../utils/viewportControls';
import type { Node } from '@redbyte/rb-logic-core';

export interface MinimapProps {
    nodes: Node[];
    viewport: ViewportControls;
    containerWidth: number;
    containerHeight: number;
}

export const Minimap: React.FC<MinimapProps> = ({ nodes, viewport, containerWidth, containerHeight }) => {

    // 1. Calculate World Bounds (Content)
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    if (nodes.length === 0) {
        minX = -500; maxX = 500; minY = -500; maxY = 500;
    } else {
        nodes.forEach(n => {
            minX = Math.min(minX, n.position.x);
            maxX = Math.max(maxX, n.position.x);
            minY = Math.min(minY, n.position.y);
            maxY = Math.max(maxY, n.position.y);
        });
        // Add minimal margin to bounds
        minX -= 200; maxX += 200; minY -= 200; maxY += 200;
    }

    // Ensure bounds have some size
    const worldWidth = Math.max(1000, maxX - minX);
    const worldHeight = Math.max(1000, maxY - minY);

    // 2. Calculate Viewport Rect in World Coords
    // screen = world * zoom + pan
    // world = (screen - pan) / zoom
    const vpWorldX = (0 - viewport.state.x) / viewport.state.zoom;
    const vpWorldY = (0 - viewport.state.y) / viewport.state.zoom;
    const vpWorldW = containerWidth / viewport.state.zoom;
    const vpWorldH = containerHeight / viewport.state.zoom;

    // 3. Mapping Function (World -> Minimap %)
    // Minimap dimensions scale with --rb-ui-scale for browser zoom compatibility
    const baseMapWidth = 200;
    const baseMapHeight = 150;
    const uiScale = typeof window !== 'undefined'
      ? parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--rb-ui-scale') || '1')
      : 1;
    const mapWidth = baseMapWidth * uiScale;
    const mapHeight = baseMapHeight * uiScale;

    // Scale factor to fit world into map
    const scaleX = mapWidth / worldWidth;
    const scaleY = mapHeight / worldHeight;
    const scale = Math.min(scaleX, scaleY); // Uniform scale

    // Center the world in the minimap
    const mapOffsetX = (mapWidth - worldWidth * scale) / 2;
    const mapOffsetY = (mapHeight - worldHeight * scale) / 2;

    const worldToMap = (wx: number, wy: number) => ({
        x: mapOffsetX + (wx - minX) * scale,
        y: mapOffsetY + (wy - minY) * scale
    });

    const handleMapClick = (e: React.MouseEvent) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        // Convert map click -> world coord
        // mapX = offset + (world - min) * scale
        // world = ((mapX - offset) / scale) + min
        const targetWorldX = ((clickX - mapOffsetX) / scale) + minX;
        const targetWorldY = ((clickY - mapOffsetY) / scale) + minY;

        // Center viewport on target
        // pan.x = screenCenter - world * zoom
        const newPanX = (containerWidth / 2) - targetWorldX * viewport.state.zoom;
        const newPanY = (containerHeight / 2) - targetWorldY * viewport.state.zoom;

        // We can't use viewport.pan() because it's relative
        // We assume viewport object might expose a setPan or we construct delta?
        // Wait, the viewportControls hook state is {x,y,zoom}. 
        // We probably need a method to set absolute position or calculate delta.
        // Current interface: pan(dx, dy) and zoom(...). reset() sets to 0,0.
        // Let's check viewportControls.ts... 
        // It exposes 'pan' (relative).
        // To do absolute jump:
        const dx = newPanX - viewport.state.x;
        const dy = newPanY - viewport.state.y;
        viewport.pan(dx, dy);
    };

    const vpRect = worldToMap(vpWorldX, vpWorldY);
    const vpW = vpWorldW * scale;
    const vpH = vpWorldH * scale;

    return (
        <div
            className="bg-gray-900 border border-gray-700 rounded overflow-hidden relative cursor-pointer shadow-lg"
            style={{ width: `${mapWidth}px`, height: `${mapHeight}px` }}
            onClick={handleMapClick}
        >
            {/* World Bounds (Grid hint) */}
            <div className="absolute inset-0 opacity-20 bg-gray-800" />

            {/* Nodes */}
            {nodes.map(node => {
                const pos = worldToMap(node.position.x, node.position.y);
                return (
                    <div
                        key={node.id}
                        className="absolute w-1 h-1 bg-gray-400 rounded-full"
                        style={{ left: pos.x, top: pos.y }}
                    />
                );
            })}

            {/* Viewport Rect */}
            <div
                className="absolute border border-cyan-500 bg-cyan-500/10 z-10 box-border pointer-events-none"
                style={{
                    left: vpRect.x,
                    top: vpRect.y,
                    width: vpW,
                    height: vpH,
                }}
            />
        </div>
    );
};
