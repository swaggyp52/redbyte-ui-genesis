import React, { useEffect, useState } from 'react';
import Markdown from 'react-markdown';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function extractHeadings(markdown: string) {
  const lines = markdown.split('\n');
  const headings = [];
  for (const line of lines) {
    const match = /^(#{1,4})\s+(.*)/.exec(line);
    if (match) {
      const level = match[1].length;
      const text = match[2].replace(/`/g, '');
      const id = slugify(text);
      if (level <= 3) headings.push({ id, text, level });
    }
  }
  return headings;
}

import { useNavigate } from 'react-router-dom';

export default function Guide() {
  const [manualContent, setManualContent] = useState('');
  const [headings, setHeadings] = useState<{ id: string; text: string; level: number }[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/user-manual.md')
      .then(res => res.text())
      .then(md => {
        setManualContent(md);
        setHeadings(extractHeadings(md));
      });
  }, []);

  return (
    <div className="py-16 bg-rb-bg">
      <div className="content-container px-6">
        <div className="flex gap-12">
          {/* Sidebar */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <nav className="sticky top-24">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-rb-dim mb-4">
                Guide
              </h2>
              <ul className="space-y-1 text-sm">
                {headings.map(h => (
                  <li key={h.id} className={h.level === 1 ? 'mt-4 font-bold' : h.level === 2 ? 'ml-2' : 'ml-6'}>
                    <a
                      href={`#${h.id}`}
                      className="block py-1 px-2 rounded hover:bg-rb-surface/50 text-rb-muted hover:text-rb-text"
                      onClick={e => {
                        e.preventDefault();
                        const el = document.getElementById(h.id);
                        if (el) {
                          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          el.focus?.();
                        }
                      }}
                    >
                      {h.text}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>

          {/* Content */}
          <main className="flex-1 min-w-0 prose prose-invert prose-rb max-w-none text-rb-muted leading-relaxed">
            {/* Start Here Card */}
            <section className="mb-10">
              <div className="bg-rb-surface border border-rb-border rounded-lg shadow-card px-8 py-8 flex flex-col items-center text-center">
                <h1 className="text-h1 text-rb-text mb-2">RedByte Guide</h1>
                <p className="text-lg text-rb-muted mb-4">Turn confusion into confidence. Start building in RedByte in under 10 minutes.</p>
                <div className="flex flex-col md:flex-row gap-4 w-full max-w-xl justify-center">
                  <button
                    className="btn btn-primary flex-1 flex-col items-start gap-1 text-left"
                    onClick={() => navigate('/guide/walkthrough')}
                  >
                    New to RedByte? <span className="block text-xs font-normal">10-Minute Walkthrough</span>
                  </button>
                  <button
                    className="btn btn-secondary flex-1"
                    onClick={() => document.getElementById('build-circuit')?.scrollIntoView({behavior:'smooth'})}
                  >
                    I want to build a circuit
                  </button>
                  <button
                    className="btn btn-secondary flex-1"
                    onClick={() => document.getElementById('compare-table')?.scrollIntoView({behavior:'smooth'})}
                  >
                    How is this different?
                  </button>
                </div>
              </div>
            </section>
            {/* What's new */}
            <section className="mb-10">
              <div className="bg-rb-surface border border-rb-border rounded-xl p-6">
                <h2 className="text-xl font-semibold text-rb-text mb-2">What is covered here</h2>
                <p className="text-sm text-rb-muted mb-4">
                  The guide now includes analog simulation, deterministic submissions, and the full FPGA flow.
                </p>
                <ul className="grid gap-3 md:grid-cols-3 text-sm text-rb-muted">
                  <li className="bg-rb-bg/40 border border-rb-border rounded-lg p-3">
                    Analog sliders and live readouts in the Inspector (LDR light, VoltageSource)
                  </li>
                  <li className="bg-rb-bg/40 border border-rb-border rounded-lg p-3">
                    RB Zip v2 export with manifest, trace, integrity capsule, and signature status
                  </li>
                  <li className="bg-rb-bg/40 border border-rb-border rounded-lg p-3">
                    FPGA bridge workflow: SIM mode, UART telemetry, Vivado batch programming
                  </li>
                </ul>
              </div>
            </section>

            {/* RB Zip v2 Schema */}
            <section id="student-export-schema" className="mb-10">
              <div className="bg-rb-surface border border-rb-border rounded-xl p-6">
                <h2 className="text-h2 text-rb-text mb-2">RB Zip v2 schema</h2>
                <p className="text-sm text-rb-muted mb-4">
                  Student submissions are deterministic bundles that capture trace evidence and integrity.
                </p>
                <ul className="grid gap-3 md:grid-cols-2 text-sm text-rb-muted">
                  <li className="bg-rb-bg/40 border border-rb-border rounded-lg p-3">manifest.json (lab_id, board, bin size)</li>
                  <li className="bg-rb-bg/40 border border-rb-border rounded-lg p-3">trace/hw_trace.ndjson (events, ticks)</li>
                  <li className="bg-rb-bg/40 border border-rb-border rounded-lg p-3">integrity/capsule.json (sha256 file list)</li>
                  <li className="bg-rb-bg/40 border border-rb-border rounded-lg p-3">integrity/signature.sig (optional)</li>
                </ul>
              </div>
            </section>
            {/* Compare Table */}
            <section id="compare-table" className="my-12">
              <h2 className="text-h2 text-rb-text mb-4">Compare to what you already know</h2>
              <div className="overflow-x-auto">
                <table className="min-w-[400px] w-full border border-rb-border text-base text-left">
                  <thead className="bg-rb-raised">
                    <tr>
                      <th className="px-4 py-2 text-rb-text">If you've used...</th>
                      <th className="px-4 py-2 text-rb-text">RedByte feels different because...</th>
                    </tr>
                  </thead>
                  <tbody className="bg-rb-bg">
                    <tr>
                      <td className="px-4 py-2">Logisim</td>
                      <td className="px-4 py-2">Time is explicit and replayable</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2">Verilog</td>
                      <td className="px-4 py-2">You see behavior before writing HDL</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2">Vivado</td>
                      <td className="px-4 py-2">Debugging happens <em>before</em> synthesis</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="mt-4 p-4 bg-rb-info-bg border-l-4 border-rb-info rounded text-rb-text">
                <strong>Why this matters:</strong> Anchoring new concepts to familiar tools helps you get productive faster.
              </div>
            </section>

            {/* What RedByte is not */}
            <section id="what-redbyte-is-not" className="my-12">
              <h2 className="text-h2 text-rb-text mb-4">What RedByte is <span className="text-rb-accent">not</span></h2>
              <ul className="list-disc pl-6 text-lg text-rb-text space-y-2">
                <li>Not a replacement for professional FPGA toolchains</li>
                <li>Not a game</li>
                <li>Not a black-box simulator</li>
              </ul>
              <div className="mt-4 p-4 bg-rb-accent-bg border-l-4 border-rb-accent rounded text-rb-text">
                <strong>Why this matters:</strong> Clear boundaries build trust and set expectations for students and instructors.
              </div>
            </section>

            {/* Example callout sprinkled in */}
            <section className="my-12">
              <div className="p-4 bg-rb-info-bg border-l-4 border-rb-info rounded text-rb-text mb-4">
                <strong>Common mistake:</strong> If your output "looks right" but fails later, it's usually because you skipped stepping through time.
              </div>
            </section>

            {/* Existing markdown content */}
            {manualContent && <>{ManualMarkdown({ markdown: manualContent })}</>}
          </main>
        </div>
      </div>
    </div>
  );
}



// React 19 + react-markdown compatibility
function ManualMarkdown({ markdown }: { markdown: string }) {
  return (
    <Markdown
      components={{
        h1: ({node, ...props}: any) => <h1 id={slugify(props.children)} className="text-h1 text-rb-text mt-12 mb-6 scroll-mt-24">{props.children as React.ReactNode}</h1>,
        h2: ({node, ...props}: any) => <h2 id={slugify(props.children)} className="text-h2 text-rb-text mt-10 mb-4 scroll-mt-24">{props.children as React.ReactNode}</h2>,
        h3: ({node, ...props}: any) => <h3 id={slugify(props.children)} className="text-h3 text-rb-text mt-8 mb-3 scroll-mt-24">{props.children as React.ReactNode}</h3>,
        code: ({node, inline, className, children, ...props}: any) =>
          !inline ? (
            <pre className="bg-rb-surface border border-rb-border rounded p-4 overflow-x-auto my-4">
              <code>{children as React.ReactNode}</code>
            </pre>
          ) : (
            <code className="bg-rb-surface px-1 rounded text-rb-accent text-sm">{children as React.ReactNode}</code>
          ),
        a: ({node, ...props}: any) => <a {...props} className="text-rb-info underline hover:text-rb-accent" />,
      }}
    >
      {markdown}
    </Markdown>
  );
}
