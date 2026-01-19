export default function Manual() {
  return (
    <div className="py-16">
      <div className="container mx-auto px-6 max-w-5xl">
        <h1 className="text-5xl font-bold mb-8 text-redbyte-accent">RedByte Manual</h1>
        <p className="text-xl text-gray-300 mb-12">
          Complete reference documentation for the RedByte environment.
        </p>

        <div className="grid md:grid-cols-4 gap-8">
          {/* Sidebar TOC */}
          <aside className="md:col-span-1">
            <nav className="sticky top-24 space-y-2">
              <a href="#interface" className="block py-2 px-4 rounded hover:bg-redbyte-dark text-gray-300 hover:text-redbyte-accent transition-colors">
                Interface Overview
              </a>
              <a href="#circuit-editor" className="block py-2 px-4 rounded hover:bg-redbyte-dark text-gray-300 hover:text-redbyte-accent transition-colors">
                Circuit Editor
              </a>
              <a href="#simulation" className="block py-2 px-4 rounded hover:bg-redbyte-dark text-gray-300 hover:text-redbyte-accent transition-colors">
                Simulation
              </a>
              <a href="#oscilloscope" className="block py-2 px-4 rounded hover:bg-redbyte-dark text-gray-300 hover:text-redbyte-accent transition-colors">
                Oscilloscope
              </a>
              <a href="#custom-chips" className="block py-2 px-4 rounded hover:bg-redbyte-dark text-gray-300 hover:text-redbyte-accent transition-colors">
                Custom Chips
              </a>
              <a href="#export" className="block py-2 px-4 rounded hover:bg-redbyte-dark text-gray-300 hover:text-redbyte-accent transition-colors">
                Import/Export
              </a>
              <a href="#shortcuts" className="block py-2 px-4 rounded hover:bg-redbyte-dark text-gray-300 hover:text-redbyte-accent transition-colors">
                Keyboard Shortcuts
              </a>
              <a href="#troubleshooting" className="block py-2 px-4 rounded hover:bg-redbyte-dark text-gray-300 hover:text-redbyte-accent transition-colors">
                Troubleshooting
              </a>
            </nav>
          </aside>

          {/* Main Content */}
          <main className="md:col-span-3 space-y-16">
            {/* Interface Overview */}
            <section id="interface">
              <h2 className="text-3xl font-bold mb-6 text-redbyte-cyan">Interface Overview</h2>
              <p className="text-gray-300 mb-4">
                RedByte uses an OS-style metaphor with a desktop, launcher, and app windows. 
                The environment boots up when you launch the application, showing the desktop with the launcher panel.
              </p>
              <div className="bg-redbyte-darker rounded-lg p-6 border border-redbyte-accent/30 mb-4">
                <h3 className="font-bold text-redbyte-accent mb-3">Main Components</h3>
                <ul className="space-y-2 text-gray-300">
                  <li><strong className="text-white">Desktop:</strong> The main workspace where app windows appear</li>
                  <li><strong className="text-white">Launcher:</strong> Quick access panel for opening apps</li>
                  <li><strong className="text-white">Logic Playground:</strong> Circuit design and simulation</li>
                  <li><strong className="text-white">Oscilloscope:</strong> Signal waveform visualization</li>
                  <li><strong className="text-white">File Manager:</strong> Browse and manage your circuits</li>
                </ul>
              </div>
            </section>

            {/* Circuit Editor */}
            <section id="circuit-editor">
              <h2 className="text-3xl font-bold mb-6 text-redbyte-cyan">Circuit Editor Basics</h2>
              <p className="text-gray-300 mb-4">
                The circuit editor is where you design your logic circuits using gates, wires, and components.
              </p>
              
              <h3 className="text-xl font-bold mb-3 text-redbyte-accent">Adding Components</h3>
              <ul className="list-disc list-inside space-y-2 text-gray-300 mb-6">
                <li>Click the component palette to select gates (AND, OR, NOT, XOR, etc.)</li>
                <li>Click on the canvas to place the selected component</li>
                <li>Drag components to reposition them</li>
                <li>Press <kbd className="px-2 py-1 bg-redbyte-dark rounded border border-redbyte-accent/50">Del</kbd> to remove selected components</li>
              </ul>

              <h3 className="text-xl font-bold mb-3 text-redbyte-accent">Wiring</h3>
              <ul className="list-disc list-inside space-y-2 text-gray-300 mb-6">
                <li>Press <kbd className="px-2 py-1 bg-redbyte-dark rounded border border-redbyte-accent/50">W</kbd> to enter wire mode</li>
                <li>Click an output pin, then click an input pin to create a wire</li>
                <li>Wires automatically route around components</li>
                <li>Click a wire to select and delete it</li>
              </ul>
            </section>

            {/* Simulation Controls */}
            <section id="simulation">
              <h2 className="text-3xl font-bold mb-6 text-redbyte-cyan">Simulation Controls</h2>
              <p className="text-gray-300 mb-4">
                RedByte's deterministic simulation engine lets you step through time, both forward and backward.
              </p>
              
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <div className="bg-redbyte-dark rounded-lg p-4 border border-redbyte-accent/20">
                  <h3 className="font-bold text-redbyte-accent mb-3">Playback Controls</h3>
                  <ul className="space-y-2 text-sm text-gray-300">
                    <li><kbd className="px-2 py-1 bg-redbyte-darker rounded">Space</kbd> Play/Pause simulation</li>
                    <li><kbd className="px-2 py-1 bg-redbyte-darker rounded">→</kbd> Step forward one tick</li>
                    <li><kbd className="px-2 py-1 bg-redbyte-darker rounded">←</kbd> Step backward one tick</li>
                    <li><kbd className="px-2 py-1 bg-redbyte-darker rounded">R</kbd> Reset to time 0</li>
                  </ul>
                </div>
                <div className="bg-redbyte-dark rounded-lg p-4 border border-redbyte-accent/20">
                  <h3 className="font-bold text-redbyte-cyan mb-3">Speed Controls</h3>
                  <ul className="space-y-2 text-sm text-gray-300">
                    <li><kbd className="px-2 py-1 bg-redbyte-darker rounded">+</kbd> Increase simulation speed</li>
                    <li><kbd className="px-2 py-1 bg-redbyte-darker rounded">-</kbd> Decrease simulation speed</li>
                    <li><kbd className="px-2 py-1 bg-redbyte-darker rounded">0</kbd> Reset to default speed</li>
                  </ul>
                </div>
              </div>

              <div className="bg-redbyte-darker rounded-lg p-4 border-l-4 border-redbyte-accent">
                <p className="text-gray-300 text-sm">
                  <strong className="text-redbyte-accent">Determinism guarantee:</strong> Every simulation is 
                  perfectly reproducible. You can step backward to any point and the state will be identical 
                  to when you were there before.
                </p>
              </div>
            </section>

            {/* Oscilloscope */}
            <section id="oscilloscope">
              <h2 className="text-3xl font-bold mb-6 text-redbyte-cyan">Oscilloscope and Probing</h2>
              <p className="text-gray-300 mb-4">
                The oscilloscope app displays signal waveforms over time. Use it to debug timing issues and 
                visualize how your circuit behaves.
              </p>
              
              <h3 className="text-xl font-bold mb-3 text-redbyte-accent">Adding Probes</h3>
              <ul className="list-disc list-inside space-y-2 text-gray-300 mb-6">
                <li>Open the Oscilloscope app from the launcher</li>
                <li>In the circuit editor, click any wire to add it as a probe</li>
                <li>The signal will appear in the oscilloscope with its own color</li>
                <li>Drag probes in the oscilloscope to reorder them</li>
              </ul>

              <h3 className="text-xl font-bold mb-3 text-redbyte-accent">Waveform Navigation</h3>
              <ul className="list-disc list-inside space-y-2 text-gray-300 mb-6">
                <li>Scrub the timeline to jump to any point in time</li>
                <li>Zoom in/out to see more or fewer time steps</li>
                <li>Click a waveform to highlight the corresponding wire in the circuit</li>
              </ul>
            </section>

            {/* Custom Chips */}
            <section id="custom-chips">
              <h2 className="text-3xl font-bold mb-6 text-redbyte-cyan">Creating Custom Chips</h2>
              <p className="text-gray-300 mb-4">
                Build reusable components to organize complex circuits and create your own chip library.
              </p>
              
              <h3 className="text-xl font-bold mb-3 text-redbyte-accent">Making a Custom Chip</h3>
              <ol className="list-decimal list-inside space-y-2 text-gray-300 mb-6">
                <li>Design your circuit in the Logic Playground</li>
                <li>Add input and output pins for your chip's interface</li>
                <li>Go to File → Save as Chip</li>
                <li>Name your chip and configure its properties</li>
                <li>The chip now appears in your component palette</li>
              </ol>

              <div className="bg-redbyte-dark rounded-lg p-4 border-l-4 border-redbyte-cyan">
                <p className="text-gray-300 text-sm">
                  <strong className="text-redbyte-cyan">Pro tip:</strong> Build a library of common components 
                  like adders, multiplexers, and registers. You can use them across all your projects.
                </p>
              </div>
            </section>

            {/* Import/Export */}
            <section id="export">
              <h2 className="text-3xl font-bold mb-6 text-redbyte-cyan">Import/Export Workflows</h2>
              <p className="text-gray-300 mb-4">
                RedByte can import circuits from files and export to hardware description languages.
              </p>
              
              <h3 className="text-xl font-bold mb-3 text-redbyte-accent">Exporting to Verilog/VHDL</h3>
              <ol className="list-decimal list-inside space-y-2 text-gray-300 mb-6">
                <li>Complete your circuit design</li>
                <li>Go to File → Export → Verilog (or VHDL)</li>
                <li>Configure module name and port definitions</li>
                <li>Choose output file location</li>
                <li>The generated code is ready for FPGA synthesis tools</li>
              </ol>

              <h3 className="text-xl font-bold mb-3 text-redbyte-accent">Importing Circuits</h3>
              <p className="text-gray-300 mb-4">
                Use File → Import to load circuits from .rb files or .json exports. 
                All custom chips and wiring will be preserved.
              </p>
            </section>

            {/* Keyboard Shortcuts */}
            <section id="shortcuts">
              <h2 className="text-3xl font-bold mb-6 text-redbyte-cyan">Keyboard Shortcuts Reference</h2>
              
              <div className="space-y-6">
                <div className="bg-redbyte-darker rounded-lg p-6 border border-redbyte-accent/30">
                  <h3 className="font-bold text-redbyte-accent mb-4">File Operations</h3>
                  <div className="grid md:grid-cols-2 gap-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-300">New Circuit</span>
                      <kbd className="px-2 py-1 bg-redbyte-dark rounded">Ctrl+N</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Save</span>
                      <kbd className="px-2 py-1 bg-redbyte-dark rounded">Ctrl+S</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Open</span>
                      <kbd className="px-2 py-1 bg-redbyte-dark rounded">Ctrl+O</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Export</span>
                      <kbd className="px-2 py-1 bg-redbyte-dark rounded">Ctrl+E</kbd>
                    </div>
                  </div>
                </div>

                <div className="bg-redbyte-darker rounded-lg p-6 border border-redbyte-accent/30">
                  <h3 className="font-bold text-redbyte-cyan mb-4">Editing</h3>
                  <div className="grid md:grid-cols-2 gap-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-300">Undo</span>
                      <kbd className="px-2 py-1 bg-redbyte-dark rounded">Ctrl+Z</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Redo</span>
                      <kbd className="px-2 py-1 bg-redbyte-dark rounded">Ctrl+Y</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Delete</span>
                      <kbd className="px-2 py-1 bg-redbyte-dark rounded">Del</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Wire Mode</span>
                      <kbd className="px-2 py-1 bg-redbyte-dark rounded">W</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Select All</span>
                      <kbd className="px-2 py-1 bg-redbyte-dark rounded">Ctrl+A</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Duplicate</span>
                      <kbd className="px-2 py-1 bg-redbyte-dark rounded">Ctrl+D</kbd>
                    </div>
                  </div>
                </div>

                <div className="bg-redbyte-darker rounded-lg p-6 border border-redbyte-accent/30">
                  <h3 className="font-bold text-redbyte-purple mb-4">Simulation</h3>
                  <div className="grid md:grid-cols-2 gap-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-300">Play/Pause</span>
                      <kbd className="px-2 py-1 bg-redbyte-dark rounded">Space</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Step Forward</span>
                      <kbd className="px-2 py-1 bg-redbyte-dark rounded">→</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Step Backward</span>
                      <kbd className="px-2 py-1 bg-redbyte-dark rounded">←</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Reset</span>
                      <kbd className="px-2 py-1 bg-redbyte-dark rounded">R</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Faster</span>
                      <kbd className="px-2 py-1 bg-redbyte-dark rounded">+</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Slower</span>
                      <kbd className="px-2 py-1 bg-redbyte-dark rounded">-</kbd>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Troubleshooting */}
            <section id="troubleshooting">
              <h2 className="text-3xl font-bold mb-6 text-redbyte-cyan">Troubleshooting FAQ</h2>
              
              <div className="space-y-6">
                <div className="bg-redbyte-darker rounded-lg p-6 border-l-4 border-redbyte-accent">
                  <h3 className="font-bold text-redbyte-accent mb-2">My circuit isn't working as expected</h3>
                  <p className="text-gray-300 text-sm">
                    Use the oscilloscope to probe signals and see where the behavior diverges. 
                    Check for floating inputs (unconnected pins) and verify gate connections.
                  </p>
                </div>

                <div className="bg-redbyte-darker rounded-lg p-6 border-l-4 border-redbyte-cyan">
                  <h3 className="font-bold text-redbyte-cyan mb-2">Simulation is running slowly</h3>
                  <p className="text-gray-300 text-sm">
                    Large circuits with many components can slow down simulation. Try breaking your 
                    design into custom chips, or reduce the number of active probes in the oscilloscope.
                  </p>
                </div>

                <div className="bg-redbyte-darker rounded-lg p-6 border-l-4 border-redbyte-purple">
                  <h3 className="font-bold text-redbyte-purple mb-2">Can't connect wires</h3>
                  <p className="text-gray-300 text-sm">
                    Make sure you're in wire mode (press W). Wires can only connect outputs to inputs. 
                    If you see a red X, the connection is invalid (e.g., output-to-output).
                  </p>
                </div>

                <div className="bg-redbyte-darker rounded-lg p-6 border-l-4 border-gray-600">
                  <h3 className="font-bold text-white mb-2">Export doesn't generate valid Verilog</h3>
                  <p className="text-gray-300 text-sm">
                    Ensure all your inputs and outputs are properly labeled. Custom chips must have 
                    valid port definitions. Check the export log for specific errors.
                  </p>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
