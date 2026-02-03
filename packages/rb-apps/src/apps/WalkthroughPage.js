import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
const STEPS = [
    {
        title: 'Welcome to the Walkthrough',
        content: (_jsxs(_Fragment, { children: [_jsx("h2", { className: "text-2xl font-bold mb-2", children: "Welcome to RedByte\u2019s 10-Minute Walkthrough" }), _jsx("p", { className: "mb-4", children: "This guided experience will take you from a blank screen to a working digital circuit in RedByte. You\u2019ll build, simulate, and debug a real circuit step by step." }), _jsxs("ul", { className: "list-disc pl-6 mb-4 text-slate-300", children: [_jsx("li", { children: "One step per screen" }), _jsx("li", { children: "Progress bar at the top" }), _jsx("li", { children: "\u201CNext\u201D and \u201CBack\u201D navigation" }), _jsx("li", { children: "Each step ends with a micro-check" })] }), _jsx("p", { className: "italic text-cyan-300", children: "Let\u2019s get started!" })] })),
        check: 'You should now know what this walkthrough will cover.'
    },
    {
        title: 'Open the Logic Playground',
        content: (_jsxs(_Fragment, { children: [_jsx("h2", { className: "text-xl font-semibold mb-2", children: "Step 1: Open the Logic Playground" }), _jsx("p", { children: "Click the Playground icon in the taskbar or use the Command Palette to open the Logic Playground app." }), _jsx("div", { className: "mt-3 p-3 bg-slate-800 rounded text-slate-200", children: "Tip: You can always return to the Guide from the top bar." })] })),
        check: 'You should now have the Playground open.'
    },
    {
        title: 'Place Gates and Wire',
        content: (_jsxs(_Fragment, { children: [_jsx("h2", { className: "text-xl font-semibold mb-2", children: "Step 2: Place Gates and Wire" }), _jsx("p", { children: "Drag an AND gate and two input switches onto the canvas. Connect them with wires to form a basic circuit." }), _jsx("div", { className: "mt-3 p-3 bg-slate-800 rounded text-slate-200", children: "Why this matters: Building from primitives helps you understand circuit logic." })] })),
        check: 'You should now have a simple AND circuit.'
    },
    {
        title: 'Toggle Inputs and Verify',
        content: (_jsxs(_Fragment, { children: [_jsx("h2", { className: "text-xl font-semibold mb-2", children: "Step 3: Toggle Inputs and Verify" }), _jsx("p", { children: "Click the switches to toggle their state. Observe the AND gate output. Try all input combinations to verify the truth table." }), _jsx("div", { className: "mt-3 p-3 bg-slate-800 rounded text-slate-200", children: "Common mistake: Forgetting to test all input combinations." })] })),
        check: 'You should now be able to verify circuit behavior.'
    },
    {
        title: 'Add a Clocked Element',
        content: (_jsxs(_Fragment, { children: [_jsx("h2", { className: "text-xl font-semibold mb-2", children: "Step 4: Add a Clocked Element" }), _jsx("p", { children: "Add a clock and a counter chip. Connect the clock to the counter and observe how the output changes with each tick." }), _jsx("div", { className: "mt-3 p-3 bg-slate-800 rounded text-slate-200", children: "Why this matters: Time is explicit in RedByte, unlike most tools." })] })),
        check: 'You should now see the counter increment with the clock.'
    },
    {
        title: 'Debug with the Waveform Viewer',
        content: (_jsxs(_Fragment, { children: [_jsx("h2", { className: "text-xl font-semibold mb-2", children: "Step 5: Debug with the Waveform Viewer" }), _jsx("p", { children: "Open the waveform/oscilloscope viewer. Step through time and see how signals change. Use this to debug any issues." }), _jsx("div", { className: "mt-3 p-3 bg-slate-800 rounded text-slate-200", children: "Why this matters: Debugging with time is RedByte\u2019s superpower." })] })),
        check: 'You should now be able to debug using the waveform viewer.'
    },
    {
        title: 'Save and Export',
        content: (_jsxs(_Fragment, { children: [_jsx("h2", { className: "text-xl font-semibold mb-2", children: "Step 6: Save and Export" }), _jsx("p", { children: "Click the Save button to store your circuit. Try exporting to see the available formats (even if just as a stub)." }), _jsx("div", { className: "mt-3 p-3 bg-slate-800 rounded text-slate-200", children: "Note: Export options may expand in the future." })] })),
        check: 'You should now know how to save and export.'
    },
    {
        title: 'You Did It!',
        content: (_jsxs(_Fragment, { children: [_jsx("h2", { className: "text-2xl font-bold mb-2", children: "Walkthrough Complete!" }), _jsx("p", { children: "You\u2019ve built, simulated, and debugged a real circuit in RedByte. You\u2019re ready to explore more on your own or dive into advanced topics in the Guide." }), _jsx("div", { className: "mt-3 p-3 bg-cyan-800 rounded text-cyan-100", children: "You should now be able to build and debug basic circuits in RedByte." })] })),
        check: 'You should now be confident using RedByte.'
    }
];
export default function WalkthroughPage() {
    const [step, setStep] = useState(0);
    const [presenter, setPresenter] = useState(false);
    const goTo = (idx) => setStep(Math.max(0, Math.min(STEPS.length - 1, idx)));
    return (_jsx("div", { className: `min-h-screen bg-slate-900 text-white flex flex-col items-center ${presenter ? 'text-2xl' : ''}`, children: _jsxs("div", { className: "w-full max-w-2xl px-4 py-6", children: [_jsxs("div", { className: "flex items-center justify-between mb-6", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: "font-bold text-cyan-400", children: "RedByte Walkthrough" }), _jsxs("span", { className: "text-xs text-slate-400", children: ["Step ", step + 1, " of ", STEPS.length] })] }), _jsx("button", { className: `px-3 py-1 rounded ${presenter ? 'bg-cyan-700' : 'bg-slate-800'} text-xs font-semibold`, onClick: () => setPresenter((p) => !p), title: "Toggle Presenter Mode", children: presenter ? 'Presenter Mode: On' : 'Presenter Mode' })] }), _jsx("div", { className: "w-full bg-slate-800 rounded h-2 mb-6", children: _jsx("div", { className: "bg-cyan-500 h-2 rounded", style: { width: `${((step + 1) / STEPS.length) * 100}%` } }) }), _jsx("div", { className: "bg-slate-950 rounded-lg p-6 shadow-lg mb-4", children: STEPS[step].content }), _jsxs("div", { className: "flex items-center justify-between mt-4", children: [_jsx("button", { className: "px-4 py-2 rounded bg-slate-700 text-slate-200 disabled:opacity-50", onClick: () => goTo(step - 1), disabled: step === 0, children: "Back" }), _jsx("div", { className: "flex-1 text-center text-cyan-300 text-sm", children: STEPS[step].check }), _jsx("button", { className: "px-4 py-2 rounded bg-cyan-600 text-white disabled:opacity-50", onClick: () => goTo(step + 1), disabled: step === STEPS.length - 1, children: step === STEPS.length - 1 ? 'Done' : 'Next' })] }), _jsxs("div", { className: "mt-4 flex items-center gap-2", children: [_jsx("label", { htmlFor: "jump-step", className: "text-xs text-slate-400", children: "Jump to step:" }), _jsx("select", { id: "jump-step", value: step, onChange: e => goTo(Number(e.target.value)), className: "bg-slate-800 text-white rounded px-2 py-1", children: STEPS.map((s, i) => (_jsxs("option", { value: i, children: [i + 1, ". ", s.title] }, i))) })] })] }) }));
}
