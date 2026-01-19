import React, { useState } from 'react';

const STEPS = [
  {
    title: 'Welcome to the Walkthrough',
    content: (
      <>
        <h2 className="text-2xl font-bold mb-2">Welcome to RedByte’s 10-Minute Walkthrough</h2>
        <p className="mb-4">This guided experience will take you from a blank screen to a working digital circuit in RedByte. You’ll build, simulate, and debug a real circuit step by step.</p>
        <ul className="list-disc pl-6 mb-4 text-slate-300">
          <li>One step per screen</li>
          <li>Progress bar at the top</li>
          <li>“Next” and “Back” navigation</li>
          <li>Each step ends with a micro-check</li>
        </ul>
        <p className="italic text-cyan-300">Let’s get started!</p>
      </>
    ),
    check: 'You should now know what this walkthrough will cover.'
  },
  {
    title: 'Open the Logic Playground',
    content: (
      <>
        <h2 className="text-xl font-semibold mb-2">Step 1: Open the Logic Playground</h2>
        <p>Click the Playground icon in the taskbar or use the Command Palette to open the Logic Playground app.</p>
        <div className="mt-3 p-3 bg-slate-800 rounded text-slate-200">Tip: You can always return to the Guide from the top bar.</div>
      </>
    ),
    check: 'You should now have the Playground open.'
  },
  {
    title: 'Place Gates and Wire',
    content: (
      <>
        <h2 className="text-xl font-semibold mb-2">Step 2: Place Gates and Wire</h2>
        <p>Drag an AND gate and two input switches onto the canvas. Connect them with wires to form a basic circuit.</p>
        <div className="mt-3 p-3 bg-slate-800 rounded text-slate-200">Why this matters: Building from primitives helps you understand circuit logic.</div>
      </>
    ),
    check: 'You should now have a simple AND circuit.'
  },
  {
    title: 'Toggle Inputs and Verify',
    content: (
      <>
        <h2 className="text-xl font-semibold mb-2">Step 3: Toggle Inputs and Verify</h2>
        <p>Click the switches to toggle their state. Observe the AND gate output. Try all input combinations to verify the truth table.</p>
        <div className="mt-3 p-3 bg-slate-800 rounded text-slate-200">Common mistake: Forgetting to test all input combinations.</div>
      </>
    ),
    check: 'You should now be able to verify circuit behavior.'
  },
  {
    title: 'Add a Clocked Element',
    content: (
      <>
        <h2 className="text-xl font-semibold mb-2">Step 4: Add a Clocked Element</h2>
        <p>Add a clock and a counter chip. Connect the clock to the counter and observe how the output changes with each tick.</p>
        <div className="mt-3 p-3 bg-slate-800 rounded text-slate-200">Why this matters: Time is explicit in RedByte, unlike most tools.</div>
      </>
    ),
    check: 'You should now see the counter increment with the clock.'
  },
  {
    title: 'Debug with the Waveform Viewer',
    content: (
      <>
        <h2 className="text-xl font-semibold mb-2">Step 5: Debug with the Waveform Viewer</h2>
        <p>Open the waveform/oscilloscope viewer. Step through time and see how signals change. Use this to debug any issues.</p>
        <div className="mt-3 p-3 bg-slate-800 rounded text-slate-200">Why this matters: Debugging with time is RedByte’s superpower.</div>
      </>
    ),
    check: 'You should now be able to debug using the waveform viewer.'
  },
  {
    title: 'Save and Export',
    content: (
      <>
        <h2 className="text-xl font-semibold mb-2">Step 6: Save and Export</h2>
        <p>Click the Save button to store your circuit. Try exporting to see the available formats (even if just as a stub).</p>
        <div className="mt-3 p-3 bg-slate-800 rounded text-slate-200">Note: Export options may expand in the future.</div>
      </>
    ),
    check: 'You should now know how to save and export.'
  },
  {
    title: 'You Did It!',
    content: (
      <>
        <h2 className="text-2xl font-bold mb-2">Walkthrough Complete!</h2>
        <p>You’ve built, simulated, and debugged a real circuit in RedByte. You’re ready to explore more on your own or dive into advanced topics in the Guide.</p>
        <div className="mt-3 p-3 bg-cyan-800 rounded text-cyan-100">You should now be able to build and debug basic circuits in RedByte.</div>
      </>
    ),
    check: 'You should now be confident using RedByte.'
  }
];

export default function WalkthroughPage() {
  const [step, setStep] = useState(0);
  const [presenter, setPresenter] = useState(false);

  const goTo = (idx: number) => setStep(Math.max(0, Math.min(STEPS.length - 1, idx)));

  return (
    <div className={`min-h-screen bg-slate-900 text-white flex flex-col items-center ${presenter ? 'text-2xl' : ''}`}>
      <div className="w-full max-w-2xl px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="font-bold text-cyan-400">RedByte Walkthrough</span>
            <span className="text-xs text-slate-400">Step {step + 1} of {STEPS.length}</span>
          </div>
          <button
            className={`px-3 py-1 rounded ${presenter ? 'bg-cyan-700' : 'bg-slate-800'} text-xs font-semibold`}
            onClick={() => setPresenter((p) => !p)}
            title="Toggle Presenter Mode"
          >
            {presenter ? 'Presenter Mode: On' : 'Presenter Mode'}
          </button>
        </div>
        <div className="w-full bg-slate-800 rounded h-2 mb-6">
          <div
            className="bg-cyan-500 h-2 rounded"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
        <div className="bg-slate-950 rounded-lg p-6 shadow-lg mb-4">
          {STEPS[step].content}
        </div>
        <div className="flex items-center justify-between mt-4">
          <button
            className="px-4 py-2 rounded bg-slate-700 text-slate-200 disabled:opacity-50"
            onClick={() => goTo(step - 1)}
            disabled={step === 0}
          >
            Back
          </button>
          <div className="flex-1 text-center text-cyan-300 text-sm">{STEPS[step].check}</div>
          <button
            className="px-4 py-2 rounded bg-cyan-600 text-white disabled:opacity-50"
            onClick={() => goTo(step + 1)}
            disabled={step === STEPS.length - 1}
          >
            {step === STEPS.length - 1 ? 'Done' : 'Next'}
          </button>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <label htmlFor="jump-step" className="text-xs text-slate-400">Jump to step:</label>
          <select
            id="jump-step"
            value={step}
            onChange={e => goTo(Number(e.target.value))}
            className="bg-slate-800 text-white rounded px-2 py-1"
          >
            {STEPS.map((s, i) => (
              <option key={i} value={i}>{i + 1}. {s.title}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
