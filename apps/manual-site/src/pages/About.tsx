export default function About() {
  return (
    <div className="py-16">
      <div className="container mx-auto px-6 max-w-4xl">
        <h1 className="text-5xl font-bold mb-8 text-redbyte-accent">About RedByte</h1>
        
        <div className="space-y-12">
          {/* What is RedByte */}
          <section>
            <h2 className="text-3xl font-bold mb-6 text-redbyte-cyan">What is RedByte?</h2>
            <p className="text-gray-300 mb-4 leading-relaxed">
              RedByte is a deterministic digital logic simulator and FPGA development environment that runs 
              entirely in your browser. It provides a visual, interactive way to design, simulate, and debug 
              digital circuits before deploying them to real hardware.
            </p>
            <p className="text-gray-300 mb-4 leading-relaxed">
              Unlike traditional HDL-first workflows, RedByte lets you build circuits visually and see them 
              run in real-time. The deterministic simulation engine means every run is perfectly reproducible—you 
              can step backward through time to debug complex timing issues.
            </p>
          </section>

          {/* Who is it for? */}
          <section>
            <h2 className="text-3xl font-bold mb-6 text-redbyte-cyan">Who is RedByte For?</h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-redbyte-darker rounded-lg p-6 border border-redbyte-accent/30">
                <div className="text-3xl mb-4">🎓</div>
                <h3 className="font-bold text-redbyte-accent mb-3">Students</h3>
                <p className="text-gray-300 text-sm">
                  Learn digital logic concepts interactively. Build circuits, see them run, and understand 
                  how gates combine to create complex systems.
                </p>
              </div>
              <div className="bg-redbyte-darker rounded-lg p-6 border border-redbyte-cyan/30">
                <div className="text-3xl mb-4">👩‍💻</div>
                <h3 className="font-bold text-redbyte-cyan mb-3">Hardware Engineers</h3>
                <p className="text-gray-300 text-sm">
                  Prototype designs quickly before writing HDL. Debug timing issues visually, then export 
                  production-ready Verilog/VHDL.
                </p>
              </div>
              <div className="bg-redbyte-darker rounded-lg p-6 border border-redbyte-purple/30">
                <div className="text-3xl mb-4">🔬</div>
                <h3 className="font-bold text-redbyte-purple mb-3">Hobbyists</h3>
                <p className="text-gray-300 text-sm">
                  Explore FPGA development without expensive tools. Build retro computer components, 
                  game consoles, or custom processors.
                </p>
              </div>
            </div>
          </section>

          {/* Key Features */}
          <section>
            <h2 className="text-3xl font-bold mb-6 text-redbyte-cyan">Key Features</h2>
            <div className="bg-redbyte-darker rounded-lg p-8 border border-redbyte-accent/30">
              <ul className="space-y-4">
                <li className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-redbyte-accent/20 flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-redbyte-accent font-bold">✓</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-white mb-1">Deterministic Simulation</h3>
                    <p className="text-gray-300 text-sm">
                      Every simulation run is perfectly reproducible. Step forward and backward through time 
                      to debug timing issues and understand circuit behavior.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-redbyte-cyan/20 flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-redbyte-cyan font-bold">✓</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-white mb-1">Visual Circuit Design</h3>
                    <p className="text-gray-300 text-sm">
                      Drag and drop gates, chips, and wires. Build complex circuits visually without 
                      writing a single line of HDL code.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-redbyte-purple/20 flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-redbyte-purple font-bold">✓</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-white mb-1">Real-Time Oscilloscope</h3>
                    <p className="text-gray-300 text-sm">
                      Probe any signal in your circuit and see waveforms update in real-time. 
                      Essential for debugging sequential logic and timing.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-redbyte-accent/20 flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-redbyte-accent font-bold">✓</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-white mb-1">Hardware Export</h3>
                    <p className="text-gray-300 text-sm">
                      Generate Verilog or VHDL from your designs. Go from visual simulation to real 
                      FPGA hardware seamlessly.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-redbyte-cyan/20 flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-redbyte-cyan font-bold">✓</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-white mb-1">Custom Chip Libraries</h3>
                    <p className="text-gray-300 text-sm">
                      Build reusable components and create your own chip library. Organize complex 
                      designs hierarchically.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-redbyte-purple/20 flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-redbyte-purple font-bold">✓</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-white mb-1">Keyboard-Driven Workflow</h3>
                    <p className="text-gray-300 text-sm">
                      Power user shortcuts for every operation. Maximize productivity with a 
                      keyboard-first interface.
                    </p>
                  </div>
                </li>
              </ul>
            </div>
          </section>

          {/* Roadmap */}
          <section>
            <h2 className="text-3xl font-bold mb-6 text-redbyte-cyan">Roadmap</h2>
            <p className="text-gray-300 mb-6">
              RedByte is under active development. Here's what's coming next:
            </p>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-6 h-6 rounded-full bg-redbyte-accent flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-redbyte-dark text-xs font-bold">✓</span>
                </div>
                <div>
                  <h3 className="font-bold text-white">Core Simulation Engine</h3>
                  <p className="text-gray-400 text-sm">Complete ✓</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-6 h-6 rounded-full bg-redbyte-accent flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-redbyte-dark text-xs font-bold">✓</span>
                </div>
                <div>
                  <h3 className="font-bold text-white">Visual Circuit Editor</h3>
                  <p className="text-gray-400 text-sm">Complete ✓</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-6 h-6 rounded-full bg-redbyte-cyan border-2 border-redbyte-cyan flex items-center justify-center flex-shrink-0 mt-1">
                </div>
                <div>
                  <h3 className="font-bold text-white">Hardware Bridge (FPGA Upload)</h3>
                  <p className="text-gray-400 text-sm">In Progress</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-6 h-6 rounded-full border-2 border-gray-600 flex items-center justify-center flex-shrink-0 mt-1">
                </div>
                <div>
                  <h3 className="font-bold text-gray-300">Advanced Debugging Tools</h3>
                  <p className="text-gray-400 text-sm">Planned</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-6 h-6 rounded-full border-2 border-gray-600 flex items-center justify-center flex-shrink-0 mt-1">
                </div>
                <div>
                  <h3 className="font-bold text-gray-300">Collaborative Design Tools</h3>
                  <p className="text-gray-400 text-sm">Planned</p>
                </div>
              </div>
            </div>
          </section>

          {/* Built By */}
          <section className="bg-gradient-to-r from-redbyte-accent/20 to-redbyte-cyan/20 rounded-xl p-8">
            <h2 className="text-2xl font-bold mb-4">Built By</h2>
            <p className="text-gray-300 mb-2">
              <strong className="text-white">Connor Angiel</strong>
            </p>
            <p className="text-gray-400 text-sm">
              RedByte is a passion project to make digital logic design more accessible and enjoyable. 
              Feedback and contributions are welcome!
            </p>
          </section>

          {/* CTA */}
          <div className="text-center">
            <a
              href="#download"
              className="inline-block px-12 py-4 bg-redbyte-accent text-redbyte-dark font-bold text-lg rounded-lg hover:bg-redbyte-accent-dim transition-all hover:scale-105 shadow-xl"
            >
              Download RedByte
            </a>
            <p className="text-sm text-gray-400 mt-4">Free • Cross-Platform • Open Development</p>
          </div>
        </div>
      </div>
    </div>
  );
}
