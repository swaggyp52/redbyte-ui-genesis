import { useState } from 'react';

export default function CounterCircuit() {
  const [count, setCount] = useState(0);
  const [history, setHistory] = useState<number[]>([0]);

  const clock = () => {
    const newCount = (count + 1) % 16;
    setCount(newCount);
    setHistory([...history, newCount].slice(-8));
  };

  const reset = () => {
    setCount(0);
    setHistory([0]);
  };

  const toBinary = (num: number) => num.toString(2).padStart(4, '0');

  return (
    <div className="bg-rb-surface rounded-lg p-8 border border-rb-border">
      <h3 className="text-2xl font-bold mb-6 text-rb-text">4-Bit Counter Circuit</h3>
      
      <div className="grid md:grid-cols-2 gap-8">
        {/* Counter Display */}
        <div className="space-y-6">
          <div className="text-center">
            <div className="text-sm text-rb-muted mb-2">Current Value</div>
            <div className="text-6xl font-bold font-mono text-rb-accent">
              {count}
            </div>
            <div className="text-xl font-mono text-rb-muted mt-2">
              {toBinary(count)}
            </div>
          </div>

          <div className="flex gap-4 justify-center">
            <button
              onClick={clock}
              className="px-8 py-3 bg-rb-accent text-rb-bg font-medium rounded hover:bg-rb-accent-dim transition-colors"
            >
              ⏱ Clock Pulse
            </button>
            <button
              onClick={reset}
              className="px-8 py-3 bg-rb-bg border border-rb-border text-rb-text font-medium rounded hover:border-rb-accent transition-colors"
            >
              Reset
            </button>
          </div>

          {/* Binary Representation */}
          <div className="flex justify-center gap-2">
            {toBinary(count).split('').map((bit, i) => (
              <div 
                key={i}
                className={`w-16 h-16 flex items-center justify-center rounded text-2xl font-bold font-mono border-2 transition-colors ${
                  bit === '1'
                    ? 'bg-rb-accent border-rb-accent text-rb-bg'
                    : 'bg-rb-bg border-rb-border text-rb-muted'
                }`}
              >
                {bit}
              </div>
            ))}
          </div>
        </div>

        {/* History/Timeline */}
        <div>
          <h4 className="font-semibold mb-4 text-rb-text">Clock History</h4>
          <div className="space-y-2">
            {history.slice().reverse().map((val, i) => (
              <div 
                key={history.length - i}
                className={`p-3 rounded border font-mono flex justify-between items-center ${
                  i === 0 
                    ? 'bg-rb-accent/10 border-rb-accent' 
                    : 'bg-rb-bg border-rb-border'
                }`}
              >
                <span className="text-sm text-rb-muted">Clock {history.length - i}</span>
                <span className="font-bold text-rb-muted">{toBinary(val)}</span>
                <span className="text-lg text-rb-text">{val}</span>
              </div>
            ))}
          </div>
          <p className="text-sm text-rb-muted mt-4">
            💡 This demonstrates how registers store and update state on each clock cycle.
          </p>
        </div>
      </div>
    </div>
  );
}
