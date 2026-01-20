import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import GuidedTour from '../components/GuidedTour';
import LogicGatePlayground from '../components/examples/LogicGatePlayground';

// Type workaround for React 19 compatibility
const Link = RouterLink as React.ComponentType<{ to: string; className?: string; children: React.ReactNode }>;

export default function Home() {
  const [showTour, setShowTour] = useState(false);

  return (
    <div className="bg-rb-bg">
      {/* Hero Section */}
      <section className="border-b border-rb-border">
        <div className="content-container px-6 py-20 md:py-28">
          <div className="max-w-2xl">
            <h1 className="text-display text-rb-text mb-6">
              RedByte OS: a local FPGA + analog lab for digital logic.
            </h1>
            <p className="text-lg text-rb-muted mb-6 leading-relaxed">
              RedByte is a local-first lab OS for digital logic and FPGA courses that produces deterministic,
              replayable evidence bundles for grading.
            </p>
            <div className="bg-rb-surface border border-rb-border rounded-md p-4 mb-8">
              <div className="text-xs uppercase tracking-wide text-rb-dim mb-2">Hardware Kit</div>
              <ul className="text-sm text-rb-muted space-y-1">
                <li>Basys 3 (Artix-7), USB cable</li>
                <li>LM358 comparators, LDR sensors</li>
                <li>Breadboard, jump wires, basic resistors</li>
              </ul>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link to="/examples" className="btn btn-primary">
                Try Demo
              </Link>
              <Link to="/install" className="btn btn-secondary">
                Install OS
              </Link>
            </div>

            <p className="text-sm text-rb-dim mt-6">
              Open-source, local-first, and deterministic. Works on Windows, macOS, and Linux.
            </p>
            <button
              type="button"
              onClick={() => setShowTour(true)}
              className="mt-3 text-sm text-rb-muted hover:text-rb-text underline"
            >
              Take a tour of the OS
            </button>
          </div>
        </div>
      </section>

      {/* 60-Second Overview */}
      <section className="py-16 border-b border-rb-border">
        <div className="content-container px-6">
          <div className="max-w-3xl">
            <h2 className="text-h1 text-rb-text mb-4">In 60 seconds</h2>
            <p className="text-rb-muted mb-6">
              What RedByte delivers for modern digital logic labs:
            </p>
            <ul className="grid gap-3 md:grid-cols-2 text-rb-muted">
              <li className="flex gap-2">
                <span className="text-rb-accent">-</span>
                <span>Deterministic tick-based simulation and replay.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-rb-accent">-</span>
                <span>SIM mode for hardware-free labs plus Basys 3 programming via the FPGA Bridge.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-rb-accent">-</span>
                <span>RB Zip v2 bundles with manifest, trace, integrity capsule, and signature status.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-rb-accent">-</span>
                <span>Submission Inspector checks and grading report export.</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 border-b border-rb-border">
        <div className="content-container px-6">
          <div className="mb-12">
            <h2 className="text-h1 text-rb-text mb-4">Core Features</h2>
            <p className="text-rb-muted max-w-xl">
              Everything you need to understand how digital circuits work, from basic gates to complex state machines.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            <FeatureCard
              title="Deterministic Simulation"
              description="Every run is reproducible. Step through ticks to debug timing. Same inputs always yield the same outputs."
              tag="Core"
            />
            <FeatureCard
              title="Visual Circuit Design"
              description="Build circuits with gates, wires, and components. OS-style desktop interface with windows and a command palette."
              tag="Core"
            />
            <FeatureCard
              title="Oscilloscope View"
              description="Probe signals and watch waveforms. See exactly when signals change and debug timing issues visually."
              tag="Core"
            />
            <FeatureCard
              title="Analog Lab Models"
              description="LM358 comparators, LDRs, voltage dividers, and references built into the simulator for mixed-signal labs."
              tag="Analog"
            />
            <FeatureCard
              title="FPGA Toolchain"
              description="Export synthesizable Verilog + XDC, then program Basys 3 boards via the FPGA Bridge using Vivado batch mode."
              tag="FPGA"
            />
            <FeatureCard
              title="Lab Workbench"
              description="Structured labs with presets for learning. Work through assignments step-by-step with built-in validation."
              tag="Education"
            />
            <FeatureCard
              title="Export & Inspect"
              description="Export circuits, debug bundles, and project archives for instructor review and LMS submission."
              tag="Education"
            />
          </div>
        </div>
      </section>

      {/* Live Demo */}
      <section className="py-20 border-b border-rb-border">
        <div className="content-container px-6">
          <div className="mb-8">
            <h2 className="text-h1 text-rb-text mb-4">Live Demo</h2>
            <p className="text-rb-muted max-w-2xl">
              A read-only example of the simulation engine. Try toggling inputs to see deterministic
              logic behavior, then jump into the full playground for the complete OS experience.
            </p>
          </div>
          <div className="bg-rb-surface border border-rb-border rounded-md p-6">
            <LogicGatePlayground />
          </div>
          <div className="mt-4 text-sm text-rb-muted">
            Want the full OS? <Link to="/install" className="text-rb-info underline">Install locally</Link>.
          </div>
        </div>
      </section>

      {/* How Labs Work */}
      <section className="py-20 border-b border-rb-border">
        <div className="content-container px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-h1 text-rb-text mb-4 text-center">How Labs Work</h2>
            <p className="text-rb-muted text-center mb-12 max-w-xl mx-auto">
              Build, run, export evidence, then grade with deterministic replay.
            </p>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <WorkflowStep
                number={1}
                title="Build"
                description="Create the circuit or lab assignment inside the OS using the palette, editor, and shortcuts."
              />
              <WorkflowStep
                number={2}
                title="Run (SIM or Hardware)"
                description="Use SIM mode for fast validation or connect Basys 3 hardware for live UART telemetry."
              />
              <WorkflowStep
                number={3}
                title="Export .rb-lab.zip"
                description="Bundle manifest, trace, and integrity capsule into a deterministic submission zip."
              />
              <WorkflowStep
                number={4}
                title="Grade in Inspector"
                description="Replay deterministically, run checks, and export a grading report."
              />
            </div>
          </div>
        </div>
      </section>

      {/* Screenshots Section */}
      <section className="py-20 border-b border-rb-border">
        <div className="content-container px-6">
          <h2 className="text-h1 text-rb-text mb-4">See It In Action</h2>
          <p className="text-rb-muted mb-10 max-w-xl">
            A desktop-style interface with windows, a launcher, and multiple tools working together.
          </p>

          <div className="grid md:grid-cols-2 gap-4">
            <ScreenshotPlaceholder
              label="Desktop & Launcher"
              description="OS-style desktop with app windows and quick launcher"
            />
            <ScreenshotPlaceholder
              label="Logic Playground"
              description="Visual circuit editor with gates and simulation controls"
            />
            <ScreenshotPlaceholder
              label="Oscilloscope"
              description="Real-time waveform viewer for debugging signals"
            />
            <ScreenshotPlaceholder
              label="Lab Workbench"
              description="Structured assignments with step-by-step guidance"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="download" className="py-20">
        <div className="content-container px-6">
          <div className="bg-rb-surface border border-rb-border rounded-lg p-10 md:p-14 text-center">
            <h2 className="text-h1 text-rb-text mb-4">Install RedByte OS</h2>
            <p className="text-rb-muted mb-8 max-w-lg mx-auto">
              Use the pinned bootstrap flow for deterministic setup on lab machines.
            </p>
            <div className="max-w-xl mx-auto text-left mb-8">
              <CodeBlock
                code={`powershell -NoProfile -ExecutionPolicy Bypass -Command \"git clone https://github.com/swaggyp52/redbyte-ui-genesis.git; cd redbyte-ui-genesis; .\\\\scripts\\\\bootstrap.ps1\"`}
              />
              <p className="text-xs text-rb-dim mt-3">
                SIM mode works without Vivado. Install Vivado 2024.1 only for hardware programming.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-4">
              <Link to="/install" className="btn btn-primary">
                Install OS
              </Link>
              <a href="https://github.com/swaggyp52/redbyte-ui-genesis" className="btn btn-secondary">
                Open GitHub Repo
              </a>
            </div>
          </div>
        </div>
      </section>

      {showTour && <GuidedTour onClose={() => setShowTour(false)} />}
    </div>
  );
}

