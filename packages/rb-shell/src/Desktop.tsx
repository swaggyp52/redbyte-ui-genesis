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
      className="absolute inset-0 text-white"
      style={{ ...wallpaperStyle }}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseDown={handleDesktopMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-black/30" />
      {icons.map((icon) => {
        const IconComponent = iconComponents[icon.iconId] ?? FolderIcon;
        const isSelected = selected.includes(icon.id);
        return (
          <div
            key={icon.id}
            className={`absolute flex flex-col items-center text-xs cursor-pointer select-none transition-transform duration-150 ${
              isSelected ? 'scale-105 drop-shadow-[0_0_12px_rgba(34,211,238,0.5)]' : ''
            }`}
            style={{ left: icon.x, top: icon.y }}
            onMouseDown={(e) => onIconMouseDown(e, icon)}
            onClick={() => handleIconClick(icon)}
          >
            <div
              className={`flex h-16 w-16 items-center justify-center rounded-xl border border-white/10 bg-black/30 backdrop-blur-sm transition-colors ${
                isSelected ? 'border-cyan-400/70 bg-cyan-400/10' : 'hover:border-white/20'
              }`}
            >
              <IconComponent width={32} height={32} />
            </div>
            <div className={`mt-2 px-2 py-1 rounded ${isSelected ? 'bg-cyan-500/30' : 'bg-black/20'}`}>
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
    </div>
  );
};
