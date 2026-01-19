// Copyright Ac 2025 Connor Angiel - RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useCallback, useMemo, useState } from 'react';
import type { RedByteApp } from '../types';
import type { ExampleId } from '../examples';
import manual from '../../../../REDBYTE_USER_MANUAL.md?raw';

interface UserManualProps {
  onOpenApp?: (appId: string, props?: Record<string, unknown>) => void;
}

type TocItem = {
  id: string;
  text: string;
  level: number;
};

const DEMO_LINKS: Record<string, { id: ExampleId; label: string }> = {
  'not-gate': { id: '15_not-gate', label: 'NOT Gate' },
  'and-gate': { id: '02_and-gate', label: 'AND Gate' },
  'half-adder': { id: '03_half-adder', label: 'Half Adder' },
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[`~!@#$%^&*()=+[\]{}\\|;:'",.<>/?]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

const isTableSeparator = (line: string) =>
  /^\s*\|?(\s*:?-+:?\s*\|)+\s*$/.test(line);

const parseTableRow = (line: string) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());

const highlightText = (text: string, query: string) => {
  if (!query) return text;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  if (!lowerQuery) return text;

  const parts: React.ReactNode[] = [];
  let start = 0;
  let index = lowerText.indexOf(lowerQuery);

  while (index !== -1) {
    if (index > start) {
      parts.push(text.slice(start, index));
    }
    const match = text.slice(index, index + lowerQuery.length);
    parts.push(
      <mark key={`${index}-${match}`} className="bg-cyan-400/30 text-cyan-100 rounded px-0.5">
        {match}
      </mark>
    );
    start = index + lowerQuery.length;
    index = lowerText.indexOf(lowerQuery, start);
  }

  if (start < text.length) {
    parts.push(text.slice(start));
  }

  return parts.length > 0 ? parts : text;
};

const renderInline = (
  text: string,
  query: string,
  onLinkClick: (event: React.MouseEvent<HTMLAnchorElement>, href: string) => void
): React.ReactNode[] => {
  const patterns = [
    { type: 'link', regex: /\[([^\]]+)\]\(([^)]+)\)/ },
    { type: 'bold', regex: /\*\*([^*]+)\*\*/ },
    { type: 'code', regex: /`([^`]+)`/ },
    { type: 'italic', regex: /\*([^*]+)\*/ },
  ];

  const nodes: React.ReactNode[] = [];
  let remaining = text;
  let keyIndex = 0;

  while (remaining.length > 0) {
    let nextMatch: { type: string; match: RegExpExecArray; index: number } | null = null;

    for (const pattern of patterns) {
      const match = pattern.regex.exec(remaining);
      if (!match) continue;
      if (!nextMatch || match.index < nextMatch.index) {
        nextMatch = { type: pattern.type, match, index: match.index };
      }
    }

    if (!nextMatch) {
      nodes.push(<span key={`t-${keyIndex++}`}>{highlightText(remaining, query)}</span>);
      break;
    }

    if (nextMatch.index > 0) {
      nodes.push(
        <span key={`t-${keyIndex++}`}>{highlightText(remaining.slice(0, nextMatch.index), query)}</span>
      );
    }

    const token = nextMatch.match[0];
    const content = nextMatch.match[1];

    if (nextMatch.type === 'link') {
      const href = nextMatch.match[2];
      nodes.push(
        <a
          key={`l-${keyIndex++}`}
          href={href}
          onClick={(event) => onLinkClick(event, href)}
          className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 focus:outline-none focus:ring-2 focus:ring-cyan-400"
        >
          {highlightText(content, query)}
        </a>
      );
    } else if (nextMatch.type === 'bold') {
      nodes.push(
        <strong key={`b-${keyIndex++}`} className="text-slate-100">
          {highlightText(content, query)}
        </strong>
      );
    } else if (nextMatch.type === 'italic') {
      nodes.push(
        <em key={`i-${keyIndex++}`} className="text-slate-200">
          {highlightText(content, query)}
        </em>
      );
    } else if (nextMatch.type === 'code') {
      nodes.push(
        <code key={`c-${keyIndex++}`} className="px-1 py-0.5 rounded bg-slate-800 text-cyan-200">
          {content}
        </code>
      );
    }

    remaining = remaining.slice(nextMatch.index + token.length);
  }

  return nodes;
};

const parseMarkdown = (
  markdown: string,
  query: string,
  onLinkClick: (event: React.MouseEvent<HTMLAnchorElement>, href: string) => void,
  onCopy: (code: string, id: string) => void,
  copiedId: string | null
) => {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const toc: TocItem[] = [];
  const blocks: React.ReactNode[] = [];
  let index = 0;
  let codeIndex = 0;

  const isSpecialLine = (line: string) => {
    if (line.trim() === '') return true;
    if (/^#{1,6}\s+/.test(line)) return true;
    if (/^\s*```/.test(line)) return true;
    if (/^\s*[-*+]\s+/.test(line)) return true;
    if (/^\s*\d+\.\s+/.test(line)) return true;
    if (/^\s*---\s*$/.test(line)) return true;
    if (line.includes('|') && isTableSeparator(lines[index + 1] ?? '')) return true;
    return false;
  };

  while (index < lines.length) {
    const line = lines[index];

    if (line.trim() === '') {
      index += 1;
      continue;
    }

    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2].trim();
      const id = slugify(text);
      toc.push({ id, text, level });
      const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements;
      blocks.push(
        <HeadingTag
          key={`h-${index}`}
          id={id}
          tabIndex={-1}
          className={`scroll-mt-24 font-semibold ${
            level === 1
              ? 'text-3xl text-cyan-200'
              : level === 2
                ? 'text-2xl text-cyan-300'
                : level === 3
                  ? 'text-xl text-cyan-200'
                  : 'text-lg text-cyan-100'
          }`}
        >
          {renderInline(text, query, onLinkClick)}
        </HeadingTag>
      );
      index += 1;
      continue;
    }

    if (/^\s*---\s*$/.test(line)) {
      blocks.push(<hr key={`hr-${index}`} className="border-slate-700/60 my-6" />);
      index += 1;
      continue;
    }

    if (/^\s*```/.test(line)) {
      const language = line.trim().replace('```', '').trim();
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !/^\s*```/.test(lines[index])) {
        codeLines.push(lines[index]);
        index += 1;
      }
      index += 1;
      const code = codeLines.join('\n');
      const codeId = `code-${codeIndex++}`;
      blocks.push(
        <div key={codeId} className="relative my-4">
          <div className="absolute right-3 top-3 flex items-center gap-2">
            {language && (
              <span className="text-xs uppercase tracking-wide text-slate-400">{language}</span>
            )}
            <button
              type="button"
              onClick={() => onCopy(code, codeId)}
              className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-200 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-400"
              aria-label="Copy code block"
            >
              {copiedId === codeId ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre className="bg-slate-950 border border-slate-800 rounded-lg p-4 overflow-x-auto text-sm text-slate-200">
            <code>{code}</code>
          </pre>
        </div>
      );
      continue;
    }

    if (line.includes('|') && isTableSeparator(lines[index + 1] ?? '')) {
      const header = parseTableRow(line);
      index += 2;
      const rows: string[][] = [];

      while (index < lines.length && lines[index].includes('|') && lines[index].trim() !== '') {
        rows.push(parseTableRow(lines[index]));
        index += 1;
      }

      blocks.push(
        <div key={`table-${index}`} className="my-4 overflow-x-auto">
          <table className="min-w-full border border-slate-700 text-sm">
            <thead className="bg-slate-900/80">
              <tr>
                {header.map((cell, cellIndex) => (
                  <th key={`th-${cellIndex}`} className="px-3 py-2 text-left font-semibold text-slate-200 border-b border-slate-700">
                    {renderInline(cell, query, onLinkClick)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={`tr-${rowIndex}`} className="border-b border-slate-800">
                  {row.map((cell, cellIndex) => (
                    <td key={`td-${rowIndex}-${cellIndex}`} className="px-3 py-2 text-slate-300">
                      {renderInline(cell, query, onLinkClick)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*[-*+]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*[-*+]\s+/, '').trim());
        index += 1;
      }
      blocks.push(
        <ul key={`ul-${index}`} className="list-disc list-inside space-y-2 text-slate-300">
          {items.map((item, itemIndex) => (
            <li key={`li-${itemIndex}`}>{renderInline(item, query, onLinkClick)}</li>
          ))}
        </ul>
      );
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*\d+\.\s+/, '').trim());
        index += 1;
      }
      blocks.push(
        <ol key={`ol-${index}`} className="list-decimal list-inside space-y-2 text-slate-300">
          {items.map((item, itemIndex) => (
            <li key={`oli-${itemIndex}`}>{renderInline(item, query, onLinkClick)}</li>
          ))}
        </ol>
      );
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length && !isSpecialLine(lines[index])) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }
    const paragraphText = paragraphLines.join(' ');
    if (paragraphText) {
      blocks.push(
        <p key={`p-${index}`} className="text-slate-300 leading-relaxed">
          {renderInline(paragraphText, query, onLinkClick)}
        </p>
      );
    }
  }

  return { toc, blocks };
};

export const UserManualAppComponent: React.FC<UserManualProps> = ({ onOpenApp }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingDemo, setPendingDemo] = useState<null | { id: ExampleId; label: string }>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // --- Handlers ---
  const handleLinkClick = useCallback((event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith('rb://demo/')) {
      event.preventDefault();
      const slug = href.replace('rb://demo/', '');
      const demo = DEMO_LINKS[slug];
      if (demo) setPendingDemo(demo);
      return;
    }
    if (href.startsWith('#')) {
      event.preventDefault();
      const target = document.getElementById(href.slice(1));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        target.focus({ preventScroll: true });
      }
      return;
    }
  }, []);

  const handleCopy = useCallback((code: string, id: string) => {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(code).then(() => {
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1500);
    });
  }, []);

  const { toc, blocks } = useMemo(
    () => parseMarkdown(manual, searchQuery, handleLinkClick, handleCopy, copiedId),
    [searchQuery, copiedId, handleLinkClick, handleCopy]
  );

  // --- Custom Hero Section ---
  const Hero = (
    <section className="w-full bg-gradient-to-br from-cyan-900/80 to-slate-900/90 rounded-b-2xl shadow-lg px-6 py-10 mb-8 flex flex-col items-center text-center">
      <div className="flex flex-col items-center gap-4 max-w-2xl">
        <div className="flex items-center gap-3">
          <span className="inline-block bg-cyan-600 rounded-full p-2">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#06b6d4"/><path d="M10 22V10h12v12H10zm2-2h8V12h-8v8z" fill="#fff"/></svg>
          </span>
          <h1 className="text-3xl font-bold text-cyan-100 tracking-tight">Welcome to Redbyte</h1>
        </div>
        <p className="text-lg text-slate-200 mt-2">
          <span className="font-semibold text-cyan-300">Redbyte</span> is a next-generation digital logic playground and circuit design OS.<br/>
          Build, simulate, and share digital circuits—right in your browser.
        </p>
        <ul className="flex flex-wrap justify-center gap-4 mt-4 text-slate-300 text-base">
          <li className="bg-slate-800/80 rounded px-4 py-2">Visual Circuit Editor</li>
          <li className="bg-slate-800/80 rounded px-4 py-2">Analog Lab Models</li>
          <li className="bg-slate-800/80 rounded px-4 py-2">FPGA Synthesis Flow</li>
          <li className="bg-slate-800/80 rounded px-4 py-2">Project Archive Export</li>
        </ul>
      </div>
    </section>
  );

  // --- Redesigned Table of Contents ---
  const TOC = (
    <nav aria-label="Guide table of contents" className="space-y-1 text-sm">
      {toc.length === 0 ? (
        <span className="text-slate-500">No sections found.</span>
      ) : (
        toc.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            onClick={(event) => handleLinkClick(event, `#${item.id}`)}
            className={`block rounded px-2 py-1 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-400 ${
              item.level === 1
                ? 'font-semibold text-cyan-200 hover:bg-cyan-900/30'
                : item.level === 2
                ? 'pl-4 text-cyan-100 hover:bg-cyan-800/20'
                : 'pl-8 text-slate-400 hover:bg-slate-800/30 text-xs'
            }`}
          >
            {item.text}
          </a>
        ))
      )}
    </nav>
  );

  // --- Main Layout ---
  return (
    <div className="h-full bg-slate-900 text-white flex flex-col">
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="text-xl">dY","</div>
          <div>
            <div className="text-sm font-semibold text-slate-100">Redbyte Guide</div>
            <div className="text-xs text-slate-500">Digital Circuit Playground</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400" htmlFor="manual-search">
            Search
          </label>
          <input
            id="manual-search"
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="px-3 py-1.5 text-sm bg-slate-900 border border-slate-700 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500"
            placeholder="Find topics"
            aria-label="Search the guide"
          />
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="h-full grid grid-cols-1 lg:grid-cols-[260px,1fr]">
          <aside className="hidden lg:block border-r border-slate-800 bg-slate-950/40">
            <div className="sticky top-0 px-4 py-4">
              <div className="text-xs uppercase tracking-wide text-slate-500 mb-3">Sections</div>
              {TOC}
            </div>
          </aside>

          <main
            tabIndex={0}
            className="overflow-y-auto px-6 py-6 lg:px-10 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            aria-label="Guide content"
          >
            {Hero}
            <div className="max-w-3xl space-y-6">{blocks}</div>
          </main>
        </div>
      </div>

      {pendingDemo && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="manual-demo-title"
        >
          <div className="w-full max-w-md bg-slate-950 border border-slate-700 rounded-lg p-5 shadow-xl">
            <h2 id="manual-demo-title" className="text-lg font-semibold text-slate-100">
              Load demo: {pendingDemo.label}
            </h2>
            <p className="text-sm text-slate-400 mt-2">
              This will replace the current circuit in Logic Playground. If you have unsaved work, save it first.
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setPendingDemo(null)}
                className="px-3 py-1.5 text-sm rounded bg-slate-800 text-slate-200 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-400"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onOpenApp?.('logic-playground', { initialExampleId: pendingDemo.id });
                  setPendingDemo(null);
                }}
                className="px-3 py-1.5 text-sm rounded bg-cyan-600 text-white hover:bg-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-400"
              >
                Load Demo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const UserManualApp: RedByteApp = {
  manifest: {
    id: 'user-manual',
    name: 'User Manual',
    iconId: 'document',
    category: 'tools',
    defaultSize: { width: 980, height: 720 },
    minSize: { width: 720, height: 520 },
  },
  component: UserManualAppComponent,
};
