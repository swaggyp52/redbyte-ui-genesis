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
  isMaximized?: boolean;
  onClose?: () => void;
  onFocus?: () => void;
  onPositionChange?: (x: number, y: number) => void;
  onSizeChange?: (width: number, height: number) => void;
  onMaximize?: () => void;
  onRestore?: () => void;
}

type SnapZone = "top" | "left" | "right" | null;

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
  isMaximized,
  onClose,
  onFocus,
  onPositionChange,
  onSizeChange,
  onMaximize,
  onRestore,
}) => {
  const [drag, setDrag] = useState<DragState>(null);
  const [snapZone, setSnapZone] = useState<SnapZone>(null);

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

      // Update snap zone preview
      if (typeof window !== "undefined") {
        const w = window.innerWidth;
        const snapThreshold = 40;

        if (e.clientY < snapThreshold) {
          setSnapZone("top");
        } else if (e.clientX < snapThreshold) {
          setSnapZone("left");
        } else if (e.clientX > w - snapThreshold) {
          setSnapZone("right");
        } else {
          setSnapZone(null);
        }
      }
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
      const w = window.innerWidth;
      const h = window.innerHeight;
      const snapThreshold = 40;

      // Apply snap based on detected zone
      if (e.clientY < snapThreshold && onMaximize) {
        // Top snap = Maximize
        onMaximize();
      } else if (e.clientX < snapThreshold) {
        // Left snap = Half-screen left
        onPositionChange?.(24, 72);
        onSizeChange?.(Math.max(320, w / 2 - 36), h - 120);
      } else if (e.clientX > w - snapThreshold) {
        // Right snap = Half-screen right
        onPositionChange?.(w / 2, 72);
        onSizeChange?.(Math.max(320, w / 2 - 36), h - 120);
      } else {
        // No snap, just move
        const dx = e.clientX - drag.pointerX;
        const dy = e.clientY - drag.pointerY;
        const nextX = drag.startX + dx;
        const nextY = drag.startY + dy;
        onPositionChange?.(nextX, nextY);
      }
    }

    setSnapZone(null);
    setDrag(null);
  };

  // Render snap zone overlay
  const renderSnapZoneOverlay = () => {
    if (!snapZone || typeof window === "undefined") return null;

    const w = window.innerWidth;
    const h = window.innerHeight;

    let overlayStyle: React.CSSProperties = {};

    if (snapZone === "top") {
      overlayStyle = {
        left: 24,
        top: 48,
        width: w - 48,
        height: h - 96,
      };
    } else if (snapZone === "left") {
      overlayStyle = {
        left: 24,
        top: 72,
        width: Math.max(320, w / 2 - 36),
        height: h - 120,
      };
    } else if (snapZone === "right") {
      overlayStyle = {
        left: w / 2,
        top: 72,
        width: Math.max(320, w / 2 - 36),
        height: h - 120,
      };
    }

    return (
      <div
        className="fixed pointer-events-none border-2 border-pink-500/60 bg-pink-500/10 rounded-xl transition-all duration-150 z-[9999]"
        style={overlayStyle}
      />
    );
  };

  return (
    <>
      {renderSnapZoneOverlay()}
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
    </>
  );
};




































