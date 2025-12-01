import React from "react";
import { motion } from "framer-motion";
import { AppWindow, Puzzle, Code } from "lucide-react";

const items = [
  {
    name: "UI Frames",
    icon: <AppWindow size={18} />,
    tag: "Layout pack",
  },
  {
    name: "Animations Pack",
    icon: <Puzzle size={18} />,
    tag: "Motion presets",
  },
  {
    name: "Code Snippets",
    icon: <Code size={18} />,
    tag: "Dev shortcuts",
  },
];

export default function Marketplace() {
  return (
    <div className="px-4 sm:px-8 py-10 max-w-5xl mx-auto text-white">
      <h1 className="text-3xl sm:text-4xl font-black mb-2">Marketplace</h1>
      <p className="text-xs sm:text-sm text-neutral-400 mb-8 max-w-xl">
        A fake but beautiful marketplace surface to show how RedByte would feel
        as a real SaaS: plug apps, effects and integrations right into the
        design system.
      </p>

      <div className="grid sm:grid-cols-3 gap-4">
        {items.map((x, i) => (
          <motion.div
            key={x.name}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            whileHover={{ scale: 1.04, translateY: -2 }}
            className="p-5 rounded-2xl border border-neutral-800 bg-neutral-950/80 cursor-pointer"
          >
            <div className="flex items-center gap-2 mb-2 text-sm font-semibold">
              <span className="text-red-500">{x.icon}</span>
              <span>{x.name}</span>
            </div>
            <div className="text-[11px] text-neutral-400 mb-3">{x.tag}</div>
            <div className="text-[10px] text-neutral-500 uppercase tracking-[0.18em]">
              Coming soon
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

