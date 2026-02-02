import LogicGatePlayground from '../components/examples/LogicGatePlayground';
import CounterCircuit from '../components/examples/CounterCircuit';
import WaveformViewer from '../components/examples/WaveformViewer';
import { Link as RouterLink } from 'react-router-dom';

const Link = RouterLink as React.ComponentType<{ to: string; className?: string; children: React.ReactNode }>;

export default function Labs() {
  return (
    <div className="py-20 bg-zinc-950 min-h-screen text-zinc-100" style={{ fontFamily: '"Geist", sans-serif' }}>
      <div className="container mx-auto px-6 max-w-6xl">
        {/* Header */}
        <div className="max-w-2xl mb-16">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">Lab Library</h1>
          <p className="text-xl text-zinc-400 leading-relaxed">
            Standardized lab modules designed for the RedByte curriculum. <br />
            Download to run offline or preview instantly in the browser.
          </p>
        </div>

        {/* Labs Grid */}
        <div className="grid md:grid-cols-2 gap-8 mb-20">

          {/* Lab 1 */}
          <LabCard
            id="01"
            title="Combinational Logic: Adder"
            desc="Design a 4-bit ripple carry adder using basic logic gates. Verify truth tables and propagation delay."
            tags={['Gates', 'Arithmetic', 'Combinational']}
            downloadUrl="/labs/lab01-adder.rbx.zip"
            previewComponent={<LogicGatePlayground />}
          />

          {/* Lab 2 */}
          <LabCard
            id="02"
            title="Sequential Logic: 4-Bit Counter"
            desc="Build a synchronous up/down counter with reset and enable. Analyze clock edges and state transitions."
            tags={['Flip-Flops', 'State Machines', 'Sequential']}
            downloadUrl="/labs/lab02-counter.rbx.zip"
            previewComponent={<CounterCircuit />}
          />

        </div>

        {/* Waveform Tool */}
        <div className="border border-zinc-800 rounded-xl bg-zinc-900/30 p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-2">Waveform Analysis</h2>
            <p className="text-zinc-400">All labs include the integrated 16-channel logic analyzer.</p>
          </div>
          <WaveformViewer />
        </div>

      </div>
    </div>
  );
}

const LabCard = ({ id, title, desc, tags, downloadUrl, previewComponent }: any) => (
  <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-700 transition-colors flex flex-col">
    {/* Preview Area */}
    <div className="h-64 bg-zinc-950 border-b border-zinc-800 relative group overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center p-4">
        {previewComponent}
      </div>
      <div className="absolute top-4 left-4 bg-zinc-900/80 backdrop-blur px-2 py-1 rounded text-xs font-mono text-zinc-400 border border-zinc-700">
        LAB-{id}
      </div>
    </div>

    <div className="p-6 flex-1 flex flex-col">
      <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
      <p className="text-sm text-zinc-400 mb-6 leading-relaxed flex-1">{desc}</p>

      <div className="flex flex-wrap gap-2 mb-6">
        {tags.map((t: string) => (
          <span key={t} className="px-2 py-1 rounded text-[10px] font-medium uppercase tracking-wider bg-zinc-800 text-zinc-400">
            {t}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-3 mt-auto">
        <button className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors shadow-lg shadow-blue-900/20">
          Download Lab Bundle
        </button>
        <button className="px-4 py-2.5 border border-zinc-700 hover:bg-zinc-800 text-zinc-300 text-sm font-medium rounded-lg transition-colors">
          Preview
        </button>
      </div>
    </div>
  </div>
);


