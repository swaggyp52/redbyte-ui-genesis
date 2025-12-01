import React, { useEffect } from "react";
import "./background.css";

export default function BackgroundEngine() {
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 20;
      const y = (e.clientY / window.innerHeight - 0.5) * 20;
      document.documentElement.style.setProperty("--bg-x", `${x}px`);
      document.documentElement.style.setProperty("--bg-y", `${y}px`);
    };
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, []);

  return <div className="rb-bg-engine" />;
}

