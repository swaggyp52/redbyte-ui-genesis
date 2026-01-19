import { useState } from 'react';

type GateType = 'AND' | 'OR' | 'XOR' | 'NAND' | 'NOR' | 'XNOR' | 'NOT';

const gateLogic: Record<GateType, (a: boolean, b?: boolean) => boolean> = {
  AND: (a, b) => a && (b ?? false),
  OR: (a, b) => a || (b ?? false),
  XOR: (a, b) => a !== (b ?? false),
  NAND: (a, b) => !(a && (b ?? false)),
  NOR: (a, b) => !(a || (b ?? false)),
  XNOR: (a, b) => a === (b ?? false),
  NOT: (a) => !a,
};

const gateDescriptions: Record<GateType, string> = {
  AND: 'Output is 1 only when both inputs are 1',
  OR: 'Output is 1 when at least one input is 1',
  XOR: 'Output is 1 when inputs are different',
  NAND: 'Output is 0 only when both inputs are 1',
  NOR: 'Output is 0 when at least one input is 1',
  XNOR: 'Output is 1 when inputs are the same',
  NOT: 'Output is the inverse of the input',
};

export default function LogicGatePlayground() {
  const [inputA, setInputA] = useState(false);
  const [inputB, setInputB] = useState(false);
  const [gateType, setGateType] = useState<GateType>('AND');

  const isUnary = gateType === 'NOT';
  const output = gateLogic[gateType](inputA, isUnary ? undefined : inputB);

  const truthTable = isUnary
    ? [false, true].map((a) => ({ a, b: null, out: gateLogic[gateType](a) }))
    : [
        [false, false],
        [false, true],
        [true, false],
        [true, true],
      ].map(([a, b]) => ({ a, b, out: gateLogic[gateType](a, b) }));

  return (
    <div className="bg-rb-surface border border-rb-border rounded-md overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-rb-border">
        <h3 className="text-h3 text-rb-text">Logic Gate Playground</h3>
        <p className="text-sm text-rb-muted mt-1">Toggle inputs and select gates to see how logic flows.</p>
      </div>

      <div className="p-6">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Interactive Circuit */}
          <div className="space-y-6">
            {/* Gate Selector */}
            <div>
              <label htmlFor="gate-type" className="block mb-2 text-sm font-medium text-rb-text">
                Gate Type
              </label>
              <select
                id="gate-type"
                value={gateType}
                onChange={(e) => setGateType(e.target.value as GateType)}
                className="w-full bg-rb-raised border border-rb-border rounded-md px-4 py-2.5 text-rb-text focus:border-rb-accent focus:outline-none transition-colors"
              >
                {Object.keys(gateLogic).map((gate) => (
                  <option key={gate} value={gate}>
                    {gate}
                  </option>
                ))}
              </select>
              <p className="text-xs text-rb-dim mt-2">{gateDescriptions[gateType]}</p>
            </div>

            {/* Input Toggles */}
            <div className="space-y-3">
              <InputToggle
                label="Input A"
                value={inputA}
                onChange={() => setInputA(!inputA)}
              />
              {!isUnary && (
                <InputToggle
                  label="Input B"
                  value={inputB}
                  onChange={() => setInputB(!inputB)}
                />
              )}
            </div>

            {/* Output Display */}
            <div className="pt-4 border-t border-rb-border">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm text-rb-muted">Output</span>
                <div
                  className={`w-20 h-10 rounded-md flex items-center justify-center font-bold font-mono text-lg transition-all ${
                    output
                      ? 'bg-rb-accent text-rb-bg'
                      : 'bg-rb-raised border border-rb-border text-rb-dim'
                  }`}
                >
                  {output ? '1' : '0'}
                </div>
              </div>
            </div>
          </div>

          {/* Truth Table */}
          <div>
            <h4 className="text-sm font-semibold text-rb-text mb-3">Truth Table</h4>
            <div className="bg-rb-raised border border-rb-border rounded-md overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-rb-bg text-xs uppercase tracking-wider">
                    <th className="px-4 py-3 text-rb-dim font-medium text-left">A</th>
                    {!isUnary && <th className="px-4 py-3 text-rb-dim font-medium text-left">B</th>}
                    <th className="px-4 py-3 text-rb-dim font-medium text-left">Out</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-sm">
                  {truthTable.map((row, i) => {
                    const isActive = isUnary
                      ? row.a === inputA
                      : row.a === inputA && row.b === inputB;
                    return (
                      <tr
                        key={i}
                        className={`border-t border-rb-border transition-colors ${
                          isActive ? 'bg-rb-accent-bg' : ''
                        }`}
                      >
                        <td className="px-4 py-2.5 text-rb-muted">{row.a ? '1' : '0'}</td>
                        {!isUnary && (
                          <td className="px-4 py-2.5 text-rb-muted">{row.b ? '1' : '0'}</td>
                        )}
                        <td className={`px-4 py-2.5 font-semibold ${row.out ? 'text-rb-accent' : 'text-rb-dim'}`}>
                          {row.out ? '1' : '0'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InputToggle({ label, value, onChange }: { label: string; value: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-mono text-sm text-rb-muted">{label}</span>
      <button
        type="button"
        aria-label={`Toggle ${label}`}
        onClick={onChange}
        className={`w-20 h-10 rounded-md border-2 transition-all font-mono font-semibold ${
          value
            ? 'bg-rb-accent border-rb-accent text-rb-bg'
            : 'bg-rb-raised border-rb-border text-rb-dim hover:border-rb-border-strong'
        }`}
      >
        {value ? '1' : '0'}
      </button>
    </div>
  );
}
