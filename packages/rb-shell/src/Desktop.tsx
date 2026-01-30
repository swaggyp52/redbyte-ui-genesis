// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ThemeVariant, WallpaperId } from '@redbyte/rb-utils';
import { Icon, type IconName } from '@redbyte/rb-icons';
import { getWallpaperStyle } from './wallpapers';

interface DesktopProps {
  onOpenApp: (id: string, props?: any) => void;
  wallpaperId: WallpaperId;
  themeVariant: ThemeVariant;
}

interface DesktopIconData {
  id: string;
  title: string;
  appId: string;
  iconId: IconName;
  x: number;
  y: number;
}

const ICON_BOX_SIZE = 72;
const ICON_LABEL_GAP = 8;
const ICON_LABEL_HEIGHT = 20;
const ICON_CELL_WIDTH = 120;
const ICON_CELL_HEIGHT = ICON_BOX_SIZE + ICON_LABEL_GAP + ICON_LABEL_HEIGHT;
const GRID_SPACING = 128;
const GRID_START_X = 56;
const GRID_START_Y = 56;

const seededValue = (seed: number) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

const buildNodes = (count: number, seed: number) =>
  Array.from({ length: count }, (_, i) => {
    const base = seed + i * 17.131;
    return {
      left: 5 + seededValue(base) * 90,
      top: 5 + seededValue(base + 3.17) * 90,
      size: 4 + Math.floor(seededValue(base + 5.23) * 6),
      delay: seededValue(base + 9.41) * 2,
      glow: 12 + Math.floor(seededValue(base + 11.7) * 10),
    };
  });

