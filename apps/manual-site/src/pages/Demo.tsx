import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import GuidedTour from '../components/GuidedTour';
import { mvpFacts } from '../content/mvpFacts';
import LogicGatePlayground from '../components/examples/LogicGatePlayground';

const Link = RouterLink as React.ComponentType<{ to: string; className?: string; children: React.ReactNode }>;

export default function Demo() {
  const [showTour, setShowTour] = useState(false);

  return (
    <div className="py-16 bg-rb-bg">
      <div className="content-container px-6">
        <div className="max-w-4xl">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-h1 text-rb-text mb-4">For Educators</h1>
            <p className="text-lg text-rb-muted leading-relaxed">
              A quick overview of RedByte as a digital logic teaching platform.
            </p>
          </div>

          {/* 60-Second Overview */}
          <section className="mb-16">
            <h2 className="text-h2 text-rb-text mb-6">60-Second Overview</h2>
            <div className="bg-rb-surface border border-rb-border rounded-md p-6 space-y-4">
              <p className="text-rb-text leading-relaxed">
                <strong>RedByte</strong> is a browser-based environment for teaching digital logic.
                Students build circuits visually, simulate them deterministically (step forward/backward
                through time), and debug with an oscilloscope view. No installation required - runs
                entirely in the browser with no backend or cloud dependency.
              </p>
              <p className="text-rb-muted leading-relaxed">
                The platform includes a Lab Workbench for structured assignments and a Submission
                Inspector for reviewing student work. Students export .rb-lab.zip {mvpFacts.bundleSchemaVersion} bundles with
                manifest, trace, and integrity capsule; the Inspector runs checks and exports a grading
                report. All data stays local - no accounts, no telemetry.
              </p>
              <p className="text-rb-muted leading-relaxed">
                <strong className="text-rb-text">Key differentiator:</strong> Full determinism.
                Every simulation run is perfectly reproducible, making debugging and grading
                straightforward.
              </p>
              <button
                type="button"
                onClick={() => setShowTour(true)}
                className="mt-2 btn btn-primary"
              >
                Start Guided Tour
              </button>
              <a href="#demo-playground" className="mt-2 btn btn-secondary">
                Start Demo
              </a>
            </div>
          </section>

          {/* Interactive Demo */}
          <section id="demo-playground" className="mb-16">
            <h2 className="text-h2 text-rb-text mb-4">Interactive demo</h2>
            <p className="text-rb-muted mb-6">
              Use the live logic playground to show deterministic behavior in seconds.
            </p>
            <div className="bg-rb-surface border border-rb-border rounded-md p-6">
              <LogicGatePlayground />
            </div>
            <div className="mt-4 bg-rb-raised border border-rb-border rounded-md p-4">
              <div className="text-sm font-semibold text-rb-text mb-2">Try this now</div>
              <ul className="text-sm text-rb-muted space-y-1.5">
                <li className="flex gap-2"><span className="text-rb-accent">-</span>Toggle inputs and watch outputs update instantly.</li>
                <li className="flex gap-2"><span className="text-rb-accent">-</span>Switch gate types to show how truth tables change.</li>
                <li className="flex gap-2"><span className="text-rb-accent">-</span>Point out that identical inputs always yield identical outputs.</li>
              </ul>
            </div>
          </section>

          {/* Demo Scenes */}
          <section className="mb-16">
            <h2 className="text-h2 text-rb-text mb-6">What to Show</h2>
            <div className="grid md:grid-cols-3 gap-4">
              <DemoSceneCard
                number={1}
                title="Logic Playground"
                items={[
                  'Add gates from palette',
                  'Wire components together',
                  'Run simulation (Space)',
                  'Step through time (arrows)',
                ]}
              />
              <DemoSceneCard
                number={2}
                title="Oscilloscope"
                items={[
                  'Probe any wire',
                  'See waveforms over time',
                  'Scrub timeline',
                  'Debug timing issues',
                ]}
              />
              <DemoSceneCard
                number={3}
                title="Lab Workbench"
                items={[
                  'Structured assignments',
                  'Built-in validation',
                  'Export submissions',
                  'Inspector for grading',
                ]}
              />
            </div>
          </section>

          {/* Implementation Status - HONEST */}
          <section className="mb-16">
            <h2 className="text-h2 text-rb-text mb-6">Implementation Status</h2>
            <p className="text-rb-muted mb-6">
              RedByte is under active development. Here's an honest assessment of what works today
              versus what's planned.
            </p>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Working Now */}
              <div className="bg-rb-surface border border-rb-border rounded-md overflow-hidden">
                <div className="px-5 py-4 bg-rb-raised border-b border-rb-border">
                  <h3 className="text-base font-semibold text-rb-accent flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 0a8 8 0 100 16A8 8 0 008 0zm3.78 5.28l-5 6a.75.75 0 01-1.06.06l-2.5-2.25a.75.75 0 111-1.12l1.94 1.75 4.5-5.38a.75.75 0 111.12.94z" />
                    </svg>
                    Working Now
                  </h3>
                </div>
                <ul className="p-5 space-y-2.5 text-sm">
                  <StatusItem status="done">Desktop shell with windowing</StatusItem>
                  <StatusItem status="done">Logic designer (add/remove gates, manage state)</StatusItem>
                  <StatusItem status="done">Deterministic tick-based simulation</StatusItem>
                  <StatusItem status="done">Oscilloscope infrastructure</StatusItem>
                  <StatusItem status="done">Learning context with progress tracking</StatusItem>
                  <StatusItem status="done">File explorer and terminal</StatusItem>
                  <StatusItem status="done">Keyboard shortcuts (Ctrl+K, etc.)</StatusItem>
                  <StatusItem status="done">Settings and preferences</StatusItem>
                  <StatusItem status="done">RB Zip v2 export (manifest, trace, integrity capsule)</StatusItem>
                  <StatusItem status="done">Submission Inspector checks and grading report export</StatusItem>
                  <StatusItem status="done">Lab template checks (baseline)</StatusItem>
                </ul>
              </div>

              {/* In Progress / Planned */}
              <div className="bg-rb-surface border border-rb-border rounded-md overflow-hidden">
                <div className="px-5 py-4 bg-rb-raised border-b border-rb-border">
                  <h3 className="text-base font-semibold text-rb-muted flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 0a8 8 0 100 16A8 8 0 008 0zm3.5 9h-7a.5.5 0 010-1h7a.5.5 0 010 1z" />
                    </svg>
                    In Progress / Planned
                  </h3>
                </div>
                <ul className="p-5 space-y-2.5 text-sm">
                  <StatusItem status="wip">Visual canvas editor (table UI exists, canvas pending)</StatusItem>
                  <StatusItem status="wip">Oscilloscope visualization polish</StatusItem>
                  <StatusItem status="planned">Hierarchical chips (reusable components)</StatusItem>
                  <StatusItem status="planned">HDL export (Verilog/VHDL)</StatusItem>
                  <StatusItem status="planned">Gradebook integration</StatusItem>
                </ul>
              </div>
            </div>
          </section>

          {/* Course Integration */}
          <section className="mb-16">
            <h2 className="text-h2 text-rb-text mb-6">Course Integration Ideas</h2>
            <div className="bg-rb-surface border border-rb-border rounded-md p-6">
              <p className="text-rb-text mb-6">
                A suggested 12-week integration for a digital logic course:
              </p>

              <div className="space-y-4">
                <CourseWeek
                  weeks="1-4"
                  title="Combinational Logic"
                  description="Students build basic gates, truth tables, multiplexers. Lab assignments with auto-validation."
                />
                <CourseWeek
                  weeks="5-8"
                  title="Sequential Logic"
                  description="Registers, counters, state machines. Debug timing with the oscilloscope, step through states."
                />
                <CourseWeek
                  weeks="9-12"
                  title="Projects"
                  description="Build adders, ALUs, simple CPUs. Create custom chips for reuse. Optional hardware deployment."
                />
              </div>

              <div className="mt-6 pt-6 border-t border-rb-border">
                <h4 className="text-sm font-semibold text-rb-text mb-2">Instructor Benefits</h4>
                <ul className="text-sm text-rb-muted space-y-1.5">
                  <li>- No VM setup or license costs - runs on any platform with a browser</li>
                  <li>- Students submit .rb-lab.zip bundles for consistent grading</li>
                  <li>- Deterministic simulation means reproducible test cases</li>
                  <li>- Submission Inspector for viewing student circuits and results</li>
                  <li>- Inspector checks and grading report export for assessment</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Quick Reference */}
          <section className="mb-16">
            <h2 className="text-h2 text-rb-text mb-6">Keyboard-First UX</h2>
            <p className="text-rb-muted mb-4">
              RedByte is designed for efficiency. Key shortcuts for your demo:
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-rb-surface border border-rb-border rounded-md p-4">
                <h4 className="text-sm font-semibold text-rb-text mb-3">Navigation</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-rb-muted">Command Palette</span>
                    <kbd>Ctrl+K</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-rb-muted">Close Window</span>
                    <kbd>Ctrl+W</kbd>
                  </div>
                </div>
              </div>
              <div className="bg-rb-surface border border-rb-border rounded-md p-4">
                <h4 className="text-sm font-semibold text-rb-text mb-3">Simulation</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-rb-muted">Play/Pause</span>
                    <kbd>Space</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-rb-muted">Step Forward/Back</span>
                    <kbd>{'->'} / {'<-'}</kbd>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Links */}
          <section>
            <h2 className="text-h2 text-rb-text mb-6">Try It</h2>
            <div className="flex flex-wrap gap-4">
              <Link to="/examples" className="btn btn-primary">
                Interactive Examples
              </Link>
              <Link to="/getting-started" className="btn btn-secondary">
                Getting Started Guide
              </Link>
              <Link to="/manual" className="btn btn-secondary">
                Full Manual
              </Link>
            </div>
          </section>

        </div>
      </div>

      {showTour && <GuidedTour onClose={() => setShowTour(false)} />}
    </div>
  );
}

