import React from "react"
import { motion } from "framer-motion"

const heroPills = [
  "Personal dev OS",
  "Cloudflare-native",
  "Auto-healing pipeline",
]

const featureCards = [
  {
    tag: "OS LAYER",
    title: "RedByte Desktop",
    description:
      "Windows, dock, launchpad, terminals, dashboards. All rendered as a living OS surface instead of a boring web app.",
  },
  {
    tag: "PIPELINE",
    title: "Push → Ship → Heal",
    description:
      "Git push to main, Cloudflare takes it from there. Supermega scripts keep configs, BOMs, and builds clean.",
  },
  {
    tag: "PLAYGROUND",
    title: "Space for experiments",
    description:
      "Spin up widgets, agents, and tools without breaking prod. Treat the whole OS as your canvas.",
  },
]

const statusBadges = [
  { label: "React 18", value: "✓" },
  { label: "Vite 5", value: "✓" },
  { label: "Tailwind", value: "✓" },
  { label: "Cloudflare Pages", value: "✓" },
]

const glowVariants = {
  initial: { opacity: 0, scale: 0.9 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.9, ease: "easeOut" },
  },
}

const cardVariants = {
  initial: { opacity: 0, y: 24 },
  animate: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: 0.08 * i, ease: "easeOut" },
  }),
}

