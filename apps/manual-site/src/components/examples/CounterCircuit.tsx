import { useState } from 'react';

export default function CounterCircuit() {
  const [count, setCount] = useState(0);
  const [history, setHistory] = useState<number[]>([0]);

  const clock = () => {
    const newCount = (count + 1) % 16;
    setCount(newCount);
    setHistory(prev => [...prev, newCount].slice(-8));
  };

  const reset = () => {
    setCount(0);
    setHistory([0]);
  };

  const toBinary = (num: number) => num.toString(2).padStart(4, '0');

  return (
    <div className="bg-rb-surface border border-rb-border rounded-md overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-rb-border">
        <h3 className="text-h3 text-rb-text">4-Bit Counter</h3>
        <p className="text-sm text-rb-muted mt-1">
          Sequential logic: registers store state and update on clock edges.
        </p>
      </div>

      <div className="p-6">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Counter Display */}
          <div className="space-y-6">
            {/* Value Display */}
            <div className="text-center py-4">
              <div className="text-xs uppercase tracking-wider text-rb-dim mb-2">Current Value</div>
              <div className="text-6xl font-bold font-mono text-rb-accent tabular-nums">
                {count}
              </div>
              <div className="text-lg font-mono text-rb-muted mt-2 tracking-widest">
                {toBinary(count)}
              </div>
            </div>

            {/* Controls */}
            <div className="flex gap-3 justify-center">
              <button
                type="button"
                onClick={clock}
                className="btn btn-primary flex items-center gap-2"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 2v4h4V2H8zM8 10v4h4v-4H8zM2 2v4h4V2H2zM2 10v4h4v-4H2z" />
                </svg>
                Clock Pulse
              </button>
              <button
                type="button"
                onClick={reset}
                className="btn btn-secondary"
              >
                Reset
              </button>
            </div>

            {/* Binary Bit Display */}
            <div className="flex justify-center gap-2">
              {toBinary(count).split('').map((bit, i) => (
                <div key={i} className="text-center">
                  <div className="text-xs text-rb-dim mb-1">Q{3 - i}</div>
                  <div
                    className={`w-14 h-14 flex items-center justify-center rounded-md text-xl font-bold font-mono border-2 transition-all ${
                      bit === '1'
                        ? 'bg-rb-accent border-rb-accent text-rb-bg'
                        : 'bg-rb-raised border-rb-border text-rb-dim'
                    }`}
                  >
                    {bit}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* History/Timeline */}
          <div>
            <h4 className="text-sm font-semibold text-rb-text mb-3">Clock History</h4>
            <div className="space-y-1.5">
              {history.slice().reverse().map((val, i) => {
                const tick = history.length - i;
                const isCurrent = i === 0;
                return (
                  <div
                    key={tick}
                    className={`flex items-center justify-between p-3 rounded-md font-mono text-sm transition-all ${
                      isCurrent
                        ? 'bg-rb-accent-bg border border-rb-accent'
                        : 'bg-rb-raised border border-rb-border'
                    }`}
                  >
                    <span className={`text-xs ${isCurrent ? 'text-rb-accent' : 'text-rb-dim'}`}>
                      t={tick}
                    </span>
                    <span className={`tracking-widest ${isCurrent ? 'text-rb-text' : 'text-rb-muted'}`}>
                      {toBinary(val)}
                    </span>
                    <span className={`font-semibold ${isCurrent ? 'text-rb-accent' : 'text-rb-text'}`}>
                      {val}
                    </span>
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-rb-dim mt-4 leading-relaxed">
              Each clock pulse increments the counter. When it reaches 15 (1111), it wraps to 0.
              This is how binary counters work in real hardware.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
