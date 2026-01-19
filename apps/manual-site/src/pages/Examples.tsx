import LogicGatePlayground from '../components/examples/LogicGatePlayground';
import CounterCircuit from '../components/examples/CounterCircuit';
import WaveformViewer from '../components/examples/WaveformViewer';

export default function Examples() {
  return (
    <div className="py-16 bg-rb-bg">
      <div className="content-container px-6">
        {/* Header */}
        <div className="max-w-2xl mb-12">
          <h1 className="text-h1 text-rb-text mb-4">Interactive Examples</h1>
          <p className="text-lg text-rb-muted leading-relaxed">
            Try these demos directly in your browser. Each demonstrates a core concept
            of digital logic design—no installation required.
          </p>
        </div>

        {/* Examples */}
        <div className="space-y-8">
          {/* Logic Gate Playground */}
          <section>
            <LogicGatePlayground />
            <ExampleNote
              concept="Combinational Logic"
              description="Basic gates (AND, OR, XOR, etc.) produce outputs instantly based on current inputs. No memory, no state—just pure logic."
            />
          </section>

          {/* Counter Circuit */}
          <section>
            <CounterCircuit />
            <ExampleNote
              concept="Sequential Logic"
              description="Registers store state across clock cycles. The counter remembers its value and increments on each clock pulse—this is how memory works."
            />
          </section>

          {/* Waveform Viewer */}
          <section>
            <WaveformViewer />
            <ExampleNote
              concept="Signal Timing"
              description="The oscilloscope shows how signals change over time. Scrub through ticks to see the exact moment values change—essential for debugging."
            />
          </section>
        </div>

        {/* CTA */}
        <div className="mt-16 bg-rb-surface border border-rb-border rounded-md p-8 text-center">
          <h2 className="text-h2 text-rb-text mb-3">Ready for More?</h2>
          <p className="text-rb-muted mb-6 max-w-lg mx-auto">
            These examples demonstrate the basics. Download RedByte to build complex circuits,
            create custom chips, and work through structured labs.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a href="#download" className="btn btn-primary">
              Download RedByte
            </a>
            <a href="/#/getting-started" className="btn btn-secondary">
              Read Getting Started
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExampleNote({ concept, description }: { concept: string; description: string }) {
  return (
    <div className="mt-4 flex items-start gap-3 px-2">
      <div className="flex-shrink-0 w-5 h-5 rounded bg-rb-info-bg flex items-center justify-center mt-0.5">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className="text-rb-info">
          <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 3a1 1 0 110 2 1 1 0 010-2zm2 8H6v-1h1V8H6V7h3v4h1v1z" />
        </svg>
      </div>
      <div>
        <span className="text-sm font-medium text-rb-text">{concept}:</span>
        <span className="text-sm text-rb-muted ml-1">{description}</span>
      </div>
    </div>
  );
}
