import React, { useState, useRef } from "react";
import { X } from "lucide-react";

export default function Window({ title, children, onClose }) {
  const windowRef = useRef(null);
  const [pos, setPos] = useState({ x: 200, y: 120 });

  const onDrag = (e) => {
    setPos({
      x: e.clientX - 150,
      y: e.clientY - 20,
    });
  };

  return (
    <div
      ref={windowRef}
      className="absolute bg-black/70 backdrop-blur-xl border border-white/10 rounded-xl shadow-xl w-96"
      style={{ left: pos.x, top: pos.y }}
    >
      {/* TITLE BAR */}
      <div
        className="flex justify-between items-center px-4 py-2 bg-white/10 cursor-move"
        onMouseDown={(e) => {
          document.onmousemove = onDrag;
          document.onmouseup = () => (document.onmousemove = null);
        }}
      >
        <span className="font-semibold">{title.toUpperCase()}</span>
        <button onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      {/* CONTENT */}
      <div className="p-4">{children}</div>
    </div>
  );
}

