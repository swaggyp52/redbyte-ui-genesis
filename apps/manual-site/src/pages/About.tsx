export default function Product() {
  return (
    <div className="bg-zinc-950 text-zinc-100 min-h-screen" style={{ fontFamily: '"Geist", sans-serif' }}>

      {/* Header */}
      <div className="relative border-b border-zinc-900 bg-zinc-950 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-zinc-950 to-zinc-950" />
        <div className="container mx-auto px-6 py-24 relative max-w-4xl text-center">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            The Unified Lab Environment
          </h1>
          <p className="text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            RedByte bridges the gap between simulation and silicon. <br />
            One interface to design, simulate, verify, and grade.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-6 py-20 max-w-5xl">

        {/* Workflow Section */}
        <section className="mb-24">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-wider">
                Step 1: Simulation
              </div>
              <h2 className="text-3xl font-bold mb-4">Deterministic by Design.</h2>
              <p className="text-zinc-400 leading-relaxed mb-6">
                Most simulators hide glitches. RedByte exposes them. Our tick-based engine models propagation delay explicitly, ensuring that race conditions and hazards are visible before they hit hardware.
              </p>
              <ul className="space-y-3">
                <CheckItem text="Real-time truth table evaluation" />
                <CheckItem text="Waveform analysis with <10ms latency" />
                <CheckItem text="Reproducible physics (ticks)" />
              </ul>
            </div>
            <div className="aspect-video rounded-xl border border-zinc-800 bg-zinc-900/50 flex items-center justify-center text-zinc-700 font-mono">
              [ Simulation GIF ]
            </div>
          </div>
        </section>

        <section className="mb-24">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="order-2 md:order-1 aspect-video rounded-xl border border-zinc-800 bg-zinc-900/50 flex items-center justify-center text-zinc-700 font-mono">
              [ Hardware GIF ]
            </div>
            <div className="order-1 md:order-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold uppercase tracking-wider">
                Step 2: Verification
              </div>
              <h2 className="text-3xl font-bold mb-4">Hardware in the Loop.</h2>
              <p className="text-zinc-400 leading-relaxed mb-6">
                Stop compiling blindly. RedByte's hardware bridge connects your browser directly to the FPGA. Toggle switches in the UI and see LEDs light up on the board instantly.
              </p>
              <ul className="space-y-3">
                <CheckItem text="Works with Basys3 & similar boards" />
                <CheckItem text="Zero-install WebSerial connection" />
                <CheckItem text="Auto-generated constraints (.xdc)" />
              </ul>
            </div>
          </div>
        </section>

        <section className="mb-24">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold uppercase tracking-wider">
                Step 3: Grading
              </div>
              <h2 className="text-3xl font-bold mb-4">Evidence Capsules.</h2>
              <p className="text-zinc-400 leading-relaxed mb-6">
                Forget screenshots. RedByte exports a cryptographic "Capsule" containing the circuit, simulation trace, and hardware verification logs. Instructors can replay the student's exact session.
              </p>
              <ul className="space-y-3">
                <CheckItem text="Tamper-evident .rbx.zip format" />
                <CheckItem text="Bit-perfect replay for grading" />
                <CheckItem text="Automated self-check verification" />
              </ul>
            </div>
            <div className="aspect-video rounded-xl border border-zinc-800 bg-zinc-900/50 flex items-center justify-center text-zinc-700 font-mono">
              [ Capsule Diagram ]
            </div>
          </div>
        </section>

        {/* Key Differentiators */}
        <section className="py-12 border-t border-zinc-800">
          <h3 className="text-center text-xl font-bold mb-12">Why RedByte?</h3>
          <div className="grid md:grid-cols-3 gap-6">
            <Differentiator
              title="Local First"
              desc="Runs entirely in the browser. No usage caps, no cloud lag, no accounts required."
            />
            <Differentiator
              title="Open Standard"
              desc="Labs are defined in JSON. Questions, inputs, and strict checks are fully customizable."
            />
            <Differentiator
              title="Accessibility"
              desc="Full keyboard navigation, screen reader support, and high-contrast themes included."
            />
          </div>
        </section>

      </div>
    </div>
  );
}

const CheckItem = ({ text }: { text: string }) => (
  <li className="flex items-center gap-3 text-sm text-zinc-300">
    <span className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center text-green-500 text-xs">✓</span>
    {text}
  </li>
);

const Differentiator = ({ title, desc }: { title: string; desc: string }) => (
  <div className="p-6 rounded-lg bg-zinc-900 border border-zinc-800">
    <h4 className="font-bold text-white mb-2">{title}</h4>
    <p className="text-sm text-zinc-400 leading-relaxed">{desc}</p>
  </div>
);
