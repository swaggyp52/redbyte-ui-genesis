export default function GettingStarted() {
  return (
    <div className="py-16">
      <div className="container mx-auto px-6 max-w-4xl">
        <h1 className="text-5xl font-bold mb-8 text-redbyte-accent">Getting Started</h1>
        <p className="text-xl text-gray-300 mb-12">
          Follow this step-by-step guide to build your first circuit in RedByte.
        </p>

        {/* Step 1 */}
        <div className="mb-16">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-full bg-redbyte-accent text-redbyte-dark font-bold text-xl flex items-center justify-center">
              1
            </div>
            <h2 className="text-3xl font-bold">Launch RedByte</h2>
          </div>
          <div className="ml-16">
            <p className="text-gray-300 mb-4">
              After downloading and installing RedByte, launch the application. You'll see the desktop environment with the launcher panel.
            </p>
            <div className="bg-redbyte-darker rounded-lg p-6 border border-redbyte-accent/30">
              <div className="aspect-video bg-gradient-to-br from-redbyte-dark to-redbyte-darker rounded flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <div className="text-4xl mb-2">🖥️</div>
                  <p>Screenshot: RedByte Desktop</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Step 2 */}
        <div className="mb-16">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-full bg-redbyte-cyan text-redbyte-dark font-bold text-xl flex items-center justify-center">
              2
            </div>
            <h2 className="text-3xl font-bold">Create Your First Circuit</h2>
          </div>
          <div className="ml-16">
            <p className="text-gray-300 mb-4">
              Open the Logic Playground app. Start with a simple AND gate circuit:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-gray-300 mb-4">
              <li>Add two input switches</li>
              <li>Place an AND gate</li>
              <li>Connect the switches to the gate inputs</li>
              <li>Add an LED output</li>
              <li>Wire the gate output to the LED</li>
            </ol>
            <div className="bg-redbyte-dark rounded-lg p-4 font-mono text-sm border-l-4 border-redbyte-cyan">
              <div className="text-redbyte-cyan font-bold mb-2">💡 Pro Tip</div>
              <p className="text-gray-300">Press <kbd className="px-2 py-1 bg-redbyte-darker rounded border border-redbyte-accent/50">Ctrl+N</kbd> for a new circuit</p>
            </div>
          </div>
        </div>

        {/* Step 3 */}
        <div className="mb-16">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-full bg-redbyte-purple text-white font-bold text-xl flex items-center justify-center">
              3
            </div>
            <h2 className="text-3xl font-bold">Run the Simulation</h2>
          </div>
          <div className="ml-16">
            <p className="text-gray-300 mb-4">
              Press <kbd className="px-2 py-1 bg-redbyte-darker rounded border border-redbyte-accent/50">Space</kbd> to start the simulation. 
              Toggle your input switches and watch the LED respond in real-time.
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-redbyte-darker rounded-lg p-4 border border-redbyte-accent/20">
                <div className="font-bold text-redbyte-accent mb-2">Simulation Controls</div>
                <ul className="space-y-1 text-sm text-gray-300">
                  <li><kbd className="text-xs px-1 bg-redbyte-dark rounded">Space</kbd> Play/Pause</li>
                  <li><kbd className="text-xs px-1 bg-redbyte-dark rounded">→</kbd> Step Forward</li>
                  <li><kbd className="text-xs px-1 bg-redbyte-dark rounded">←</kbd> Step Backward</li>
                  <li><kbd className="text-xs px-1 bg-redbyte-dark rounded">R</kbd> Reset</li>
                </ul>
              </div>
              <div className="bg-redbyte-darker rounded-lg p-4 border border-redbyte-accent/20">
                <div className="font-bold text-redbyte-cyan mb-2">Editing Shortcuts</div>
                <ul className="space-y-1 text-sm text-gray-300">
                  <li><kbd className="text-xs px-1 bg-redbyte-dark rounded">Ctrl+S</kbd> Save</li>
                  <li><kbd className="text-xs px-1 bg-redbyte-dark rounded">Ctrl+Z</kbd> Undo</li>
                  <li><kbd className="text-xs px-1 bg-redbyte-dark rounded">Del</kbd> Delete</li>
                  <li><kbd className="text-xs px-1 bg-redbyte-dark rounded">W</kbd> Wire Mode</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Step 4 */}
        <div className="mb-16">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-redbyte-accent to-redbyte-cyan text-redbyte-dark font-bold text-xl flex items-center justify-center">
              4
            </div>
            <h2 className="text-3xl font-bold">Probe Signals</h2>
          </div>
          <div className="ml-16">
            <p className="text-gray-300 mb-4">
              Open the Oscilloscope app to see signal waveforms. Click any wire in your circuit to add it as a probe. 
              Watch the waveforms update in real-time as your circuit runs.
            </p>
            <div className="bg-redbyte-dark rounded-lg p-4 border-l-4 border-redbyte-purple">
              <p className="text-gray-300 text-sm">
                <strong className="text-redbyte-purple">Deterministic debugging:</strong> Scrub through time to see 
                the exact state of every signal at any moment. Perfect for finding timing bugs.
              </p>
            </div>
          </div>
        </div>

        {/* Step 5 */}
        <div className="mb-16">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-full bg-white text-redbyte-dark font-bold text-xl flex items-center justify-center">
              5
            </div>
            <h2 className="text-3xl font-bold">Export Your Design</h2>
          </div>
          <div className="ml-16">
            <p className="text-gray-300 mb-4">
              When you're ready, export your circuit to Verilog or VHDL for deployment on real FPGA hardware:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-gray-300 mb-4">
              <li>Go to File → Export</li>
              <li>Choose your target format (Verilog or VHDL)</li>
              <li>Configure module name and ports</li>
              <li>Save the generated file</li>
            </ol>
            <div className="bg-redbyte-darker rounded-lg p-4 font-mono text-sm text-redbyte-accent border border-redbyte-accent/30">
              <div className="text-gray-500">// Generated Verilog example</div>
              <div>module my_circuit(input a, input b, output out);</div>
              <div className="ml-4">assign out = a & b;</div>
              <div>endmodule</div>
            </div>
          </div>
        </div>

        {/* Next Steps */}
        <div className="bg-gradient-to-r from-redbyte-accent/20 to-redbyte-cyan/20 rounded-xl p-8">
          <h2 className="text-2xl font-bold mb-4">Next Steps</h2>
          <ul className="space-y-3 text-gray-300">
            <li className="flex items-start gap-3">
              <span className="text-redbyte-accent">→</span>
              <span>Explore the <a href="/#/examples" className="text-redbyte-accent hover:underline">interactive examples</a> to learn advanced techniques</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-redbyte-cyan">→</span>
              <span>Read the <a href="/#/manual" className="text-redbyte-cyan hover:underline">full manual</a> for detailed documentation</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-redbyte-purple">→</span>
              <span>Build custom chips and create your own component library</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
