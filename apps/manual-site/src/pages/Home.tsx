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
        <div className="relative container mx-auto px-6 pt-24 pb-16 max-w-5xl">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-zinc-50 mb-6 leading-[1.08]">
            The operating system for<br />
            hardware engineering education.
          </h1>

          <p className="text-lg text-zinc-400 mb-10 leading-relaxed max-w-2xl">
            Build digital circuits visually. Simulate deterministically.
            Deploy instant virtual labs verified on real FPGA hardware.
          </p>

          <div className="flex flex-wrap gap-3 mb-16">
            <Link
              to="/demo"
              className="px-6 py-3 rounded-md font-semibold text-sm text-white transition-opacity hover:opacity-90"
              style={{ background: '#3B82F6' }}
            >
              Try Live Demo
            </Link>
            <a
              href="https://github.com/swaggyp52/redbyte-ui-genesis/archive/refs/heads/main.zip"
              className="px-6 py-3 rounded-md font-semibold text-sm text-zinc-200 border border-zinc-700 bg-zinc-800/50 hover:bg-zinc-700/50 transition-colors"
            >
              Download
            </a>
            <Link
              to="/instructors"
              className="px-6 py-3 rounded-md font-semibold text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Instructor Guide
            </Link>
          </div>

          {/* Live OS Embed */}
          <div className="rounded-lg border border-zinc-700/50 overflow-hidden" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
            <div className="bg-zinc-900 px-4 py-2 border-b border-zinc-800 flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
                <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
                <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
              </div>
              <div className="text-[10px] font-mono text-zinc-500 flex-1 text-center tracking-wider uppercase">
                RedByte OS Genesis
              </div>
              <div className="px-2 py-0.5 rounded text-[9px] font-mono font-medium uppercase tracking-wider"
                style={{ color: '#3B82F6', background: 'rgba(59, 130, 246, 0.1)' }}>
                Live
              </div>
            </div>
            <div className="relative aspect-video w-full bg-zinc-950">
              <iframe
                src="/os/"
                className="w-full h-full border-0"
                title="RedByte OS Interactive Preview"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="py-20 bg-zinc-950 border-b border-zinc-800">
        <div className="container mx-auto px-6 max-w-5xl">
          <div className="grid md:grid-cols-3 gap-12">
            <Capability
              title="Design."
              desc="Build circuits visually with a component palette and wire editor. From simple gates to complex sequential logic."
            />
            <Capability
              title="Simulate."
              desc="Run deterministic simulations with real-time truth table evaluation and waveform analysis. Every tick is reproducible."
            />
            <Capability
              title="Verify."
              desc="Export bit-perfect evidence capsules for grading and academic integrity. Replay exactly what happened."
            />
          </div>
        </div>
      </section>

      {/* Audience Split */}
      <section className="py-20 bg-zinc-900/50 border-b border-zinc-800">
        <div className="container mx-auto px-6 max-w-5xl">
          <div className="grid md:grid-cols-2 gap-16">
            <AudienceColumn
              heading="For Students"
              items={[
                'Virtual labs with guided workflows',
                'FPGA bridge for hardware verification',
                'Circuit export and project sharing',
                'Integrated help and truth table HUD',
              ]}
              cta={{ label: 'Get Started', to: '/students' }}
            />
            <AudienceColumn
              heading="For Instructors"
              items={[
                'Deterministic grading with replay',
                'Submission inspector with annotations',
                'Lab specification authoring',
                'Evidence export for academic integrity',
              ]}
              cta={{ label: 'Instructor Guide', to: '/instructors' }}
            />
          </div>
        </div>
      </section>

      {/* Trust Indicators */}
      <section className="py-16 bg-zinc-950 border-b border-zinc-800">
        <div className="container mx-auto px-6 max-w-5xl">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 text-center">
            <TrustStat value="<10ms" label="Latency" />
            <TrustStat value="100%" label="Deterministic" />
            <TrustStat value="Basys3" label="FPGA Support" />
            <TrustStat value="Browser" label="Native" />
            <TrustStat value="Zero" label="Install Required" />
            <TrustStat value="Open" label="Source" />
          </div>
        </div>
      </section>

      {/* Transparency */}
      <section className="py-12 bg-zinc-900/30">
        <div className="container mx-auto px-6 max-w-3xl text-center">
          <p className="text-xs text-zinc-500 leading-relaxed">
            <strong className="text-zinc-400">Transparency:</strong> RedByte is a deterministic learning instrument.
            It does not solve labs for students. It records, verifies, and evaluates student work
            using bit-perfect replay.
          </p>
        </div>
      </section>
    </div>
  );
};

const Capability = ({ title, desc }: { title: string; desc: string }) => (
  <div>
    <h3 className="text-2xl font-bold text-zinc-50 mb-3 tracking-tight">{title}</h3>
    <p className="text-sm text-zinc-400 leading-relaxed">{desc}</p>
  </div>
);

const AudienceColumn = ({
  heading,
  items,
  cta,
}: {
  heading: string;
  items: string[];
  cta: { label: string; to: string };
}) => (
  <div>
    <h3 className="text-xl font-bold text-zinc-50 mb-5 tracking-tight">{heading}</h3>
    <ul className="space-y-3 mb-6">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5 text-sm text-zinc-400">
          <span className="mt-1.5 h-1 w-1 rounded-full bg-blue-500 shrink-0" />
          {item}
        </li>
      ))}
    </ul>
    <Link
      to={cta.to}
      className="text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors"
    >
      {cta.label} &rarr;
    </Link>
  </div>
);

const TrustStat = ({ value, label }: { value: string; label: string }) => (
  <div>
    <div className="text-xl font-bold text-zinc-50 font-mono mb-1">{value}</div>
    <div className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest">{label}</div>
  </div>
);

export default Home;
