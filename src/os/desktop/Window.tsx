import React, { useRef, useState } from "react";
import { WindowInstance, useSystem } from "../core/SystemProvider";
import { getAppComponent } from "../core/appRegistry";

interface WindowProps {
  window: WindowInstance;
}

export function Window({ window: win }: WindowProps) {
  const {
    closeWindow,
    focusWindow,
    moveWindow,
    resizeWindow,
    applySnap,
    minimizeWindow,
    toggleMaximizeWindow,
  } = useSystem();

  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState<null | string>(null);
  const dragOffset = useRef<{ x: number; y: number } | null>(null);

  const AppComponent = getAppComponent(win.appId);

  // ---------------------------
  // DRAGGING
  // ---------------------------
  const onMouseDownHeader = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (target && target.closest("button")) {
      // Don't start drag when clicking window controls
      return;
    }

    e.stopPropagation();
    focusWindow(win.id);
    dragOffset.current = {
      x: e.clientX - win.x,
      y: e.clientY - win.y,
    };
    setDragging(true);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (dragging && dragOffset.current && !win.isMaximized) {
      const nx = e.clientX - dragOffset.current.x;
      const ny = e.clientY - dragOffset.current.y;

      moveWindow(win.id, nx, ny);

      const viewportWidth = globalThis?.innerWidth ?? 0;

      if (ny < 10) {
        applySnap(win.id, "top");
      } else if (nx < 10) {
        applySnap(win.id, "left");
      } else if (viewportWidth && e.clientX > viewportWidth - 10) {
        applySnap(win.id, "right");
      } else {
        applySnap(win.id, "none");
      }
    }

    if (resizing) handleResize(e);
  };

  const onMouseUp = () => {
    setDragging(false);
    setResizing(null);
    dragOffset.current = null;
  };

  // ---------------------------
  // RESIZING (bottom-right corner)
  // ---------------------------
  const startResize = (edge: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    focusWindow(win.id);
    setResizing(edge);
  };

  const handleResize = (e: React.MouseEvent) => {
    if (!resizing || win.isMaximized) return;

    const minW = 240;
    const minH = 180;

    let newWidth = win.width;
    let newHeight = win.height;

    if (resizing.includes("right")) {
      newWidth = Math.max(minW, e.clientX - win.x);
    }

    if (resizing.includes("bottom")) {
      newHeight = Math.max(minH, e.clientY - win.y);
    }

    resizeWindow(win.id, { width: newWidth, height: newHeight });
  };

  // ---------------------------
  // STYLE (snap + maximize)
  // ---------------------------
  let style: React.CSSProperties = {
    zIndex: win.z,
    position: "absolute",
  };

  if (win.isMaximized) {
    style = {
      ...style,
      left: 0,
      top: 0,
      width: "100%",
      height: "100%",
    };
  } else if (win.snap === "left") {
    style = {
      ...style,
      left: 0,
      top: 0,
      width: "50%",
      height: "100%",
    };
  } else if (win.snap === "right") {
    style = {
      ...style,
      right: 0,
      top: 0,
      width: "50%",
      height: "100%",
    };
  } else if (win.snap === "top") {
    style = {
      ...style,
      left: 0,
      top: 0,
      width: "100%",
      height: "100%",
    };
  } else {
    style = {
      ...style,
      left: win.x,
      top: win.y,
      width: win.width,
      height: win.height,
    };
  }

  return (
    <div
      style={style}
      className={`flex flex-col rounded-2xl border ${
        win.isActive
          ? "border-pink-500/70 shadow-xl shadow-pink-500/30"
          : "border-slate-700/80 shadow-md shadow-black/40"
      } bg-slate-950/80 backdrop-blur-xl overflow-hidden`}
      onMouseDown={() => focusWindow(win.id)}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      {/* WINDOW HEADER */}
      <div
        className="flex items-center justify-between px-3 py-1.5 border-b border-slate-800/80 cursor-move select-none bg-slate-900/80"
        onMouseDown={onMouseDownHeader}
      >
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <button
              aria-label="Close"
              className="h-2.5 w-2.5 rounded-full bg-rose-500 hover:bg-rose-400"
              onClick={(e) => {
                e.stopPropagation();
                closeWindow(win.id);
              }}
            />
            <button
              aria-label="Minimize"
              className="h-2.5 w-2.5 rounded-full bg-amber-400 hover:bg-amber-300"
              onClick={(e) => {
                e.stopPropagation();
                minimizeWindow(win.id);
              }}
            />
            <button
              aria-label="Maximize"
              className="h-2.5 w-2.5 rounded-full bg-emerald-400 hover:bg-emerald-300"
              onClick={(e) => {
                e.stopPropagation();
                toggleMaximizeWindow(win.id);
              }}
            />
          </div>
          <span className="text-xs text-slate-200 truncate max-w-[12rem]">
            {win.title}
          </span>
        </div>
        <span className="text-[0.6rem] text-slate-500 uppercase">
          {win.appId}
        </span>
      </div>

      {/* CONTENT */}
      <div className="flex-1 bg-slate-950/70 p-3 text-xs overflow-auto">
        <AppComponent />
      </div>

      {/* RESIZE HANDLE */}
      {!win.isMaximized && (
        <div
          className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize"
          onMouseDown={startResize("bottom-right")}
        />
      )}
    </div>
  );
}





















