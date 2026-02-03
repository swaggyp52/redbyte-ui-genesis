import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Markdown from 'react-markdown';
// --- Documentation Content (Single Source) ---
const DOCS_CONTENT = `
# RedByte Documentation

**The local-first logic playground for reproducible digital design.**

---

## Getting Started

### For Students
1. **Open the Playground**: Go to the [Logic Playground](/manual/playground).
2. **Follow the "Start Here" Tutorial**: Upon first load, a guided tour explains the basics.
3. **Build & Simulate**: Drag components from the palette, wire them up, and toggle inputs.
4. **Export Evidence**: When finished, click **Export Lab Evidence** to generate a \`.rb-lab.zip\` file for your instructor.

### For Instructors
1. **Design a Lab**: Create a starter circuit or specification.
2. **Distribute**: Share the \`.rb-circuit\` file or instructions with students.
3. **Collect**: Receive \`.rb-lab.zip\` files from students.
4. **Grade**: Use the **Submission Inspector** to load a bundle, replay the exact simulation trace, and verify correctness deterministically.

### For Developers
RedByte is open source and extensible.
- **Repository**: [swaggyp52/redbyte-ui-genesis](https://github.com/swaggyp52/redbyte-ui-genesis)
- **Architecture**: React, Zustand, TypeScript, discrete-event simulation engine.
- **Contribution**: See \`CONTRIBUTING.md\` in the repo for setup instructions.

---

## Core Concepts

### 1. Deterministic Simulation
RedByte uses a **tick-based** discrete time model.
- **Tick**: The atomic unit of time. Gates update once per tick.
- **Determinism**: The same circuit + the same inputs + the same initial state = **identical output**, every single time.
- **Replay**: Because execution is deterministic, you can record a session and replay it bit-for-bit to debug glitches.

### 2. Visibility
Every signal is visible.
- **Probes**: Attach probes to any wire to record its history in the Oscilloscope.
- **Oscilloscope**: View tick-accurate waveforms to debug timing issues and race conditions.
- **Inspector**: See the real-time state of any selected component.

### 3. No Magic
- **Local-First**: Circuits run 100% in your browser. No server round-trips.
- **Explicit State**: Flip-flops and memory initialize to known states (usually 0).
- **Propagation Delay**: Real gates take time to switch. RedByte models this (1 tick delay per gate) so you learn to handle it.

---

## Evidence Export Schema

Student submissions are exported as a **.rb-lab.zip** file. This is a standard ZIP archive containing the following deterministic artifacts:

| File Path | Description | Key Fields |
| :--- | :--- | :--- |
| \`manifest.json\` | Metadata about the submission. | \`student_identity\`, \`lab_id\`, \`timestamp\`, \`app_version\` |
| \`circuit.json\` | The exact circuit structure at export. | \`nodes\`, \`edges\`, \`viewport\` |
| \`trace/hw_trace.ndjson\` | Recorded events and signal changes. | \`tick\`, \`event_type\`, \`payload\` |
| \`integrity/capsule.json\` | Hash manifest for tamper detection. | \`sha256\` hashes of all files |

### Example Grading Script (Python)
Instructors can automate grading by reading the JSON files directly.

\`\`\`python
import zipfile
import json

def grade_submission(zip_path):
    with zipfile.ZipFile(zip_path) as z:
        # 1. Check Manifest
        manifest = json.loads(z.read('manifest.json'))
        print(f"Student: {manifest['student_identity']['name']}")
        
        # 2. Check Circuit Structure
        circuit = json.loads(z.read('circuit.json'))
        gate_count = len([n for n in circuit['nodes'] if n['type'] == 'AND'])
        
        if gate_count < 2:
            return "Fail: Not enough AND gates"
            
        return "Pass"
\`\`\`

---

## Keyboard Shortcuts

| Key | Action |
| :--- | :--- |
| **Shift + 1** | Switch to **Schematic View** (Edit) |
| **Shift + 2** | Switch to **Logic View** (Simulate) |
| **Shift + 3** | Switch to **Oscilloscope View** (Debug) |
| **Space** | Toggle Simulation (Run / Pause) |
| **S** | Step one tick (when paused) |
| **Delete** | Delete selected component |
| **Ctrl + Z** | Undo |

`;
// --- Components ---
function slugify(text) {
    return text
        .toLowerCase()
        .replace(/[^\\w\\s-]/g, '')
        .replace(/\\s+/g, '-')
        .replace(/^-+|-+$/g, '');
}
function extractHeadings(markdown) {
    const lines = markdown.split('\\n');
    const headings = [];
    for (const line of lines) {
        const match = /^(#{1,3})\\s+(.*)/.exec(line);
        if (match) {
            const level = match[1].length;
            const text = match[2];
            const id = slugify(text);
            headings.push({ id, text, level });
        }
    }
    return headings;
}
export default function Guide() {
    const [headings, setHeadings] = useState([]);
    useEffect(() => {
        setHeadings(extractHeadings(DOCS_CONTENT));
    }, []);
    return (_jsx("div", { className: "py-16 bg-rb-bg text-rb-text", children: _jsx("div", { className: "content-container px-6", children: _jsxs("div", { className: "flex gap-12", children: [_jsx("aside", { className: "hidden lg:block w-64 flex-shrink-0", children: _jsxs("nav", { className: "sticky top-24", children: [_jsx("h2", { className: "text-xs font-semibold uppercase tracking-wider text-rb-dim mb-4", children: "Table of Contents" }), _jsx("ul", { className: "space-y-1 text-sm", children: headings.map(h => (_jsx("li", { className: h.level === 1 ? 'mt-4 font-bold text-rb-text' : h.level === 2 ? 'ml-2' : 'ml-6', children: _jsx("a", { href: `#\${h.id}`, className: "block py-1 hover:text-rb-accent transition-colors text-rb-muted", onClick: (e) => {
                                                e.preventDefault();
                                                document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth' });
                                            }, children: h.text }) }, h.id))) })] }) }), _jsx("main", { className: "flex-1 min-w-0 prose prose-invert prose-rb max-w-none", children: _jsx(Markdown, { components: {
                                h1: ({ node, ...props }) => _jsx("h1", { id: slugify(String(props.children)), className: "text-h1 mt-12 mb-6 scroll-mt-24", children: props.children }),
                                h2: ({ node, ...props }) => _jsx("h2", { id: slugify(String(props.children)), className: "text-h2 mt-10 mb-4 scroll-mt-24 pb-2 border-b border-rb-border", children: props.children }),
                                h3: ({ node, ...props }) => _jsx("h3", { id: slugify(String(props.children)), className: "text-h3 mt-8 mb-3 scroll-mt-24", children: props.children }),
                                table: ({ node, ...props }) => _jsx("div", { className: "overflow-x-auto my-6", children: _jsx("table", { className: "min-w-full text-left text-sm border-collapse", ...props }) }),
                                thead: ({ node, ...props }) => _jsx("thead", { className: "bg-rb-surface text-rb-text font-semibold uppercase tracking-wider", ...props }),
                                th: ({ node, ...props }) => _jsx("th", { className: "px-4 py-3 border border-rb-border", ...props }),
                                td: ({ node, ...props }) => _jsx("td", { className: "px-4 py-3 border border-rb-border", ...props }),
                                code: ({ node, inline, className, children, ...props }) => inline
                                    ? _jsx("code", { className: "bg-rb-surface px-1.5 py-0.5 rounded text-rb-accent font-mono text-sm", children: children })
                                    : _jsx("pre", { className: "bg-rb-surface border border-rb-border rounded p-4 overflow-x-auto", children: _jsx("code", { className: "font-mono text-sm text-rb-text", children: children }) }),
                                a: ({ node, ...props }) => _jsx(Link, { to: props.href, className: "text-rb-info hover:underline hover:text-rb-accent transition-colors", children: props.children })
                            }, children: DOCS_CONTENT }) })] }) }) }));
}
