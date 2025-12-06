import { useState } from "react";

export function useWindowControls(initial) {
  const [pos, setPos] = useState({ x: initial.x, y: initial.y });
  const [size, setSize] = useState({ w: initial.w, h: initial.h });
  const [drag, setDrag] = useState(null);
  const [resize, setResize] = useState(null);

  const startDrag = (e) => {
    e.stopPropagation();
    setDrag({ ox: e.clientX - pos.x, oy: e.clientY - pos.y });
  };

  const startResize = (e) => {
    e.stopPropagation();
    setResize({ ox: e.clientX, oy: e.clientY, w0: size.w, h0: size.h });
  };

  const move = (e) => {
    if (drag) {
      setPos({ x: e.clientX - drag.ox, y: e.clientY - drag.oy });
    }
    if (resize) {
      setSize({
        w: Math.max(240, resize.w0 + (e.clientX - resize.ox)),
        h: Math.max(160, resize.h0 + (e.clientY - resize.oy))
      });
    }
  };

  const end = () => {
    setDrag(null);
    setResize(null);
  };

  const snapLeft = () => {
    setPos({ x: 0, y: 0 });
    setSize({ w: window.innerWidth / 2, h: window.innerHeight });
  };

  const snapRight = () => {
    setPos({ x: window.innerWidth / 2, y: 0 });
    setSize({ w: window.innerWidth / 2, h: window.innerHeight });
  };

  const maximize = () => {
    setPos({ x: 0, y: 0 });
    setSize({ w: window.innerWidth, h: window.innerHeight });
  };

  return {
    pos, size,
    startDrag, startResize,
    move, end,
    snapLeft, snapRight, maximize
  };
}
