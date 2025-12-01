import React from "react";
import { motion } from "framer-motion";
import { Home, Grid, Cpu, PanelTop } from "lucide-react";
import { Link } from "react-router-dom";
import clsx from "clsx";

export default function LayoutV4({ children }) {
  return (
    <div className="min-h-screen bg-black text-white relative pb-20 md:pb-0">
      {/* TOP BAR */}
      <motion.div
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="fixed top-0 left-0 w-full bg-black/60 backdrop-blur-xl border-b border-white/10 z-50 py-3 px-6 flex justify-between"
      >
        <h1 className="text-xl font-bold tracking-wide">RedByte OS v4</h1>
      </motion.div>

      {/* PAGE CONTENT */}
      <div className="pt-20 px-6">{children}</div>

      {/* MOBILE NAV */}
      <div className="fixed bottom-0 left-0 w-full bg-black/70 backdrop-blur-xl border-t border-white/10 flex md:hidden justify-around py-3">
        <NavLink icon={<Home size={22} />} label="Home" to="/" />
        <NavLink icon={<Grid size={22} />} label="Play" to="/playground" />
        <NavLink icon={<Cpu size={22} />} label="System" to="/systemkit" />
        <NavLink icon={<PanelTop size={22} />} label="HUD" to="/hud" />
      </div>
    </div>
  );
}

function NavLink({ icon, label, to }) {
  return (
    <Link to={to} className="flex flex-col items-center text-gray-400 hover:text-white transition">
      {icon}
      <span className="text-xs mt-1">{label}</span>
    </Link>
  );
}

