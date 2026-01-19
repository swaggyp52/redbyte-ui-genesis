import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import GuidedTour from '../components/GuidedTour';

const Link = RouterLink as any;

export default function Demo() {
  const [showTour, setShowTour] = useState(false);

  return (
    <div className="py-16 bg-rb-bg">
      <div className="content-container px-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-4xl font-bold mb-4 text-rb-text">Professor Demo</h1>
            <p className="text-lg text-rb-muted leading-relaxed">
              A 60-second overview of RedByte as a digital logic teaching platform.
            </p>
          </div>

          {/* 60-Second Overview */}
          <section className="mb-16">
            <h2 className="text-2xl font-bold mb-6 text-rb-text">Overview</h2>
            <div className="bg-rb-surface border border-rb-border rounded-lg p-6 space-y-4">
              <p className="text-rb-text leading-relaxed">
                <strong>RedByte</strong> is a deterministic digital logic simulator and FPGA development environment 
                designed for education. It runs entirely in the browser—no installation, no backend, no cloud dependency.
              </p>
              <p className="text-rb-muted leading-relaxed">
                Students build circuits visually, simulate them deterministically (step forward/backward through time), 
                and export to Verilog for real hardware. The platform includes a Lab Workbench for assignments, 
                automatic grading, and submission inspection.
              </p>
              <p className="text-rb-muted leading-relaxed">
                <strong className="text-rb-text">Key differentiator:</strong> Full determinism means every simulation is 
                reproducible. Perfect for teaching, debugging, and automated testing.
              </p>
              <button
                onClick={() => setShowTour(true)}
                className="mt-4 px-6 py-2 bg-rb-accent text-rb-bg font-medium rounded hover:bg-rb-accent-dim transition-colors"
              >
                Start Guided Tour
              </button>
            </div>
          </section>

          {/* Demo Scenes */}
          <section className="mb-16">
            <h2 className="text-2xl font-bold mb-6 text-rb-text">Demo Scenes</h2>
            <div className="grid md:grid-cols-3 gap-6">
              <DemoSceneCard
                number={1}
                title="Logic Playground"
                description="Visual circuit editor, simulation controls, real-time debugging"
                link="/examples"
                linkText="Try Examples"
              />
              <DemoSceneCard
                number={2}
                title="Lab Workbench"
                description="Student assignments, self-check tools, export for grading"
                link="/getting-started"
                linkText="See Workflow"
              />
              <DemoSceneCard
                number={3}
                title="Submission Inspector"
                description="Instructor tool for viewing student submissions and grades"
                link="/manual"
                linkText="Read Manual"
              />
            </div>
          </section>

          {/* Implementation Status */}
          <section className="mb-16">
            <h2 className="text-2xl font-bold mb-6 text-rb-text">Implementation Status</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Implemented */}
              <div className="bg-rb-surface border border-rb-border rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4 text-rb-accent">✓ Implemented Now</h3>
                <ul className="space-y-2 text-sm text-rb-muted">
                  <li className="flex items-start gap-2">
                    <span className="text-rb-accent mt-0.5">✓</span>
                    <span>Visual circuit editor with gates, wires, chips</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-rb-accent mt-0.5">✓</span>
                    <span>Deterministic simulation engine (forward/backward)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-rb-accent mt-0.5">✓</span>
                    <span>Real-time oscilloscope with signal probing</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-rb-accent mt-0.5">✓</span>
                    <span>Custom chip library system</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-rb-accent mt-0.5">✓</span>
                    <span>Lab Workbench (student assignments)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-rb-accent mt-0.5">✓</span>
                    <span>Automatic grading with test vectors</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-rb-accent mt-0.5">✓</span>
                    <span>Submission Inspector (instructor tool)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-rb-accent mt-0.5">✓</span>
                    <span>Export to Verilog/VHDL</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-rb-accent mt-0.5">✓</span>
                    <span>Keyboard-driven workflow</span>
                  </li>
                </ul>
              </div>

              {/* Roadmap */}
              <div className="bg-rb-surface border border-rb-border rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4 text-rb-text">→ Next</h3>
                <ul className="space-y-2 text-sm text-rb-muted">
                  <li className="flex items-start gap-2">
                    <span className="text-rb-muted mt-0.5">→</span>
                    <span>Hardware Bridge (upload to FPGA)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-rb-muted mt-0.5">→</span>
                    <span>Advanced waveform analysis tools</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-rb-muted mt-0.5">→</span>
                    <span>Collaborative design features</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-rb-muted mt-0.5">→</span>
                    <span>Lab template library</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-rb-muted mt-0.5">→</span>
                    <span>Gradebook integration</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Course Integration */}
          <section className="mb-16">
            <h2 className="text-2xl font-bold mb-6 text-rb-text">Course Integration</h2>
            <div className="bg-rb-surface border border-rb-border rounded-lg p-6 space-y-4">
              <p className="text-rb-text leading-relaxed">
                <strong>How RedByte fits a digital logic course:</strong>
              </p>
              
              <div className="space-y-3 text-rb-muted">
                <div>
                  <strong className="text-rb-text">Week 1-4: Combinational Logic</strong>
                  <p className="text-sm mt-1">Students build basic gates, truth tables, multiplexers. Lab assignments use the Lab Workbench with auto-grading.</p>
                </div>
                
                <div>
                  <strong className="text-rb-text">Week 5-8: Sequential Logic</strong>
                  <p className="text-sm mt-1">Registers, counters, state machines. Students debug timing with the oscilloscope and step through simulation states.</p>
                </div>
                
                <div>
                  <strong className="text-rb-text">Week 9-12: Custom Chips & Projects</strong>
                  <p className="text-sm mt-1">Students create reusable components (adders, ALUs) and build a final project (e.g., simple CPU). Export to Verilog for optional FPGA deployment.</p>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-rb-border">
                <p className="text-sm text-rb-muted">
                  <strong className="text-rb-text">Instructor benefits:</strong> No VM setup, no license costs, runs on any platform. 
                  Students submit .rb-lab.zip files—instructors use Submission Inspector to view circuits and grades.
                </p>
              </div>
            </div>
          </section>

          {/* Keyboard Shortcuts Quick Reference */}
          <section>
            <h2 className="text-2xl font-bold mb-6 text-rb-text">Keyboard-First UX</h2>
            <div className="bg-rb-surface border border-rb-border rounded-lg p-6">
              <p className="text-sm text-rb-muted mb-4">
                RedByte uses an OS-style interface with keyboard shortcuts for power users:
              </p>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div>
                  <strong className="text-rb-text block mb-2">OS Navigation</strong>
                  <div className="space-y-1 text-rb-muted">
                    <div className="flex justify-between">
                      <span>Command Palette</span>
                      <kbd className="px-2 py-0.5 bg-rb-bg rounded border border-rb-border font-mono text-xs">Ctrl+K</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span>Close Window</span>
                      <kbd className="px-2 py-0.5 bg-rb-bg rounded border border-rb-border font-mono text-xs">Ctrl+W</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span>New Circuit</span>
                      <kbd className="px-2 py-0.5 bg-rb-bg rounded border border-rb-border font-mono text-xs">Ctrl+N</kbd>
                    </div>
                  </div>
                </div>
                <div>
                  <strong className="text-rb-text block mb-2">Simulation</strong>
                  <div className="space-y-1 text-rb-muted">
                    <div className="flex justify-between">
                      <span>Play/Pause</span>
                      <kbd className="px-2 py-0.5 bg-rb-bg rounded border border-rb-border font-mono text-xs">Space</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span>Step Forward</span>
                      <kbd className="px-2 py-0.5 bg-rb-bg rounded border border-rb-border font-mono text-xs">→</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span>Step Backward</span>
                      <kbd className="px-2 py-0.5 bg-rb-bg rounded border border-rb-border font-mono text-xs">←</kbd>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {showTour && <GuidedTour onClose={() => setShowTour(false)} />}
    </div>
  );
}

function DemoSceneCard({ number, title, description, link, linkText }: {
  number: number;
  title: string;
  description: string;
  link: string;
  linkText: string;
}) {
  return (
    <div className="bg-rb-surface border border-rb-border rounded-lg p-6 hover:border-rb-accent transition-colors">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-full bg-rb-accent text-rb-bg font-bold flex items-center justify-center text-sm">
          {number}
        </div>
        <h3 className="text-lg font-semibold text-rb-text">{title}</h3>
      </div>
      <p className="text-sm text-rb-muted mb-4 leading-relaxed">
        {description}
      </p>
      <Link
        to={link}
        className="text-sm text-rb-accent hover:text-rb-accent-dim transition-colors"
      >
        {linkText} →
      </Link>
    </div>
  );
}
