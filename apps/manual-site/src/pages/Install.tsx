import { Link as RouterLink } from 'react-router-dom';
import CodeBlock from '../components/CodeBlock';
import { mvpFacts } from '../content/mvpFacts';

const Link = RouterLink as React.ComponentType<{ to: string; className?: string; children: React.ReactNode }>;

export default function Install() {
  return (
    <div className="py-16 bg-rb-bg">
      <div className="content-container px-6">
        <div className="max-w-4xl">
          <h1 className="text-h1 text-rb-text mb-4">Install RedByte OS (Windows)</h1>
          <p className="text-lg text-rb-muted mb-10 leading-relaxed">
            Paste this into a <strong>fresh PowerShell window</strong>.
            It installs everything and launches RedByte automatically.
          </p>

          <section className="mb-12">
            <div className="bg-rb-surface border border-rb-border rounded-md p-8 space-y-6">
              <CodeBlock code={mvpFacts.bootstrapCommand} />

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => navigator.clipboard.writeText(mvpFacts.bootstrapCommand)}
                  className="btn btn-primary"
                >
                  Copy Command
                </button>
                <a
                  href="https://redbyteapps.dev/bootstrap.ps1"
                  className="btn btn-secondary"
                  download
                >
                  Download Script
                </a>
              </div>
            </div>
          </section>

          <section className="mb-4">
            <div className="bg-rb-surface border border-rb-border rounded-md p-6">
              <h3 className="text-h3 text-rb-text mb-2">Advanced / Offline Setup</h3>
              <p className="text-sm text-rb-muted mb-4">
                For educator guides, manual toolchain setup, or offline installs:
              </p>
              <div className="flex flex-wrap gap-3">
                <Link to="/instructors" className="btn btn-secondary">
                  For Educators
                </Link>
                <a
                  href="https://github.com/swaggyp52/redbyte-ui-genesis"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary"
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
