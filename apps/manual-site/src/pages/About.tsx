export default function About() {
  return (
    <div className="py-16 bg-rb-bg">
      <div className="content-container px-6">
        <div className="max-w-3xl">
          {/* Header */}
          <h1 className="text-h1 text-rb-text mb-4">About RedByte</h1>
          <p className="text-lg text-rb-muted mb-12 leading-relaxed">
            Why deterministic debugging matters for learning digital logic.
          </p>

          {/* Philosophy */}
          <section className="mb-16">
            <h2 className="text-h2 text-rb-text mb-6">Philosophy</h2>
            <div className="space-y-4 text-rb-muted leading-relaxed">
              <p>
                RedByte started from a simple observation: debugging digital circuits is hard because
                traditional simulators don't let you go backward. When something goes wrong at tick 1,000,
                you have to restart and carefully step through all 1,000 ticks again.
              </p>
              <p>
                <strong className="text-rb-text">Our solution: full determinism.</strong> Every simulation
                in RedByte is perfectly reproducible. Same inputs + same state = identical output, every time.
                You can step backward to any point and the state will be exactly what it was before.
              </p>
              <p>
                This makes RedByte ideal for learning. Students can experiment freely, break things,
                and trace exactly how a bug propagates through their circuit. No more "restart and hope
                you catch it this time."
              </p>
            </div>
          </section>

          {/* Core Principles */}
          <section className="mb-16">
            <h2 className="text-h2 text-rb-text mb-6">Core Principles</h2>
            <div className="space-y-4">
              <Principle
                title="Truth Over Simplicity"
                description="Gates have propagation delay. Circuits take time to settle. We model this honestly instead of pretending everything is instant."
              />
              <Principle
                title="Local-First, Privacy-Respecting"
                description="100% browser-based. No telemetry, no accounts required, no cloud dependency. Your circuits stay on your machine."
              />
              <Principle
                title="Deterministic by Design"
                description="The simulation engine is built from the ground up to be reproducible. Same inputs always produce identical outputs."
              />
              <Principle
                title="One Truth, Many Views"
                description="A single circuit model with multiple visualizations: schematic editor, 3D view, oscilloscope, and eventually HDL."
              />
              <Principle
                title="Keyboard-First Interaction"
                description="All actions accessible via shortcuts. Command palette for everything. Designed for efficiency."
              />
              <Principle
                title="Progressive Disclosure"
                description="Beginners see simple gates. Experts can access timing details, state machines, and hardware export."
              />
            </div>
          </section>

          {/* Roadmap */}
          <section className="mb-16">
            <h2 className="text-h2 text-rb-text mb-6">Roadmap</h2>
            <p className="text-rb-muted mb-6">
              RedByte is under active development. Here's where we're headed:
            </p>

            <div className="space-y-6">
              <RoadmapMilestone
                status="done"
                title="Core Platform"
                items={[
                  'Desktop shell with windowing',
                  'Deterministic simulation engine',
                  'Basic oscilloscope infrastructure',
                  'Learning and progress tracking',
                ]}
              />
              <RoadmapMilestone
                status="current"
                title="Visual Editing & Polish"
                items={[
                  'Canvas-based circuit editor',
                  'Oscilloscope visualization improvements',
                  'Circuit export formats',
                  'Lab workbench content',
                ]}
              />
              <RoadmapMilestone
                status="future"
                title="Advanced Features"
                items={[
                  'Hierarchical chips (save subcircuits as components)',
                  'HDL export (Verilog/VHDL generation)',
                  'FPGA bridge for hardware deployment',
                  'Automated testing framework',
                ]}
              />
              <RoadmapMilestone
                status="future"
                title="Education Tools"
                items={[
                  'Lab template library',
                  'Gradebook integration',
                  'Collaborative editing (future)',
                  'LMS export (LTI)',
                ]}
              />
            </div>
          </section>

          {/* Who is it for */}
          <section className="mb-16">
            <h2 className="text-h2 text-rb-text mb-6">Who It's For</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <AudienceCard
                title="Students"
                description="Learn digital logic concepts interactively. Build circuits, see them run, step through time to understand how gates combine to create complex systems."
              />
              <AudienceCard
                title="Educators"
                description="Structured lab assignments with auto-validation. Submission inspector for grading. No VMs or licenses—works in any browser."
              />
              <AudienceCard
                title="Hobbyists"
                description="Explore digital design without expensive tools. Build retro computer components, game consoles, or custom processors."
              />
              <AudienceCard
                title="Engineers"
                description="Prototype and debug designs visually before writing HDL. Time-travel debugging for finding subtle timing bugs."
              />
            </div>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-h2 text-rb-text mb-6">Contact & Repository</h2>
            <div className="bg-rb-surface border border-rb-border rounded-md p-6">
              <p className="text-rb-muted mb-4">
                RedByte is built by Connor Angiel. The source code is available on GitHub.
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-3">
                  <span className="text-rb-dim w-20">GitHub:</span>
                  <a
                    href="https://github.com/swaggyp52/redbyte-ui-genesis"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-rb-accent hover:underline"
                  >
                    github.com/swaggyp52/redbyte-ui-genesis
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-rb-dim w-20">Website:</span>
                  <span className="text-rb-text">redbyteapps.dev</span>
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

function RoadmapMilestone({
  status,
  title,
  items,
}: {
  status: 'done' | 'current' | 'future';
  title: string;
  items: string[];
}) {
  const statusStyles = {
    done: { label: 'Complete', color: 'text-rb-accent', bg: 'bg-rb-accent' },
    current: { label: 'In Progress', color: 'text-rb-info', bg: 'bg-rb-info' },
    future: { label: 'Planned', color: 'text-rb-dim', bg: 'bg-rb-dim' },
  };

  const { label, color, bg } = statusStyles[status];

  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className={`w-3 h-3 rounded-full ${bg}`} />
        <div className="w-px flex-1 bg-rb-border mt-2" />
      </div>
      <div className="pb-6">
        <div className="flex items-center gap-3 mb-2">
          <h3 className="font-semibold text-rb-text">{title}</h3>
          <span className={`text-xs ${color}`}>{label}</span>
        </div>
        <ul className="space-y-1 text-sm text-rb-muted">
          {items.map((item, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="text-rb-dim">•</span>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function AudienceCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-rb-surface border border-rb-border rounded-md p-5">
      <h3 className="font-semibold text-rb-text mb-2">{title}</h3>
      <p className="text-sm text-rb-muted leading-relaxed">{description}</p>
    </div>
  );
}
