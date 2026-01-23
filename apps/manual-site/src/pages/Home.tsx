import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import GuidedTour from '../components/GuidedTour';
import LogicGatePlayground from '../components/examples/LogicGatePlayground';

// Type workaround for React 19 compatibility
const Link = RouterLink as React.ComponentType<{ to: string; className?: string; children: React.ReactNode }>;

export default function Home() {
  const [showTour, setShowTour] = useState(false);

  return (
    <div className="bg-rb-bg text-rb-text">
      {/* Hero Section */}
      <section className="border-b border-rb-border bg-rb-surface">
        <div className="content-container px-6 py-20 md:py-28 text-center">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-display mb-6 font-bold tracking-tight">
              Design, Simulate, and Grade Digital Logic – <br className="hidden md:block" />
              All in the Browser.
            </h1>
            <p className="text-xl text-rb-muted mb-10 leading-relaxed max-w-2xl mx-auto">
              RedByte is a local-first logic playground that lets you build real-time circuits,
              view waveforms instantly, and explore the principles of digital logic directly in your browser.
            </p>

            <div className="flex flex-col sm:flex-row justify-center gap-4 mb-12">
              <Link to="/manual/playground" className="btn btn-primary text-lg px-8 py-3">
                Open Playground
              </Link>
              <Link to="/docs" className="btn btn-secondary text-lg px-8 py-3">
                Read the Docs
              </Link>
            </div>

            <div className="text-sm text-rb-dim">
              Open source. Local-first. Deterministic execution.
            </div>
          </div>
        </div>
      </section>

      {/* Why RedByte Matters */}
      <section className="py-16 border-b border-rb-border">
        <div className="content-container px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-h2 mb-4">Why RedByte Matters</h2>
            <p className="text-lg text-rb-muted leading-relaxed">
              Traditional logic labs require clunky installed software or fragile hardware setups.
              RedByte runs entirely in the browser with <strong>zero setup</strong>. Students get
              <strong>immediate feedback</strong> through a live oscilloscope, and instructors get
              <strong>reproducible labs</strong> with deterministic grading evidence.
            </p>
          </div>
        </div>
      </section>

      {/* Audience Segments */}
      <section className="py-20 border-b border-rb-border bg-rb-bg-alt">
        <div className="content-container px-6">
          <h2 className="text-h2 text-center mb-12">Who It's For</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <AudienceCard
              title="Students"
              icon="🎓"
              description="Quickly prototype and test logic circuits. Drag-and-drop components, instant wire routing, and a guided 'Start Here' tutorial to master the basics without friction."
              link="/docs#students"
              linkText="Start Learning"
            />
            <AudienceCard
              title="Instructors"
              icon="👩‍🏫"
              description="Provide structured labs and grade automatically. The Evidence Export feature produces a deterministic JSON snapshot of student work, including circuit state and waveforms."
              link="/docs#instructors"
              linkText="Instructor Guide"
            />
            <AudienceCard
              title="Engineers"
              icon="🛠️"
              description="Experiment with custom logic modules. Use the TypeScript API to extend the component library or embed the sandboxed environment into your own documentation."
              link="/docs#developers"
              linkText="View API"
            />
          </div>
        </div>
      </section>

      {/* Core Features */}
      <section className="py-20 border-b border-rb-border">
        <div className="content-container px-6">
          <div className="mb-12 text-center">
            <h2 className="text-h2 mb-4">What Actually Ships</h2>
            <p className="text-rb-muted max-w-2xl mx-auto">
              No future promises or marketing fluff. These features are live in the codebase today.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              title="Component Palette"
              description="Full library of logic gates, flip-flops, multiplexers, and I/O components. Drag and drop directly onto the canvas."
              status="Shipped"
            />
            <FeatureCard
              title="Live Oscilloscope"
              description="Real-time waveform display with probe selection. Sampling is tick-accurate for precise timing analysis."
              status="Shipped"
            />
            <FeatureCard
              title="Start-Here Tutorial"
              description="Integrated first-time user experience with a guided D-Flip-Flop example and step-by-step instructions."
              status="Shipped"
            />
            <FeatureCard
              title="Lab Evidence Export"
              description="One-click generation of a deterministic JSON file containing circuit topology, probe data, and trace metadata."
              status="Shipped"
            />
            <FeatureCard
              title="Keyboard Shortcuts"
              description="Rapidly switch between Schematic, Logic, and Oscilloscope views using the Perspective system (keys 1-3)."
              status="Shipped"
            />
            <FeatureCard
              title="Resilient Loading"
              description="Robust example loading with schema validation. Prevents partial state mutation and provides clear UI feedback."
              status="Shipped"
            />
          </div>
        </div>
      </section>

      {/* Live Demo Preview */}
      <section className="py-20 border-b border-rb-border bg-rb-surface">
        <div className="content-container px-6">
          <div className="mb-8 text-center">
            <h2 className="text-h2 mb-4">Try It Live</h2>
            <p className="text-rb-muted max-w-2xl mx-auto">
              Interact with a running simulation right here. Toggle the inputs and watch the logic update instantly.
            </p>
          </div>
          <div className="bg-rb-bg border border-rb-border rounded-lg p-6 shadow-sm">
            <LogicGatePlayground />
          </div>
          <div className="mt-8 text-center">
            <Link to="/manual/playground" className="btn btn-outline">
              Launch Full Playground
            </Link>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="content-container px-6 text-center">
          <h2 className="text-h2 mb-6">Ready to Build?</h2>
          <Link to="/manual/playground" className="btn btn-primary text-lg px-10 py-4">
            Open RedByte Playground
          </Link>
          <div className="mt-4">
            <button
              onClick={() => setShowTour(true)}
              className="text-rb-accent hover:underline text-sm"
            >
              Replay the OS Tour
            </button>
          </div>
        </div>
      </section>

      {showTour && <GuidedTour onClose={() => setShowTour(false)} />}
    </div>
  );
}

function AudienceCard({ title, description, icon, link, linkText }: { title: string; description: string; icon: string; link: string; linkText: string }) {
  return (
    <div className="bg-rb-surface border border-rb-border rounded-lg p-8 hover:border-rb-accent transition-colors flex flex-col h-full">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-h3 mb-3">{title}</h3>
      <p className="text-rb-muted leading-relaxed mb-6 flex-grow">{description}</p>
      <Link to={link} className="text-rb-accent font-medium hover:underline inline-flex items-center">
        {linkText} &rarr;
      </Link>
    </div>
  );
}

function FeatureCard({ title, description, status }: { title: string; description: string; status: string }) {
  return (
    <div className="bg-rb-bg border border-rb-border rounded-lg p-6">
      <div className="flex justify-between items-start mb-3">
        <h3 className="font-bold text-rb-text text-lg">{title}</h3>
        <span className="text-xs font-bold text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400 px-2 py-1 rounded-full uppercase tracking-wider">
          {status}
        </span>
      </div>
      <p className="text-sm text-rb-muted leading-relaxed">{description}</p>
    </div>
  );
}
