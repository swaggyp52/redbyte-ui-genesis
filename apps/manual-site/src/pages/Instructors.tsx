import { Link as RouterLink } from 'react-router-dom';
import CodeBlock from '../components/CodeBlock';
import { mvpFacts } from '../content/mvpFacts';

const Link = RouterLink as React.ComponentType<{ to: string; className?: string; children: React.ReactNode }>;

export default function Instructors() {
  return (
    <div className="py-16 bg-rb-bg">
      <div className="content-container px-6">
        <div className="max-w-4xl">
          <h1 className="text-h1 text-rb-text mb-4">Instructor Day 1</h1>
          <p className="text-lg text-rb-muted mb-10 leading-relaxed">
            A SIM-first workflow to run a lab without hardware, then scale to Basys 3 when ready.
          </p>

          <section className="mb-12">
            <h2 className="text-h2 text-rb-text mb-4">Day 1 flow</h2>
            <ol className="list-decimal pl-5 text-sm text-rb-muted space-y-2">
              <li>Install RedByte OS with the pinned bootstrap.</li>
              <li>Run the SIM smoke test to verify deterministic frames and trace output.</li>
              <li>Launch the OS and use Start Here to open the FPGA Lab in SIM mode.</li>
              <li>Export a v2 bundle and import it into Submission Inspector.</li>
              <li>Review checks and export a grading report JSON.</li>
            </ol>
          </section>

          <section className="mb-12">
            <h2 className="text-h2 text-rb-text mb-4">SIM-first commands</h2>
            <div className="bg-rb-surface border border-rb-border rounded-md p-6 space-y-4">
              <CodeBlock code={mvpFacts.bootstrapCommand} />
              <CodeBlock code={mvpFacts.bridgeCommandSim} />
              <CodeBlock code={mvpFacts.smokeSimCommand} />
              <p className="text-xs text-rb-dim">
                Override the pinned tag with <code className="text-rb-accent">RB_GIT_REF</code> when issuing updates.
              </p>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-h2 text-rb-text mb-4">Signing and grading</h2>
            <div className="bg-rb-surface border border-rb-border rounded-md p-6 space-y-4">
              <div>
                <div className="text-sm text-rb-muted mb-2">Generate instructor keys</div>
                <CodeBlock code={`pnpm --filter @redbyte/rb-fpga-signing keygen`} />
              </div>
              <div>
                <div className="text-sm text-rb-muted mb-2">Sign a student bundle</div>
                <CodeBlock
                  code={`pnpm --filter @redbyte/rb-fpga-signing rb-sign path\\to\\student.rb-lab.zip --key <privateKeyHex> --inplace`}
                />
              </div>
              <ol className="list-decimal pl-5 text-sm text-rb-muted space-y-2">
                <li>Import the .rb-lab.zip in Submission Inspector.</li>
                <li>Confirm signature status (Valid, Invalid, Unsigned).</li>
                <li>Review checks and replay the trace.</li>
                <li>Export the grading report JSON.</li>
              </ol>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-h2 text-rb-text mb-4">Common failures</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-rb-surface border border-rb-border rounded-md p-5">
                <h3 className="text-sm font-semibold text-rb-text mb-2">No COM ports</h3>
                <p className="text-sm text-rb-muted">
                  Check the USB cable, Windows Device Manager, and FTDI drivers for Basys 3.
                </p>
              </div>
              <div className="bg-rb-surface border border-rb-border rounded-md p-5">
                <h3 className="text-sm font-semibold text-rb-text mb-2">No packets</h3>
                <p className="text-sm text-rb-muted">
                  Ensure the bitstream is programmed and UART is emitting RB binary frames.
                </p>
              </div>
              <div className="bg-rb-surface border border-rb-border rounded-md p-5">
                <h3 className="text-sm font-semibold text-rb-text mb-2">Signature invalid</h3>
                <p className="text-sm text-rb-muted">
                  Confirm the instructor public key is in trusted keys and the bundle was re-signed after edits.
                </p>
              </div>
              <div className="bg-rb-surface border border-rb-border rounded-md p-5">
                <h3 className="text-sm font-semibold text-rb-text mb-2">Trace missing</h3>
                <p className="text-sm text-rb-muted">
                  Enable trace recording before export and verify the hw_trace.ndjson file exists.
                </p>
              </div>
            </div>
          </section>

          <section className="mb-4">
            <div className="bg-rb-surface border border-rb-border rounded-md p-6">
              <h3 className="text-h3 text-rb-text mb-2">Next step</h3>
              <p className="text-sm text-rb-muted mb-4">
                Use the SIM workflow first, then transition to hardware programming once the lab is stable.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link to="/install" className="btn btn-primary">
                  Install OS
                </Link>
                <Link to="/demo" className="btn btn-secondary">
                  Educator Overview
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
