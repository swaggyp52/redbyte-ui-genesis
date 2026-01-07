// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ThemeVariant, WallpaperId } from '@redbyte/rb-utils';
import {
  TerminalIcon,
  SettingsIcon,
  FolderIcon,
  FilesIcon,
  LogicIcon,
  NeonWaveIcon,
  CpuIcon,
  ChipIcon,
  PowerButtonIcon,
} from '@redbyte/rb-icons';
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
  iconId: string;
  x: number;
  y: number;
}

const ICON_SIZE = 80;
const GRID_SPACING = 120;
const GRID_START_X = 48;
const GRID_START_Y = 48;

const iconComponents: Record<string, React.FC<React.SVGProps<SVGSVGElement>>> = {
  terminal: TerminalIcon,
  settings: SettingsIcon,
  files: FilesIcon,
  logic: LogicIcon,
  folder: FolderIcon,
  'neon-wave': NeonWaveIcon,
  cpu: CpuIcon,
  chip: ChipIcon,
  'power-button': PowerButtonIcon,
};

export const Desktop: React.FC<DesktopProps> = ({ onOpenApp, wallpaperId, themeVariant }) => {
  const [icons, setIcons] = useState<DesktopIconData[]>(() => {
    // Grid-aligned icons with Logic Playground featured
    const base: DesktopIconData[] = [
      { id: 'logic', title: 'Logic Playground', appId: 'logic-playground', iconId: 'logic', x: GRID_START_X, y: GRID_START_Y },
      { id: 'files', title: 'Files', appId: 'files', iconId: 'files', x: GRID_START_X, y: GRID_START_Y + GRID_SPACING },
      { id: 'settings', title: 'Settings', appId: 'settings', iconId: 'settings', x: GRID_START_X, y: GRID_START_Y + GRID_SPACING * 2 },
      { id: 'terminal', title: 'Terminal', appId: 'terminal', iconId: 'terminal', x: GRID_START_X, y: GRID_START_Y + GRID_SPACING * 3 },
    ];
    return base;
  });
  const [selected, setSelected] = useState<string[]>([]);
  const [selectionBox, setSelectionBox] = useState<null | { x: number; y: number; w: number; h: number }>(null);
  const selectionStart = useRef<{ x: number; y: number } | null>(null);
  const dragging = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const desktopRef = useRef<HTMLDivElement>(null);

  const wallpaperStyle = useMemo(() => getWallpaperStyle(wallpaperId, themeVariant), [wallpaperId, themeVariant]);

  useEffect(() => {
    desktopRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!selectionBox) return;
    const rectIntersect = (icon: DesktopIconData) => {
      const rect = { x: icon.x, y: icon.y, w: ICON_SIZE, h: ICON_SIZE + 20 };
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

  const isLightMode = themeVariant === 'light';
  const isMidnight = themeVariant === 'midnight';

  return (
    <div
      ref={desktopRef}
      className={`absolute inset-0 overflow-hidden ${isLightMode ? 'text-gray-900' : 'text-white'}`}
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
                    : isMidnight
                      ? 'linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.6), transparent)'
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
                    : isMidnight
                      ? 'linear-gradient(180deg, transparent, rgba(139, 92, 246, 0.6), transparent)'
                      : 'linear-gradient(180deg, transparent, rgba(6, 182, 212, 0.6), transparent)',
                  animation: `circuit-flow-v ${6 + i}s linear infinite`,
                  animationDelay: `${i * 0.3}s`,
                }}
              />
            ))}
          </div>

          {/* Circuit nodes - pulsing dots at intersections */}
          <div className={`absolute inset-0 ${isLightMode ? 'opacity-20' : 'opacity-30'}`}>
            {[...Array(15)].map((_, i) => (
              <div
                key={`node-${i}`}
                className="absolute rounded-full"
                style={{
                  left: `${Math.random() * 90 + 5}%`,
                  top: `${Math.random() * 90 + 5}%`,
                  width: Math.random() * 8 + 4 + 'px',
                  height: Math.random() * 8 + 4 + 'px',
                  background: isLightMode
                    ? 'rgba(6, 182, 212, 0.5)'
                    : isMidnight
                      ? 'rgba(139, 92, 246, 0.9)'
                      : 'rgba(6, 182, 212, 0.9)',
                  boxShadow: isLightMode
                    ? '0 0 12px rgba(6, 182, 212, 0.3)'
                    : isMidnight
                      ? '0 0 20px rgba(139, 92, 246, 0.7)'
                      : '0 0 20px rgba(6, 182, 212, 0.7)',
                  animation: `circuit-pulse ${2 + Math.random() * 3}s ease-in-out infinite`,
                  animationDelay: `${Math.random() * 2}s`,
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
                : isMidnight
                  ? `repeating-linear-gradient(45deg, transparent, transparent 40px, rgba(139, 92, 246, 0.4) 40px, rgba(139, 92, 246, 0.4) 41px),
                     repeating-linear-gradient(-45deg, transparent, transparent 40px, rgba(139, 92, 246, 0.4) 40px, rgba(139, 92, 246, 0.4) 41px)`
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
                : isMidnight
                  ? 'linear-gradient(110deg, transparent 30%, rgba(139, 92, 246, 0.2) 50%, transparent 70%)'
                  : 'linear-gradient(110deg, transparent 30%, rgba(6, 182, 212, 0.2) 50%, transparent 70%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer-sweep 8s ease-in-out infinite',
            }}
          />

          {/* Frost particles - small glowing dots */}
          <div className={`absolute inset-0 ${isLightMode ? 'opacity-10' : 'opacity-20'}`}>
            {[...Array(30)].map((_, i) => (
              <div
                key={`frost-${i}`}
                className="absolute rounded-full"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  width: Math.random() * 3 + 1 + 'px',
                  height: Math.random() * 3 + 1 + 'px',
                  background: isLightMode
                    ? 'rgba(6, 182, 212, 0.6)'
                    : isMidnight
                      ? 'rgba(139, 92, 246, 1)'
                      : 'rgba(6, 182, 212, 1)',
                  boxShadow: isLightMode
                    ? '0 0 8px rgba(6, 182, 212, 0.4)'
                    : isMidnight
                      ? '0 0 10px rgba(139, 92, 246, 0.8)'
                      : '0 0 10px rgba(6, 182, 212, 0.8)',
                  animation: `frost-twinkle ${1 + Math.random() * 2}s ease-in-out infinite`,
                  animationDelay: `${Math.random() * 3}s`,
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
      {icons.map((icon) => {
        const IconComponent = iconComponents[icon.iconId] ?? FolderIcon;
        const isSelected = selected.includes(icon.id);
        const isFlagship = icon.id === 'logic'; // Logic Playground is the flagship

        return (
          <div
            key={icon.id}
            className={`flex flex-col items-center text-xs cursor-pointer select-none transition-all duration-150 ${
              isSelected ? 'scale-105' : 'hover:scale-102'
            }`}
            style={{ position: 'absolute', left: `${icon.x}px`, top: `${icon.y}px` }}
            onMouseDown={(e) => onIconMouseDown(e, icon)}
            onClick={() => handleIconClick(icon)}
          >
          <div
            className={`flex items-center justify-center rounded-lg border transition-all duration-150 ${
              isFlagship
                ? 'h-20 w-20 border-cyan-500/60 bg-cyan-500/10 hover:bg-cyan-500/20 hover:border-cyan-400 shadow-lg shadow-cyan-500/20'
                : isSelected
                  ? isLightMode
                    ? 'h-16 w-16 border-gray-400/80 bg-white/60'
                    : 'h-16 w-16 border-cyan-400/60 bg-cyan-500/10'
                  : isLightMode
                    ? 'h-16 w-16 border-gray-300/40 bg-white/30 hover:border-gray-400/60 hover:bg-white/50'
                    : 'h-16 w-16 border-white/10 bg-black/20 hover:border-white/20 hover:bg-black/30'
            } backdrop-blur-sm`}
          >
            <IconComponent
              width={isFlagship ? 40 : 28}
              height={isFlagship ? 40 : 28}
              className={
                isFlagship
                  ? 'text-cyan-400'
                  : isLightMode
                    ? 'text-gray-700'
                    : 'text-slate-300'
              }
            />
          </div>
            <div className={`mt-2 px-2.5 py-1 rounded-md text-center backdrop-blur-sm font-medium ${
              isFlagship
                ? 'text-cyan-400 font-semibold'
                : isLightMode
                  ? 'text-gray-900'
                  : 'text-slate-300'
            }`}>
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
