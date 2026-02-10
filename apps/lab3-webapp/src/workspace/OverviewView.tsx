import React from 'react';
import { BookOpen } from 'lucide-react';

/**
 * OverviewView: Main Lab 3 overview and instructions
 */
export const OverviewView: React.FC = () => (
  <div className="space-y-4">
    <div className="flex items-center gap-3">
      <BookOpen size={24} className="text-cyan-400" />
      <h2 className="text-2xl font-bold text-cyan-300">Lab 3: Seven-Segment Display Driver</h2>
    </div>

    <p className="text-slate-300 leading-relaxed">
      Design a 4-bit to 7-segment display decoder for digits 0–9 using active-low logic.
    </p>

    <div className="space-y-2">
      <h3 className="font-tech font-bold text-emerald-400">Objectives</h3>
      <ul className="text-slate-300 text-sm space-y-1 ml-4">
        <li>✓ Build and optimize a truth table</li>
        <li>✓ Derive Boolean expressions using K-maps</li>
        <li>✓ Simulate and validate your design</li>
        <li>✓ Export to Verilog or PDF</li>
      </ul>
    </div>

    <div className="space-y-2">
      <h3 className="font-tech font-bold text-emerald-400">Seven-Segment Display</h3>
      <div className="bg-slate-700/30 border border-slate-600/50 rounded p-3 font-mono text-xs space-y-1 text-slate-300">
        <div>seg[0] = 'a' (top)</div>
        <div>seg[1] = 'b' (top-right)</div>
        <div>seg[2] = 'c' (bottom-right)</div>
        <div>seg[3] = 'd' (bottom)</div>
        <div>seg[4] = 'e' (bottom-left)</div>
        <div>seg[5] = 'f' (top-left)</div>
        <div>seg[6] = 'g' (middle)</div>
        <div className="pt-2">Active-low: 0=lit, 1=off</div>
      </div>
    </div>

    <div className="space-y-2">
      <h3 className="font-tech font-bold text-emerald-400">Windows</h3>
      <p className="text-center text-slate-400 text-sm">
        Use the draggable windows in the workspace to navigate and edit.
      </p>
    </div>
  </div>
);
