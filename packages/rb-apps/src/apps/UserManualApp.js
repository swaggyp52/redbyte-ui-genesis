import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright Ac 2025 Connor Angiel - RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { useCallback, useMemo, useState } from 'react';
import manual from '../../../../REDBYTE_USER_MANUAL.md?raw';
const DEMO_LINKS = {
    'not-gate': { id: '15_not-gate', label: 'NOT Gate' },
    'and-gate': { id: '02_and-gate', label: 'AND Gate' },
    'half-adder': { id: '03_half-adder', label: 'Half Adder' },
};
const slugify = (value) => value
    .toLowerCase()
    .trim()
    .replace(/[`~!@#$%^&*()=+[\]{}\\|;:'",.<>/?]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
const isTableSeparator = (line) => /^\s*\|?(\s*:?-+:?\s*\|)+\s*$/.test(line);
const parseTableRow = (line) => line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
const highlightText = (text, query) => {
    if (!query)
        return text;
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    if (!lowerQuery)
        return text;
    const parts = [];
    let start = 0;
    let index = lowerText.indexOf(lowerQuery);
    while (index !== -1) {
        if (index > start) {
            parts.push(text.slice(start, index));
        }
        const match = text.slice(index, index + lowerQuery.length);
        parts.push(_jsx("mark", { className: "bg-cyan-400/30 text-cyan-100 rounded px-0.5", children: match }, `${index}-${match}`));
        start = index + lowerQuery.length;
        index = lowerText.indexOf(lowerQuery, start);
    }
    if (start < text.length) {
        parts.push(text.slice(start));
    }
    return parts.length > 0 ? parts : text;
};
const renderInline = (text, query, onLinkClick) => {
    const patterns = [
        { type: 'link', regex: /\[([^\]]+)\]\(([^)]+)\)/ },
        { type: 'bold', regex: /\*\*([^*]+)\*\*/ },
        { type: 'code', regex: /`([^`]+)`/ },
        { type: 'italic', regex: /\*([^*]+)\*/ },
    ];
    const nodes = [];
    let remaining = text;
    let keyIndex = 0;
    while (remaining.length > 0) {
        let nextMatch = null;
        for (const pattern of patterns) {
            const match = pattern.regex.exec(remaining);
            if (!match)
                continue;
            if (!nextMatch || match.index < nextMatch.index) {
                nextMatch = { type: pattern.type, match, index: match.index };
            }
        }
        if (!nextMatch) {
            nodes.push(_jsx("span", { children: highlightText(remaining, query) }, `t-${keyIndex++}`));
            break;
        }
        if (nextMatch.index > 0) {
            nodes.push(_jsx("span", { children: highlightText(remaining.slice(0, nextMatch.index), query) }, `t-${keyIndex++}`));
        }
        const token = nextMatch.match[0];
        const content = nextMatch.match[1];
        if (nextMatch.type === 'link') {
            const href = nextMatch.match[2];
            nodes.push(_jsx("a", { href: href, onClick: (event) => onLinkClick(event, href), className: "text-cyan-300 hover:text-cyan-200 underline underline-offset-4 focus:outline-none focus:ring-2 focus:ring-cyan-400", children: highlightText(content, query) }, `l-${keyIndex++}`));
        }
        else if (nextMatch.type === 'bold') {
            nodes.push(_jsx("strong", { className: "text-slate-100", children: highlightText(content, query) }, `b-${keyIndex++}`));
        }
        else if (nextMatch.type === 'italic') {
            nodes.push(_jsx("em", { className: "text-slate-200", children: highlightText(content, query) }, `i-${keyIndex++}`));
        }
        else if (nextMatch.type === 'code') {
            nodes.push(_jsx("code", { className: "px-1 py-0.5 rounded bg-slate-800 text-cyan-200", children: content }, `c-${keyIndex++}`));
        }
        remaining = remaining.slice(nextMatch.index + token.length);
    }
    return nodes;
};
const parseMarkdown = (markdown, query, onLinkClick, onCopy, copiedId) => {
    const lines = markdown.replace(/\r\n/g, '\n').split('\n');
    const toc = [];
    const blocks = [];
    let index = 0;
    let codeIndex = 0;
    const isSpecialLine = (line) => {
        if (line.trim() === '')
            return true;
        if (/^#{1,6}\s+/.test(line))
            return true;
        if (/^\s*```/.test(line))
            return true;
        if (/^\s*[-*+]\s+/.test(line))
            return true;
        if (/^\s*\d+\.\s+/.test(line))
            return true;
        if (/^\s*---\s*$/.test(line))
            return true;
        if (line.includes('|') && isTableSeparator(lines[index + 1] ?? ''))
            return true;
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
            const HeadingTag = `h${level}`;
            blocks.push(_jsx(HeadingTag, { id: id, tabIndex: -1, className: `scroll-mt-24 font-semibold ${level === 1
                    ? 'text-3xl text-cyan-200'
                    : level === 2
                        ? 'text-2xl text-cyan-300'
                        : level === 3
                            ? 'text-xl text-cyan-200'
                            : 'text-lg text-cyan-100'}`, children: renderInline(text, query, onLinkClick) }, `h-${index}`));
            index += 1;
            continue;
        }
        if (/^\s*---\s*$/.test(line)) {
            blocks.push(_jsx("hr", { className: "border-slate-700/60 my-6" }, `hr-${index}`));
            index += 1;
            continue;
        }
        if (/^\s*```/.test(line)) {
            const language = line.trim().replace('```', '').trim();
            const codeLines = [];
            index += 1;
            while (index < lines.length && !/^\s*```/.test(lines[index])) {
                codeLines.push(lines[index]);
                index += 1;
            }
            index += 1;
            const code = codeLines.join('\n');
            const codeId = `code-${codeIndex++}`;
            blocks.push(_jsxs("div", { className: "relative my-4", children: [_jsxs("div", { className: "absolute right-3 top-3 flex items-center gap-2", children: [language && (_jsx("span", { className: "text-xs uppercase tracking-wide text-slate-400", children: language })), _jsx("button", { type: "button", onClick: () => onCopy(code, codeId), className: "text-xs px-2 py-1 rounded bg-slate-800 text-slate-200 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-400", "aria-label": "Copy code block", children: copiedId === codeId ? 'Copied' : 'Copy' })] }), _jsx("pre", { className: "bg-slate-950 border border-slate-800 rounded-lg p-4 overflow-x-auto text-sm text-slate-200", children: _jsx("code", { children: code }) })] }, codeId));
            continue;
        }
        if (line.includes('|') && isTableSeparator(lines[index + 1] ?? '')) {
            const header = parseTableRow(line);
            index += 2;
            const rows = [];
            while (index < lines.length && lines[index].includes('|') && lines[index].trim() !== '') {
                rows.push(parseTableRow(lines[index]));
                index += 1;
            }
            blocks.push(_jsx("div", { className: "my-4 overflow-x-auto", children: _jsxs("table", { className: "min-w-full border border-slate-700 text-sm", children: [_jsx("thead", { className: "bg-slate-900/80", children: _jsx("tr", { children: header.map((cell, cellIndex) => (_jsx("th", { className: "px-3 py-2 text-left font-semibold text-slate-200 border-b border-slate-700", children: renderInline(cell, query, onLinkClick) }, `th-${cellIndex}`))) }) }), _jsx("tbody", { children: rows.map((row, rowIndex) => (_jsx("tr", { className: "border-b border-slate-800", children: row.map((cell, cellIndex) => (_jsx("td", { className: "px-3 py-2 text-slate-300", children: renderInline(cell, query, onLinkClick) }, `td-${rowIndex}-${cellIndex}`))) }, `tr-${rowIndex}`))) })] }) }, `table-${index}`));
            continue;
        }
        if (/^\s*[-*+]\s+/.test(line)) {
            const items = [];
            while (index < lines.length && /^\s*[-*+]\s+/.test(lines[index])) {
                items.push(lines[index].replace(/^\s*[-*+]\s+/, '').trim());
                index += 1;
            }
            blocks.push(_jsx("ul", { className: "list-disc list-inside space-y-2 text-slate-300", children: items.map((item, itemIndex) => (_jsx("li", { children: renderInline(item, query, onLinkClick) }, `li-${itemIndex}`))) }, `ul-${index}`));
            continue;
        }
        if (/^\s*\d+\.\s+/.test(line)) {
            const items = [];
            while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
                items.push(lines[index].replace(/^\s*\d+\.\s+/, '').trim());
                index += 1;
            }
            blocks.push(_jsx("ol", { className: "list-decimal list-inside space-y-2 text-slate-300", children: items.map((item, itemIndex) => (_jsx("li", { children: renderInline(item, query, onLinkClick) }, `oli-${itemIndex}`))) }, `ol-${index}`));
            continue;
        }
        const paragraphLines = [];
        while (index < lines.length && !isSpecialLine(lines[index])) {
            paragraphLines.push(lines[index].trim());
            index += 1;
        }
        const paragraphText = paragraphLines.join(' ');
        if (paragraphText) {
            blocks.push(_jsx("p", { className: "text-slate-300 leading-relaxed", children: renderInline(paragraphText, query, onLinkClick) }, `p-${index}`));
        }
    }
    return { toc, blocks };
};
export const UserManualAppComponent = ({ onOpenApp }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [pendingDemo, setPendingDemo] = useState(null);
    const [copiedId, setCopiedId] = useState(null);
    // --- Handlers ---
    const handleLinkClick = useCallback((event, href) => {
        if (href.startsWith('rb://demo/')) {
            event.preventDefault();
            const slug = href.replace('rb://demo/', '');
            const demo = DEMO_LINKS[slug];
            if (demo)
                setPendingDemo(demo);
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
    const handleCopy = useCallback((code, id) => {
        if (!navigator.clipboard)
            return;
        navigator.clipboard.writeText(code).then(() => {
            setCopiedId(id);
            window.setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1500);
        });
    }, []);
    const { toc, blocks } = useMemo(() => parseMarkdown(manual, searchQuery, handleLinkClick, handleCopy, copiedId), [searchQuery, copiedId, handleLinkClick, handleCopy]);
    // --- Custom Hero Section ---
    const Hero = (_jsx("section", { className: "w-full bg-gradient-to-br from-cyan-900/80 to-slate-900/90 rounded-b-2xl shadow-lg px-6 py-10 mb-8 flex flex-col items-center text-center", children: _jsxs("div", { className: "flex flex-col items-center gap-4 max-w-2xl", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: "inline-block bg-cyan-600 rounded-full p-2", children: _jsxs("svg", { width: "32", height: "32", viewBox: "0 0 32 32", fill: "none", children: [_jsx("circle", { cx: "16", cy: "16", r: "16", fill: "#06b6d4" }), _jsx("path", { d: "M10 22V10h12v12H10zm2-2h8V12h-8v8z", fill: "#fff" })] }) }), _jsx("h1", { className: "text-3xl font-bold text-cyan-100 tracking-tight", children: "Welcome to Redbyte" })] }), _jsxs("p", { className: "text-lg text-slate-200 mt-2", children: [_jsx("span", { className: "font-semibold text-cyan-300", children: "Redbyte" }), " is a next-generation digital logic playground and circuit design OS.", _jsx("br", {}), "Build, simulate, and share digital circuits\u2014right in your browser."] }), _jsxs("ul", { className: "flex flex-wrap justify-center gap-4 mt-4 text-slate-300 text-base", children: [_jsx("li", { className: "bg-slate-800/80 rounded px-4 py-2", children: "Visual Circuit Editor" }), _jsx("li", { className: "bg-slate-800/80 rounded px-4 py-2", children: "Analog Lab Models" }), _jsx("li", { className: "bg-slate-800/80 rounded px-4 py-2", children: "FPGA Synthesis Flow" }), _jsx("li", { className: "bg-slate-800/80 rounded px-4 py-2", children: "Project Archive Export" })] })] }) }));
    // --- Redesigned Table of Contents ---
    const TOC = (_jsx("nav", { "aria-label": "Guide table of contents", className: "space-y-1 text-sm", children: toc.length === 0 ? (_jsx("span", { className: "text-slate-500", children: "No sections found." })) : (toc.map((item) => (_jsx("a", { href: `#${item.id}`, onClick: (event) => handleLinkClick(event, `#${item.id}`), className: `block rounded px-2 py-1 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-400 ${item.level === 1
                ? 'font-semibold text-cyan-200 hover:bg-cyan-900/30'
                : item.level === 2
                    ? 'pl-4 text-cyan-100 hover:bg-cyan-800/20'
                    : 'pl-8 text-slate-400 hover:bg-slate-800/30 text-xs'}`, children: item.text }, item.id)))) }));
    // --- Main Layout ---
    return (_jsxs("div", { className: "h-full bg-slate-900 text-white flex flex-col", children: [_jsxs("div", { className: "flex items-center justify-between border-b border-slate-800 bg-slate-950 px-4 py-3", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "text-xl", children: "\uD83D\uDCD6" }), _jsxs("div", { children: [_jsx("div", { className: "text-sm font-semibold text-slate-100", children: "Redbyte Guide" }), _jsx("div", { className: "text-xs text-slate-500", children: "Digital Circuit Playground" })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("label", { className: "text-xs text-slate-400", htmlFor: "manual-search", children: "Search" }), _jsx("input", { id: "manual-search", type: "search", value: searchQuery, onChange: (event) => setSearchQuery(event.target.value), className: "px-3 py-1.5 text-sm bg-slate-900 border border-slate-700 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500", placeholder: "Find topics", "aria-label": "Search the guide" })] })] }), _jsx("div", { className: "flex-1 overflow-hidden", children: _jsxs("div", { className: "h-full grid grid-cols-1 lg:grid-cols-[260px,1fr]", children: [_jsx("aside", { className: "hidden lg:block border-r border-slate-800 bg-slate-950/40", children: _jsxs("div", { className: "sticky top-0 px-4 py-4", children: [_jsx("div", { className: "text-xs uppercase tracking-wide text-slate-500 mb-3", children: "Sections" }), TOC] }) }), _jsxs("main", { tabIndex: 0, className: "overflow-y-auto px-6 py-6 lg:px-10 focus:outline-none focus:ring-2 focus:ring-cyan-500", "aria-label": "Guide content", children: [Hero, _jsx("div", { className: "max-w-3xl space-y-6", children: blocks })] })] }) }), pendingDemo && (_jsx("div", { className: "fixed inset-0 bg-black/70 flex items-center justify-center", role: "dialog", "aria-modal": "true", "aria-labelledby": "manual-demo-title", children: _jsxs("div", { className: "w-full max-w-md bg-slate-950 border border-slate-700 rounded-lg p-5 shadow-xl", children: [_jsxs("h2", { id: "manual-demo-title", className: "text-lg font-semibold text-slate-100", children: ["Load demo: ", pendingDemo.label] }), _jsx("p", { className: "text-sm text-slate-400 mt-2", children: "This will replace the current circuit in Logic Playground. If you have unsaved work, save it first." }), _jsxs("div", { className: "flex justify-end gap-2 mt-4", children: [_jsx("button", { type: "button", onClick: () => setPendingDemo(null), className: "px-3 py-1.5 text-sm rounded bg-slate-800 text-slate-200 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-400", children: "Cancel" }), _jsx("button", { type: "button", onClick: () => {
                                        onOpenApp?.('logic-playground', { initialExampleId: pendingDemo.id });
                                        setPendingDemo(null);
                                    }, className: "px-3 py-1.5 text-sm rounded bg-cyan-600 text-white hover:bg-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-400", children: "Load Demo" })] })] }) }))] }));
};
export const UserManualApp = {
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
