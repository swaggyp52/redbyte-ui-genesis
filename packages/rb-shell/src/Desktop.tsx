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

  return (
    <div
      ref={desktopRef}
      className="absolute inset-0 text-white overflow-hidden"
      style={{ ...wallpaperStyle }}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseDown={handleDesktopMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Animated wallpaper effects */}
      {wallpaperId === 'neon-circuit' && (
        <div className="absolute inset-0 pointer-events-none">
          {/* Floating glow orbs */}
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/15 rounded-full blur-3xl animate-float-orb" />
          <div className="absolute bottom-1/3 right-1/4 w-[450px] h-[450px] bg-blue-500/15 rounded-full blur-3xl animate-float-orb" style={{ animationDelay: '2s', animationDuration: '12s' }} />
          <div className="absolute top-1/2 right-1/3 w-80 h-80 bg-purple-500/15 rounded-full blur-3xl animate-float-orb" style={{ animationDelay: '4s', animationDuration: '10s' }} />
          {/* Pulsing accent glows */}
          <div className="absolute top-1/3 right-1/2 w-64 h-64 bg-cyan-500/10 rounded-full blur-2xl animate-pulse-glow" />
          <div className="absolute bottom-1/4 left-1/3 w-72 h-72 bg-pink-500/10 rounded-full blur-2xl animate-pulse-glow" style={{ animationDelay: '1.5s' }} />
          {/* Animated grid overlay */}
          <div className="absolute inset-0 animate-grid-pulse" style={{
            backgroundImage: 'linear-gradient(rgba(255, 0, 0, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 135, 255, 0.1) 1px, transparent 1px)',
            backgroundSize: '50px 50px',
          }} />
          {/* Sparkle particles */}
          <div className="absolute top-[15%] left-[30%] w-2 h-2 bg-cyan-400 rounded-full blur-sm animate-sparkle" style={{ animationDelay: '0s' }} />
          <div className="absolute top-[60%] left-[70%] w-1.5 h-1.5 bg-pink-400 rounded-full blur-sm animate-sparkle" style={{ animationDelay: '0.5s' }} />
          <div className="absolute top-[80%] left-[20%] w-2 h-2 bg-blue-400 rounded-full blur-sm animate-sparkle" style={{ animationDelay: '1s' }} />
          <div className="absolute top-[40%] left-[85%] w-1.5 h-1.5 bg-red-400 rounded-full blur-sm animate-sparkle" style={{ animationDelay: '1.5s' }} />
          <div className="absolute top-[25%] left-[50%] w-1 h-1 bg-purple-400 rounded-full blur-sm animate-sparkle" style={{ animationDelay: '2s' }} />
        </div>
      )}
      {wallpaperId === 'default' && (
        <div className="absolute inset-0 pointer-events-none">
          {/* Large animated gradient overlay */}
          <div className="absolute inset-0 opacity-40">
            <div className="absolute w-full h-full bg-gradient-to-br from-red-500/30 via-transparent to-blue-500/30 animate-gradient-shift" />
          </div>
          {/* Floating color orbs */}
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/20 rounded-full blur-3xl animate-float-orb" style={{ animationDuration: '14s' }} />
          <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-blue-500/20 rounded-full blur-3xl animate-float-orb" style={{ animationDelay: '3s', animationDuration: '16s' }} />
          <div className="absolute top-1/2 left-1/2 w-80 h-80 bg-purple-500/15 rounded-full blur-3xl animate-pulse-glow" style={{ animationDuration: '6s' }} />
        </div>
      )}
      {wallpaperId === 'frost-grid' && (
        <div className="absolute inset-0 pointer-events-none">
          {/* Subtle cyan glow orbs */}
          <div className="absolute top-1/3 left-1/4 w-72 h-72 bg-cyan-400/10 rounded-full blur-3xl animate-pulse-glow" style={{ animationDuration: '5s' }} />
          <div className="absolute bottom-1/3 right-1/3 w-80 h-80 bg-blue-400/10 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: '2s', animationDuration: '6s' }} />
          {/* Pulsing grid overlay */}
          <div className="absolute inset-0 animate-grid-pulse" style={{
            backgroundImage: 'linear-gradient(rgba(6, 182, 212, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(6, 182, 212, 0.08) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }} />
        </div>
      )}
      {wallpaperId === 'solid' && (
        <div className="absolute inset-0 pointer-events-none">
          {/* Subtle ambient glow */}
          <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl animate-pulse-glow" style={{ animationDuration: '8s' }} />
          <div className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: '3s', animationDuration: '10s' }} />
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-black/5 to-black/20" />
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
                  ? 'border-cyan-400/80 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 shadow-lg shadow-cyan-500/30'
                  : 'border-white/10 bg-black/30 hover:border-cyan-400/40 hover:bg-black/40'
              } backdrop-blur-sm`}
            >
              <IconComponent
                width={32}
                height={32}
                className={isSelected ? 'text-cyan-300 drop-shadow-[0_0_4px_rgba(6,182,212,0.8)]' : 'text-white'}
              />
            </div>
            <div className={`mt-2 px-2.5 py-1 rounded-md transition-all duration-200 backdrop-blur-sm font-medium ${
              isSelected
                ? 'bg-cyan-500/40 text-white shadow-lg shadow-cyan-500/20'
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

      <div className="absolute bottom-4 right-4 z-10 space-y-1 text-right text-xs text-white drop-shadow pointer-events-none">
        <div>© 2025 Connor Angiel — RedByte OS Genesis</div>
        <div></div>
      </div>
    </div>
  );
};
