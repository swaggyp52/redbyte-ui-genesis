import React from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import Desktop from "./pages/Desktop";

export default function AppRouter() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Desktop />} />
        <Route path="/desktop" element={<Desktop />} />
      </Routes>
    </HashRouter>
  );
}