export default function App() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-50">
      {/* Background glows */}
      <div className="pointer-events-none fixed inset-0">
        <motion.div
          className="absolute -left-32 top-[-10rem] h-80 w-80 rounded-full bg-fuchsia-500/25 blur-3xl"
          {...glowVariants}
        />
        <motion.div
          className="absolute right-[-4rem] top-40 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl"
          {...glowVariants}
          transition={{ ...glowVariants.animate.transition, delay: 0.2 }}
        />
        <motion.div
          className="absolute bottom-[-8rem] left-1/2 h-96 w-[32rem] -translate-x-1/2 rounded-full bg-emerald-500/15 blur-3xl"
          {...glowVariants}
          transition={{ ...glowVariants.animate.transition, delay: 0.3 }}
        />
      </div>

      {/* Top chrome / nav */}
      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-4 pt-6 md:px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-cyan-400 shadow-lg shadow-fuchsia-500/40">
            <span className="text-lg font-black leading-none">R</span>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
              REDBYTE UI
            </span>
            <span className="text-[11px] text-slate-500">
              personal dev OS surface
            </span>
          </div>
        </div>

        <div className="hidden items-center gap-2 text-[11px] text-slate-400 md:flex">
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#22c55e]" />
            LIVE BUILD
          </span>
          <span className="text-slate-500">·</span>
          <span>autoheal + auto-deploy</span>
        </div>
      </header>

      {/* Main layout */}
      <main className="relative mx-auto flex max-w-6xl flex-col gap-10 px-4 pb-14 pt-10 md:flex-row md:px-6 md:pb-20 md:pt-16">
        {/* Left: hero text */}
        <section className="relative z-10 flex flex-1 flex-col gap-6">
          <div className="inline-flex flex-wrap gap-2 text-[11px] text-slate-400">
            {heroPills.map((pill) => (
              <span
                key={pill}
                className="inline-flex items-center gap-1 rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1"
              >
                <span className="h-1 w-1 rounded-full bg-fuchsia-400" />
                {pill}
              </span>
            ))}
          </div>

          <motion.h1
            className="text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl lg:text-5xl"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            Your personal dev OS,
            <span className="block bg-gradient-to-r from-fuchsia-400 via-blue-400 to-cyan-300 bg-clip-text text-transparent">
              running on RedByte UI
            </span>
          </motion.h1>

          <motion.p
            className="max-w-xl text-sm leading-relaxed text-slate-300 md:text-[15px]"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
          >
            This isn&apos;t just a website. It&apos;s your control surface:
            desktop, windows, terminals, and dashboards — all wired into an
            auto-healing pipeline that ships on every push.
          </motion.p>

          {/* CTA row */}
          <motion.div
            className="flex flex-wrap items-center gap-3"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.18, ease: "easeOut" }}
          >
            <a
              href="https://github.com/swaggyp52/redbyte-ui-genesis"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-400 px-4 py-2 text-sm font-medium text-slate-950 shadow-lg shadow-fuchsia-500/40 transition hover:brightness-110"
            >
              Launch RedByte UI /root
              <span className="text-xs opacity-80">↗</span>
            </a>
            <span className="text-xs text-slate-400">
              <span className="font-mono text-emerald-300">git push</span>{" "}
              → Cloudflare Pages → OS online
            </span>
          </motion.div>

          {/* Status strip */}
          <motion.div
            className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-[11px] text-slate-300 shadow-[0_18px_45px_rgba(15,23,42,0.75)]"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
          >
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/90 px-2 py-1 font-semibold uppercase tracking-wide text-[10px] text-slate-400">
              Pipeline
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#22c55e]" />
              healthy
            </span>
            {statusBadges.map((item) => (
              <span
                key={item.label}
                className="inline-flex items-center gap-1 rounded-full bg-slate-900/80 px-2 py-1 text-[10px] text-slate-400"
              >
                <span className="text-[10px] text-emerald-400">{item.value}</span>
                {item.label}
              </span>
            ))}
          </motion.div>
        </section>

        {/* Right: OS preview card */}
        <section className="relative z-10 flex flex-1 items-stretch">
          <motion.div
            className="relative w-full rounded-[28px] border border-slate-800/80 bg-slate-950/80 p-4 shadow-[0_22px_80px_rgba(15,23,42,0.95)] backdrop-blur-xl md:p-5"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.15, ease: "easeOut" }}
          >
            {/* window chrome */}
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
              </div>
              <span className="rounded-full bg-slate-900/80 px-2 py-0.5 text-[10px] text-slate-400">
                redbyte-os · preview
              </span>
            </div>

            {/* faux desktop */}
            <div className="grid gap-3 md:grid-cols-[2fr,1.6fr]">
              <div className="space-y-3">
                <div className="rounded-xl border border-slate-800/80 bg-gradient-to-br from-slate-950/60 via-slate-900/80 to-slate-950/80 p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-200">
                      RedByte OS Desktop
                    </span>
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                      READY
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    windows · dock · launchpad · terminals
                  </p>

                  <div className="mt-3 flex h-20 items-center justify-between rounded-lg border border-slate-800/80 bg-slate-950/70 px-3">
                    <div className="space-y-1 text-[10px] text-slate-400">
                      <div className="flex items-center gap-2">
                        <span className="h-1.5 w-10 rounded-full bg-gradient-to-r from-fuchsia-400 via-sky-400 to-emerald-400" />
                        <span className="text-[10px] text-slate-300">
                          OS Layer
                        </span>
                      </div>
                      <p>Desktop + windows + HUD overlay.</p>
                      <p>Ready to wire into /apps and /agents.</p>
                    </div>
                    <div className="hidden h-14 w-20 items-center justify-center rounded-lg border border-slate-800/80 bg-slate-950/90 text-[9px] text-slate-400 sm:flex">
                      <span className="text-[26px]">⌘</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-[11px]">
                  <div className="space-y-1 rounded-xl border border-slate-800 bg-slate-950/80 p-2.5">
                    <div className="text-[10px] font-semibold text-slate-200">
                      System
                    </div>
                    <ul className="space-y-0.5 text-slate-400">
                      <li>Node · Vite · React</li>
                      <li>Cloudflare Pages</li>
                      <li>Autoheal script: ON</li>
                    </ul>
                  </div>
                  <div className="space-y-1 rounded-xl border border-slate-800 bg-slate-950/80 p-2.5">
                    <div className="text-[10px] font-semibold text-slate-200">
                      Next up
                    </div>
                    <ul className="space-y-0.5 text-slate-400">
                      <li>Wire OS pages</li>
                      <li>Add auth &amp; dashboard</li>
                      <li>Ship v1 workspace</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* right column mini-panels */}
              <div className="space-y-3 text-[11px]">
                <div className="rounded-xl border border-slate-800 bg-slate-950/85 p-2.5">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-slate-300">
                      Command
                    </span>
                    <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[9px] uppercase tracking-wide text-slate-500">
                      Deploy
                    </span>
                  </div>
                  <code className="block rounded-md bg-slate-950 px-2 py-1 text-[10px] font-mono text-emerald-300">
                    git push origin main
                    <span className="text-slate-500"> → deploy.redbyteapps.dev</span>
                  </code>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/85 p-2.5">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-slate-300">
                      Health
                    </span>
                    <span className="text-[10px] text-emerald-400">OK ●</span>
                  </div>
                  <ul className="space-y-0.5 text-slate-400">
                    <li>Build: passing</li>
                    <li>Config: clean</li>
                    <li>Routing: SPA-ready</li>
                  </ul>
                </div>

                <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/60 p-2.5 text-slate-400">
                  <div className="mb-1 text-[10px] font-semibold text-slate-300">
                    Your playground
                  </div>
                  <p>
                    This panel is for whatever you build next: agent console,
                    workspace, or a live OS preview.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </section>
      </main>

      {/* Feature cards row */}
      <section className="relative mx-auto max-w-6xl px-4 pb-10 md:px-6 md:pb-14">
        <div className="grid gap-4 md:grid-cols-3">
          {featureCards.map((card, i) => (
            <motion.div
              key={card.title}
              className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 text-sm text-slate-200 shadow-[0_14px_40px_rgba(15,23,42,0.85)]"
              variants={cardVariants}
              initial="initial"
              animate="animate"
              custom={i}
            >
              <div className="mb-2 inline-flex rounded-full bg-slate-900/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                {card.tag}
              </div>
              <h3 className="mb-1 text-sm font-semibold text-slate-50">
                {card.title}
              </h3>
              <p className="text-xs leading-relaxed text-slate-400">
                {card.description}
              </p>
            </motion.div>
          ))}
        </div>

        <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4 text-[11px] text-slate-500">
          <span>RedByte UI · personal dev OS layer</span>
          <span>React · Vite · Tailwind · Cloudflare Pages · framer-motion</span>
        </footer>
      </section>
    </div>
  )
}