function FeatureCard({ title, description, tag }: { title: string; description: string; tag: string }) {
  return (
    <div className="bg-rb-surface border border-rb-border rounded-md p-6 hover:border-rb-border-strong transition-colors">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-medium text-rb-dim uppercase tracking-wider">{tag}</span>
      </div>
      <h3 className="text-h3 text-rb-text mb-2">{title}</h3>
      <p className="text-sm text-rb-muted leading-relaxed">{description}</p>
    </div>
  );
}

function WorkflowStep({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="text-center">
      <div className="w-10 h-10 rounded-full bg-rb-accent text-rb-bg font-bold flex items-center justify-center mx-auto mb-4">
        {number}
      </div>
      <h3 className="text-h3 text-rb-text mb-2">{title}</h3>
      <p className="text-sm text-rb-muted leading-relaxed">{description}</p>
    </div>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="bg-rb-raised border border-rb-border rounded-md p-4 overflow-x-auto">
      <code className="text-sm text-rb-text font-mono">{code}</code>
    </pre>
  );
}

function ScreenshotPlaceholder({ label, description }: { label: string; description: string }) {
  return (
    <div className="bg-rb-surface border border-rb-border rounded-md overflow-hidden">
      <div className="aspect-video bg-rb-raised flex items-center justify-center">
        <div className="text-center p-6">
          <div className="w-12 h-12 rounded bg-rb-border mx-auto mb-3 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-rb-dim">
              <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
              <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
              <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-sm font-medium text-rb-muted">{label}</p>
        </div>
      </div>
      <div className="p-4 border-t border-rb-border">
        <p className="text-xs text-rb-dim">{description}</p>
      </div>
    </div>
  );
}
