import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Overview from "./pages/Overview";
import Playground from "./pages/Playground";
import SystemKit from "./pages/SystemKit";
import HUD from "./pages/HUD";
import Desktop from "./pages/Desktop";
import Login from "./pages/Login";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Redirect to login */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Login */}
        <Route path="/login" element={<Login />} />

        {/* Desktop OS */}
        <Route path="/desktop" element={<Desktop />} />

        {/* Shell apps */}
        <Route path="/overview" element={<Overview />} />
        <Route path="/playground" element={<Playground />} />
        <Route path="/systemkit" element={<SystemKit />} />
        <Route path="/hud" element={<HUD />} />
      </Routes>
    </BrowserRouter>
  );
}
