import { useState } from 'react';



import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';

function extractHeadings(markdown: string) {
  const lines = markdown.split('\n');
  const headings = [];
  for (const line of lines) {
    const match = /^(#{1,4})\s+(.*)/.exec(line);
    if (match) {
      const level = match[1].length;
      const text = match[2].replace(/`/g, '');
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      if (level <= 3) headings.push({ id, text, level });
    }
  }
  return headings;
}

export default function Manual() {
  const [manualContent, setManualContent] = useState('');
  const [headings, setHeadings] = useState([]);

  useEffect(() => {
    fetch('/owners-manual.md')
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
                Owner's Manual
              </h2>
              <ul className="space-y-1 text-sm">
                {headings.map(h => (
                  <li key={h.id} className={h.level === 1 ? 'mt-4 font-bold' : h.level === 2 ? 'ml-2' : 'ml-6'}>
                    <a
                      href={`#${h.id}`}
                      className="block py-1 px-2 rounded hover:bg-rb-surface/50 text-rb-muted hover:text-rb-text"
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
            {manualContent && (
              <ReactMarkdown
                children={manualContent}
                components={{
                  h1: ({node, ...props}) => <h1 id={slugify(props.children)} className="text-h1 text-rb-text mt-12 mb-6 scroll-mt-24">{props.children}</h1>,
                  h2: ({node, ...props}) => <h2 id={slugify(props.children)} className="text-h2 text-rb-text mt-10 mb-4 scroll-mt-24">{props.children}</h2>,
                  h3: ({node, ...props}) => <h3 id={slugify(props.children)} className="text-h3 text-rb-text mt-8 mb-3 scroll-mt-24">{props.children}</h3>,
                  code: ({node, inline, className, children, ...props}) =>
                    !inline ? (
                      <pre className="bg-rb-surface border border-rb-border rounded p-4 overflow-x-auto my-4">
                        <code>{children}</code>
                      </pre>
                    ) : (
                      <code className="bg-rb-surface px-1 rounded text-rb-accent text-sm">{children}</code>
                    ),
                  a: ({node, ...props}) => <a {...props} className="text-rb-info underline hover:text-rb-accent" />,
                  li: ({node, ...props}) => <li className="mb-1">{props.children}</li>,
                }}
              />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function slugify(children: React.ReactNode) {
  const text = Array.isArray(children) ? children.join(' ') : String(children);
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
                  <li>Double-click the title bar to maximize/restore</li>
