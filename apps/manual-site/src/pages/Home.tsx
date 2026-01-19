import { useState } from 'react';
import { Link } from 'react-router-dom';
import GuidedTour from '../components/GuidedTour';

export default function Home() {
  const [showTour, setShowTour] = useState(false);

  return (
    <div className="bg-rb-bg text-rb-text">
      {/* Hero Section */}
      <section className="border-b border-rb-border">
        <div className="content-container px-6 py-20">
          <div className="max-w-3xl">
            <h1 className="text-5xl font-bold mb-4 text-rb-text">
              RedByte
            </h1>
            <p className="text-xl text-rb-muted mb-8 leading-relaxed">
              A deterministic digital logic simulator and FPGA development environment. 
              Build circuits visually, debug with real-time waveforms, and export to hardware.
            </p>
            
            <div className="flex flex-wrap gap-3">
              <a
                href="#download"
                className="px-6 py-3 bg-rb-accent text-rb-bg font-medium rounded hover:bg-rb-accent-dim transition-colors"
              >
                Download RedByte
              </a>
              <Link
                to="/examples"
                className="px-6 py-3 border border-rb-border text-rb-text font-medium rounded hover:border-rb-accent hover:text-rb-accent transition-colors"
              >
                Try Examples
              </Link>
              <button
                onClick={() => setShowTour(true)}
                className="px-6 py-3 border border-rb-border text-rb-text font-medium rounded hover:border-rb-accent hover:text-rb-accent transition-colors"
              >
                Start Tour
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 border-b border-rb-border">
        <div className="content-container px-6">
          <h2 className="text-3xl font-bold mb-12 text-rb-text">
            Core Features
          </h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon="⏱"
              title="Deterministic Simulation"
              description="Step forward and backward through time. Same inputs always produce the same outputs."
            />
            <FeatureCard
              icon="🎨"
              title="Visual Circuit Design"
              description="Build circuits with gates, chips, and wires. Drag-and-drop interface with keyboard shortcuts."
            />
            <FeatureCard
              icon="📊"
              title="Real-Time Oscilloscope"
              description="Probe any signal and watch waveforms live. Debug timing issues visually."
            />
            <FeatureCard
              icon="💾"
              title="Export to Hardware"
              description="Generate Verilog or VHDL from your designs. Deploy to real FPGA hardware."
            />
            <FeatureCard
              icon="🧩"
              title="Custom Chip Libraries"
              description="Create reusable components. Build complex systems modularly."
            />
            <FeatureCard
              icon="⌨️"
              title="Keyboard-Driven"
              description="Power user shortcuts for every action. Maximize productivity."
            />
          </div>
        </div>
      </section>

      {/* Quick Demo */}
      <section className="py-20 border-b border-rb-border">
        <div className="content-container px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold mb-8 text-rb-text">
              Workflow
            </h2>
            
            <div className="bg-rb-surface rounded-lg border border-rb-border p-8">
              <div className="aspect-video bg-rb-bg rounded border border-rb-border flex items-center justify-center text-rb-muted mb-6">
                <div className="text-center">
                  <div className="text-5xl mb-3">🎬</div>
                  <p className="text-lg">Demo Video</p>
                  <p className="text-sm mt-1">Visual circuit building • Live simulation • Export</p>
                </div>
              </div>
              
              <div className="grid md:grid-cols-3 gap-4 text-sm">
                <div className="bg-rb-bg p-4 rounded border border-rb-border">
                  <div className="font-semibold text-rb-accent mb-2">1. Design</div>
                  <p className="text-rb-muted">Build circuits visually with gates and wires</p>
                </div>
                <div className="bg-rb-bg p-4 rounded border border-rb-border">
                  <div className="font-semibold text-rb-accent mb-2">2. Simulate</div>
                  <p className="text-rb-muted">Run deterministic simulations in real-time</p>
                </div>
                <div className="bg-rb-bg p-4 rounded border border-rb-border">
                  <div className="font-semibold text-rb-accent mb-2">3. Export</div>
                  <p className="text-rb-muted">Generate Verilog for real hardware</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="content-container px-6 text-center">
          <h2 className="text-3xl font-bold mb-4 text-rb-text">Ready to Build?</h2>
          <p className="text-lg text-rb-muted mb-8 max-w-2xl mx-auto">
            Download RedByte and start designing deterministic digital circuits.
          </p>
          <a
            href="#download"
            className="inline-block px-8 py-3 bg-rb-accent text-rb-bg font-medium rounded hover:bg-rb-accent-dim transition-colors"
          >
            Download Now
          </a>
          <p className="text-sm text-rb-muted mt-4">Free • Open Development • Cross-Platform</p>
        </div>
      </section>

      {showTour && <GuidedTour onClose={() => setShowTour(false)} />}
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="bg-rb-surface rounded-lg p-6 border border-rb-border hover:border-rb-accent transition-colors">
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="text-lg font-semibold mb-2 text-rb-text">{title}</h3>
      <p className="text-sm text-rb-muted leading-relaxed">{description}</p>
    </div>
  );
}
