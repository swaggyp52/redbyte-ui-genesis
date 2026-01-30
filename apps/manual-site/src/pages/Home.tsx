import React from 'react';
import { Link } from 'react-router-dom';

const Home = () => {
  return (
    <div className="bg-rb-bg text-gray-200">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-b from-[#1a1a1a] to-[#111] pt-20 pb-32 border-b border-gray-800">
        <div className="container mx-auto px-6 text-center max-w-4xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-900/30 border border-blue-700/50 text-blue-400 text-xs font-bold uppercase tracking-wider mb-8">
            <span className="animate-pulse">●</span> RedByte OS Genesis
          </div>

          <h1 className="text-6xl md:text-7xl font-black tracking-tighter text-white mb-6 leading-tight">
            The OS for <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-indigo-500">Hardware Labs</span>
          </h1>

          <p className="text-xl text-gray-400 mb-10 leading-relaxed max-w-2xl mx-auto">
            A modern, deterministic environment for digital logic design.
            Deploy instant virtual labs that students verify on real FPGA hardware.
          </p>

          <a
            href="https://github.com/swaggyp52/redbyte-ui-genesis/archive/refs/heads/main.zip"
            className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-lg shadow-lg shadow-blue-900/20 transition-all transform hover:-translate-y-1 inline-block"
          >
            Download RedByte ZIP
          </a>
          <Link to="/instructors" className="ml-4 px-8 py-4 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg font-bold text-lg border border-gray-700 transition-all inline-block">
            Instructor Guide
          </Link>
        </div>

        <div className="mt-8 mb-4">
          <p className="text-xs text-gray-500 max-w-lg mx-auto border-t border-gray-800 pt-4">
            <strong>Transparency Note:</strong> RedByte is a deterministic learning instrument.
            It does not "solve" labs for students. It records, verifies, and evaluates student work
            using bit-perfect replay.
          </p>
        </div>

        {/* Hero Image / OS UI Embedded */}
        <div className="mt-16 -mb-48 rounded-xl border border-gray-700 shadow-2xl overflow-hidden bg-[#0a0a0a]">
          <div className="bg-[#1a1a1a] p-3 border-b border-gray-800 flex items-center gap-4">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
              <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
              <div className="w-3 h-3 rounded-full bg-[#28c840]" />
            </div>
            <div className="text-xs font-bold text-gray-500 uppercase tracking-widest flex-1 text-center">
              RedByte OS Genesis — v1.0.0
            </div>
            <div className="w-16" /> {/* Spacer */}
          </div>
          <div className="relative aspect-video w-full bg-black group">
            <iframe
              src="/os/"
              className="w-full h-full border-0"
              title="RedByte OS Interactive Preview"
              loading="lazy"
            />
            {/* Overlay to encourage clicking if needed, though OS is interactive */}
            <div className="absolute top-4 right-4 pointer-events-none">
              <div className="px-2 py-1 rounded bg-blue-600/20 border border-blue-500/50 text-blue-400 text-[10px] font-bold uppercase tracking-wider backdrop-blur-md">
                Live Preview
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* Trust / Stats */}
      <div className="bg-[#0f0f0f] border-b border-gray-800 pt-56 pb-16">
        <div className="container mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <Stat label="Latency" value="<10ms" />
          <Stat label="Hardware" value="Basys3 + Uno" />
          <Stat label="Determinism" value="100%" />
          <Stat label="License" value="Open Source" />
        </div>
        <div className="mt-8 text-center">
          <BuildTag />
        </div>
      </div>

      {/* Core Value Props */}
      <div className="py-24 bg-[#111]">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-12">
            <FeatureCard
              icon="⚡"
              title="Hardware Reality"
              desc="Bridge virtual circuits to physical FPGAs instantly. No massive toolchains required on student laptops."
            />
            <FeatureCard
              icon="🎓"
              title="Guided Labs"
              desc="Integrated lab manuals and Truth HUD ensure students know exactly what to build and verify."
            />
            <FeatureCard
              icon="⚖️"
              title="Evidence Export"
              desc="Deterministic replay capsules allow TAs to grade labs based on what actually happened, not just screenshots."
            />
          </div>
        </div>
      </div>

    </div >
  );
};

const Stat = ({ label, value }: { label: string, value: string }) => (
  <div>
    <div className="text-3xl font-black text-white mb-1">{value}</div>
    <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">{label}</div>
  </div>
);

const FeatureCard = ({ icon, title, desc }: { icon: string, title: string, desc: string }) => (
  <div className="bg-[#1a1a1a] p-8 rounded-2xl border border-gray-800 hover:border-gray-600 transition-colors">
    <div className="text-4xl mb-6">{icon}</div>
    <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
    <p className="text-gray-400 leading-relaxed text-sm">
      {desc}
    </p>
  </div>
);

const BuildTag = () => {
  const [build, setBuild] = React.useState<{ sha: string, env: string } | null>(null);

  React.useEffect(() => {
    fetch('/build.json')
      .then(r => r.json())
      .then(setBuild)
      .catch(() => setBuild({ sha: 'dev', env: 'local' }));
  }, []);

  if (!build) return null;

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-900 rounded font-mono text-[10px] text-gray-600 border border-gray-800" title="Deployment Trust Identity">
      <span className="text-green-500/50">●</span>
      <span>Build: <span className="text-gray-400">{build.sha}</span></span>
      <span className="opacity-50">({build.env})</span>
    </div>
  );
};

export default Home;
