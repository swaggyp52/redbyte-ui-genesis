import LogicGatePlayground from '../components/examples/LogicGatePlayground';
import CounterCircuit from '../components/examples/CounterCircuit';
import WaveformViewer from '../components/examples/WaveformViewer';

export default function Examples() {
  return (
    <div className="py-16 bg-rb-bg">
      <div className="content-container px-6">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-4xl font-bold mb-4 text-rb-text">Interactive Examples</h1>
          <p className="text-lg text-rb-muted mb-16 leading-relaxed">
            Experience RedByte's capabilities through these interactive demos. 
            Each example runs directly in your browser and demonstrates core concepts of digital logic design.
          </p>

          <div className="space-y-12">
            {/* Example 1 */}
            <div>
              <LogicGatePlayground />
              <div className="mt-4 text-sm text-rb-muted ml-2">
                💡 <strong className="text-rb-text">Learn:</strong> Basic logic gates and truth tables. Toggle inputs to see how different gates process signals.
              </div>
            </div>

            {/* Example 2 */}
            <div>
              <CounterCircuit />
              <div className="mt-4 text-sm text-rb-muted ml-2">
                💡 <strong className="text-rb-text">Learn:</strong> Sequential logic and state machines. See how registers store values and update on clock edges.
              </div>
            </div>

            {/* Example 3 */}
            <div>
              <WaveformViewer />
              <div className="mt-4 text-sm text-rb-muted ml-2">
                💡 <strong className="text-rb-text">Learn:</strong> Signal timing and waveform analysis. This is how RedByte's oscilloscope helps you debug complex circuits.
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-16 bg-rb-surface rounded-lg border border-rb-border p-8 text-center">
            <h2 className="text-2xl font-bold mb-4 text-rb-text">Ready for More?</h2>
            <p className="text-rb-muted mb-6 leading-relaxed">
              These examples just scratch the surface. Download RedByte to build complex circuits, 
              custom chips, and export to real FPGA hardware.
            </p>
            <a
              href="#download"
              className="inline-block px-8 py-3 bg-rb-accent text-rb-bg font-medium rounded hover:bg-rb-accent-dim transition-colors"
            >
              Download RedByte
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
