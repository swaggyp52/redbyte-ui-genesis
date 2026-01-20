import { Link as RouterLink } from 'react-router-dom';

const Link = RouterLink as React.ComponentType<{ to: string; className?: string; children: React.ReactNode }>;

export default function GettingStarted() {
  return (
    <div className="py-16 bg-rb-bg">
      <div className="content-container px-6">
        <div className="max-w-3xl">
          {/* Header */}
          <h1 className="text-h1 text-rb-text mb-4">Getting Started</h1>
          <p className="text-lg text-rb-muted mb-12 leading-relaxed">
            Get RedByte running locally and build your first circuit.
          </p>

          {/* Prerequisites */}
          <section className="mb-16">
            <h2 className="text-h2 text-rb-text mb-6">Prerequisites</h2>
            <div className="bg-rb-surface border border-rb-border rounded-md p-6">
              <ul className="space-y-3 text-rb-muted">
                <li className="flex items-start gap-3">
                  <span className="text-rb-accent mt-1">&gt;</span>
                  <span><strong className="text-rb-text">Node.js 20.19.0+</strong> - Required for running the development server</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-rb-accent mt-1">&gt;</span>
                  <span><strong className="text-rb-text">pnpm 10.24.0+</strong> - Package manager (install with <code className="text-rb-accent">npm install -g pnpm</code>)</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-rb-accent mt-1">&gt;</span>
                  <span><strong className="text-rb-text">Modern browser</strong> - Chrome, Firefox, Safari, or Edge (latest versions)</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-rb-accent mt-1">&gt;</span>
                  <span><strong className="text-rb-text">Optional hardware kit</strong> - Basys 3 (Artix-7), LM358, LDRs, breadboard, USB cable</span>
                </li>
              </ul>
            </div>
          </section>

          {/* Installation */}
          <section className="mb-16">
            <h2 className="text-h2 text-rb-text mb-6">Installation</h2>
            <div className="space-y-4">
              <Step number={1} title="Clone the repository">
                <CodeBlock code={`git clone https://github.com/swaggyp52/redbyte-ui-genesis.git
cd redbyte-ui-genesis`} />
                <p className="text-sm text-rb-muted mt-3">
                  This will download the full RedByte monorepo to your device.
                </p>
              </Step>

              <Step number={2} title="Install dependencies">
                <CodeBlock code="pnpm install" />
                <p className="text-sm text-rb-muted mt-3">
                  Make sure you have <b>pnpm 10.24.0+</b> installed globally. If not, run <code className="text-rb-accent">npm install -g pnpm</code> first.
                </p>
              </Step>

              <Step number={3} title="Start the RedByte app">
                <CodeBlock code={`pnpm --filter @redbyte/playground dev`} />
                <p className="text-sm text-rb-muted mt-3">
                  This launches the main RedByte desktop environment. Open <code className="text-rb-accent">http://localhost:5173</code> in your browser.
                </p>
              </Step>

              <Step number={4} title="(Optional) Run tests or build">
                <CodeBlock code={`pnpm test\npnpm build`} />
                <p className="text-sm text-rb-muted mt-3">
                  <b>pnpm test</b> runs the full test suite. <b>pnpm build</b> builds all apps and packages for production.
                </p>
              </Step>
            </div>
          </section>

          {/* Walkthrough */}
          <section className="mb-16">
            <h2 className="text-h2 text-rb-text mb-6">Your First Circuit</h2>
            <p className="text-rb-muted mb-8">
              Let's build a simple AND gate circuit and see it run.
            </p>

            <div className="space-y-8">
              <WalkthroughStep
                number={1}
                title="Open the Logic Playground"
                content="From the desktop, click the Logic Playground icon in the launcher or press Ctrl+K and type 'Logic Playground'."
              />

              <WalkthroughStep
                number={2}
                title="Add input switches"
                content="Open the component palette and add two input switches. These will be your A and B inputs."
              />

              <WalkthroughStep
                number={3}
                title="Add an AND gate"
                content="From the Gates section, add an AND gate to the canvas. Position it to the right of your inputs."
              />

              <WalkthroughStep
                number={4}
                title="Wire the components"
                content="Press W to enter wire mode. Click an output pin on a switch, then click an input pin on the AND gate. Repeat for the second switch."
              />

              <WalkthroughStep
                number={5}
                title="Add an output indicator"
                content="Add an LED or output component and wire it to the AND gate's output."
              />

              <WalkthroughStep
                number={6}
                title="Run the simulation"
                content="Press Space to start the simulation. Toggle your input switches and watch the output respond."
              />

              <WalkthroughStep
                number={7}
                title="Open the oscilloscope"
                content="Open the Oscilloscope app from the launcher. Click any wire in your circuit to add it as a probe. You'll see waveforms as signals change."
              />

              <WalkthroughStep
                number={8}
                title="Step through time"
                content="Press Space to pause. Use the arrow keys to step forward (->) and backward (<-) through the simulation. This is deterministic - same state every time."
              />
            </div>
          </section>

          {/* FPGA Toolchain */}
          <section className="mb-16">
            <h2 className="text-h2 text-rb-text mb-6">FPGA Toolchain (Optional)</h2>
            <p className="text-rb-muted mb-6">
              RedByte programs Basys 3 boards through the FPGA Bridge using AMD Vivado WebPACK in batch mode.
              SIM mode works without Vivado, and UART telemetry uses CRC-checked binary frames for reliable capture.
            </p>
            <div className="space-y-4">
              <TroubleshootItem
                question="Vivado not found"
                answer="Install AMD Vivado WebPACK and ensure the Vivado binary is on your PATH. The Hardware Panel will show toolchain status once detected."
              />
              <TroubleshootItem
                question="Board not detected"
                answer="Confirm the Basys 3 is connected over USB and powered. On Windows, verify the FTDI driver is installed and the COM port appears."
              />
            </div>
          </section>

          {/* Keyboard Shortcuts */}
          <section className="mb-16">
            <h2 className="text-h2 text-rb-text mb-6">Keyboard Shortcuts</h2>
            <p className="text-rb-muted mb-6">
              RedByte is keyboard-first. These shortcuts work everywhere.
            </p>

            <div className="grid md:grid-cols-2 gap-4">
              <ShortcutGroup title="Navigation">
                <Shortcut keys="Ctrl+K" action="Command palette" />
                <Shortcut keys="Ctrl+W" action="Close window" />
                <Shortcut keys="Ctrl+N" action="New circuit" />
                <Shortcut keys="Ctrl+O" action="Open file" />
              </ShortcutGroup>

              <ShortcutGroup title="Simulation">
                <Shortcut keys="Space" action="Play / Pause" />
                <Shortcut keys="->" action="Step forward" />
                <Shortcut keys="<-" action="Step backward" />
                <Shortcut keys="R" action="Reset to tick 0" />
              </ShortcutGroup>

              <ShortcutGroup title="Editing">
                <Shortcut keys="W" action="Wire mode" />
                <Shortcut keys="Del" action="Delete selected" />
                <Shortcut keys="Ctrl+Z" action="Undo" />
                <Shortcut keys="Ctrl+Y" action="Redo" />
              </ShortcutGroup>

              <ShortcutGroup title="View">
                <Shortcut keys="Ctrl+=" action="Zoom in" />
                <Shortcut keys="Ctrl+-" action="Zoom out" />
                <Shortcut keys="Ctrl+0" action="Reset zoom" />
                <Shortcut keys="F" action="Fit to view" />
              </ShortcutGroup>
            </div>
          </section>

          {/* Troubleshooting */}
          <section className="mb-16">
            <h2 className="text-h2 text-rb-text mb-6">Troubleshooting</h2>

            <div className="space-y-4">
              <TroubleshootItem
                question="pnpm install fails with dependency errors"
                answer="Make sure you're using pnpm 10.24.0 or later and Node.js 20.19.0 or later. Run 'pnpm --version' and 'node --version' to check. If versions are correct, try 'pnpm install --force'."
              />

              <TroubleshootItem
                question="The app won't load in the browser"
                answer="Check that the dev server is running (you should see output in your terminal). Try a hard refresh (Ctrl+Shift+R). Check browser console for errors."
              />

              <TroubleshootItem
                question="Simulation isn't responding"
                answer="Make sure simulation is not paused (press Space). Check that all inputs and outputs are wired correctly - floating inputs can cause unexpected behavior."
              />

              <TroubleshootItem
                question="Simulator doesn't tick"
                answer="Verify the tick rate is above zero and the simulation is running. If you're in replay mode, exit replay to resume live ticks."
              />

              <TroubleshootItem
                question="Can't connect wires between components"
                answer="Enter wire mode first (press W). Wires connect outputs to inputs only - you can't wire two outputs together or two inputs together."
              />
            </div>
          </section>

          {/* Next Steps */}
          <section>
            <h2 className="text-h2 text-rb-text mb-6">Next Steps</h2>
            <div className="bg-rb-surface border border-rb-border rounded-md p-6">
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <span className="text-rb-accent">-></span>
                  <span className="text-rb-muted">
                    <Link to="/examples" className="text-rb-text hover:text-rb-accent transition-colors">Try the interactive examples</Link>
                    {' '}to see logic gates, counters, and waveforms in action
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-rb-accent">-></span>
                  <span className="text-rb-muted">
                    <Link to="/manual" className="text-rb-text hover:text-rb-accent transition-colors">Read the manual</Link>
                    {' '}for detailed documentation on all features
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-rb-accent">-></span>
                  <span className="text-rb-muted">
                    <Link to="/demo" className="text-rb-text hover:text-rb-accent transition-colors">See the educator overview</Link>
                    {' '}if you're considering RedByte for a course
                  </span>
                </li>
              </ul>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-rb-accent text-rb-bg font-bold text-sm flex items-center justify-center">
        {number}
      </div>
      <div className="flex-1 pt-1">
        <h3 className="text-h3 text-rb-text mb-2">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="bg-rb-raised border border-rb-border rounded-md p-4 overflow-x-auto">
      <code className="text-sm text-rb-text font-mono">{code}</code>
    </pre>
  );
}

function WalkthroughStep({ number, title, content }: { number: number; title: string; content: string }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-full border-2 border-rb-border text-rb-muted font-mono text-sm flex items-center justify-center">
        {number}
      </div>
      <div className="flex-1 pt-1">
        <h3 className="text-h3 text-rb-text mb-1">{title}</h3>
        <p className="text-sm text-rb-muted leading-relaxed">{content}</p>
      </div>
    </div>
  );
}

function ShortcutGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-rb-surface border border-rb-border rounded-md p-4">
      <h3 className="text-sm font-semibold text-rb-text mb-3">{title}</h3>
      <div className="space-y-2">
        {children}
      </div>
    </div>
  );
}

function Shortcut({ keys, action }: { keys: string; action: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-rb-muted">{action}</span>
      <kbd className="text-rb-text">{keys}</kbd>
    </div>
  );
}

function TroubleshootItem({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="bg-rb-surface border border-rb-border rounded-md p-5">
      <h3 className="text-rb-text font-medium mb-2">{question}</h3>
      <p className="text-sm text-rb-muted leading-relaxed">{answer}</p>
    </div>
  );
}
