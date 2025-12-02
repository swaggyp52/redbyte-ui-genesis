@"
import React from "react"

type Feature = {
  title: string
  description: string
  tag: string
}

const features: Feature[] = [
  {
    title: "RedByte OS Desktop",
    description: "Windowed apps, dock, launchpad, and a reactive HUD built with your custom OS components.",
    tag: "OS Layer"
  },
  {
    title: "AI-First Workflows",
    description: "Wire your assistants, terminals, and dashboards into one command surface.",
    tag: "Automation"
  },
  {
    title: "Cloudflare + GitHub Sync",
    description: "Every push deploys a fresh build to your Pages instance — no buttons, no friction.",
    tag: "Deploy"
  },
]

export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black text-slate-50">
      <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col gap-10">
        {/* Top bar */}
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-rose-500 via-purple-500 to-cyan-400 shadow-lg shadow-rose-500/40" />
            <div>
              <div className="text-sm font-semibold tracking-wide text-slate-200">
                RedByte UI
              </div>
              <div className="text-xs text-slate-400">
                Personal OS · Cloud-native
              </div>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-3 text-xs text-slate-400">
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 mr-1" />
            <span>Connected to Cloudflare Pages</span>
          </div>
        </header>

        {/* Hero */}
        <main className="grid gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] items-start">
          {/* Left: text */}
          <section className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-rose-500/40 bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-100">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
              LIVE BUILD · autoheal + auto-deploy
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-slate-50">
                Your personal dev OS,
                <span className="block bg-gradient-to-r from-rose-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
                  running on RedByte UI
                </span>
              </h1>
              <p className="max-w-xl text-sm sm:text-base text-slate-300">
                This is your control surface. Desktop, windows, terminals, and dashboards —
                all backed by an auto-healing pipeline that builds and deploys every push.
              </p>
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap gap-3">
              <a
                href="/"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rose-500/40 hover:bg-rose-400 transition-colors"
              >
                Launch RedByte UI
                <span className="text-xs opacity-80">/root</span>
              </a>
              <a
                href="https://github.com/swaggyp52/redbyte-ui-genesis"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900/60 px-5 py-2.5 text-sm font-medium text-slate-200 hover:border-slate-500 hover:bg-slate-900 transition-colors"
              >
                View source on GitHub
              </a>
            </div>

            {/* Status row */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Pipeline: healthy
              </span>
              <span>React 18 · Vite 5 · Tailwind</span>
              <span className="hidden sm:inline text-slate-500">
                Cloudflare Pages · Git auto-deploy
              </span>
            </div>
          </section>

          {/* Right: glass panel */}
          <aside className="relative">
            <div className="pointer-events-none absolute -inset-8 rounded-[40px] bg-gradient-to-br from-rose-500/10 via-purple-500/5 to-cyan-400/10 blur-3xl" />
            <div className="relative rounded-3xl border border-slate-800/80 bg-slate-900/70 p-5 shadow-2xl shadow-black/60 backdrop-blur-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span>redbyte-os</span>
                </div>
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                  Preview
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/60 px-3 py-2">
                  <div className="flex flex-col">
                    <span className="text-[11px] font-medium text-slate-200">
                      Desktop OS
                    </span>
                    <span className="text-[10px] text-slate-500">
                      windows · dock · launchpad
                    </span>
                  </div>
                  <span className="rounded-lg bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-300">
                    READY
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2.5">
                    <div className="text-[10px] font-semibold text-slate-300 mb-1.5">
                      System
                    </div>
                    <ul className="space-y-0.5 text-[10px] text-slate-400">
                      <li>Node · Vite · React</li>
                      <li>Cloudflare Pages</li>
                      <li>Autoheal script: ON</li>
                    </ul>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2.5">
                    <div className="text-[10px] font-semibold text-slate-300 mb-1.5">
                      Next Up
                    </div>
                    <ul className="space-y-0.5 text-[10px] text-slate-400">
                      <li>Wire OS pages</li>
                      <li>Add auth & dashboard</li>
                      <li>Ship v1 workspace</li>
                    </ul>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2.5 text-[11px] text-slate-300">
                  <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">
                    Command
                  </div>
                  <code className="block font-mono text-[10px] text-emerald-300">
                    git push → deploy.redbyteapps.dev
                  </code>
                </div>
              </div>
            </div>
          </aside>
        </main>

        {/* Feature cards */}
        <section className="grid gap-4 md:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-200"
            >
              <div className="mb-2 inline-flex rounded-full bg-slate-800/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                {f.tag}
              </div>
              <h3 className="mb-1 text-sm font-semibold text-slate-50">
                {f.title}
              </h3>
              <p className="text-xs text-slate-400">{f.description}</p>
            </div>
          ))}
        </section>

        {/* Footer */}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4 text-xs text-slate-500">
          <span>RedByte UI · personal OS surface</span>
          <span>Built with React · Vite · Tailwind · Cloudflare Pages</span>
        </footer>
      </div>
    </div>
  )
}
"@ | Set-Content .\src\App.tsx -Encoding UTF8
