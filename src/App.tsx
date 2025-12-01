import React, { useState } from "react";
import { motion } from "framer-motion";
import { Menu, X, Rocket, Smartphone, Palette, Cpu, Frame } from "lucide-react";

export default function App() {
  const [menu, setMenu] = useState(false);
  const [mode, setMode] = useState("overview");
  const [dark, setDark] = useState(true);

  return (
    <div className={dark ? "dark" : ""}>
      <div className="min-h-screen bg-white dark:bg-black text-neutral-900 dark:text-white">
        
        {/* NAV */}
        <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-white/50 dark:bg-black/40 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center justify-between px-4 py-4 max-w-6xl mx-auto">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-red-500 to-purple-600 shadow-lg" />
              <h1 className="font-extrabold text-xl tracking-tight">RedByte UI</h1>
            </div>

            <div className="flex items-center gap-3">
              <button onclick={() => setDark(!dark)} className="rounded-xl px-3 py-2 bg-neutral-200 dark:bg-neutral-800">
                {dark ? "??" : "??"}
              </button>

              <button className="sm:hidden" onClick={() => setMenu(!menu)}>
                {menu ? <X size={28}/> : <Menu size={28}/>}
              </button>

              <div className="hidden sm:flex gap-8 text-sm font-semibold">
                <a href="#features" className="hover:text-red-500">Features</a>
                <a href="#studio" className="hover:text-red-500">Studio</a>
                <a href="#showcase" className="hover:text-red-500">Showcase</a>
              </div>
            </div>
          </div>

          {menu && (
            <div className="sm:hidden flex flex-col bg-neutral-100 dark:bg-neutral-900 p-4 gap-4 border-t border-neutral-300 dark:border-neutral-800">
              <a href="#features" onClick={() => setMenu(false)}>Features</a>
              <a href="#studio" onClick={() => setMenu(false)}>Studio</a>
              <a href="#showcase" onClick={() => setMenu(false)}>Showcase</a>
            </div>
          )}
        </nav>

        {/* HERO */}
        <header className="pt-32 pb-20 text-center px-6 max-w-5xl mx-auto">
          <motion.h2
            initial={{opacity:0, y:20}}
            animate={{opacity:1, y:0}}
            transition={{duration:.6}}
            className="text-5xl sm:text-7xl font-black bg-gradient-to-r from-red-500 via-pink-500 to-purple-500 bg-clip-text text-transparent"
          >
            Next-Gen Interface Engine
          </motion.h2>

          <motion.p
            initial={{opacity:0}}
            animate={{opacity:1}}
            transition={{delay:.3}}
            className="text-neutral-600 dark:text-neutral-400 text-lg max-w-2xl mx-auto mt-5"
          >
            A live-demo React & Tailwind UI shell designed to impress instantly. 
            Mobile-perfect. Super responsive. Cyber-styled.
          </motion.p>

          <motion.div
            initial={{opacity:0}}
            animate={{opacity:1}}
            transition={{delay:.6}}
            className="mt-8 flex justify-center gap-4 flex-wrap"
          >
            <a href="#studio" className="px-8 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold">
              Launch UI Studio
            </a>
            <a href="https://github.com/swaggyp52/redbyte-ui-genesis" target="_blank"
              className="px-8 py-3 rounded-xl border border-neutral-500 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800">
              GitHub Source
            </a>
          </motion.div>
        </header>

        {/* QUICK FEATURES */}
        <section id="features" className="px-6 max-w-6xl mx-auto py-16 grid sm:grid-cols-3 gap-6">
          <Card icon={<Rocket/>} title="Fast as hell" body="Optimized Vite + React stack, 1s reload, zero lag motion."/>
          <Card icon={<Smartphone/>} title="Mobile Native" body="Designed directly around iPhone Safari layouts."/>
          <Card icon={<Palette/>} title="Customizable" body="Brand tokens, gradients, motion, spacing, all editable."/>
        </section>

        {/* STUDIO */}
        <section id="studio" className="px-6 max-w-6xl mx-auto py-20">
          <h3 className="text-3xl font-bold mb-6">UI Studio</h3>

          {/* Mode Selector */}
          <div className="inline-flex p-1 bg-neutral-200 dark:bg-neutral-800 rounded-full mb-6">
            {["overview", "components", "playground"].map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={
                  "px-6 py-2 rounded-full text-sm " +
                  (mode === m
                    ? "bg-white dark:bg-neutral-700 text-red-500 shadow"
                    : "text-neutral-500 hover:text-neutral-300")
                }
              >
                {m.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Dynamic View */}
          <motion.div
            key={mode}
            initial={{opacity:0, y:10}}
            animate={{opacity:1, y:0}}
            className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 p-8"
          >
            {mode === "overview" && <Overview/>}
            {mode === "components" && <Kit/>}
            {mode === "playground" && <Play/>}
          </motion.div>
        </section>

        {/* FOOTER */}
        <footer className="py-10 text-center text-neutral-500 text-sm border-t border-neutral-300 dark:border-neutral-800">
          © {new Date().getFullYear()} RedByte Interactive. All rights reserved.
        </footer>
      </div>
    </div>
  );
}

function Card({ icon, title, body }) {
  return (
    <div className="rounded-2xl p-6 border border-neutral-300 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900">
      <div className="mb-3 text-red-500">{icon}</div>
      <h4 className="font-bold text-lg">{title}</h4>
      <p className="text-neutral-600 dark:text-neutral-400 text-sm mt-1">{body}</p>
    </div>
  );
}

function Overview() {
  return (
    <div className="space-y-4">
      <h4 className="font-bold text-xl mb-2 flex items-center gap-2"><Cpu/> System Overview</h4>
      <p className="text-neutral-400 text-sm">
        This shell behaves like a real SaaS product, optimized for mobile and desktop previews.
      </p>
    </div>
  );
}

function Kit() {
  return (
    <div className="space-y-4">
      <h4 className="font-bold text-xl mb-2 flex items-center gap-2"><Frame/> Component Kit</h4>
      <p className="text-neutral-400 text-sm">RedByte primitives ready for implementation.</p>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="p-3 rounded-xl bg-neutral-800">Button</div>
        <div className="p-3 rounded-xl bg-neutral-800">Badge</div>
        <div className="p-3 rounded-xl bg-neutral-800">Card</div>
      </div>
    </div>
  );
}

function Play() {
  return (
    <motion.button
      whileHover={{scale:1.05}}
      whileTap={{scale:.90}}
      className="px-8 py-4 bg-red-600 rounded-xl shadow text-white"
    >
      Feel the Motion
    </motion.button>
  );
}
