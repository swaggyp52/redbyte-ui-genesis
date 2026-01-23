export default function About() {
  return (
    <div className="py-16 bg-rb-bg text-rb-text">
      <div className="content-container px-6">
        <div className="max-w-3xl">
          {/* Header */}
          <h1 className="text-h1 text-rb-text mb-4">About RedByte</h1>
          <p className="text-lg text-rb-muted mb-12 leading-relaxed">
            Why deterministic simulation matters for digital logic education.
          </p>

          {/* Philosophy */}
          <section className="mb-16">
            <h2 className="text-h2 text-rb-text mb-6">Philosophy</h2>
            <div className="space-y-4 text-rb-muted leading-relaxed">
              <p>
                RedByte started from a simple observation: learning digital logic is frustrating when
                glitches are invisible and irreproducible.
              </p>
              <p>
                <strong className="text-rb-text">Our solution: full determinism.</strong> Every simulation
                in RedByte is perfectly reproducibility. Same inputs + same state = identical output, every time.
                You can record a session and replay it bit-for-bit.
              </p>
              <p>
                This makes RedByte fundamentally different from traditional simulators. It prioritizes
                visibility and causality over raw performance or analog precision.
              </p>
            </div>
          </section>

          {/* Core Principles */}
          <section className="mb-16">
            <h2 className="text-h2 text-rb-text mb-6">Technical Principles</h2>
            <div className="space-y-4">
              <Principle
                title="Truth Over Simplicity"
                description="Components have propagation delay (1 tick). Circuits take time to settle. We model this explicitly."
              />
              <Principle
                title="Local-First, Privacy-Respecting"
                description="Runs 100% in the browser. No telemetry, no accounts, no cloud dependency."
              />
              <Principle
                title="Deterministic Replay"
                description="The simulation engine allows time-travel debugging by recording and replaying the exact sequence of ticks."
              />
              <Principle
                title="Keyboard-First Interaction"
                description="Designed for efficiency with comprehensive keyboard shortcuts and a command palette."
              />
            </div>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-h2 text-rb-text mb-6">Project</h2>
            <div className="bg-rb-surface border border-rb-border rounded-md p-6">
              <p className="text-rb-muted mb-4">
                RedByte is an open-source project.
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-3">
                  <span className="text-rb-dim w-20">Source:</span>
                  <a
                    href="https://github.com/swaggyp52/redbyte-ui-genesis"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-rb-accent hover:underline"
                  >
                    github.com/swaggyp52/redbyte-ui-genesis
                  </a>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Principle({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-rb-surface border border-rb-border rounded-md p-5">
      <h3 className="text-base font-semibold text-rb-text mb-2">{title}</h3>
      <p className="text-sm text-rb-muted leading-relaxed">{description}</p>
    </div>
  );
}
