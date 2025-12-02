import React from "react";
import UniverseOrb from "./os/boot/UniverseOrb";
import AppRouter from "./Router"; // or your main Desktop/Login router
import "./global.css";

export default function App() {
  return (
    <div className="relative w-full h-full overflow-hidden bg-black">

      {/* Background void storm */}
      <div className="fixed inset-0 -z-50 pointer-events-none opacity-[0.7]">
        <UniverseOrb progress={1} />
      </div>

      {/* Foreground OS */}
      <div className="relative z-10 h-full w-full">
        <AppRouter />
      </div>

    </div>
  );
}














