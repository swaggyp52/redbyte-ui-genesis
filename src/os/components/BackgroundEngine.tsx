import React, { useEffect } from "react";
import "./background.css";

const BackgroundEngine: React.FC = () => {
  useEffect(() => {
    const mover = (e: PointerEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      document.documentElement.style.setProperty("--rb-x", x.toString());
      document.documentElement.style.setProperty("--rb-y", y.toString());
    };
    window.addEventListener("pointermove", mover);
    return () => window.removeEventListener("pointermove", mover);
  }, []);

  return (
    <>
      <div id="rb-bg-base" />
      <canvas id="rb-particles"></canvas>
      <div id="rb-neon-grid" />
    </>
  );
};

export default BackgroundEngine;
