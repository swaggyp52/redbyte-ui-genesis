import React from "react";
import { motion } from "framer-motion";
import { AppWindow, Puzzle, Code } from "lucide-react";

export default function Marketplace() {
  const items = [
    { name: "UI Frames", icon: <AppWindow /> },
    { name: "Animations Pack", icon: <Puzzle /> },
    { name: "Code Snippets", icon: <Code /> },
  ];

  return (
    <div className="px-6 py-20 text-white">
      <h1 className="text-4xl font-black mb-10">Marketplace</h1>

      <div className="grid sm:grid-cols-3 gap-6">
        {items.map((x,i)=>(
          <motion.div key={i} whileHover={{scale:1.04}}
            className="p-6 bg-neutral-900 border border-neutral-800 rounded-2xl">
            <div className="text-red-500 mb-3">{x.icon}</div>
            <h2 className="text-xl font-bold">{x.name}</h2>
            <p className="text-neutral-400 text-sm mt-2">Digital assets inside RedByte.</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
