import React, { useState, useEffect } from 'react';
import { TruthTableEditor } from './truth-table';
import { Simulator } from './simulator';
import { VerilogExporter } from './verilog';
import { KMapViewer } from './kmap-viewer-interactive';
import { WaveformViewer } from './waveform-viewer-enhanced';
import { LiveValidation } from './live-validation';
import { ProgressTracker, useLabProgress } from './progress-tracker';
import { CircuitEditor } from './circuit-editor';
import { useLabStore } from './store';
import { useAutoSave } from './use-auto-save';
import { Settings, Download, Upload, Zap, BookOpen, Table, Target, PlayCircle, FileCode, Cpu, AlertCircle } from 'lucide-react';
import useNewLabStore from './store/labStore';
import { loadSnapshot, initPersistence } from './store/persistence';
import { WindowManager } from './workspace/WindowManager';
import { PluginRegistry } from './plugins/PluginRegistry';
import { registerLab3 } from './plugins/registerLab3';

type Tab = 'overview' | 'table' | 'kmaps' | 'circuit' | 'simulator' | 'verilog';

export const App: React.FC = () => {
  const [tab, setTab] = useState<Tab>('overview');
  const [showSettings, setShowSettings] = useState(false);
  const [showRecoveryBanner, setShowRecoveryBanner] = useState(false);
  const [recoverySnapshot, setRecoverySnapshot] = useState<any>(null);
  const [showWindowManager, setShowWindowManager] = useState(false);
  const [registry] = useState(() => {
    const reg = new PluginRegistry();
    registerLab3(reg);
    return reg;
  });
  
  const reset = useLabStore((s) => s.reset);
  const exportJSON = useLabStore((s) => s.exportJSON);
  const importJSON = useLabStore((s) => s.importJSON);
  const progressSteps = useLabProgress();
  const openWindow = useNewLabStore((s) => s.openWindow);
  const windows = useNewLabStore((s) => s.windows);
  const doc = useNewLabStore((s) => s.doc);

  // Enable auto-save
  useAutoSave(true);

  // Initialize persistence and check for recovery on mount
  useEffect(() => {
    initPersistence(useNewLabStore);
    
    const snapshot = loadSnapshot();
    if (snapshot) {
      setRecoverySnapshot(snapshot);
      setShowRecoveryBanner(true);
    }
  }, []);

  // Open 5 default windows on first load (only once)
  useEffect(() => {
    if (windows.length === 0) {
      // Spawn 5 windows in default layout
      setTimeout(() => {
        // Check if Pro should be default
        const useProByDefault = (doc as any).meta?.useProByDefault ?? false;
        const circuitViewId = useProByDefault ? 'circuit-designer-pro' : 'circuit';

        openWindow('lab3', 'overview', { x: 0, y: 0, w: 800, h: 600 });
        openWindow('lab3', 'truth-table', { x: 850, y: 0, w: 700, h: 600 });
        openWindow('lab3', circuitViewId, { x: 0, y: 650, w: 1000, h: 600 });
        openWindow('lab3', 'simulator', { x: 1050, y: 650, w: 700, h: 600 });
        openWindow('lab3', 'console', { x: 1750, y: 0, w: 400, h: 1250 });
        setShowWindowManager(true);
      }, 100);
    }
  }, [windows.length, openWindow, doc]);

  const handleRecover = () => {
    if (recoverySnapshot) {
      useNewLabStore.getState().hydrateFromSnapshot(recoverySnapshot);
      setShowRecoveryBanner(false);
    }
  };

  const handleDiscard = () => {
    useNewLabStore.getState().discardRecovery();
    localStorage.removeItem('rb.lab3.session.v1');
    setShowRecoveryBanner(false);
  };

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

  if (showWindowManager) {
    return (
      <div className="relative w-full h-screen">
        {/* Recovery Banner */}
        {showRecoveryBanner && (
          <div className="absolute top-0 left-0 right-0 z-50 bg-gradient-to-r from-amber-600 to-orange-600 border-b border-amber-500/50 shadow-xl">
            <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <AlertCircle size={24} className="text-white flex-shrink-0" />
                <div>
                  <p className="font-tech font-bold text-white text-lg">Previous Session Found</p>
                  <p className="font-digital text-amber-100 text-sm">Would you like to recover your previous work?</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleRecover}
                  className="px-5 py-2 bg-white text-amber-700 hover:bg-amber-50 rounded-lg font-tech font-bold transition-all duration-200 shadow-lg"
                >
                  Recover
                </button>
                <button
                  onClick={handleDiscard}
                  className="px-5 py-2 bg-amber-800 hover:bg-amber-900 text-white rounded-lg font-tech font-semibold transition-all duration-200"
                >
                  Discard
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Fallback Button */}
        <button
          onClick={() => setShowWindowManager(false)}
          className="absolute top-4 left-4 z-40 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-tech text-sm transition-all duration-200"
          title="Switch to tab view"
        >
          ← Back to Tabs
        </button>

        {/* Window Manager */}
        <WindowManager registry={registry} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-slate-50 font-tech">
      {/* Recovery Banner */}
      {showRecoveryBanner && (
        <div className="bg-gradient-to-r from-amber-600 to-orange-600 border-b border-amber-500/50 shadow-xl">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertCircle size={24} className="text-white flex-shrink-0" />
              <div>
                <p className="font-tech font-bold text-white text-lg">
                  Previous Session Found
                </p>
                <p className="font-digital text-amber-100 text-sm">
                  Would you like to recover your previous work?
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleRecover}
                className="px-5 py-2 bg-white text-amber-700 hover:bg-amber-50 rounded-lg font-tech font-bold transition-all duration-200 shadow-lg"
              >
                Recover
              </button>
              <button
                onClick={handleDiscard}
                className="px-5 py-2 bg-amber-800 hover:bg-amber-900 text-white rounded-lg font-tech font-semibold transition-all duration-200"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-950 to-slate-900 border-b border-cyan-500/20 shadow-2xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="font-tech-display text-4xl font-black bg-gradient-to-r from-cyan-400 via-emerald-400 to-cyan-400 bg-clip-text text-transparent neon-cyan">
                <Zap className="inline-block mb-2 mr-2" size={32} />
                Lab 3: Seven-Segment Display Driver
              </h1>
              <p className="font-digital text-slate-400 mt-2 ml-1">
                Design a 4-bit to 7-segment decoder | Active-low logic | Digits 0–9
              </p>
            </div>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-3 hover:bg-slate-800/50 rounded-xl transition-all duration-200 glow-box-cyan group"
              title="Workspace Settings"
            >
              <Settings size={24} className="text-cyan-300 group-hover:text-cyan-400 group-hover:rotate-90 transition-all duration-300" />
            </button>
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <div className="bg-slate-800/80 backdrop-blur-sm border border-cyan-500/30 rounded-xl p-5 mb-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
              <h3 className="font-tech font-bold text-lg text-cyan-300 flex items-center gap-2">
                <Settings size={18} />
                Workspace Settings
              </h3>
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={handleExportJSON}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 rounded-lg flex items-center gap-2 font-tech font-semibold transition-all duration-200 glow-box-emerald"
                  title="Download your workspace as JSON"
                >
                  <Download size={16} />
                  Export JSON
                </button>
                <label className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-500 hover:to-cyan-600 rounded-lg flex items-center gap-2 font-tech font-semibold transition-all duration-200 cursor-pointer glow-box-cyan"
                  title="Load a previously saved workspace"
                >
                  <Upload size={16} />
                  Import JSON
                  <input type="file" accept=".json" onChange={handleImportJSON} hidden />
                </label>
                <button
                  onClick={() => setShowWindowManager(true)}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 rounded-lg flex items-center gap-2 font-tech font-semibold transition-all duration-200"
                  title="Open window-based workspace"
                >
                  <PlayCircle size={16} />
                  Window Manager
                </button>
                <button
                  onClick={reset}
                  className="px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 rounded-lg font-tech font-semibold transition-all duration-200 ml-auto"
                  title="Clear all data and start fresh"
                >
                  Reset All
                </button>
              </div>
              <div className="text-xs font-digital text-slate-400 pt-2 border-t border-slate-700">
                All changes are automatically saved to your browser. Export JSON for backup or sharing.
              </div>
            </div>
          )}

          {/* Tab Navigation with Icons */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-cyan-500">
            {[
              { id: 'overview' as Tab, label: 'Overview', icon: BookOpen },
              { id: 'table' as Tab, label: 'Truth Table', icon: Table },
              { id: 'kmaps' as Tab, label: 'K-Maps', icon: Target },
              { id: 'circuit' as Tab, label: 'Circuit', icon: Cpu },
              { id: 'simulator' as Tab, label: 'Simulator', icon: PlayCircle },
              { id: 'verilog' as Tab, label: 'Export', icon: FileCode },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  className={`px-5 py-2.5 rounded-xl font-tech font-bold transition-all duration-200 whitespace-nowrap flex items-center gap-2 ${
                    tab === item.id
                      ? 'bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-900 shadow-xl glow-box-cyan scale-105'
                      : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 hover:text-white hover:scale-102'
                  }`}
                >
                  <Icon size={18} />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-[1fr_320px] gap-6">
          {/* Main Content Area */}
          <div className="space-y-6">
            {tab === 'overview' && (
              <div className="space-y-6">
                <div className="bg-gradient-to-br from-slate-900/80 to-slate-800/80 border border-cyan-500/20 rounded-2xl p-8 glow-box-cyan">
                  <h2 className="font-tech-display text-3xl font-bold text-cyan-400 neon-cyan mb-6">
                    Welcome to the RedByte Seven-Segment Lab
                  </h2>
                  <p className="font-digital text-slate-300 leading-relaxed mb-6">
                    This interactive tool guides you through designing a combinational logic circuit
                    that converts 4-bit binary inputs (0-15) to seven-segment display outputs.
                    You'll master truth tables, Karnaugh maps, Boolean simplification, and Verilog code generation.
                  </p>
                  
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="bg-slate-950/50 border border-slate-700 rounded-xl p-6">
                      <h3 className="font-tech-display text-xl font-bold text-emerald-400 mb-4 flex items-center gap-2">
                        <Zap size={20} className="text-emerald-400" />
                        Quick Start
                      </h3>
                      <ol className="space-y-3 text-slate-300 font-digital text-sm">
                        <li className="flex gap-3">
                          <span className="flex-shrink-0 w-7 h-7 bg-gradient-to-br from-cyan-500 to-cyan-600 text-white rounded-lg flex items-center justify-center font-bold glow-box-cyan">
                            1
                          </span>
                          <span>
                            Go to <strong className="text-cyan-400">Truth Table</strong> and click "Auto-Fill" for digits 0–9
                          </span>
                        </li>
                        <li className="flex gap-3">
                          <span className="flex-shrink-0 w-7 h-7 bg-gradient-to-br from-cyan-500 to-cyan-600 text-white rounded-lg flex items-center justify-center font-bold glow-box-cyan">
                            2
                          </span>
                          <span>
                            Review <strong className="text-cyan-400">K-Maps</strong> for simplified boolean expressions
                          </span>
                        </li>
                        <li className="flex gap-3">
                          <span className="flex-shrink-0 w-7 h-7 bg-gradient-to-br from-cyan-500 to-cyan-600 text-white rounded-lg flex items-center justify-center font-bold glow-box-cyan">
                            3
                          </span>
                          <span>
                            Test in <strong className="text-cyan-400">Simulator</strong> with animated Basys 3 board
                          </span>
                        </li>
                        <li className="flex gap-3">
                          <span className="flex-shrink-0 w-7 h-7 bg-gradient-to-br from-cyan-500 to-cyan-600 text-white rounded-lg flex items-center justify-center font-bold glow-box-cyan">
                            4
                          </span>
                          <span>
                            <strong className="text-cyan-400">Export</strong> Verilog code and PDF report for grading
                          </span>
                        </li>
                      </ol>
                    </div>

                    <div className="space-y-4">
                      <div className="bg-cyan-950/30 border border-cyan-700/40 rounded-xl p-5">
                        <h3 className="font-tech font-bold text-cyan-300 mb-3 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                          Key Concepts
                        </h3>
                        <ul className="space-y-2.5 text-sm text-slate-300 font-digital">
                          <li>
                            <strong className="text-cyan-400">Active-Low:</strong> Segment lights when bit = 0
                          </li>
                          <li>
                            <strong className="text-cyan-400">Don't-Cares:</strong> Inputs 10-15 simplify logic
                          </li>
                          <li>
                            <strong className="text-cyan-400">Gray Code:</strong> Adjacent K-map cells differ by 1 bit
                          </li>
                          <li>
                            <strong className="text-cyan-400">SOP Form:</strong> Sum of Products minimal expression
                          </li>
                        </ul>
                      </div>

                      <div className="bg-emerald-950/30 border border-emerald-700/40 rounded-xl p-5">
                        <h3 className="font-tech font-bold text-emerald-300 mb-3 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                          Hardware Target
                        </h3>
                        <div className="text-sm font-digital text-slate-300 space-y-1.5">
                          <p><strong className="text-emerald-400">Board:</strong> Digilent Basys 3</p>
                          <p><strong className="text-emerald-400">FPGA:</strong> Artix-7 XC7A35T</p>
                          <p><strong className="text-emerald-400">Display:</strong> 4-digit common anode</p>
                          <p><strong className="text-emerald-400">Inputs:</strong> SW3-SW0 (4 switches)</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Live Validation on Overview */}
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

            {tab === 'circuit' && (
              <div className="space-y-6">
                <CircuitEditor />
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
          </div>

          {/* Sidebar: Progress Tracker */}
          <aside className="lg:sticky lg:top-24 h-fit">
            <ProgressTracker steps={progressSteps} />
          </aside>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-cyan-500/20 bg-slate-950/80 backdrop-blur-sm mt-16 py-8">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center space-y-3">
            <p className="font-tech-display text-lg font-bold text-cyan-400">
              Lab 3 Webapp v2.0 | RedByte Engineering Tools
            </p>
            <p className="font-digital text-sm text-slate-400">
              Seven-Segment Display Driver Design | Combinational Logic Synthesis
            </p>
            <div className="flex justify-center gap-6 text-xs font-digital text-slate-500 pt-4 border-t border-slate-800">
              <span>💡 Tip: Export your work before closing the browser</span>
              <span>⚡ Auto-saves enabled</span>
              <span>🎯 All tests must pass</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
