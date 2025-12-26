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

const ICON_SIZE = 76;

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
    const base: DesktopIconData[] = [
      { id: 'terminal', title: 'Terminal', appId: 'terminal', iconId: 'terminal', x: 36, y: 32 },
      { id: 'files', title: 'Files', appId: 'files', iconId: 'files', x: 36, y: 128 },
      { id: 'settings', title: 'Settings', appId: 'settings', iconId: 'settings', x: 36, y: 224 },
      { id: 'logic', title: 'Logic Playground', appId: 'logic-playground', iconId: 'logic', x: 36, y: 320 },
      { id: 'app-store', title: 'App Store', appId: 'app-store', iconId: 'neon-wave', x: 36, y: 416 },
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
      {/* Clean wallpapers with no animations - all static */}
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent ${isLightMode ? 'via-white/5 to-white/10' : 'via-black/5 to-black/20'}`} />
      {icons.map((icon) => {
        const IconComponent = iconComponents[icon.iconId] ?? FolderIcon;
        const isSelected = selected.includes(icon.id);
        return (
          <div
            key={icon.id}
            className={`flex flex-col items-center text-xs cursor-pointer select-none transition-all duration-200 ${
              isSelected ? 'scale-110 drop-shadow-[0_0_20px_rgba(6,182,212,0.6)]' : 'hover:scale-105'
            }`}
            style={{ position: 'absolute', left: `${icon.x}px`, top: `${icon.y}px` }}
            onMouseDown={(e) => onIconMouseDown(e, icon)}
            onClick={() => handleIconClick(icon)}
          >
            <div
              className={`flex h-16 w-16 items-center justify-center rounded-xl border transition-all duration-200 ${
                isSelected
                  ? isMidnight
                    ? 'border-indigo-400/80 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 shadow-lg shadow-indigo-500/30'
                    : 'border-cyan-400/80 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 shadow-lg shadow-cyan-500/30'
                  : isLightMode
                    ? 'border-gray-300/50 bg-white/40 hover:border-cyan-400/60 hover:bg-white/60'
                    : isMidnight
                      ? 'border-indigo-500/20 bg-indigo-950/30 hover:border-indigo-400/40 hover:bg-indigo-950/50'
                      : 'border-white/10 bg-black/30 hover:border-cyan-400/40 hover:bg-black/40'
              } backdrop-blur-sm`}
            >
              <IconComponent
                width={32}
                height={32}
                className={isSelected ? isMidnight ? 'text-indigo-300 drop-shadow-[0_0_4px_rgba(99,102,241,0.8)]' : 'text-cyan-600 drop-shadow-[0_0_4px_rgba(6,182,212,0.8)]' : isLightMode ? 'text-gray-700' : isMidnight ? 'text-indigo-200' : 'text-white'}
              />
            </div>
            <div className={`mt-2 px-2.5 py-1 rounded-md transition-all duration-200 backdrop-blur-sm font-medium ${
              isSelected
                ? isMidnight
                  ? 'bg-indigo-500/40 text-white shadow-lg shadow-indigo-500/20'
                  : 'bg-cyan-500/40 text-white shadow-lg shadow-cyan-500/20'
                : isLightMode
                  ? 'bg-white/50 text-gray-900'
                  : isMidnight
                    ? 'bg-indigo-950/40 text-indigo-100'
                    : 'bg-black/30 text-white/90'
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
