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

          <Link to="/install" className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-lg shadow-lg shadow-blue-900/20 transition-all transform hover:-translate-y-1">
            Download Bundle
          </Link>
          <Link to="/instructors" className="px-8 py-4 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg font-bold text-lg border border-gray-700 transition-all">
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

        {/* Hero Image / UI Mockup */}
        <div className="mt-16 -mb-48 rounded-xl border border-gray-700 shadow-2xl overflow-hidden opacity-90 hover:opacity-100 transition-opacity">
          <div className="bg-gray-900 p-2 border-b border-gray-800 flex gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>
          <div className="bg-black h-[400px] flex items-center justify-center text-gray-600 font-mono">
            <span className="text-lg">[ Live Simulation Viewport ]</span>
          </div>
        </div>
      </div>
    </div>

      {/* Trust / Stats */ }
  <div className="bg-[#0f0f0f] border-b border-gray-800 pt-56 pb-16">
    <div className="container mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
      <Stat label="Latency" value="<10ms" />
      <Stat label="Hardware" value="Basys3 + Uno" />
      <Stat label="Determinism" value="100%" />
      <Stat label="License" value="Open Source" />
    </div>
  </div>

  {/* Core Value Props */ }
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

export default Home;