function DemoSceneCard({ number, title, items }: { number: number; title: string; items: string[] }) {
  return (
    <div className="bg-rb-surface border border-rb-border rounded-md p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-7 h-7 rounded-full bg-rb-accent text-rb-bg font-bold text-sm flex items-center justify-center">
          {number}
        </div>
        <h3 className="font-semibold text-rb-text">{title}</h3>
      </div>
      <ul className="space-y-1.5 text-sm text-rb-muted">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="text-rb-dim">-</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatusItem({ status, children }: { status: 'done' | 'wip' | 'planned'; children: React.ReactNode }) {
  const styles = {
    done: { icon: 'OK', color: 'text-rb-accent' },
    wip: { icon: 'WIP', color: 'text-rb-info' },
    planned: { icon: 'TBD', color: 'text-rb-dim' },
  };

  const { icon, color } = styles[status];

  return (
    <li className="flex items-start gap-2">
      <span className={`${color} mt-0.5`}>{icon}</span>
      <span className={status === 'planned' ? 'text-rb-dim' : 'text-rb-muted'}>{children}</span>
    </li>
  );
}

function CourseWeek({ weeks, title, description }: { weeks: string; title: string; description: string }) {
  return (
    <div>
      <div className="flex items-baseline gap-3 mb-1">
        <span className="text-xs font-mono text-rb-dim">Week {weeks}</span>
        <h4 className="text-sm font-semibold text-rb-text">{title}</h4>
      </div>
      <p className="text-sm text-rb-muted pl-16">{description}</p>
    </div>
  );
}
