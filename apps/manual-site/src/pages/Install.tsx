import { Link as RouterLink } from 'react-router-dom';
import CodeBlock from '../components/CodeBlock';
import { mvpFacts } from '../content/mvpFacts';

const Link = RouterLink as React.ComponentType<{ to: string; className?: string; children: React.ReactNode }>;

export default function Install() {
  return (
    <div className="py-24 bg-rb-bg min-h-[60vh]">
      <div className="content-container px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-h1 text-rb-text mb-4">Lab Machine Setup</h1>
            <p className="text-lg text-rb-muted">
              Follow these steps to verify readiness for ECE Lab deployment.
            </p>
          </div>

          <div className="space-y-12">
            {/* Quick Start */}
            <section className="bg-rb-surface border border-rb-border rounded-xl p-8">
              <h2 className="text-h3 text-white mb-4 flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-sm font-bold border border-emerald-500/20">1</span>
                Quick Start
              </h2>
              <p className="text-rb-muted mb-4 text-sm">
                Run this command in PowerShell (Admin not required) to install Node.js (if missing), dependencies, and start the dev environment.
              </p>
              <CodeBlock
                code="powershell -ExecutionPolicy Bypass -NoProfile -File .\bootstrap.ps1"
              />
            </section>

            {/* Verification Plan */}
            <section className="bg-rb-surface border border-rb-border rounded-xl p-8">
              <h2 className="text-h3 text-white mb-6 flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center text-sm font-bold border border-blue-500/20">2</span>
                Lab Verification Plan
              </h2>

              <div className="space-y-6">
                <div>
                  <h3 className="font-bold text-gray-200 mb-2">A. Verify Bridge</h3>
                  <ul className="list-disc list-inside text-sm text-rb-muted space-y-1">
                    <li>Start the bridge daemon (port 4242).</li>
                    <li>Open <a href="http://localhost:4242/health" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">/health</a> - Expect <code className="bg-black/30 px-1 rounded">ok: true</code></li>
                    <li>Open <a href="http://localhost:4242/devices" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">/devices</a> - Expect your board to be listed.</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-bold text-gray-200 mb-2">B. Hardware Panel UX</h3>
                  <ul className="list-disc list-inside text-sm text-rb-muted space-y-1">
                    <li>Open RedByte UI (port 5173/5174).</li>
                    <li>Navigate to Hardware Panel.</li>
                    <li>Verify status is <strong>ONLINE</strong> (or connect manually).</li>
                    <li>Ensure correct board model (e.g., Basys3) is detected.</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-bold text-gray-200 mb-2">C. Program & Export</h3>
                  <ul className="list-disc list-inside text-sm text-rb-muted space-y-1">
                    <li>Program a known-good bitstream (e.g., lab wrapper).</li>
                    <li>Click <strong>REC</strong> and toggle switches on the board.</li>
                    <li>Click <strong>STOP</strong> after ~5 seconds.</li>
                    <li>Click <strong>EXPORT</strong> to download the V2 Bundle (zip).</li>
                    <li>Verify the zip contains <code>manifest.json</code> and <code>trace/hw_trace.ndjson</code>.</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Spartan-3E Setup Guide */}
            <section className="bg-rb-surface border border-rb-border rounded-xl p-8">
              <h2 className="text-h3 text-white mb-6 flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center text-sm font-bold border border-red-500/20">3</span>
                Spartan-3E Starter Kit Setup
              </h2>
              <div className="space-y-4">
                <div className="bg-black/20 p-4 rounded-lg border border-rb-border">
                  <h4 className="font-bold text-sm text-gray-300 mb-2">Hardware Connection</h4>
                  <ul className="list-disc list-inside text-sm text-rb-muted space-y-2">
                    <li>
                      <strong>Power:</strong> Connect the 5V power supply. Slide power switch to ON.
                    </li>
                    <li>
                      <strong>USB:</strong> Connect the USB Type-B cable (port is on the left, next to Ethernet).
                    </li>
                    <li>
                      <strong>Status:</strong> Ensure the green LED near the USB port is LIT (driver active).
                    </li>
                  </ul>
                </div>

                <div className="bg-black/20 p-4 rounded-lg border border-rb-border">
                  <h4 className="font-bold text-sm text-gray-300 mb-2">Programming & Wrapper</h4>
                  <p className="text-sm text-rb-muted mb-2">
                    This board requires JTAG programming via USBC.
                  </p>
                  <ul className="list-disc list-inside text-sm text-rb-muted space-y-1">
                    <li>Use <strong>Adept</strong> or <strong>iMPACT</strong> to load your bitstream (<code>.bit</code>).</li>
                    <li>
                      <strong>Wrapper Required:</strong> If you see <span className="text-amber-400">NO DATA</span> in RedByte, ensure your design instantiates the RedByte Wrapper to drive the UART trace pins.
                    </li>
                  </ul>
                </div>
              </div>
            </section>
          </div>

          <div className="mt-12 text-center">
            <Link to="/about" className="btn btn-secondary px-8">
              Detailed Docs
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
