import React from 'react';
import type { SignalSource } from './types';

interface SerialPanelProps {
  signalSource: SignalSource | null;
}

export const SerialPanel: React.FC<SerialPanelProps> = ({ signalSource }) => {
  if (!signalSource?.getSerialLog) {
    return <div className="text-xs text-gray-500">No serial data available.</div>;
  }

  const lines = signalSource.getSerialLog();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-gray-200">Serial Output</div>
        {signalSource.clearSerialLog && (
          <button
            onClick={() => signalSource.clearSerialLog?.()}
            className="text-[10px] text-gray-400 hover:text-gray-200"
            type="button"
          >
            Clear
          </button>
        )}
      </div>
      <pre className="flex-1 bg-black/60 border border-gray-700 rounded p-2 text-[10px] text-green-200 font-mono overflow-auto whitespace-pre-wrap">
        {lines.length > 0 ? lines.join('') : 'No output yet.'}
      </pre>
    </div>
  );
};
