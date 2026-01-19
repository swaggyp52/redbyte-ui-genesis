import { useState } from 'react';

const sections = [
  { id: 'interface', title: 'Interface Overview' },
  { id: 'navigation', title: 'Navigation & Windows' },
  { id: 'logic-playground', title: 'Logic Playground' },
  { id: 'oscilloscope', title: 'Oscilloscope' },
  { id: 'labs', title: 'Lab Workbench' },
  { id: 'export', title: 'Export & Bundles' },
  { id: 'shortcuts', title: 'Keyboard Shortcuts' },
];

export default function Manual() {
  const [activeSection, setActiveSection] = useState('interface');

  return (
    <div className="py-16 bg-rb-bg">
      <div className="content-container px-6">
        <div className="flex gap-12">
          {/* Sidebar */}
          <aside className="hidden lg:block w-56 flex-shrink-0">
            <nav className="sticky top-24">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-rb-dim mb-4">
                Manual
              </h2>
              <ul className="space-y-1">
                {sections.map((section) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      onClick={() => setActiveSection(section.id)}
                      className={`block py-2 px-3 text-sm rounded transition-colors ${
                        activeSection === section.id
                          ? 'text-rb-text bg-rb-surface'
                          : 'text-rb-muted hover:text-rb-text hover:bg-rb-surface/50'
                      }`}
                    >
                      {section.title}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>

          {/* Content */}
          <main className="flex-1 min-w-0">
            <h1 className="text-h1 text-rb-text mb-4">RedByte Manual</h1>
            <p className="text-lg text-rb-muted mb-12 leading-relaxed max-w-2xl">
              Complete reference documentation for the RedByte environment.
            </p>

            <div className="space-y-16">
              {/* Interface Overview */}
              <Section id="interface" title="Interface Overview">
                <p>
                  RedByte uses an OS-style metaphor with a desktop, launcher, and app windows.
                  When you launch RedByte, you see the desktop environment with the launcher panel.
                </p>

                <Callout title="Main Components">
                  <ul className="space-y-2 mt-3">
                    <li><strong>Desktop</strong> — The main workspace where app windows appear</li>
                    <li><strong>Launcher</strong> — Quick access panel for opening apps (click the grid icon or press <kbd>Ctrl+K</kbd>)</li>
                    <li><strong>Logic Playground</strong> — Circuit design and simulation</li>
                    <li><strong>Oscilloscope</strong> — Signal waveform visualization</li>
                    <li><strong>File Explorer</strong> — Browse and manage your circuits</li>
                    <li><strong>Terminal</strong> — Command-line interface for advanced operations</li>
                  </ul>
                </Callout>

                <p>
                  Windows can be moved, resized, minimized, and closed. Use keyboard shortcuts
                  for fast navigation—<kbd>Ctrl+W</kbd> closes the active window, <kbd>Ctrl+K</kbd>
                  opens the command palette.
                </p>
              </Section>

              {/* Navigation & Windows */}
              <Section id="navigation" title="Navigation & Windows">
                <p>
                  The window manager supports multiple apps running simultaneously. Each app
                  opens in its own window that you can position anywhere on the desktop.
                </p>

                <h4>Window Controls</h4>
                <ul>
                  <li>Click and drag the title bar to move a window</li>
                  <li>Drag window edges to resize</li>
                  <li>Double-click the title bar to maximize/restore</li>
                  <li>Click the X button or press <kbd>Ctrl+W</kbd> to close</li>
                </ul>

                <h4>Command Palette</h4>
                <p>
                  Press <kbd>Ctrl+K</kbd> to open the command palette. Type to search for
                  apps, actions, or settings. This is the fastest way to navigate.
                </p>

                <Callout title="Window Snapping">
                  <p className="mt-2">
                    Drag a window to the screen edge to snap it to half the screen. Useful for
                    viewing the circuit editor and oscilloscope side-by-side.
                  </p>
                </Callout>
              </Section>

              {/* Logic Playground */}
              <Section id="logic-playground" title="Logic Playground">
                <p>
                  The Logic Playground is where you design and simulate digital circuits.
                  Add gates, wire them together, and run the simulation to see signals propagate.
                </p>

                <h4>Adding Components</h4>
                <ul>
                  <li>Open the component palette from the sidebar</li>
                  <li>Click a component type (AND, OR, XOR, etc.) to select it</li>
                  <li>Click on the canvas to place the component</li>
                  <li>Press <kbd>Del</kbd> to delete selected components</li>
                </ul>

                <h4>Wiring</h4>
                <ul>
                  <li>Press <kbd>W</kbd> to enter wire mode</li>
                  <li>Click an output pin, then click an input pin to create a wire</li>
                  <li>Wires only connect outputs to inputs (not output-to-output)</li>
                  <li>Click a wire to select and delete it</li>
                </ul>

                <h4>Simulation Controls</h4>
                <div className="grid md:grid-cols-2 gap-4 my-4">
                  <div className="bg-rb-raised border border-rb-border rounded-md p-4">
                    <h5 className="text-sm font-semibold text-rb-text mb-2">Playback</h5>
                    <ul className="text-sm space-y-1">
                      <li><kbd>Space</kbd> — Play/Pause simulation</li>
                      <li><kbd>→</kbd> — Step forward one tick</li>
                      <li><kbd>←</kbd> — Step backward one tick</li>
                      <li><kbd>R</kbd> — Reset to tick 0</li>
                    </ul>
                  </div>
                  <div className="bg-rb-raised border border-rb-border rounded-md p-4">
                    <h5 className="text-sm font-semibold text-rb-text mb-2">Speed</h5>
                    <ul className="text-sm space-y-1">
                      <li><kbd>+</kbd> — Increase simulation speed</li>
                      <li><kbd>-</kbd> — Decrease simulation speed</li>
                      <li><kbd>0</kbd> — Reset to default speed</li>
                    </ul>
                  </div>
                </div>

                <Callout title="Determinism Guarantee" variant="accent">
                  <p className="mt-2">
                    Every simulation is perfectly reproducible. You can step backward to any point
                    and the state will be identical to when you were there before. Same inputs
                    always produce same outputs.
                  </p>
                </Callout>
              </Section>

              {/* Oscilloscope */}
              <Section id="oscilloscope" title="Oscilloscope">
                <p>
                  The oscilloscope displays signal waveforms over time. Use it to debug
                  timing issues and visualize how your circuit behaves.
                </p>

                <h4>Adding Probes</h4>
                <ul>
                  <li>Open the Oscilloscope app from the launcher</li>
                  <li>In the circuit editor, click any wire to add it as a probe</li>
                  <li>The signal appears in the oscilloscope with its own color</li>
                  <li>Click a probe label in the oscilloscope to remove it</li>
                </ul>

                <h4>Waveform Navigation</h4>
                <ul>
                  <li>Scrub the timeline to jump to any point in time</li>
                  <li>Use the scroll wheel to zoom in/out on the timeline</li>
                  <li>Click a waveform edge to jump to that tick</li>
                </ul>

                <p>
                  The oscilloscope is synchronized with the simulation. When you step
                  through time in the Logic Playground, the oscilloscope cursor moves too.
                </p>
              </Section>

              {/* Lab Workbench */}
              <Section id="labs" title="Lab Workbench">
                <p>
                  The Lab Workbench provides structured assignments for learning. Each lab
                  has specific goals, presets, and validation.
                </p>

                <h4>Starting a Lab</h4>
                <ul>
                  <li>Open the Lab Workbench from the launcher</li>
                  <li>Browse available labs by category</li>
                  <li>Click a lab to see its description and requirements</li>
                  <li>Click "Start" to begin working</li>
                </ul>

                <h4>Lab Structure</h4>
                <ul>
                  <li><strong>Objective</strong> — What you need to build</li>
                  <li><strong>Inputs/Outputs</strong> — Required interface for your circuit</li>
                  <li><strong>Test Cases</strong> — Validation that your circuit is correct</li>
                  <li><strong>Hints</strong> — Optional guidance if you get stuck</li>
                </ul>

                <p>
                  When you complete a lab, you can export your solution as a submission
                  bundle for grading.
                </p>
              </Section>

              {/* Export & Bundles */}
              <Section id="export" title="Export & Bundles">
                <p>
                  RedByte supports exporting your work in several formats for different purposes.
                </p>

                <h4>Circuit Export</h4>
                <ul>
                  <li><strong>.rb file</strong> — Native format, preserves all circuit data</li>
                  <li><strong>.json</strong> — Portable format for sharing or backup</li>
                </ul>

                <h4>Lab Submissions</h4>
                <p>
                  When completing lab assignments, export your work as a submission bundle:
                </p>
                <ul>
                  <li>Go to File → Export → Lab Submission</li>
                  <li>The bundle includes your circuit, test results, and metadata</li>
                  <li>Submit the <code>.rb-lab.zip</code> file to your instructor</li>
                </ul>

                <h4>Submission Inspector</h4>
                <p>
                  Instructors can use the Submission Inspector to review student work:
                </p>
                <ul>
                  <li>Open a submission bundle</li>
                  <li>View the circuit design and simulation</li>
                  <li>See test results and validation status</li>
                  <li>Add feedback comments</li>
                </ul>
              </Section>

              {/* Keyboard Shortcuts */}
              <Section id="shortcuts" title="Keyboard Shortcuts">
                <p>
                  RedByte is designed for keyboard-first interaction. These shortcuts
                  work throughout the application.
                </p>

                <div className="grid md:grid-cols-2 gap-4 my-4">
                  <ShortcutTable title="File Operations" shortcuts={[
                    { keys: 'Ctrl+N', action: 'New circuit' },
                    { keys: 'Ctrl+O', action: 'Open file' },
                    { keys: 'Ctrl+S', action: 'Save' },
                    { keys: 'Ctrl+Shift+S', action: 'Save as' },
                    { keys: 'Ctrl+E', action: 'Export' },
                  ]} />

                  <ShortcutTable title="Navigation" shortcuts={[
                    { keys: 'Ctrl+K', action: 'Command palette' },
                    { keys: 'Ctrl+W', action: 'Close window' },
                    { keys: 'Ctrl+Tab', action: 'Switch window' },
                    { keys: 'Escape', action: 'Cancel / Close dialog' },
                  ]} />

                  <ShortcutTable title="Editing" shortcuts={[
                    { keys: 'Ctrl+Z', action: 'Undo' },
                    { keys: 'Ctrl+Y', action: 'Redo' },
                    { keys: 'Ctrl+A', action: 'Select all' },
                    { keys: 'Ctrl+D', action: 'Duplicate' },
                    { keys: 'Del', action: 'Delete selected' },
                    { keys: 'W', action: 'Wire mode' },
                  ]} />

                  <ShortcutTable title="Simulation" shortcuts={[
                    { keys: 'Space', action: 'Play/Pause' },
                    { keys: '→', action: 'Step forward' },
                    { keys: '←', action: 'Step backward' },
                    { keys: 'R', action: 'Reset' },
                    { keys: '+', action: 'Faster' },
                    { keys: '-', action: 'Slower' },
                  ]} />
                </div>
              </Section>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-h2 text-rb-text mb-6">{title}</h2>
      <div className="prose prose-invert prose-rb max-w-none space-y-4 text-rb-muted leading-relaxed
        [&_h4]:text-rb-text [&_h4]:text-base [&_h4]:font-semibold [&_h4]:mt-6 [&_h4]:mb-3
        [&_h5]:text-rb-text [&_h5]:text-sm [&_h5]:font-semibold
        [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5
        [&_li]:text-rb-muted
        [&_strong]:text-rb-text [&_strong]:font-medium
        [&_code]:text-rb-accent [&_code]:text-sm
        [&_kbd]:text-rb-text">
        {children}
      </div>
    </section>
  );
}

function Callout({ title, children, variant = 'default' }: { title: string; children: React.ReactNode; variant?: 'default' | 'accent' }) {
  const borderColor = variant === 'accent' ? 'border-l-rb-accent' : 'border-l-rb-info';

  return (
    <div className={`bg-rb-raised border border-rb-border ${borderColor} border-l-2 rounded-md p-4 my-4`}>
      <h5 className="text-sm font-semibold text-rb-text">{title}</h5>
      <div className="text-sm text-rb-muted">{children}</div>
    </div>
  );
}

function ShortcutTable({ title, shortcuts }: { title: string; shortcuts: { keys: string; action: string }[] }) {
  return (
    <div className="bg-rb-surface border border-rb-border rounded-md overflow-hidden">
      <div className="px-4 py-3 bg-rb-raised border-b border-rb-border">
        <h4 className="text-sm font-semibold text-rb-text">{title}</h4>
      </div>
      <div className="divide-y divide-rb-border">
        {shortcuts.map(({ keys, action }) => (
          <div key={keys} className="px-4 py-2.5 flex items-center justify-between text-sm">
            <span className="text-rb-muted">{action}</span>
            <kbd className="text-rb-text">{keys}</kbd>
          </div>
        ))}
      </div>
    </div>
  );
}