export const Desktop: React.FC<DesktopProps> = ({ onOpenApp, wallpaperId, themeVariant }) => {
  const [icons, setIcons] = useState<DesktopIconData[]>(() => {
    // Grid-aligned icons with Logic Playground featured
    const base: DesktopIconData[] = [
      { id: 'logic', title: 'Logic Playground', appId: 'logic-playground', iconId: 'logic', x: GRID_START_X, y: GRID_START_Y },
      { id: 'ece-lab', title: 'ECE 347 Lab', appId: 'ece-lab', iconId: 'chip', x: GRID_START_X, y: GRID_START_Y + GRID_SPACING },
      { id: 'submission-inspector', title: 'Submission Inspector', appId: 'submission-inspector', iconId: 'folder', x: GRID_START_X, y: GRID_START_Y + GRID_SPACING * 2 },
      { id: 'files', title: 'Files', appId: 'files', iconId: 'files', x: GRID_START_X, y: GRID_START_Y + GRID_SPACING * 3 },
      { id: 'settings', title: 'Settings', appId: 'settings', iconId: 'settings', x: GRID_START_X, y: GRID_START_Y + GRID_SPACING * 4 },
      { id: 'terminal', title: 'Terminal', appId: 'terminal', iconId: 'terminal', x: GRID_START_X, y: GRID_START_Y + GRID_SPACING * 5 },
      { id: 'system-log', title: 'System Log', appId: 'system-log', iconId: 'log', x: GRID_START_X, y: GRID_START_Y + GRID_SPACING * 6 },
      { id: 'user-manual', title: 'Guide', appId: 'user-manual', iconId: 'document', x: GRID_START_X, y: GRID_START_Y + GRID_SPACING * 7 },
    ];
    return base;
  });
  const [selected, setSelected] = useState<string[]>([]);
  const [selectionBox, setSelectionBox] = useState<null | { x: number; y: number; w: number; h: number }>(null);
  const selectionStart = useRef<{ x: number; y: number } | null>(null);
  const dragging = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const desktopRef = useRef<HTMLDivElement>(null);

  const wallpaperStyle = useMemo(() => getWallpaperStyle(wallpaperId, themeVariant), [wallpaperId, themeVariant]);
  const circuitNodes = useMemo(() => buildNodes(15, 4.2), []);
  const frostNodes = useMemo(() => buildNodes(30, 9.6), []);
  const isLightMode = false; // No light theme variant exists yet; branches retained for future use

  useEffect(() => {
    desktopRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!selectionBox) return;
    const rectIntersect = (icon: DesktopIconData) => {
      const rect = { x: icon.x, y: icon.y, w: ICON_CELL_WIDTH, h: ICON_CELL_HEIGHT };
      return !(
        rect.x > selectionBox.x + selectionBox.w ||
        rect.x + rect.w < selectionBox.x ||
        rect.y > selectionBox.y + selectionBox.h ||
        rect.y + rect.h < selectionBox.y
      );
    };
    const hits = icons.filter(rectIntersect).map((i) => i.id);
    setSelected(hits);
  }, [selectionBox, icons]);

  const handleDesktopMouseDown = (e: React.MouseEvent) => {
    if (e.target !== desktopRef.current) return;
    selectionStart.current = { x: e.clientX, y: e.clientY };
    setSelectionBox({ x: e.clientX, y: e.clientY, w: 0, h: 0 });
    setSelected([]);
    desktopRef.current?.focus();
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (selectionStart.current) {
      const { x, y } = selectionStart.current;
      setSelectionBox({
        x: Math.min(x, e.clientX),
        y: Math.min(y, e.clientY),
        w: Math.abs(e.clientX - x),
        h: Math.abs(e.clientY - y),
      });
    }

    if (dragging.current) {
      const { id, offsetX, offsetY } = dragging.current;
      setIcons((prev) =>
        prev.map((icon) =>
          icon.id === id
            ? { ...icon, x: e.clientX - offsetX, y: e.clientY - offsetY }
            : icon
        )
      );
    }
  };

  const handleMouseUp = () => {
    selectionStart.current = null;
    setSelectionBox(null);
    dragging.current = null;
  };

  const onIconMouseDown = (e: React.MouseEvent, icon: DesktopIconData) => {
    e.stopPropagation();
    const bounds = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    dragging.current = { id: icon.id, offsetX: e.clientX - bounds.left, offsetY: e.clientY - bounds.top };
    setSelected([icon.id]);
  };

  const handleIconClick = (icon: DesktopIconData) => {
    onOpenApp(icon.appId);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setSelected([]);
      return;
    }

    if (e.key === 'Enter' && selected.length > 0) {
      const icon = icons.find((i) => i.id === selected[0]);
      if (icon) {
        onOpenApp(icon.appId);
      }
    }
  };

  return (
    <div
      ref={desktopRef}
      data-testid="shell-desktop"
      className={`rb-desktop rb-noise absolute inset-0 overflow-hidden ${isLightMode ? 'text-gray-900' : 'text-white'}`}
      style={{ ...wallpaperStyle }}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseDown={handleDesktopMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Neon Circuit - Animated circuit board with flowing energy */}
      {wallpaperId === 'neon-circuit' && (
        <div className="pointer-events-none absolute inset-0">
          {/* Horizontal circuit lines */}
          <div className={`absolute inset-0 ${isLightMode ? 'opacity-8' : 'opacity-12'}`}>
            {[...Array(8)].map((_, i) => (
              <div
                key={`h-${i}`}
                className="absolute h-0.5"
                style={{
                  top: `${(i + 1) * 12}%`,
                  left: 0,
                  right: 0,
                  background: isLightMode
                    ? 'linear-gradient(90deg, transparent, rgba(6, 182, 212, 0.3), transparent)'
                    : 'linear-gradient(90deg, transparent, rgba(6, 182, 212, 0.6), transparent)',
                  animation: `circuit-flow-h ${8 + i}s linear infinite`,
                  animationDelay: `${i * 0.5}s`,
                }}
              />
            ))}
          </div>

          {/* Vertical circuit lines */}
          <div className={`absolute inset-0 ${isLightMode ? 'opacity-8' : 'opacity-12'}`}>
            {[...Array(12)].map((_, i) => (
              <div
                key={`v-${i}`}
                className="absolute w-0.5"
                style={{
                  left: `${(i + 1) * 8}%`,
                  top: 0,
                  bottom: 0,
                  background: isLightMode
                    ? 'linear-gradient(180deg, transparent, rgba(6, 182, 212, 0.3), transparent)'
                    : 'linear-gradient(180deg, transparent, rgba(6, 182, 212, 0.6), transparent)',
                  animation: `circuit-flow-v ${6 + i}s linear infinite`,
                  animationDelay: `${i * 0.3}s`,
                }}
              />
            ))}
          </div>

          {/* Circuit nodes - pulsing dots at intersections */}
          <div className={`absolute inset-0 ${isLightMode ? 'opacity-20' : 'opacity-30'}`}>
            {circuitNodes.map((node, i) => (
              <div
                key={`node-${i}`}
                className="absolute rounded-full rb-anim"
                style={{
                  left: `${node.left}%`,
                  top: `${node.top}%`,
                  width: `${node.size}px`,
                  height: `${node.size}px`,
                  background: isLightMode
                    ? 'rgba(6, 182, 212, 0.5)'
                    : 'rgba(6, 182, 212, 0.9)',
                  boxShadow: isLightMode
                    ? `0 0 ${node.glow}px rgba(6, 182, 212, 0.3)`
                    : `0 0 ${node.glow + 6}px rgba(6, 182, 212, 0.7)`,
                  animation: `circuit-pulse ${2 + node.delay}s ease-in-out infinite`,
                  animationDelay: `${node.delay}s`,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Frost Grid - Diagonal shifting grid with shimmer effect */}
      {wallpaperId === 'frost-grid' && (
        <div className="pointer-events-none absolute inset-0">
          {/* Animated diagonal grid layer 1 */}
          <div
            className={`absolute inset-0 ${isLightMode ? 'opacity-8' : 'opacity-12'}`}
            style={{
              backgroundImage: isLightMode
                ? `repeating-linear-gradient(45deg, transparent, transparent 40px, rgba(6, 182, 212, 0.25) 40px, rgba(6, 182, 212, 0.25) 41px),
                   repeating-linear-gradient(-45deg, transparent, transparent 40px, rgba(6, 182, 212, 0.25) 40px, rgba(6, 182, 212, 0.25) 41px)`
                : `repeating-linear-gradient(45deg, transparent, transparent 40px, rgba(6, 182, 212, 0.4) 40px, rgba(6, 182, 212, 0.4) 41px),
                   repeating-linear-gradient(-45deg, transparent, transparent 40px, rgba(6, 182, 212, 0.4) 40px, rgba(6, 182, 212, 0.4) 41px)`,
              animation: 'grid-shift-diagonal 30s linear infinite',
            }}
          />

          {/* Shimmer overlay - moves across the grid */}
          <div
            className={`absolute inset-0 ${isLightMode ? 'opacity-10' : 'opacity-20'}`}
            style={{
              background: isLightMode
                ? 'linear-gradient(110deg, transparent 30%, rgba(6, 182, 212, 0.1) 50%, transparent 70%)'
                : 'linear-gradient(110deg, transparent 30%, rgba(6, 182, 212, 0.2) 50%, transparent 70%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer-sweep 8s ease-in-out infinite',
            }}
          />

          {/* Frost particles - small glowing dots */}
          <div className={`absolute inset-0 ${isLightMode ? 'opacity-10' : 'opacity-20'}`}>
            {frostNodes.map((node, i) => (
              <div
                key={`frost-${i}`}
                className="absolute rounded-full rb-anim"
                style={{
                  left: `${node.left}%`,
                  top: `${node.top}%`,
                  width: `${Math.max(1, Math.floor(node.size / 2))}px`,
                  height: `${Math.max(1, Math.floor(node.size / 2))}px`,
                  background: isLightMode
                    ? 'rgba(6, 182, 212, 0.6)'
                    : 'rgba(6, 182, 212, 1)',
                  boxShadow: isLightMode
                    ? `0 0 ${Math.max(6, node.glow - 4)}px rgba(6, 182, 212, 0.4)`
                    : `0 0 ${Math.max(8, node.glow - 2)}px rgba(6, 182, 212, 0.8)`,
                  animation: `frost-twinkle ${1 + node.delay}s ease-in-out infinite`,
                  animationDelay: `${node.delay}s`,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Subtle gradient overlay for default and solid wallpapers */}
      {(wallpaperId === 'default' || wallpaperId === 'solid') && (
        <div className={`pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent ${isLightMode ? 'via-white/5 to-white/10' : 'via-black/5 to-black/20'}`} />
      )}

      {wallpaperId === 'redbyte-field' && (
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute inset-0 rb-anim opacity-40"
            style={{
              backgroundImage:
                'linear-gradient(rgba(56, 189, 248, 0.06) 1px, transparent 1px), ' +
                'linear-gradient(90deg, rgba(56, 189, 248, 0.05) 1px, transparent 1px)',
              backgroundSize: '120px 120px',
              animation: 'rb-field-drift 60s linear infinite',
            }}
          />
          <div
            className="absolute inset-0 rb-anim opacity-30"
            style={{
              backgroundImage:
                'radial-gradient(circle at 20% 30%, rgba(34, 211, 238, 0.12), transparent 35%), ' +
                'radial-gradient(circle at 80% 70%, rgba(59, 130, 246, 0.12), transparent 40%)',
              animation: 'rb-field-scan 40s ease-in-out infinite',
            }}
          />
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 rb-vignette" />
      {icons.map((icon) => {
        const isSelected = selected.includes(icon.id);
        const isFlagship = icon.id === 'logic';
        const iconSize = isFlagship ? 24 : 20;

        return (
          <div
            key={icon.id}
            data-testid={`desktop-icon-${icon.appId}`}
            className="flex flex-col items-center text-xs cursor-pointer select-none transition-colors duration-150"
            style={{
              position: 'absolute',
              left: `${icon.x}px`,
              top: `${icon.y}px`,
              width: `${ICON_CELL_WIDTH}px`,
              height: `${ICON_CELL_HEIGHT}px`,
            }}
            onMouseDown={(e) => onIconMouseDown(e, icon)}
            onClick={() => handleIconClick(icon)}
          >
            <div
              className={`flex items-center justify-center rounded-xl border transition-colors duration-150 backdrop-blur-sm ${isFlagship
                  ? 'border-cyan-400/70 bg-cyan-500/10 shadow-[0_10px_24px_rgba(6,182,212,0.25)]'
                  : isSelected
                    ? isLightMode
                      ? 'border-slate-400/80 bg-white/70'
                      : 'border-cyan-400/60 bg-cyan-500/10'
                    : isLightMode
                      ? 'border-slate-300/50 bg-white/40 hover:border-slate-400/70 hover:bg-white/60'
                      : 'border-white/10 bg-black/20 hover:border-white/20 hover:bg-black/30'
                }`}
              style={{ width: `${ICON_BOX_SIZE}px`, height: `${ICON_BOX_SIZE}px` }}
            >
              <Icon
                name={icon.iconId}
                size={iconSize as 20 | 24}
                className={
                  isFlagship
                    ? 'text-cyan-300'
                    : isLightMode
                      ? 'text-gray-700'
                      : 'text-slate-300'
                }
                aria-label={`${icon.title} icon`}
              />
            </div>
            <div
              className={`w-full text-center text-[11px] font-medium tracking-wide ${isFlagship
                  ? 'text-cyan-300'
                  : isLightMode
                    ? 'text-gray-900'
                    : 'text-slate-300'
                }`}
              style={{ marginTop: ICON_LABEL_GAP, minHeight: ICON_LABEL_HEIGHT }}
            >
              {icon.title}
            </div>
          </div>
        );
      })}

      {selectionBox && (
        <div
          className="absolute border border-cyan-400/70 bg-cyan-400/10"
          style={{
            left: selectionBox.x,
            top: selectionBox.y,
            width: selectionBox.w,
            height: selectionBox.h,
          }}
        />
      )}

      <div className={`absolute bottom-4 right-4 z-10 space-y-1 text-right text-xs drop-shadow pointer-events-none ${isLightMode ? 'text-gray-700' : 'text-white'}`}>
        <div>© 2025 Connor Angiel — RedByte OS Genesis</div>
        <div></div>
      </div>
    </div>
  );
};
