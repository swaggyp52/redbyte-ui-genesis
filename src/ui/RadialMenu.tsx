import React from "react";

export interface RadialItem {
  id: string;
  label: string;
  subtitle?: string;
  icon?: string;
}

interface RadialMenuProps {
  open: boolean;
  x: number;
  y: number;
  items: RadialItem[];
  activeId?: string;
  onSelect: (id: string) => void;
  onRequestClose: () => void;
}

/**
 * RadialMenu
 *
 * A hybrid Minecraft-inspired / RedByte-native radial tool wheel.
 * - Big, friendly slices
 * - Neon halo
 * - Icons + labels
 * - Opens at cursor position
 */
export const RadialMenu: React.FC<RadialMenuProps> = ({
  open,
  x,
  y,
  items,
  activeId,
  onSelect,
  onRequestClose,
}) => {
  if (!open) return null;

  const radius = 80;

  return (
    <div className="fixed inset-0 z-[70] pointer-events-none">
      {/* Backdrop: click anywhere outside to close */}
      <div
        className="absolute inset-0 pointer-events-auto"
        onClick={onRequestClose}
      />

      {/* Center disc */}
      <div
        className="absolute pointer-events-none"
        style={{ left: x, top: y, transform: "translate(-50%, -50%)" }}
      >
        <div className="relative">
          <div className="h-16 w-16 rounded-full bg-slate-950/90 border border-sky-500/60 shadow-[0_0_40px_rgba(56,189,248,0.4)] flex items-center justify-center">
            <div className="h-10 w-10 rounded-full bg-slate-900/90 border border-slate-700/80 flex items-center justify-center text-[0.7rem] font-mono text-sky-300">
              TOOL
            </div>
          </div>
        </div>
      </div>

      {/* Items around the circle */}
      {items.map((item, index) => {
        const angle =
          (2 * Math.PI * index) / Math.max(1, items.length) - Math.PI / 2;
        const tx = Math.cos(angle) * radius;
        const ty = Math.sin(angle) * radius;

        const selected = activeId === item.id;

        return (
          <button
            key={item.id}
            type="button"
            className={`absolute pointer-events-auto rounded-xl border px-2 py-1 text-[0.7rem] flex flex-col items-center justify-center shadow-lg transition-transform duration-100 ${
              selected
                ? "bg-sky-500/20 border-sky-400 text-sky-100 scale-105"
                : "bg-slate-900/95 border-slate-700/80 text-slate-100 hover:border-sky-400/80 hover:bg-slate-900"
            }`}
            style={{
              left: x + tx,
              top: y + ty,
              transform: "translate(-50%, -50%)",
              minWidth: 70,
            }}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(item.id);
            }}
          >
            {item.icon && (
              <span className="text-base leading-none mb-0.5">
                {item.icon}
              </span>
            )}
            <span className="leading-none">{item.label}</span>
            {item.subtitle && (
              <span className="text-[0.6rem] text-slate-400 mt-0.5">
                {item.subtitle}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default RadialMenu;






























