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
              <li>Launch the OS and use Start Here to open the FPGA Lab in SIM mode.</li>
              <li>Export a v2 bundle and import it into Submission Inspector.</li>
              <li>Review checks and export a grading report JSON.</li>
            </ol>
          </section>


          <section className="mb-12">
            <h2 className="text-h2 text-rb-text mb-4">Signing and grading</h2>
            <div className="bg-rb-surface border border-rb-border rounded-md p-6 space-y-4">
              <p className="text-sm text-rb-muted leading-relaxed">
                Documentation for manual signing and local grading workflows is temporarily offline.
                Please refer to the repository for current command-line tools and schemas.
              </p>
              <div className="flex">
                <a
                  href="https://github.com/swaggyp52/redbyte-ui-genesis"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary px-6"
                >
                  View CLI Docs on GitHub
                </a>
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
                <Link to="/demo" className="btn btn-secondary">
                  Educator Overview
                </Link>
                <a
                  href="https://github.com/swaggyp52/redbyte-ui-genesis"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary"
                >
                  View Source
                </a>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
