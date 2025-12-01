import React from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Dashboard from "./pages/dashboard/Dashboard";
import Login from "./pages/auth/Login";
import Pricing from "./pages/pricing/Pricing";
import Assistant from "./pages/assistant/Assistant";
import Marketplace from "./pages/marketplace/Marketplace";

export default function App() {
  return (
    <BrowserRouter basename="/redbyte-ui-genesis">
      <MainNav />
      <div className="pt-20">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/login" element={<Login />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/assistant" element={<Assistant />} />
          <Route path="/marketplace" element={<Marketplace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

function MainNav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/70 backdrop-blur-lg border-b border-neutral-800 px-6 py-4 flex justify-between items-center">
      <Link to="/" className="text-white font-bold text-xl">RedByte</Link>
      <div className="flex gap-6 text-neutral-300 text-sm">
        <Link to="/pricing">Pricing</Link>
        <Link to="/assistant">AI</Link>
        <Link to="/marketplace">Market</Link>
        <Link to="/login" className="bg-red-600 px-4 py-1 rounded-lg text-white">Login</Link>
      </div>
    </nav>
  );
}
