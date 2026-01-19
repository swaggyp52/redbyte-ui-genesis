import { useState } from 'react';

type GateType = 'AND' | 'OR' | 'XOR' | 'NAND' | 'NOR' | 'XNOR';

const gateLogic: Record<GateType, (a: boolean, b: boolean) => boolean> = {
  AND: (a, b) => a && b,
  OR: (a, b) => a || b,
  XOR: (a, b) => a !== b,
  NAND: (a, b) => !(a && b),
  NOR: (a, b) => !(a || b),
  XNOR: (a, b) => a === b,
};

export default function LogicGatePlayground() {
  const [inputA, setInputA] = useState(false);
  const [inputB, setInputB] = useState(false);
  const [gateType, setGateType] = useState<GateType>('AND');

  const output = gateLogic[gateType](inputA, inputB);

  const truthTable = [
    [false, false],
    [false, true],
    [true, false],
    [true, true],
  ].map(([a, b]) => ({ a, b, out: gateLogic[gateType](a, b) }));

  return (
    <div className="bg-rb-surface rounded-lg p-8 border border-rb-border">
      <h3 className="text-2xl font-bold mb-6 text-rb-text">Logic Gate Playground</h3>
      
      <div className="grid md:grid-cols-2 gap-8">
        {/* Interactive Circuit */}
        <div className="space-y-6">
          <div>
            <label className="block mb-2 text-sm font-medium text-rb-text">Gate Type</label>
            <select 
              value={gateType} 
              onChange={(e) => setGateType(e.target.value as GateType)}
              className="w-full bg-rb-bg border border-rb-border rounded px-4 py-2 text-rb-text focus:border-rb-accent focus:outline-none"
            >
              {Object.keys(gateLogic).map(gate => (
                <option key={gate} value={gate}>{gate}</option>
              ))}
            </select>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-rb-muted">Input A:</span>
              <button
                onClick={() => setInputA(!inputA)}
                className={`w-20 h-10 rounded border-2 transition-colors font-mono ${
                  inputA 
                    ? 'bg-rb-accent border-rb-accent text-rb-bg' 
                    : 'bg-rb-bg border-rb-border text-rb-muted'
                }`}
              >
                {inputA ? '1' : '0'}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="font-mono text-rb-muted">Input B:</span>
              <button
                onClick={() => setInputB(!inputB)}
                className={`w-20 h-10 rounded border-2 transition-colors font-mono ${
                  inputB 
                    ? 'bg-rb-accent border-rb-accent text-rb-bg' 
                    : 'bg-rb-bg border-rb-border text-rb-muted'
                }`}
              >
                {inputB ? '1' : '0'}
              </button>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-rb-border">
              <span className="font-mono font-bold text-rb-text">Output:</span>
              <div
                className={`w-20 h-10 rounded flex items-center justify-center font-bold font-mono transition-colors ${
                  output 
                    ? 'bg-rb-accent text-rb-bg' 
                    : 'bg-rb-bg text-rb-muted border border-rb-border'
                }`}
              >
                {output ? '1' : '0'}
              </div>
            </div>
          </div>
        </div>

        {/* Truth Table */}
        <div>
          <h4 className="font-semibold mb-4 text-rb-text">Truth Table</h4>
          <table className="w-full border border-rb-border">
            <thead>
              <tr className="bg-rb-bg">
                <th className="border border-rb-border px-4 py-2 text-rb-text">A</th>
                <th className="border border-rb-border px-4 py-2 text-rb-text">B</th>
                <th className="border border-rb-border px-4 py-2 text-rb-text">Output</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {truthTable.map((row, i) => (
                <tr 
                  key={i}
                  className={
                    row.a === inputA && row.b === inputB 
                      ? 'bg-rb-accent/10' 
                      : ''
                  }
                >
                  <td className="border border-rb-border px-4 py-2 text-center text-rb-muted">
                    {row.a ? '1' : '0'}
                  </td>
                  <td className="border border-rb-border px-4 py-2 text-center text-rb-muted">
                    {row.b ? '1' : '0'}
                  </td>
                  <td className="border border-rb-border px-4 py-2 text-center font-bold text-rb-text">
                    {row.out ? '1' : '0'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
