import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { HelpLayout, HelpSection, Callout, TruthTable, LessonNav, } from '../components/help';
const LogicHelpComponent = ({ onDispatchIntent }) => {
    const [viewMode, setViewMode] = useState('tracks');
    const [selectedTrack, setSelectedTrack] = useState(null);
    const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
    const [completedLessons, setCompletedLessons] = useState(new Set());
    // Track definitions
    const tracks = {
        A: {
            id: 'A',
            title: 'Track A: Introduction to Logic',
            description: 'Learn the fundamentals of binary logic, truth values, and basic gates',
            lessons: [
                {
                    id: 'A1',
                    title: 'Hello, Circuit!',
                },
                {
                    id: 'A2',
                    title: 'Manual Control (Switches)',
                },
                {
                    id: 'A3',
                    title: 'NOT Gate - The Inverter',
                },
                {
                    id: 'A4',
                    title: 'AND Gate - Both Required',
                },
                {
                    id: 'A5',
                    title: 'OR Gate - Either Works',
                },
                {
                    id: 'A6',
                    title: 'Truth Tables - The Gate Contract',
                },
                {
                    id: 'A7',
                    title: 'NAND & NOR - Universal Gates',
                },
                {
                    id: 'A8',
                    title: 'Track A Complete!',
                },
            ],
        },
        B: {
            id: 'B',
            title: 'Track B: Intermediate Logic',
            description: 'Build more complex circuits with XOR, muxes, and adders',
            lessons: [
                {
                    id: 'B1',
                    title: 'XOR - Exclusive OR',
                },
                {
                    id: 'B2',
                    title: 'Half Adder - Adding 1-bit Numbers',
                },
                {
                    id: 'B3',
                    title: 'Full Adder - Ripple Carry',
                },
                {
                    id: 'B4',
                    title: 'Multiplexer (Mux) - Data Selector',
                },
                {
                    id: 'B5',
                    title: 'Demultiplexer - Data Router',
                },
                {
                    id: 'B6',
                    title: 'Track B Complete!',
                },
            ],
        },
        C: {
            id: 'C',
            title: 'Track C: Sequential Logic',
            description: 'Master memory, state machines, and CPU fundamentals',
            lessons: [
                {
                    id: 'C1',
                    title: 'The Need for Memory',
                },
                {
                    id: 'C2',
                    title: 'SR Latch - Basic Memory Cell',
                },
                {
                    id: 'C3',
                    title: 'D Latch - Controlled Memory',
                },
                {
                    id: 'C4',
                    title: 'D Flip-Flop - Edge-Triggered Memory',
                },
                {
                    id: 'C5',
                    title: 'Registers & Counters',
                },
                {
                    id: 'C6',
                    title: 'Finite State Machines',
                },
                {
                    id: 'C7',
                    title: 'Simple CPU - Bringing It All Together',
                },
                {
                    id: 'C8',
                    title: 'Reflection & The Journey Forward',
                },
            ],
        },
    };
    // Lesson content renderer
    const renderLessonContent = (trackId, lessonId) => {
        // A1: Hello, Circuit!
        if (lessonId === 'A1') {
            return (_jsxs(_Fragment, { children: [_jsx(HelpSection, { kind: "concept", children: _jsx("p", { children: "A circuit needs a complete path for electricity to flow. When power connects to a component like a lamp, electrons flow through it." }) }), _jsx(HelpSection, { kind: "build", children: _jsxs("ol", { className: "list-decimal list-inside space-y-1", children: [_jsx("li", { children: "Open Logic Playground (if not already open)" }), _jsxs("li", { children: ["Find the ", _jsx("strong", { children: "Power" }), " source in the component palette"] }), _jsxs("li", { children: ["Find the ", _jsx("strong", { children: "Lamp" }), " component"] }), _jsx("li", { children: "Connect the Power to the Lamp by dragging a wire" })] }) }), _jsx(HelpSection, { kind: "simulate", children: _jsxs("p", { children: [_jsx("strong", { children: "What happens?" }), " The lamp lights up immediately! You've created a closed circuit."] }) }), _jsx(HelpSection, { kind: "explain", children: _jsxs(Callout, { children: [_jsx("strong", { children: "Closed Circuit:" }), " When components form a complete path from power source back to ground, electricity flows and the lamp turns on."] }) }), _jsx(HelpSection, { kind: "reflect", children: _jsx(Callout, { variant: "reflect", children: "Think: What would happen if you disconnected the wire? (The lamp would turn off because the circuit is broken!)" }) })] }));
        }
        // A2: Manual Control (Switches)
        if (lessonId === 'A2') {
            return (_jsxs(_Fragment, { children: [_jsx(HelpSection, { kind: "concept", children: _jsxs("p", { children: ["A switch lets you control the flow of electricity. Digital logic uses two states: ", _jsx("strong", { children: "1" }), " (ON, TRUE) and ", _jsx("strong", { children: "0" }), " (OFF, FALSE)."] }) }), _jsx(HelpSection, { kind: "build", children: _jsxs("ol", { className: "list-decimal list-inside space-y-1", children: [_jsx("li", { children: "Create a new circuit (or clear the previous one)" }), _jsxs("li", { children: ["Add a ", _jsx("strong", { children: "Switch" }), " component"] }), _jsx("li", { children: "Connect: Power \u2192 Switch \u2192 Lamp" })] }) }), _jsx(HelpSection, { kind: "simulate", children: _jsxs("ol", { className: "list-decimal list-inside space-y-1", children: [_jsx("li", { children: "Click the switch to turn it ON (1) - observe the lamp lights up" }), _jsx("li", { children: "Click again to turn it OFF (0) - observe the lamp goes dark" }), _jsx("li", { children: "Toggle it several times to see the immediate response" })] }) }), _jsx(HelpSection, { kind: "explain", children: _jsxs(Callout, { children: [_jsx("strong", { children: "Binary States:" }), _jsxs("ul", { className: "list-disc list-inside mt-2 space-y-1", children: [_jsxs("li", { children: [_jsx("strong", { children: "1 (ON):" }), " Switch closed, electricity flows, lamp lights"] }), _jsxs("li", { children: [_jsx("strong", { children: "0 (OFF):" }), " Switch open, no flow, lamp is dark"] })] }), _jsx("p", { className: "mt-2", children: "This on/off concept is the foundation of all digital computing!" })] }) }), _jsx(HelpSection, { kind: "reflect", children: _jsx(Callout, { variant: "reflect", children: "Think: In your computer's processor right now, billions of tiny switches are turning on and off to run this program." }) })] }));
        }
        // A3: NOT Gate
        if (lessonId === 'A3') {
            return (_jsxs(_Fragment, { children: [_jsx(HelpSection, { kind: "concept", children: _jsxs("p", { children: ["The ", _jsx("strong", { children: "NOT gate" }), " (also called an inverter) flips the input. If you give it 1, it outputs 0. If you give it 0, it outputs 1."] }) }), _jsx(HelpSection, { kind: "build", children: _jsxs("ol", { className: "list-decimal list-inside space-y-1", children: [_jsxs("li", { children: ["Place a ", _jsx("strong", { children: "NOT" }), " gate on your canvas"] }), _jsx("li", { children: "Connect a switch to the input" }), _jsx("li", { children: "Connect a lamp to the output" })] }) }), _jsxs(HelpSection, { kind: "simulate", children: [_jsx(TruthTable, { headers: ['Input', 'Output'], rows: [[0, 1], [1, 0]] }), _jsx("p", { className: "mt-2 text-sm", children: "Toggle the switch and confirm the lamp does the opposite." })] }), _jsx(HelpSection, { kind: "explain", children: _jsxs(Callout, { children: [_jsx("strong", { children: "Why NOT Matters:" }), _jsx("p", { className: "mt-2", children: "Inversion is everywhere in computing. Conditional logic (\"if NOT raining\"), password validation (\"if NOT correct\"), boolean algebra \u2013 all rely on the ability to flip a signal." })] }) }), _jsx(HelpSection, { kind: "reflect", children: _jsx(Callout, { variant: "reflect", children: "Think: You just used a gate for the first time! Gates are the building blocks of all computation." }) })] }));
        }
        // A4: AND Gate
        if (lessonId === 'A4') {
            return (_jsxs(_Fragment, { children: [_jsx(HelpSection, { kind: "concept", children: _jsxs("p", { children: ["The ", _jsx("strong", { children: "AND gate" }), " outputs 1 only when ", _jsx("em", { children: "both" }), " inputs are 1. If either input is 0, the output is 0."] }) }), _jsx(HelpSection, { kind: "build", children: _jsxs("ol", { className: "list-decimal list-inside space-y-1", children: [_jsxs("li", { children: ["Place an ", _jsx("strong", { children: "AND" }), " gate"] }), _jsx("li", { children: "Connect two switches to the inputs" }), _jsx("li", { children: "Connect a lamp to the output" })] }) }), _jsxs(HelpSection, { kind: "simulate", children: [_jsx(TruthTable, { headers: ['A', 'B', 'Output'], rows: [[0, 0, 0], [0, 1, 0], [1, 0, 0], [1, 1, 1]], highlightedCells: new Set(['3-2']) }), _jsxs("p", { className: "mt-2 text-sm", children: ["Only when ", _jsx("strong", { children: "both A=1 AND B=1" }), " does the lamp light."] })] }), _jsx(HelpSection, { kind: "explain", children: _jsxs(Callout, { children: [_jsx("strong", { children: "AND in Real Life:" }), _jsxs("ul", { className: "list-disc list-inside mt-2 space-y-1", children: [_jsx("li", { children: "Alarm systems: Motion detected AND door open \u2192 sound alarm" }), _jsx("li", { children: "Cars: Brake pressed AND gear in drive \u2192 brake lights on" }), _jsx("li", { children: "Permissions: User logged in AND has admin rights \u2192 allow action" })] })] }) }), _jsx(HelpSection, { kind: "reflect", children: _jsx(Callout, { variant: "reflect", children: "Think: How many AND decisions does your brain make every day? \"If hungry AND food available, eat.\"" }) })] }));
        }
        // A5: OR Gate
        if (lessonId === 'A5') {
            return (_jsxs(_Fragment, { children: [_jsx(HelpSection, { kind: "concept", children: _jsxs("p", { children: ["The ", _jsx("strong", { children: "OR gate" }), " outputs 1 if ", _jsx("em", { children: "either" }), " input (or both) is 1. It only outputs 0 when both inputs are 0."] }) }), _jsx(HelpSection, { kind: "build", children: _jsxs("ol", { className: "list-decimal list-inside space-y-1", children: [_jsxs("li", { children: ["Place an ", _jsx("strong", { children: "OR" }), " gate"] }), _jsx("li", { children: "Connect two switches to the inputs" }), _jsx("li", { children: "Connect a lamp to the output" })] }) }), _jsxs(HelpSection, { kind: "simulate", children: [_jsx(TruthTable, { headers: ['A', 'B', 'Output'], rows: [[0, 0, 0], [0, 1, 1], [1, 0, 1], [1, 1, 1]], highlightedCells: new Set(['1-2', '2-2', '3-2']) }), _jsxs("p", { className: "mt-2 text-sm", children: ["The lamp lights if ", _jsx("strong", { children: "A=1 OR B=1 OR both" }), "."] })] }), _jsx(HelpSection, { kind: "explain", children: _jsxs(Callout, { children: [_jsx("strong", { children: "OR in Real Life:" }), _jsxs("ul", { className: "list-disc list-inside mt-2 space-y-1", children: [_jsx("li", { children: "Doors: Front sensor triggered OR back sensor triggered \u2192 open door" }), _jsx("li", { children: "Alerts: Battery low OR temperature high \u2192 send notification" }), _jsx("li", { children: "Search: Results matching keyword A OR keyword B" })] })] }) }), _jsx(HelpSection, { kind: "reflect", children: _jsx(Callout, { variant: "reflect", children: "Think: OR gives you options. It's the foundation of choice in computing." }) })] }));
        }
        // A6: Truth Tables
        if (lessonId === 'A6') {
            return (_jsxs(_Fragment, { children: [_jsx(HelpSection, { kind: "concept", children: _jsxs("p", { children: ["A ", _jsx("strong", { children: "truth table" }), " is a contract. It lists every possible input combination and the guaranteed output. Once you know a gate's truth table, you know exactly how it behaves."] }) }), _jsx(HelpSection, { kind: "build", children: _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("p", { className: "font-semibold mb-2", children: "NOT Gate:" }), _jsx(TruthTable, { headers: ['Input', 'Output'], rows: [[0, 1], [1, 0]] })] }), _jsxs("div", { children: [_jsx("p", { className: "font-semibold mb-2", children: "AND Gate:" }), _jsx(TruthTable, { headers: ['A', 'B', 'Output'], rows: [[0, 0, 0], [0, 1, 0], [1, 0, 0], [1, 1, 1]] })] }), _jsxs("div", { children: [_jsx("p", { className: "font-semibold mb-2", children: "OR Gate:" }), _jsx(TruthTable, { headers: ['A', 'B', 'Output'], rows: [[0, 0, 0], [0, 1, 1], [1, 0, 1], [1, 1, 1]] })] })] }) }), _jsx(HelpSection, { kind: "simulate", children: _jsx("p", { children: "Build each gate and verify the truth table yourself. Toggle all combinations!" }) }), _jsx(HelpSection, { kind: "explain", children: _jsxs(Callout, { children: [_jsx("strong", { children: "Why Truth Tables Matter:" }), _jsx("p", { className: "mt-2", children: "Truth tables are the spec. When hardware engineers design chips, they define behavior with truth tables. When software engineers write tests, they're essentially checking truth tables. They're the universal language of logic." })] }) }), _jsx(HelpSection, { kind: "reflect", children: _jsx(Callout, { variant: "reflect", children: "Think: You now speak the language that connects math, hardware, and software." }) })] }));
        }
        // A7: NAND & NOR
        if (lessonId === 'A7') {
            return (_jsxs(_Fragment, { children: [_jsx(HelpSection, { kind: "concept", children: _jsxs("p", { children: [_jsx("strong", { children: "NAND" }), " (NOT-AND) and ", _jsx("strong", { children: "NOR" }), " (NOT-OR) are called ", _jsx("em", { children: "universal gates" }), ' ', "because you can build ANY other gate using only NAND or only NOR."] }) }), _jsx(HelpSection, { kind: "build", children: _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("p", { className: "font-semibold mb-2", children: "NAND Gate (NOT-AND):" }), _jsx(TruthTable, { headers: ['A', 'B', 'Output'], rows: [[0, 0, 1], [0, 1, 1], [1, 0, 1], [1, 1, 0]] })] }), _jsxs("div", { children: [_jsx("p", { className: "font-semibold mb-2", children: "NOR Gate (NOT-OR):" }), _jsx(TruthTable, { headers: ['A', 'B', 'Output'], rows: [[0, 0, 1], [0, 1, 0], [1, 0, 0], [1, 1, 0]] })] })] }) }), _jsxs(HelpSection, { kind: "simulate", children: [_jsx("p", { children: "Challenge: Build a NOT gate using only a NAND gate!" }), _jsx("p", { className: "text-sm text-gray-400 mt-2", children: "(Hint: Connect both NAND inputs to the same source)" })] }), _jsx(HelpSection, { kind: "explain", children: _jsxs(Callout, { children: [_jsx("strong", { children: "Why Universal Gates Matter:" }), _jsx("p", { className: "mt-2", children: "Real computer chips are often built entirely from NAND gates because they're simple to manufacture. The entire processor in your computer could theoretically be built from billions of NAND gates." })] }) }), _jsx(HelpSection, { kind: "reflect", children: _jsx(Callout, { variant: "reflect", children: "Think: The simplest building block can create infinite complexity." }) })] }));
        }
        // A8: Track A Complete
        if (lessonId === 'A8') {
            return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "text-center py-12", children: [_jsx("h2", { className: "text-3xl mb-4 text-cyan-400", children: "\uD83C\uDF89 Track A Complete! \uD83C\uDF89" }), _jsx("p", { className: "text-xl text-gray-200 mb-6", children: "You've mastered the fundamentals of digital logic!" })] }), _jsxs(HelpSection, { kind: "concept", children: [_jsx("p", { children: "You now understand:" }), _jsxs("ul", { className: "list-disc list-inside space-y-2 mt-2", children: [_jsx("li", { children: "Binary states (0 and 1)" }), _jsx("li", { children: "Basic logic gates (NOT, AND, OR, NAND, NOR)" }), _jsx("li", { children: "Truth tables as the contract of gate behavior" }), _jsx("li", { children: "How gates combine to create more complex logic" })] })] }), _jsx(HelpSection, { kind: "build", children: _jsxs(Callout, { variant: "success", children: [_jsx("p", { className: "font-semibold", children: "What's Next?" }), _jsxs("p", { className: "mt-2", children: [_jsx("strong", { children: "Track B: Intermediate Logic" }), " - Build XOR gates, half adders, full adders, and multiplexers. Learn how computers perform arithmetic!"] }), _jsxs("p", { className: "mt-2", children: [_jsx("strong", { children: "Track C: Sequential Logic" }), " - Master memory, state machines, and CPU architecture. Understand how computers remember and execute programs!"] })] }) }), _jsx(HelpSection, { kind: "reflect", children: _jsx(Callout, { variant: "reflect", children: "You've laid the foundation. Every complex circuit you'll ever see is built from these simple gates. Ready for more?" }) })] }));
        }
        // B1: XOR Gate
        if (lessonId === 'B1') {
            return (_jsxs(_Fragment, { children: [_jsx(HelpSection, { kind: "concept", children: _jsxs("p", { children: [_jsx("strong", { children: "XOR (Exclusive OR)" }), " outputs 1 when inputs are ", _jsx("em", { children: "different" }), ". Unlike regular OR, XOR outputs 0 when both inputs are 1."] }) }), _jsxs(HelpSection, { kind: "build", children: [_jsxs("p", { children: ["Build an XOR using basic gates: ", _jsx("code", { children: "(A AND NOT B) OR (NOT A AND B)" })] }), _jsxs("ol", { className: "list-decimal list-inside space-y-1 mt-2", children: [_jsx("li", { children: "Use two AND gates, two NOT gates, and one OR gate" }), _jsx("li", { children: "Connect two switches to inputs A and B" }), _jsx("li", { children: "Connect a lamp to the final output" })] })] }), _jsxs(HelpSection, { kind: "simulate", children: [_jsx(TruthTable, { headers: ['A', 'B', 'A XOR B'], rows: [[0, 0, 0], [0, 1, 1], [1, 0, 1], [1, 1, 0]], highlightedCells: new Set(['1-2', '2-2']) }), _jsx("p", { className: "mt-2 text-sm", children: "Output is 1 only when inputs differ." })] }), _jsx(HelpSection, { kind: "explain", children: _jsxs(Callout, { children: [_jsx("strong", { children: "Why XOR Matters:" }), _jsx("p", { className: "mt-2", children: "XOR is crucial for binary addition \u2013 it gives you the sum bit! When you add 1+1 in binary, you get 10 (sum=0, carry=1). That sum bit is exactly what XOR produces." })] }) }), _jsx(HelpSection, { kind: "reflect", children: _jsx(Callout, { variant: "reflect", children: "Think: You just built a new gate from simpler parts. This is exactly how complex circuits are designed \u2013 layer by layer, building blocks on top of blocks." }) })] }));
        }
        // Fallback for unimplemented lessons
        return (_jsxs("div", { className: "text-center py-12 text-gray-400", children: [_jsxs("h2", { className: "text-2xl mb-4", children: [lessonId, ": Lesson Unavailable"] }), _jsx("p", { children: "This lesson is not available in this build. Choose another lesson from the index." })] }));
    };
    // Keyboard shortcuts content
    const renderKeyboardShortcuts = () => {
        return (_jsxs("div", { className: "space-y-8", children: [_jsxs("div", { className: "text-center mb-8", children: [_jsx("h1", { className: "text-3xl text-cyan-400 mb-3", children: "Keyboard Shortcuts" }), _jsx("p", { className: "text-gray-300", children: "Master these shortcuts for faster workflow" })] }), _jsxs("div", { children: [_jsx("h2", { className: "text-xl text-cyan-300 mb-4 border-b border-gray-700 pb-2", children: "System" }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex justify-between items-center p-3 bg-slate-800 rounded", children: [_jsx("span", { className: "text-gray-200", children: "Open System Search" }), _jsx("kbd", { className: "px-3 py-1 bg-gray-700 text-cyan-300 rounded font-mono text-sm", children: "Ctrl/Cmd + Space" })] }), _jsxs("div", { className: "flex justify-between items-center p-3 bg-slate-800 rounded", children: [_jsx("span", { className: "text-gray-200", children: "Open Command Palette" }), _jsx("kbd", { className: "px-3 py-1 bg-gray-700 text-cyan-300 rounded font-mono text-sm", children: "Ctrl/Cmd + Shift + P" })] }), _jsxs("div", { className: "flex justify-between items-center p-3 bg-slate-800 rounded", children: [_jsx("span", { className: "text-gray-200", children: "Open Launcher" }), _jsx("kbd", { className: "px-3 py-1 bg-gray-700 text-cyan-300 rounded font-mono text-sm", children: "Ctrl/Cmd + K" })] }), _jsxs("div", { className: "flex justify-between items-center p-3 bg-slate-800 rounded", children: [_jsx("span", { className: "text-gray-200", children: "Open Settings" }), _jsx("kbd", { className: "px-3 py-1 bg-gray-700 text-cyan-300 rounded font-mono text-sm", children: "Ctrl/Cmd + ," })] }), _jsxs("div", { className: "flex justify-between items-center p-3 bg-slate-800 rounded", children: [_jsx("span", { className: "text-gray-200", children: "Open About" }), _jsx("kbd", { className: "px-3 py-1 bg-gray-700 text-cyan-300 rounded font-mono text-sm", children: "Ctrl/Cmd + /" })] })] })] }), _jsxs("div", { children: [_jsx("h2", { className: "text-xl text-cyan-300 mb-4 border-b border-gray-700 pb-2", children: "Window Management" }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex justify-between items-center p-3 bg-slate-800 rounded", children: [_jsx("span", { className: "text-gray-200", children: "Switch Windows" }), _jsx("kbd", { className: "px-3 py-1 bg-gray-700 text-cyan-300 rounded font-mono text-sm", children: "Ctrl/Cmd + Tab" })] }), _jsxs("div", { className: "flex justify-between items-center p-3 bg-slate-800 rounded", children: [_jsx("span", { className: "text-gray-200", children: "Cycle Through Windows" }), _jsx("kbd", { className: "px-3 py-1 bg-gray-700 text-cyan-300 rounded font-mono text-sm", children: "Ctrl/Cmd + `" })] }), _jsxs("div", { className: "flex justify-between items-center p-3 bg-slate-800 rounded", children: [_jsx("span", { className: "text-gray-200", children: "Close Window" }), _jsx("kbd", { className: "px-3 py-1 bg-gray-700 text-cyan-300 rounded font-mono text-sm", children: "Ctrl/Cmd + W" })] }), _jsxs("div", { className: "flex justify-between items-center p-3 bg-slate-800 rounded", children: [_jsx("span", { className: "text-gray-200", children: "Minimize Window" }), _jsx("kbd", { className: "px-3 py-1 bg-gray-700 text-cyan-300 rounded font-mono text-sm", children: "Ctrl/Cmd + M" })] }), _jsxs("div", { className: "flex justify-between items-center p-3 bg-slate-800 rounded", children: [_jsx("span", { className: "text-gray-200", children: "Center Window" }), _jsx("kbd", { className: "px-3 py-1 bg-gray-700 text-cyan-300 rounded font-mono text-sm", children: "Ctrl/Cmd + Alt + C" })] })] })] }), _jsxs("div", { children: [_jsx("h2", { className: "text-xl text-cyan-300 mb-4 border-b border-gray-700 pb-2", children: "Window Snapping" }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex justify-between items-center p-3 bg-slate-800 rounded", children: [_jsx("span", { className: "text-gray-200", children: "Snap Left" }), _jsx("kbd", { className: "px-3 py-1 bg-gray-700 text-cyan-300 rounded font-mono text-sm", children: "Ctrl/Cmd + Alt + \u2190" })] }), _jsxs("div", { className: "flex justify-between items-center p-3 bg-slate-800 rounded", children: [_jsx("span", { className: "text-gray-200", children: "Snap Right" }), _jsx("kbd", { className: "px-3 py-1 bg-gray-700 text-cyan-300 rounded font-mono text-sm", children: "Ctrl/Cmd + Alt + \u2192" })] }), _jsxs("div", { className: "flex justify-between items-center p-3 bg-slate-800 rounded", children: [_jsx("span", { className: "text-gray-200", children: "Snap Top" }), _jsx("kbd", { className: "px-3 py-1 bg-gray-700 text-cyan-300 rounded font-mono text-sm", children: "Ctrl/Cmd + Alt + \u2191" })] }), _jsxs("div", { className: "flex justify-between items-center p-3 bg-slate-800 rounded", children: [_jsx("span", { className: "text-gray-200", children: "Snap Bottom" }), _jsx("kbd", { className: "px-3 py-1 bg-gray-700 text-cyan-300 rounded font-mono text-sm", children: "Ctrl/Cmd + Alt + \u2193" })] })] })] })] }));
    };
    const currentTrack = selectedTrack ? tracks[selectedTrack] : null;
    const currentLesson = currentTrack?.lessons[currentLessonIndex];
    const handleMarkComplete = () => {
        if (currentLesson) {
            const newCompleted = new Set(completedLessons);
            if (newCompleted.has(currentLesson.id)) {
                newCompleted.delete(currentLesson.id);
            }
            else {
                newCompleted.add(currentLesson.id);
            }
            setCompletedLessons(newCompleted);
        }
    };
    return (_jsx(HelpLayout, { sidebar: _jsxs("div", { children: [_jsx("h1", { className: "text-2xl mb-4 text-cyan-400", children: "Logic Help" }), _jsx("p", { className: "text-sm text-gray-400 mb-6", children: "Learn digital logic from gates to CPUs" }), viewMode === 'tracks' ? (
                // Track Selection Mode
                _jsxs("div", { children: [_jsx("h2", { className: "text-base mb-4", children: "Choose a Track:" }), Object.values(tracks).map((track) => (_jsxs("button", { onClick: () => {
                                setSelectedTrack(track.id);
                                setViewMode(track.id);
                                setCurrentLessonIndex(0);
                            }, className: "w-full p-4 mb-3 bg-slate-800 border border-slate-700 rounded-md text-gray-200 cursor-pointer text-left transition-all hover:bg-slate-700 hover:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500", children: [_jsx("div", { className: "text-lg mb-1", children: track.title }), _jsx("div", { className: "text-xs text-gray-400", children: track.description })] }, track.id))), _jsxs("button", { onClick: () => setViewMode('shortcuts'), className: "w-full p-4 mb-3 bg-purple-900/30 border border-purple-700/50 rounded-md text-gray-200 cursor-pointer text-left transition-all hover:bg-purple-900/40 hover:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500", children: [_jsx("div", { className: "text-lg mb-1", children: "\u2328\uFE0F Keyboard Shortcuts" }), _jsx("div", { className: "text-xs text-gray-400", children: "Master shortcuts for faster workflow" })] })] })) : viewMode === 'shortcuts' ? (
                // Keyboard Shortcuts Mode
                _jsxs("div", { children: [_jsx("button", { onClick: () => setViewMode('tracks'), className: "mb-4 px-3 py-2 border border-slate-700 text-cyan-400 rounded hover:bg-slate-700 transition-colors text-sm", children: "\u2190 Back to Tracks" }), _jsx("h2", { className: "text-base mb-4", children: "Keyboard Shortcuts" })] })) : currentTrack ? (
                // Lesson Navigation Mode
                _jsxs("div", { children: [_jsx("button", { onClick: () => {
                                setSelectedTrack(null);
                                setViewMode('tracks');
                            }, className: "mb-4 px-3 py-2 border border-slate-700 text-cyan-400 rounded hover:bg-slate-700 transition-colors text-sm", children: "\u2190 Back to Tracks" }), _jsx("h2", { className: "text-base mb-4", children: currentTrack.title }), _jsx("div", { children: currentTrack.lessons.map((lesson, index) => {
                                const isCompleted = completedLessons?.has(lesson.id);
                                const isCurrent = index === currentLessonIndex;
                                return (_jsx("div", { className: "mb-1", children: _jsxs("button", { onClick: () => setCurrentLessonIndex(index), className: `w-full px-3 py-2 rounded text-left text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 ${isCurrent
                                            ? 'bg-cyan-900/30 border border-cyan-500 text-cyan-300 font-medium'
                                            : 'text-gray-300 hover:bg-slate-700'}`, children: [_jsx("span", { className: "mr-2", children: isCompleted ? '✓' : '○' }), lesson.id, ": ", lesson.title] }) }, lesson.id));
                            }) })] })) : null] }), children: viewMode === 'shortcuts' ? (renderKeyboardShortcuts()) : currentLesson && currentTrack ? (_jsxs("div", { children: [_jsxs("div", { className: "mb-6", children: [_jsx("div", { className: "text-sm text-gray-400 mb-2 truncate", children: currentTrack.title }), _jsxs("h1", { className: "text-3xl text-cyan-400 mb-1 break-words", children: [currentLesson.id, ": ", currentLesson.title] })] }), _jsx("div", { className: "prose prose-invert max-w-none", children: renderLessonContent(selectedTrack, currentLesson.id) }), _jsx(LessonNav, { currentIndex: currentLessonIndex, totalLessons: currentTrack.lessons.length, onPrevious: currentLessonIndex > 0 ? () => setCurrentLessonIndex((i) => i - 1) : undefined, onNext: currentLessonIndex < currentTrack.lessons.length - 1
                        ? () => setCurrentLessonIndex((i) => i + 1)
                        : undefined, onMarkComplete: handleMarkComplete, isCompleted: completedLessons.has(currentLesson.id) })] })) : (_jsxs("div", { className: "text-center mt-16 text-gray-400", children: [_jsx("h2", { className: "text-2xl mb-4", children: "Welcome to Logic Help!" }), _jsx("p", { children: "Choose a track or keyboard shortcuts from the sidebar to begin." })] })) }));
};
// Export as RedByteApp
const LogicHelpApp = {
    manifest: {
        id: 'help',
        name: 'Logic Help',
        iconId: 'book',
        defaultSize: { width: 1000, height: 700 },
        minSize: { width: 700, height: 500 },
    },
    component: LogicHelpComponent,
};
export default LogicHelpApp;
