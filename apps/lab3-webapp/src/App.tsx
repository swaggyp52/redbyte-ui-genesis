import React, { useState } from 'react';
import { TruthTableEditor } from './truth-table';
import { Simulator } from './simulator';
import { VerilogExporter } from './verilog';
import { KMapViewer } from './kmap-viewer';
import { WaveformViewer } from './waveform-viewer';
import { LiveValidation } from './live-validation';
import { useLabStore } from './store';
import { Settings, Download, Upload } from 'lucide-react';

type Tab = 'overview' | 'table' | 'kmaps' | 'simulator' | 'verilog';

export const App: React.FC = () => {
  const [tab, setTab] = useState<Tab>('overview');
  const [showSettings, setShowSettings] = useState(false);
  const reset = useLabStore((s) => s.reset);
  const exportJSON = useLabStore((s) => s.exportJSON);
  const importJSON = useLabStore((s) => s.importJSON);

  const handleExportJSON = () => {
    const json = exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lab3-workspace-${new Date().getTime()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const json = e.target?.result as string;
        importJSON(json);
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-slate-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-950 to-slate-900 border-b border-slate-700 shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
                Lab 3: Seven-Segment Display Driver
              </h1>
              <p className="text-slate-400 mt-1">
                Design a 4-bit to 7-segment decoder (active-low, digits 0–9)
              </p>
            </div>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
              title="Settings"
            >
              <Settings size={24} className="text-slate-300 hover:text-slate-50" />
            </button>
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 mb-4 space-y-3">
              <h3 className="font-semibold text-sm text-slate-200">Workspace</h3>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={handleExportJSON}
                  className="px-3 py-2 bg-emerald-700 hover:bg-emerald-600 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
                >
                  <Download size={16} />
                  Export JSON
                </button>
                <label className="px-3 py-2 bg-emerald-700 hover:bg-emerald-600 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors cursor-pointer">
                  <Upload size={16} />
                  Import JSON
                  <input type="file" accept=".json" onChange={handleImportJSON} hidden />
                </label>
                <button
                  onClick={reset}
                  className="px-3 py-2 bg-red-700 hover:bg-red-600 rounded-lg text-sm font-medium transition-colors ml-auto"
                >
                  Reset All
                </button>
              </div>
            </div>
          )}

          {/* Tab Navigation */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {[
              { id: 'overview' as Tab, label: '📊 Overview' },
              { id: 'table' as Tab, label: '📋 Truth Table' },
              { id: 'kmaps' as Tab, label: '🎯 K-Maps' },
              { id: 'simulator' as Tab, label: '⚙️ Simulator' },
              { id: 'verilog' as Tab, label: '💾 Verilog & Export' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                  tab === item.id
                    ? 'bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-900 shadow-lg'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                <h2 className="text-2xl font-bold text-cyan-400 mb-4">Getting Started</h2>
                <ol className="space-y-3 text-slate-300 text-sm">
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-cyan-500 text-slate-900 rounded-full flex items-center justify-center font-bold">
                      1
                    </span>
                    <span>
                      Fill the <strong>Truth Table</strong> with segment patterns for digits 0–9
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-cyan-500 text-slate-900 rounded-full flex items-center justify-center font-bold">
                      2
                    </span>
                    <span>
                      Review and edit <strong>K-Maps</strong> to see optimal groupings and simplified boolean expressions
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-cyan-500 text-slate-900 rounded-full flex items-center justify-center font-bold">
                      3
                    </span>
                    <span>
                      Check <strong>Live Validation</strong> to ensure expressions match your truth table
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-cyan-500 text-slate-900 rounded-full flex items-center justify-center font-bold">
                      4
                    </span>
                    <span>
                      Use the <strong>Simulator</strong> to test all 16 input combinations
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-cyan-500 text-slate-900 rounded-full flex items-center justify-center font-bold">
                      5
                    </span>
                    <span>
                      Export to <strong>Verilog</strong> and download your lab report
                    </span>
                  </li>
                </ol>
              </div>

              <div className="space-y-4">
                <div className="bg-gradient-to-br from-cyan-950/50 to-emerald-950/50 border border-cyan-700/50 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-cyan-300 mb-3">Key Concepts</h3>
                  <ul className="space-y-2 text-sm text-slate-300">
                    <li>
                      <strong>Active-Low Logic:</strong> 0 = segment ON (lit), 1 = segment OFF (dark)
                    </li>
                    <li>
                      <strong>Don't-Cares:</strong> Inputs 10–15 can be any value; use them to simplify logic
                    </li>
                    <li>
                      <strong>Karnaugh Map:</strong> Visual tool to find minimal boolean expressions
                    </li>
                    <li>
                      <strong>Gray Code:</strong> Adjacent cells differ by 1 bit (easier grouping)
                    </li>
                  </ul>
                </div>

                <div className="bg-gradient-to-br from-emerald-950/50 to-slate-900 border border-emerald-700/50 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-emerald-300 mb-3">Digit Patterns (Active-Low)</h3>
                  <div className="grid grid-cols-5 gap-2 text-xs">
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                      <div key={digit} className="text-center">
                        <div className="text-lg font-bold text-slate-200">{digit}</div>
                        <div className="text-xs text-slate-400">segments: a b c d e f g</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Live Validation Always Visible */}
            <LiveValidation />
          </div>
        )}

        {tab === 'table' && (
          <div className="space-y-6">
            <TruthTableEditor />
            <LiveValidation />
          </div>
        )}

        {tab === 'kmaps' && (
          <div className="space-y-6">
            <KMapViewer />
            <LiveValidation />
          </div>
        )}

        {tab === 'simulator' && (
          <div className="space-y-6">
            <Simulator />
            <WaveformViewer />
          </div>
        )}

        {tab === 'verilog' && (
          <div className="space-y-6">
            <VerilogExporter />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-700 bg-slate-900/50 mt-12 py-6">
        <div className="max-w-7xl mx-auto px-6 text-center text-sm text-slate-400">
          <p>Lab 3 Webapp v2.0 | Seven-Segment Display Driver Design Tool</p>
          <p className="text-xs mt-2">Tips: Use your boolean expressions from K-maps. Verify all 16 inputs pass in Simulator.</p>
        </div>
      </footer>
    </div>
  );
};
