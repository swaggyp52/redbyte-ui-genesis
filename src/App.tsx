import React, { useState } from "react";
import { motion } from "framer-motion";
import { Bars3Icon, XMarkIcon, SunIcon, MoonIcon } from "@heroicons/react/24/solid";

type Tab = "overview" | "components" | "playground";

export default function App() {
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  return (
    <div className={dark ? "dark" : ""}>
      <div className="min-h-screen bg-white dark:bg-neutral-950 text-neutral-900 dark:text-white flex flex-col font-sans">
        {/* NAV */}
        <nav className="fixed top-0 left-0 right-0 z-50 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-md border-b border-neutral-300/40 dark:border-neutral-800">
          <div className="container mx-auto py-4 flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-red-500 via-pink-500 to-purple-500" />
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">RedByte UI</h1>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Genesis Build • v2.0</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => setDark(!dark)}
                className="p-2 rounded-xl bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 transition"
                aria-label="Toggle theme"
              >
                {dark ? <SunIcon className="w-5" /> : <MoonIcon className="w-5" />}
              </button>

              <button
                className="sm:hidden"
                onClick={() => setOpen(!open)}
                aria-label="Toggle menu"
              >
                {open ? <XMarkIcon className="w-7" /> : <Bars3Icon className="w-7" />}
              </button>

              <div className="hidden sm:flex gap-8 font-medium text-sm sm:text-base">
                <a href="#features" className="hover:text-red-500">Features</a>
                <a href="#studio" className="hover:text-red-500">UI Studio</a>
                <a href="#contact" className="hover:text-red-500">Contact</a>
              </div>
            </div>
          </div>

          {open && (
            <div className="sm:hidden flex flex-col bg-neutral-100 dark:bg-neutral-900 px-6 py-4 gap-3 text-base border-t border-neutral-300 dark:border-neutral-700">
              <a href="#features" onClick={() => setOpen(false)}>Features</a>
              <a href="#studio" onClick={() => setOpen(false)}>UI Studio</a>
              <a href="#contact" onClick={() => setOpen(false)}>Contact</a>
            </div>
          )}
        </nav>

        {/* HERO */}
        <header className="pt-28 sm:pt-32 pb-20 text-center container mx-auto px-4">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-4xl sm:text-6xl lg:text-7xl font-extrabold bg-gradient-to-r from-red-500 via-pink-500 to-purple-500 bg-clip-text text-transparent leading-tight"
          >
            Ship interfaces
            <span className="block">like a cyber-native studio.</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="text-neutral-600 dark:text-neutral-400 text-base sm:text-xl max-w-3xl mx-auto mt-5"
          >
            RedByte UI is a sleek React + Tailwind design system for demos, dashboards, and
            prototypes that actually feel premium—without spending days on UI.
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-8 flex justify-center gap-3 sm:gap-4 flex-wrap"
          >
            <a
              href="#studio"
              className="px-7 py-3.5 rounded-xl bg-red-600 hover:bg-red-500 text-sm sm:text-base font-semibold transition shadow-lg shadow-red-500/30"
            >
              Launch Live Demo
            </a>
            <a
              href="https://github.com/swaggyp52/redbyte-ui-genesis"
              target="_blank"
              rel="noreferrer"
              className="px-7 py-3.5 rounded-xl border border-neutral-400 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-900 text-sm sm:text-base transition"
            >
              View Source on GitHub
            </a>
          </motion.div>

          {/* Quick stats */}
          <div className="mt-10 grid grid-cols-3 max-w-xl mx-auto gap-4 text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
            <div>
              <p className="font-semibold text-base sm:text-lg text-red-500">30s</p>
              <p>to understand the product</p>
            </div>
            <div>
              <p className="font-semibold text-base sm:text-lg text-red-500">100%</p>
              <p>mobile-ready UI</p>
            </div>
            <div>
              <p className="font-semibold text-base sm:text-lg text-red-500">0</p>
              <p>backend required for demo</p>
            </div>
          </div>
        </header>

        {/* FEATURES */}
        <section id="features" className="container mx-auto py-12 sm:py-16 px-4">
          <h3 className="text-2xl sm:text-3xl font-bold mb-6 text-center">Why RedByte UI?</h3>
          <p className="text-neutral-500 dark:text-neutral-400 max-w-2xl mx-auto text-center mb-10 text-sm sm:text-base">
            This isn&apos;t just a static page. It&apos;s a tiny product you can send to people and say:
            &ldquo;this is the style I&apos;m building with.&rdquo;
          </p>

          <div className="grid sm:grid-cols-3 gap-6">
            <FeatureCard
              title="Product-grade"
              body="Sections, tabs, and layout that feel like a real SaaS landing instead of a starter template."
            />
            <FeatureCard
              title="Mobile native"
              body="Designed and tuned for iPhone Safari. Buttons, spacing, and typography sized for thumbs."
            />
            <FeatureCard
              title="Clone + extend"
              body="Everything is just React + Tailwind. Fork it, drop in APIs, and you have a live product shell."
            />
          </div>
        </section>

        {/* UI STUDIO / TABS */}
        <section id="studio" className="container mx-auto py-16 sm:py-20 px-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h3 className="text-2xl sm:text-3xl font-bold">RedByte UI Studio</h3>
              <p className="text-neutral-500 dark:text-neutral-400 text-sm sm:text-base">
                Switch modes to preview different use-cases inside the same layout.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 text-xs sm:text-sm rounded-full border border-neutral-300 dark:border-neutral-700 px-3 py-1 text-neutral-500 dark:text-neutral-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              Live demo shell
            </span>
          </div>

          {/* Tabs */}
          <div className="inline-flex rounded-full bg-neutral-100 dark:bg-neutral-900 p-1 border border-neutral-200 dark:border-neutral-800 mb-6 text-xs sm:text-sm">
            {[
              { id: "overview", label: "Overview" },
              { id: "components", label: "Component Kit" },
              { id: "playground", label: "Playground" },
            ].map((tab) => (
              <button
                key={tab.id}
                className={
                  "px-4 sm:px-5 py-1.5 rounded-full transition " +
                  (activeTab === tab.id
                    ? "bg-white dark:bg-neutral-800 text-red-500 shadow-sm"
                    : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200")
                }
                onClick={() => setActiveTab(tab.id as Tab)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-6 items-start">
            {/* Left: main preview */}
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/60 p-4 sm:p-6 shadow-sm"
            >
              {activeTab === "overview" && <OverviewPreview />}
              {activeTab === "components" && <ComponentsPreview />}
              {activeTab === "playground" && <PlaygroundPreview />}
            </motion.div>

            {/* Right: metadata */}
            <div className="space-y-4 text-xs sm:text-sm">
              <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/70 p-4">
                <p className="text-neutral-500 dark:text-neutral-400 mb-2 font-semibold text-xs uppercase tracking-wide">
                  Demo context
                </p>
                {activeTab === "overview" && (
                  <p className="text-neutral-500 dark:text-neutral-400">
                    Use this mode when you&apos;re showing RedByte UI as a product landing: what it is,
                    who it&apos;s for, and why it&apos;s fast to use.
                  </p>
                )}
                {activeTab === "components" && (
                  <p className="text-neutral-500 dark:text-neutral-400">
                    This mode shows off atomic pieces: cards, stats, badges, and layout primitives your
                    app can reuse.
                  </p>
                )}
                {activeTab === "playground" && (
                  <p className="text-neutral-500 dark:text-neutral-400">
                    A small interactive feel for motion and hover states—like a micro playground for UI ideas.
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/70 p-4 space-y-1">
                <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                  Tech stack
                </p>
                <p>?? React 18 + Vite 5</p>
                <p>?? Tailwind + custom tokens</p>
                <p>?? Framer Motion micro-interactions</p>
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer
          id="contact"
          className="mt-auto py-10 text-center border-t border-neutral-300 dark:border-neutral-800 px-4 text-xs sm:text-sm text-neutral-500 dark:text-neutral-400"
        >
          <p>© {new Date().getFullYear()} RedByte Interactive. All rights reserved.</p>
          <p className="mt-1">
            Live at{" "}
            <a
              className="underline underline-offset-2 hover:text-red-500"
              href="https://redbyteinteractive.dev"
              target="_blank"
              rel="noreferrer"
            >
              redbyteinteractive.dev
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}

type FeatureCardProps = {
  title: string;
  body: string;
};

function FeatureCard({ title, body }: FeatureCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.35 }}
      className="p-5 sm:p-6 bg-neutral-100 dark:bg-neutral-900 rounded-2xl border border-neutral-300 dark:border-neutral-800 hover:border-red-500/70 hover:-translate-y-1 transition"
    >
      <h4 className="text-lg font-semibold mb-1.5">{title}</h4>
      <p className="text-neutral-600 dark:text-neutral-400 text-sm">{body}</p>
    </motion.div>
  );
}

function OverviewPreview() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
          Overview
        </p>
        <span className="text-xs rounded-full bg-emerald-500/10 text-emerald-400 px-3 py-1">
          Ready to demo
        </span>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <Stat label="Launch time" value="~1 min" />
        <Stat label="Lines of code" value="Small" />
        <Stat label="Vibes" value="High" />
      </div>

      <div className="mt-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-800 p-4">
        <p className="text-xs text-neutral-400 mb-1">demo.tsx</p>
        <pre className="text-xs sm:text-sm text-neutral-100 font-mono overflow-x-auto">
{`<RedByteShell>
  <Hero title="Ship faster" />
  <Tabs views={["Overview", "Components", "Playground"]} />
</RedByteShell>`}
        </pre>
      </div>
    </div>
  );
}

function ComponentsPreview() {
  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
        Component Kit
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 p-4 space-y-2 text-sm">
          <p className="font-semibold">Primitives</p>
          <p className="text-neutral-500 dark:text-neutral-400 text-xs">
            Buttons, badges, stats, cards—ready to drop into any dashboard or marketing site.
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            <Pill label="Button" />
            <Pill label="Badge" />
            <Pill label="Card" />
            <Pill label="Shell" />
          </div>
        </div>
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 p-4 text-sm space-y-2">
          <p className="font-semibold">Layout</p>
          <p className="text-neutral-500 dark:text-neutral-400 text-xs">
            Responsive spacing tuned for mobile first, then scales up to desktop cleanly.
          </p>
          <div className="grid grid-cols-3 gap-1 text-[10px] text-neutral-400 mt-2">
            <span className="rounded-md bg-neutral-200 dark:bg-neutral-800 py-2 text-center">
              Hero
            </span>
            <span className="rounded-md bg-neutral-200 dark:bg-neutral-800 py-2 text-center">
              Features
            </span>
            <span className="rounded-md bg-neutral-200 dark:bg-neutral-800 py-2 text-center">
              Studio
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlaygroundPreview() {
  const [pressed, setPressed] = useState(false);
  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
        Micro Playground
      </p>
      <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
        Tap the button below on mobile to feel the motion. This is what friends will notice instantly.
      </p>
      <motion.button
        whileTap={{ scale: 0.94 }}
        whileHover={{ scale: 1.02 }}
        onClick={() => setPressed(!pressed)}
        className={
          "w-full sm:w-auto px-7 py-3 rounded-xl text-sm sm:text-base font-semibold transition " +
          (pressed
            ? "bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/30"
            : "bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/30")
        }
      >
        {pressed ? "Nice. Do it again." : "Tap to feel the click"}
      </motion.button>
      <p className="text-[11px] sm:text-xs text-neutral-500 dark:text-neutral-500">
        This little interaction sells the entire experience more than a wall of text.
      </p>
    </div>
  );
}

type StatProps = {
  label: string;
  value: string;
};

function Stat({ label, value }: StatProps) {
  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3 sm:p-4 text-left">
      <p className="text-[11px] sm:text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-0.5">
        {label}
      </p>
      <p className="text-base sm:text-lg font-semibold">{value}</p>
    </div>
  );
}

type PillProps = {
  label: string;
};

function Pill({ label }: PillProps) {
  return (
    <span className="text-[11px] px-3 py-1 rounded-full bg-neutral-200/80 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200">
      {label}
    </span>
  );
}
