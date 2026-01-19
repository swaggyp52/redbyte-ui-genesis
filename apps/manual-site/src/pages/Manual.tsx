import React, { useEffect, useState } from 'react';
import Markdown from 'react-markdown';

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
    // Wrapper to allow ReactMarkdown to be used as a JSX component in React 19
  const [manualContent, setManualContent] = useState('');
  const [headings, setHeadings] = useState<{ id: string; text: string; level: number }[]>([]);

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
                User Manual
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
            {manualContent && <>{ManualMarkdown({ markdown: manualContent })}</>}
          </main>
        </div>
      </div>
    </div>
  );
}

function slugify(children: React.ReactNode): string {
  let text = '';
  if (Array.isArray(children)) {
    text = children.map(child => (typeof child === 'string' ? child : '')).join(' ');
  } else if (typeof children === 'string') {
    text = children;
  } else {
    text = String(children);
  }
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
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
