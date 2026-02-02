import React from 'react';
import { Link } from 'react-router-dom';

const Home = () => {
  return (
    <div style={{ fontFamily: '"Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-zinc-800">
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(145deg, #09090B 0%, #18181B 50%, #09090B 100%)',
          }}
        />
        <div className="relative container mx-auto px-6 py-24 md:py-32 max-w-5xl text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 rounded-full border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-medium text-zinc-400 tracking-wider uppercase">v1.0.0 Stable Release</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white mb-6 leading-[1.05]">
            Digital Logic,<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Redefined.</span>
          </h1>

          <p className="text-lg md:text-xl text-zinc-400 mb-10 leading-relaxed max-w-2xl mx-auto">
            The operating system for hands-on hardware labs. <br className="hidden md:block" />
            Design circuits, simulate IO, and verify on real FPGAs—all in one shell.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
            <Link
              to="/download"
              className="px-8 py-3.5 rounded-lg font-semibold text-sm text-white bg-blue-600 hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20"
            >
              Download RedByte OS
            </Link>
            <Link
              to="/demo"
              className="px-8 py-3.5 rounded-lg font-semibold text-sm text-zinc-300 border border-zinc-700 hover:border-zinc-600 hover:text-white transition-all bg-zinc-900/50"
            >
              Try Live Demo
            </Link>
          </div>

          {/* Hero Visual */}
          <div className="relative rounded-xl border border-zinc-800 bg-zinc-900/50 shadow-2xl overflow-hidden aspect-video max-w-4xl mx-auto group">
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent z-10 pointer-events-none" />
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />

            {/* Window Controls */}
            <div className="absolute top-0 inset-x-0 h-8 bg-zinc-950/80 border-b border-zinc-800 flex items-center px-4 gap-2 z-20">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/50" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500/20 border border-amber-500/50" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/20 border border-green-500/50" />
              <div className="ml-4 text-[10px] font-mono text-zinc-500 flex-1 text-center">lab-01-adder.rbl</div>
            </div>

            <img
              src="/screenshot-lab.png"
              alt="RedByte Interface"
              className="w-full h-full object-cover opacity-90 group-hover:scale-[1.02] transition-transform duration-700"
              onError={(e) => {
                // Fallback if image missing
                e.currentTarget.style.display = 'none';
              }}
            />
            {/* Fallback Preview IF image fails/missing */}
            <div className="w-full h-full flex items-center justify-center text-zinc-700 font-mono text-sm">
              [ Interactive Lab Environment Preview ]
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="py-24 bg-zinc-950 border-b border-zinc-800">
        <div className="container mx-auto px-6 max-w-6xl">
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon="⚡"
              title="Unified Simulation"
              desc="Simulate circuits with real-time feedback. Toggle switches, watch LEDs, and verify logic before touching hardware."
            />
            <FeatureCard
              icon="🔌"
              title="Hardware Verified"
              desc="One-click bridge to Basys3 FPGAs. Run your virtual circuit on physical silicon with zero configuration."
            />
            <FeatureCard
              icon="📦"
              title="Evidence Capsules"
              desc="Export verifiable .rbx.zip snapshots containing circuit state, simulation traces, and hardware logs for grading."
            />
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section className="py-24 bg-zinc-900/30">
        <div className="container mx-auto px-6 max-w-4xl text-center">
          <h2 className="text-3xl font-bold text-white mb-12">From Logic to Lab.</h2>

          <div className="grid md:grid-cols-4 gap-4 relative">
            {/* Connecting Line (Desktop) */}
            <div className="hidden md:block absolute top-8 left-0 w-full h-0.5 bg-zinc-800 -z-10" />

            <Step number="01" title="Design" desc="Drag & drop gates" />
            <Step number="02" title="Simulate" desc="Verify behavior" />
            <Step number="03" title="Flash" desc="Push to FPGA" />
            <Step number="04" title="Submit" desc="Export Evidence" />
          </div>
        </div>
      </section>

      {/* CTA Footer */}
      <section className="py-20 border-t border-zinc-800 bg-zinc-950 text-center">
        <h2 className="text-2xl font-bold text-white mb-6">Ready to upgrade your lab?</h2>
        <Link
          to="/download"
          className="inline-flex px-8 py-3 rounded-lg font-semibold text-sm text-zinc-950 bg-white hover:bg-zinc-200 transition-colors"
        >
          Get Started Now
        </Link>
      </section>
    </div>
  );
};

const FeatureCard = ({ icon, title, desc }: { icon: string; title: string; desc: string }) => (
  <div className="p-6 rounded-xl bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 transition-colors">
    <div className="text-3xl mb-4">{icon}</div>
    <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
    <p className="text-sm text-zinc-400 leading-relaxed">{desc}</p>
  </div>
);

const Step = ({ number, title, desc }: { number: string; title: string; desc: string }) => (
  <div className="flex flex-col items-center relative z-10">
    <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4 text-zinc-500 font-mono font-bold text-lg shadow-lg">
      {number}
    </div>
    <div className="text-base font-bold text-white mb-1">{title}</div>
    <div className="text-xs text-zinc-500">{desc}</div>
  </div>
);

export default Home;
