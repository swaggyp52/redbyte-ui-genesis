import React, { useState } from "react";

export interface WindowProps {
  id: string;
  title: string;
  children: React.ReactNode;
  active?: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  onClose?: () => void;
  onFocus?: () => void;
  onPositionChange?: (x: number, y: number) => void;
  onSizeChange?: (width: number, height: number) => void;
}

type DragState =
  | {
      kind: "move";
      startX: number;
      startY: number;
      pointerX: number;
      pointerY: number;
    }
  | {
      kind: "resize";
      startW: number;
      startH: number;
      pointerX: number;
      pointerY: number;
    }
  | null;

export const Window: React.FC<WindowProps> = ({
  id,
  title,
  children,
  active,
  x,
  y,
  width,
  height,
  onClose,
  onFocus,
  onPositionChange,
  onSizeChange,
}) => {
  const [drag, setDrag] = useState<DragState>(null);

  const handleHeaderPointerDown: React.PointerEventHandler<HTMLDivElement> = (
    e
  ) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({
      kind: "move",
      startX: x,
      startY: y,
      pointerX: e.clientX,
      pointerY: e.clientY,
    });
    onFocus?.();
  };

  const handleResizePointerDown: React.PointerEventHandler<HTMLDivElement> = (
    e
  ) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({
      kind: "resize",
      startW: width,
      startH: height,
      pointerX: e.clientX,
      pointerY: e.clientY,
    });
    onFocus?.();
  };

  const handlePointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!drag) return;

    if (drag.kind === "move") {
      const dx = e.clientX - drag.pointerX;
      const dy = e.clientY - drag.pointerY;
      const nextX = drag.startX + dx;
      const nextY = drag.startY + dy;
      onPositionChange?.(nextX, nextY);
    } else if (drag.kind === "resize") {
      const dw = e.clientX - drag.pointerX;
      const dh = e.clientY - drag.pointerY;
      const minW = 280;
      const minH = 180;
      const nextW = Math.max(minW, drag.startW + dw);
      const nextH = Math.max(minH, drag.startH + dh);
      onSizeChange?.(nextW, nextH);
    }
  };

  const handlePointerUp: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!drag) return;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);

    if (drag.kind === "move" && typeof window !== "undefined") {
      const dx = e.clientX - drag.pointerX;
      const dy = e.clientY - drag.pointerY;
      let nextX = drag.startX + dx;
      let nextY = drag.startY + dy;

      const w = window.innerWidth;
      const h = window.innerHeight;

      const nearLeft = nextX < 40;
      const nearRight = nextX + width > w - 40;
      const nearTop = nextY < 40;

      if (nearTop) {
        nextX = 24;
        nextY = 48;
        onPositionChange?.(nextX, nextY);
        onSizeChange?.(w - 48, h - 96);
      } else if (nearLeft) {
        nextX = 24;
        nextY = 72;
        onPositionChange?.(nextX, nextY);
        onSizeChange?.(Math.max(320, w / 2 - 36), h - 120);
      } else if (nearRight) {
        nextX = w / 2;
        nextY = 72;
        onPositionChange?.(nextX, nextY);
        onSizeChange?.(Math.max(320, w / 2 - 36), h - 120);
      } else {
        onPositionChange?.(nextX, nextY);
      }
    }

    setDrag(null);
  };

  return (
    <div
      data-window-id={id}
      className={`rb-glass rounded-2xl shadow-xl border flex flex-col gap-2 ${
        active ? "ring-1 ring-pink-500/70" : "opacity-90"
      }`}
      style={{
        width,
        height,
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div
        className="flex items-center justify-between text-xs text-slate-300 px-3 pt-2 pb-1 cursor-move select-none"
        onPointerDown={handleHeaderPointerDown}
      >
        <div className="flex items-center gap-2">
          <span className="flex gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500/90" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/90" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/90" />
          </span>
          <span className="font-medium truncate max-w-[160px]">{title}</span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="h-5 w-5 rounded-md border border-slate-700 hover:bg-rose-500/80 hover:border-rose-400 transition"
          />
        )}
      </div>
      <div className="px-3 pb-3 pt-1 text-sm text-slate-100 overflow-hidden">
        {children}
      </div>
      <div
        className="absolute bottom-1.5 right-2 h-3 w-3 cursor-nwse-resize"
        onPointerDown={handleResizePointerDown}
      >
        <div className="h-full w-full border-b border-r border-slate-500/70" />
      </div>
    </div>
  );
};


















