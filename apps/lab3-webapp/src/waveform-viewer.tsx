import React, { useMemo } from 'react';
import { useLabStore } from './store';
import { Play, Pause } from 'lucide-react';

export const WaveformViewer: React.FC = () => {
  const waveformHistory = useLabStore((s) => s.waveformHistory);
  const simulationMode = useLabStore((s) => s.simulationMode);
  const setSimulationMode = useLabStore((s) => s.setSimulationMode);
  const stepSimulation = useLabStore((s) => s.stepSimulation);
  const resetSimulation = useLabStore((s) => s.resetSimulation);
  const currentStep = useLabStore((s) => s.currentStep);

  const SEGMENT_NAMES = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  const INPUT_NAMES = ['B3', 'B2', 'B1', 'B0'];

  const timelineWidth = Math.max(300, waveformHistory.length * 30);

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-slate-50 rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-cyan-400">Waveform Mini-Scope</h3>
        <div className="flex gap-2">
          {simulationMode === 'manual' ? (
            <button
              onClick={() => setSimulationMode('step')}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded flex items-center gap-2 text-sm font-medium transition-colors"
            >
              <Play size={16} />
              Step-Through
            </button>
          ) : (
            <>
              <button
                onClick={() => setSimulationMode('manual')}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded flex items-center gap-2 text-sm font-medium transition-colors"
              >
                <Pause size={16} />
                Stop
              </button>
              <button
                onClick={stepSimulation}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded text-sm font-medium transition-colors"
                disabled={currentStep >= 16}
              >
                Next
              </button>
            </>
          )}
          {waveformHistory.length > 0 && (
            <button
              onClick={resetSimulation}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm font-medium transition-colors"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {waveformHistory.length === 0 ? (
        <div className="text-slate-400 text-center py-8">
          Click "Run All 16 Vectors" or "Step-Through" to see waveforms
        </div>
      ) : (
        <div className="bg-slate-900 rounded p-4 overflow-x-auto">
          <div style={{ width: timelineWidth }}>
            {/* Time axis */}
            <div className="flex items-end gap-1 mb-1 pl-32">
              {waveformHistory.map((sample) => (
                <div
                  key={sample.time}
                  className="text-xs text-slate-500 font-mono"
                  style={{ width: '30px', textAlign: 'center' }}
                >
                  {sample.time}
                </div>
              ))}
            </div>

            {/* Signals */}
            <div className="space-y-2">
              {/* Input signals */}
              <div className="text-xs text-slate-400 font-bold mb-3">INPUTS</div>
              {INPUT_NAMES.map((inputName, inputIdx) => (
                <div key={inputName} className="flex items-center gap-1">
                  <div className="w-32 text-xs font-mono text-slate-300">{inputName}</div>
                  <div className="flex gap-1">
                    {waveformHistory.map((sample) => (
                      <SignalBlock
                        key={`${inputName}-${sample.time}`}
                        value={sample.inputs[inputIdx]}
                        width={30}
                      />
                    ))}
                  </div>
                </div>
              ))}

              <div className="my-4 border-t border-slate-700" />

              {/* Output signals */}
              <div className="text-xs text-slate-400 font-bold mb-3">SEGMENT OUTPUTS</div>
              {SEGMENT_NAMES.map((segName, segIdx) => (
                <div key={segName} className="flex items-center gap-1">
                  <div className="w-32 text-xs font-mono text-slate-300">seg_{segName}</div>
                  <div className="flex gap-1">
                    {waveformHistory.map((sample) => (
                      <SignalBlock
                        key={`seg_${segName}-${sample.time}`}
                        value={sample.outputs[segIdx]}
                        width={30}
                        isOutput
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {simulationMode === 'step' && waveformHistory.length > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded p-3 text-sm">
          <div className="text-slate-300">
            Step {waveformHistory.length} of 16
            {waveformHistory.length === 16 && <span className="text-emerald-400 ml-2">✓ Complete</span>}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {currentStep >= 16 ? 'All vectors simulated.' : `Press "Next" to step through.`}
          </div>
        </div>
      )}
    </div>
  );
};

interface SignalBlockProps {
  value: 0 | 1;
  width: number;
  isOutput?: boolean;
}

const SignalBlock: React.FC<SignalBlockProps> = ({ value, width, isOutput }) => {
  return (
    <div
      style={{ width }}
      className={`h-6 rounded-sm font-mono text-xs flex items-center justify-center font-bold transition-all ${
        value === 1
          ? isOutput
            ? 'bg-emerald-600/50 text-emerald-200 border border-emerald-500'
            : 'bg-blue-600/50 text-blue-200 border border-blue-500'
          : 'bg-slate-700 text-slate-400 border border-slate-600'
      }`}
      title={`Value: ${value}`}
    >
      {value}
    </div>
  );
};
