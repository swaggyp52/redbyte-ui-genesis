import React from 'react';
import { PluginRegistry, PluginViewSpec } from './PluginRegistry';
import { TruthTableEditor } from '../truth-table';
import { KMapViewer } from '../kmap-viewer-interactive';
import { CircuitEditor } from '../circuit-editor';
import { Simulator } from '../simulator';
import { WaveformViewer } from '../waveform-viewer-enhanced';
import { VerilogExporter } from '../verilog';
import { PdfExporter } from '../pdf-exporter';

/**
 * Stub components for console and inspector (to be implemented in window manager phase)
 */
const OverviewView: React.FC = () => (
  <div className="p-4">
    <h2 className="text-2xl font-bold mb-2">Lab 3: Seven-Segment Display Driver</h2>
    <p className="text-slate-300">Design a 4-bit to 7-segment decoder | Active-low logic | Digits 0–9</p>
  </div>
);

const ConsoleStub: React.FC = () => (
  <div className="p-4 text-slate-400">
    <h3 className="font-bold mb-2">Console (events log)</h3>
    <p className="text-sm">Window manager phase will populate this with emitted events.</p>
  </div>
);

const InspectorStub: React.FC = () => (
  <div className="p-4 text-slate-400">
    <h3 className="font-bold mb-2">Inspector (state viewer)</h3>
    <p className="text-sm">Window manager phase will show selected doc state here.</p>
  </div>
);

/**
 * Register Lab 3 plugin with all views
 * Called once on app mount
 */
export function registerLab3(registry: PluginRegistry): void {
  const lab3Views: PluginViewSpec[] = [
    {
      pluginId: 'lab3',
      viewId: 'overview',
      title: 'Overview',
      icon: 'BookOpen',
      Component: OverviewView,
    },
    {
      pluginId: 'lab3',
      viewId: 'truth-table',
      title: 'Truth Table',
      icon: 'Table',
      Component: TruthTableEditor,
    },
    {
      pluginId: 'lab3',
      viewId: 'kmap',
      title: 'K-Maps',
      icon: 'Target',
      Component: KMapViewer,
    },
    {
      pluginId: 'lab3',
      viewId: 'circuit',
      title: 'Circuit',
      icon: 'Cpu',
      Component: CircuitEditor,
    },
    {
      pluginId: 'lab3',
      viewId: 'simulator',
      title: 'Simulator',
      icon: 'PlayCircle',
      Component: Simulator,
    },
    {
      pluginId: 'lab3',
      viewId: 'waveform',
      title: 'Waveform',
      icon: 'TrendingUp',
      Component: WaveformViewer,
    },
    {
      pluginId: 'lab3',
      viewId: 'verilog',
      title: 'Verilog',
      icon: 'FileCode',
      Component: VerilogExporter,
    },
    {
      pluginId: 'lab3',
      viewId: 'pdf',
      title: 'PDF Export',
      icon: 'Download',
      Component: PdfExporter,
    },
    {
      pluginId: 'lab3',
      viewId: 'console',
      title: 'Console',
      icon: 'TerminalSquare',
      Component: ConsoleStub,
    },
    {
      pluginId: 'lab3',
      viewId: 'inspector',
      title: 'Inspector',
      icon: 'Eye',
      Component: InspectorStub,
    },
  ];

  registry.registerPlugin('lab3', lab3Views);
}
