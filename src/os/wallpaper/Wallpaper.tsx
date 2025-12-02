import React, { useEffect, useState } from "react";

const wallpapers = [
  "radial-gradient(circle at top left, rgba(255,0,128,0.35), transparent 60%)",
  "radial-gradient(circle at bottom right, rgba(0,180,255,0.32), transparent 60%)",
  "radial-gradient(circle at center, rgba(120,0,255,0.35), transparent 70%)",
];

export const Wallpaper: React.FC = () => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((n) => (n + 1) % wallpapers.length);
    }, 20000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="absolute inset-0 transition-all duration-[2000ms]"
      style={{
        background: wallpapers[index],
        opacity: 0.12,
      }}
    />
  );
};




























