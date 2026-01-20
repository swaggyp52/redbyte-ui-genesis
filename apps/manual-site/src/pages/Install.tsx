import { Link as RouterLink } from 'react-router-dom';

const Link = RouterLink as React.ComponentType<{ to: string; className?: string; children: React.ReactNode }>;

export default function Install() {
  return (
    <div className="py-16 bg-rb-bg">
      <div className="content-container px-6">
        <div className="max-w-4xl">
          <h1 className="text-h1 text-rb-text mb-4">Install RedByte OS</h1>
          <p className="text-lg text-rb-muted mb-10 leading-relaxed">
            Use the pinned bootstrap script for deterministic setup. It installs the required
            toolchain, checks versions, and builds the workspace.
          </p>

          <section className="mb-12">
            <h2 className="text-h2 text-rb-text mb-6">Bootstrap (Windows PowerShell)</h2>
            <div className="bg-rb-surface border border-rb-border rounded-md p-6 space-y-4">
              <p className="text-sm text-rb-muted">
                Runs the pinned bootstrap script from a clean clone.
              </p>
              <CodeBlock
                code={`powershell -NoProfile -ExecutionPolicy Bypass -Command \"git clone https://github.com/swaggyp52/redbyte-ui-genesis.git; cd redbyte-ui-genesis; .\\\\scripts\\\\bootstrap.ps1\"`}
              />
              <p className="text-xs text-rb-dim">
                Default pin: <code className="text-rb-accent">fpga-mvp-0.1.0</code>. Override with <code className="text-rb-accent">RB_GIT_REF</code> if needed.
              </p>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-h2 text-rb-text mb-6">Override the pinned ref</h2>
            <div className="bg-rb-surface border border-rb-border rounded-md p-6 space-y-4">
              <p className="text-sm text-rb-muted">
                Use a tag or commit SHA for a specific class release.
              </p>
              <CodeBlock
                code={`$env:RB_GIT_REF=\"fpga-mvp-0.1.0\"\npowershell -NoProfile -ExecutionPolicy Bypass -File .\\\\scripts\\\\bootstrap.ps1`}
              />
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-h2 text-rb-text mb-6">System requirements</h2>
            <div className="bg-rb-surface border border-rb-border rounded-md p-6">
              <ul className="space-y-2 text-rb-muted">
                <li>Windows 10 or 11</li>
                <li>Basys 3 board optional (hardware mode)</li>
                <li>Vivado 2024.1 required only for programming hardware</li>
                <li>SIM mode works without Vivado</li>
              </ul>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-h2 text-rb-text mb-6">Verify the install</h2>
            <div className="bg-rb-surface border border-rb-border rounded-md p-6 space-y-4">
              <div>
                <div className="text-sm text-rb-muted mb-2">Environment check (SIM mode supported)</div>
                <CodeBlock code={`powershell -NoProfile -ExecutionPolicy Bypass -File .\\\\scripts\\\\doctor.ps1`} />
                <p className="text-xs text-rb-dim mt-2">
                  To validate SIM-only machines, set <code className="text-rb-accent">RB_FPGA_SIM=1</code> before running doctor.
                </p>
              </div>
              <div>
                <div className="text-sm text-rb-muted mb-2">SIM smoke test (no hardware)</div>
                <CodeBlock
                  code={`$env:RB_FPGA_SIM=\"1\"\npowershell -NoProfile -ExecutionPolicy Bypass -File .\\\\scripts\\\\smoke_fpga.ps1`}
                />
              </div>
            </div>
          </section>

          <section className="mb-4">
            <div className="bg-rb-surface border border-rb-border rounded-md p-6">
              <h3 className="text-h3 text-rb-text mb-2">Next steps</h3>
              <p className="text-sm text-rb-muted mb-4">
                Launch the OS, open Start Here, and follow the SIM or hardware walkthroughs.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link to="/getting-started" className="btn btn-secondary">
                  Getting Started
                </Link>
                <Link to="/demo" className="btn btn-secondary">
                  For Educators
                </Link>
                <a
                  href="https://github.com/swaggyp52/redbyte-ui-genesis"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                >
                  View Repo
                </a>
              </div>
            </div>
          </section>
        </div>
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
