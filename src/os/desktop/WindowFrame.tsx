import React, { useState, useRef, useEffect } from "react";
import { LayoutMode } from "../context/SettingsContext";

interface Props {
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
  isActive: boolean;
  layoutMode: LayoutMode;
  gridSize: number;
  onFocus: () => void;
  onClose: () => void;
  onMinimize: () => void;
  onChange: (patch: Partial<{ x: number; y: number; width: number; height: number }>) => void;
  children: React.ReactNode;
}

const WindowFrame: React.FC<Props> = ({
  title, x, y, width, height, z, isActive,
  layoutMode, gridSize,
  onFocus, onClose, onMinimize, onChange,
  children
}) => {

  const dragging = useRef(false);
  const resizing = useRef(false);
  const last = useRef({ mx: 0, my: 0 });

  const minLeft = 65;
  const minTop = 32;
  const minWidth = 260;
  const minHeight = 160;

  const snapDist = 24;
  const edgeMagnet = 22;

  const applySnap = (v: number) =>
    layoutMode === "smart" ? Math.round(v / gridSize) * gridSize : v;

  const onMouseDownTitle = (e: React.MouseEvent) => {
    dragging.current = true;
    last.current = { mx: e.clientX, my: e.clientY };
    onFocus();
    e.stopPropagation();
  };

  const onMouseDownResizer = (e: React.MouseEvent) => {
    resizing.current = true;
    last.current = { mx: e.clientX, my: e.clientY };
    onFocus();
    e.stopPropagation();
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current && !resizing.current) return;

      const dx = e.clientX - last.current.mx;
      const dy = e.clientY - last.current.my;
      last.current = { mx: e.clientX, my: e.clientY };

      if (dragging.current) {
        let nx = x + dx;
        let ny = y + dy;

        if (Math.abs(nx - minLeft) < edgeMagnet) nx = minLeft;
        if (Math.abs(ny - minTop) < edgeMagnet) ny = minTop;

        if (layoutMode === "smart") {
          if (Math.abs(nx % gridSize) < snapDist) nx = applySnap(nx);
          if (Math.abs(ny % gridSize) < snapDist) ny = applySnap(ny);
        }

        onChange({ x: nx, y: ny });
      }

      if (resizing.current) {
        let nw = width + dx;
        let nh = height + dy;

        if (nw < minWidth) nw = minWidth;
        if (nh < minHeight) nh = minHeight;

        if (layoutMode === "smart") {
          if (Math.abs(nw % gridSize) < snapDist) nw = applySnap(nw);
          if (Math.abs(nh % gridSize) < snapDist) nh = applySnap(nh);
        }

        onChange({ width: nw, height: nh });
      }
    };

    const onUp = () => {
      dragging.current = false;
      resizing.current = false;
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [x, y, width, height, layoutMode, gridSize]);

  return (
    <div
      style={{
        position: "absolute",
        left: x, top: y, width, height, zIndex: z,
        transition: dragging.current || resizing.current ? "none" : "0.1s ease-out"
      }}
      className={`rounded-xl border border-red-900/70 bg-black/70 backdrop-blur-md shadow-xl overflow-hidden ${
        isActive ? "ring-1 ring-red-400/70" : ""
      }`}
      onMouseDown={(e) => { onFocus(); e.stopPropagation(); }}
    >
      <div
        onMouseDown={onMouseDownTitle}
        className="h-8 bg-red-950/60 border-b border-red-900/70 flex items-center justify-between px-3 text-xs cursor-move"
      >
        <span className="text-red-200">{title}</span>

        <div className="flex gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onMinimize(); }}
            className="text-red-300 hover:text-red-100"
          >
            —
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="text-red-300 hover:text-red-100"
          >
            ?
          </button>
        </div>
      </div>

      <div className="w-full h-[calc(100%-2rem)] overflow-hidden">
        {children}
      </div>

      <div
        onMouseDown={onMouseDownResizer}
        className="absolute bottom-0 right-0 w-4 h-4 bg-red-900/40 cursor-se-resize"
      />
    </div>
  );
};

export default WindowFrame;
