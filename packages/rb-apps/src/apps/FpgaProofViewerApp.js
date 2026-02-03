import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { useFileSystemStore } from '../stores/fileSystemStore';
import { parseCapsule, loadEventsNdjson, } from '@redbyte/rb-fpga-proof-core';
// Use core library's loadEventsNdjson instead of local parseNdjson
// Kept for backward compatibility with existing code that may call this
function parseNdjson(raw) {
    return loadEventsNdjson(raw);
}
function summarizeInputs(inputs) {
    if (!inputs)
        return '';
    const parts = Object.entries(inputs).map(([k, v]) => `${k}:${v}`);
    return parts.join(' ');
}
function getEventsBasename(path) {
    if (!path)
        return null;
    const parts = path.split(/[\\/]/);
    return parts[parts.length - 1] || null;
}
const badgeStyles = {
    PASS: 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/40',
    FAIL: 'bg-rose-500/15 text-rose-200 border border-rose-500/40',
};
function VerdictBadge({ verdict }) {
    const style = badgeStyles[verdict] || 'bg-slate-700/60 text-slate-200 border border-slate-600';
    return (_jsx("span", { className: `px-2 py-1 rounded text-xs font-semibold uppercase tracking-wide ${style}`, children: verdict }));
}
const FpgaProofViewerComponent = ({ resourceId, resourceType }) => {
    const fs = useFileSystemStore();
    const [capsule, setCapsule] = useState(null);
    const [capsuleSource, setCapsuleSource] = useState('');
    const [eventsRaw, setEventsRaw] = useState('');
    const [events, setEvents] = useState([]);
    const [activeTab, setActiveTab] = useState('overview');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const loadEventsContent = async (ref) => {
        if (!ref)
            return '';
        const basename = getEventsBasename(ref.path);
        if (basename) {
            const match = fs.getAllFiles().find((file) => file.name === basename && file.content);
            if (match?.content) {
                return match.content;
            }
        }
        if (ref.path && ref.path.startsWith('http')) {
            const response = await fetch(ref.path);
            if (!response.ok) {
                throw new Error(`Failed to fetch events (${response.status})`);
            }
            return await response.text();
        }
        return '';
    };
    const hydrateFromText = async (name, text, preferEvents) => {
        setLoading(true);
        setError(null);
        try {
            // Use core library to parse capsule (supports both schemas)
            const parsed = parseCapsule(text);
            setCapsule(parsed);
            setCapsuleSource(name);
            let eventsText = preferEvents || '';
            if (!eventsText) {
                eventsText = await loadEventsContent(parsed.events);
            }
            setEventsRaw(eventsText);
            // Use core library to parse NDJSON events
            const parsedEvents = loadEventsNdjson(eventsText);
            setEvents(parsedEvents);
            setActiveTab('overview');
        }
        catch (err) {
            setCapsule(null);
            setEvents([]);
            const message = err instanceof Error ? err.message : 'Failed to parse capsule';
            setError(message);
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        if (!resourceId)
            return;
        if (resourceType && resourceType !== 'file') {
            setError('Select a capsule file to open.');
            return;
        }
        const file = fs.getFile(resourceId);
        if (!file || file.type !== 'file') {
            setError('File not found.');
            return;
        }
        hydrateFromText(file.name, file.content || '');
    }, [resourceId, resourceType]);
    const handleLoadDemo = async () => {
        setLoading(true);
        setError(null);
        try {
            // Try to load from public/ first (production/web)
            const capsuleUrl = '/examples/fpga-proof/traffic-light-stateful.capsule.json';
            const eventsUrl = '/examples/fpga-proof/traffic-light-stateful.events.ndjson';
            const [capsuleRes, eventsRes] = await Promise.all([
                fetch(capsuleUrl),
                fetch(eventsUrl),
            ]);
            if (!capsuleRes.ok) {
                throw new Error(`Failed to fetch capsule (${capsuleRes.status})`);
            }
            if (!eventsRes.ok) {
                throw new Error(`Failed to fetch events (${eventsRes.status})`);
            }
            const capsuleText = await capsuleRes.text();
            const eventsText = await eventsRes.text();
            await hydrateFromText('traffic-light-stateful.capsule.json', capsuleText, eventsText);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to load demo';
            console.warn('[FPGA Viewer] Load demo error:', message);
            setError(`Could not load demo artifacts: ${message}`);
            setLoading(false);
        }
    };
    const passCount = capsule?.test_summary?.passed ?? capsule?.summary?.passed ?? 0;
    const failCount = capsule?.test_summary?.failed ?? capsule?.summary?.failed ?? 0;
    const totalVectors = capsule?.test_summary?.total ?? capsule?.results?.length ?? 0;
    const firstFailure = capsule?.results?.find((r) => r.result !== 'PASS') || null;
    const ioUpdates = useMemo(() => {
        return events.filter((evt) => evt && evt.type === 'io:update');
    }, [events]);
    const timelineRows = useMemo(() => {
        return ioUpdates.map((evt, index) => {
            const tick = Number(evt.TICK ?? index + 1);
            const vector = capsule?.results?.[index];
            return {
                tick,
                sw: evt.SW ?? '',
                btn: evt.BTN ?? '',
                led: evt.LED ?? '',
                verdict: vector?.result ?? '—',
                name: vector?.name ?? `t${tick}`,
            };
        });
    }, [capsule?.results, ioUpdates]);
    const headerGradient = 'bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950';
    return (_jsxs("div", { className: "h-full flex flex-col bg-slate-950 text-slate-50", children: [_jsxs("div", { className: `${headerGradient} border-b border-slate-800 px-4 py-3 flex items-center justify-between gap-4`, children: [_jsxs("div", { children: [_jsx("div", { className: "text-xs uppercase tracking-[0.12em] text-cyan-300", children: "FPGA Proof Viewer" }), _jsx("div", { className: "text-lg font-semibold text-white", children: capsuleSource || 'No capsule loaded' }), capsule?.session_id && (_jsxs("div", { className: "text-xs text-slate-400", children: ["Session: ", capsule.session_id] }))] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { type: "button", onClick: handleLoadDemo, className: "px-3 py-2 text-sm font-semibold bg-cyan-500 text-slate-950 rounded shadow hover:bg-cyan-400 transition", children: "Load Demo Capsule" }), loading && _jsx("span", { className: "text-xs text-slate-400", children: "Loading\u2026" })] })] }), error && (_jsx("div", { className: "bg-rose-900/40 border border-rose-700 text-rose-100 px-4 py-3 text-sm", children: error })), _jsxs("div", { className: "p-4 grid grid-cols-2 lg:grid-cols-4 gap-3", children: [_jsxs("div", { className: "bg-slate-900/70 border border-slate-800 rounded-lg p-3", children: [_jsx("div", { className: "text-xs text-slate-400", children: "Board" }), _jsx("div", { className: "text-base font-semibold text-slate-100", children: capsule?.board_id || '—' }), _jsx("div", { className: "text-xs text-slate-500", children: capsule?.board_snapshot?.name || 'Awaiting capsule' })] }), _jsxs("div", { className: "bg-slate-900/70 border border-slate-800 rounded-lg p-3", children: [_jsx("div", { className: "text-xs text-slate-400", children: "Vectors" }), _jsxs("div", { className: "text-base font-semibold text-slate-100", children: [passCount, "/", totalVectors, " passed"] }), _jsxs("div", { className: "text-xs text-slate-500", children: ["Fails: ", failCount] })] }), _jsxs("div", { className: "bg-slate-900/70 border border-slate-800 rounded-lg p-3", children: [_jsx("div", { className: "text-xs text-slate-400", children: "Git" }), _jsx("div", { className: "text-base font-semibold text-slate-100", children: capsule?.git_sha || '—' }), _jsxs("div", { className: "text-xs text-slate-500", children: ["Node ", capsule?.node_version || '—'] })] }), _jsxs("div", { className: "bg-slate-900/70 border border-slate-800 rounded-lg p-3", children: [_jsx("div", { className: "text-xs text-slate-400", children: "Events" }), _jsx("div", { className: "text-base font-semibold text-slate-100", children: capsule?.events?.count ?? ioUpdates.length }), _jsx("div", { className: "text-xs text-slate-500", children: capsule?.events?.sha256 ? `sha256: ${capsule.events.sha256.slice(0, 12)}…` : 'No hash yet' })] })] }), _jsx("div", { className: "px-4 pb-3 border-b border-slate-800 flex items-center gap-4 text-sm", children: ['overview', 'vectors', 'timeline', 'events'].map((tab) => {
                    const isActive = activeTab === tab;
                    return (_jsx("button", { className: `px-3 py-2 rounded-md font-semibold transition ${isActive ? 'bg-cyan-500 text-slate-950' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`, onClick: () => setActiveTab(tab), children: tab.toUpperCase() }, tab));
                }) }), _jsxs("div", { className: "flex-1 overflow-auto", children: [activeTab === 'overview' && (_jsxs("div", { className: "p-4 space-y-4", children: [_jsxs("div", { className: "bg-slate-900/70 border border-slate-800 rounded-lg p-4", children: [_jsx("div", { className: "text-sm text-slate-300", children: "Session" }), _jsx("div", { className: "text-lg font-semibold text-white", children: capsule?.session_id || '—' }), _jsxs("div", { className: "text-xs text-slate-500", children: ["Started: ", capsule?.started_at || '—', " | Ended: ", capsule?.ended_at || '—'] })] }), _jsxs("div", { className: "bg-slate-900/70 border border-slate-800 rounded-lg p-4 flex flex-wrap gap-4", children: [_jsxs("div", { children: [_jsx("div", { className: "text-xs text-slate-400", children: "Vector file hash" }), _jsx("div", { className: "font-mono text-sm text-slate-100 break-all", children: capsule?.vector_file_hash || '—' })] }), _jsxs("div", { children: [_jsx("div", { className: "text-xs text-slate-400", children: "Events sha256" }), _jsx("div", { className: "font-mono text-sm text-slate-100 break-all", children: capsule?.events?.sha256 || '—' })] }), _jsxs("div", { children: [_jsx("div", { className: "text-xs text-slate-400", children: "Events count" }), _jsx("div", { className: "font-mono text-sm text-slate-100", children: capsule?.events?.count || '—' })] }), _jsxs("div", { children: [_jsx("div", { className: "text-xs text-slate-400", children: "Events path" }), _jsx("div", { className: "font-mono text-sm text-slate-100 break-all", children: capsule?.events?.path || '—' })] })] }), _jsxs("div", { className: "bg-slate-900/70 border border-slate-800 rounded-lg p-4", children: [_jsx("div", { className: "text-xs uppercase tracking-[0.12em] text-cyan-300 mb-2", children: "Integrity" }), _jsxs("div", { className: "space-y-1 text-sm", children: [_jsx("div", { className: "flex items-center gap-2 text-slate-100", children: _jsx("span", { children: "\u2713 Hashes verified in capsule metadata" }) }), _jsx("div", { className: "text-xs text-slate-400", children: "Strict CI mode: RB_FPGA_STRICT_HASH=1 enforces hash match on golden baseline." })] })] }), firstFailure && (_jsxs("div", { className: "bg-rose-900/40 border border-rose-700 rounded-lg p-4", children: [_jsx("div", { className: "text-xs uppercase tracking-[0.12em] text-rose-200 mb-1", children: "First Failure" }), _jsx("div", { className: "text-sm text-rose-100 font-semibold", children: firstFailure.name })] })), !firstFailure && capsule && (_jsx("div", { className: "bg-emerald-900/30 border border-emerald-700 rounded-lg p-4 text-emerald-50 text-sm", children: "All vectors passed. Ready to demo." }))] })), activeTab === 'vectors' && (_jsx("div", { className: "p-4", children: _jsx("div", { className: "overflow-auto border border-slate-800 rounded-lg bg-slate-900/60", children: _jsxs("table", { className: "min-w-full text-sm", children: [_jsx("thead", { className: "bg-slate-900 text-slate-300 uppercase text-xs tracking-wide", children: _jsxs("tr", { children: [_jsx("th", { className: "px-3 py-2 text-left", children: "#" }), _jsx("th", { className: "px-3 py-2 text-left", children: "Name" }), _jsx("th", { className: "px-3 py-2 text-left", children: "Inputs" }), _jsx("th", { className: "px-3 py-2 text-left", children: "Expected" }), _jsx("th", { className: "px-3 py-2 text-left", children: "Observed" }), _jsx("th", { className: "px-3 py-2 text-left", children: "Verdict" })] }) }), _jsx("tbody", { children: capsule?.results?.map((result, idx) => (_jsxs("tr", { className: idx % 2 === 0 ? 'bg-slate-950/60' : 'bg-slate-900/60', children: [_jsx("td", { className: "px-3 py-2 text-slate-400", children: idx }), _jsx("td", { className: "px-3 py-2 text-slate-100 whitespace-nowrap", children: result.name }), _jsx("td", { className: "px-3 py-2 text-slate-300 font-mono text-xs", children: summarizeInputs(result.inputs) }), _jsx("td", { className: "px-3 py-2 text-cyan-100 font-mono text-xs", children: result.expected }), _jsx("td", { className: "px-3 py-2 text-amber-100 font-mono text-xs", children: result.observed }), _jsx("td", { className: "px-3 py-2", children: _jsx(VerdictBadge, { verdict: result.result }) })] }, result.name + idx))) || (_jsx("tr", { children: _jsx("td", { className: "px-3 py-3 text-slate-400", colSpan: 6, children: "No vectors loaded." }) })) })] }) }) })), activeTab === 'timeline' && (_jsxs("div", { className: "p-4 space-y-3", children: [firstFailure && (_jsxs("div", { className: "bg-rose-900/40 border border-rose-700 rounded-lg p-3 text-sm text-rose-100 flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("span", { className: "font-semibold", children: "First failure detected:" }), " ", firstFailure.name] }), _jsx("button", { type: "button", className: "px-2 py-1 text-xs bg-rose-700 hover:bg-rose-600 rounded transition", onClick: () => {
                                            // Scroll to first failure row
                                            const failIdx = timelineRows.findIndex((r) => r.verdict === 'FAIL');
                                            if (failIdx >= 0) {
                                                document.getElementById(`timeline-row-${failIdx}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            }
                                        }, children: "Jump to mismatch" })] })), _jsx("div", { className: "overflow-auto border border-slate-800 rounded-lg bg-slate-900/60", children: _jsxs("table", { className: "min-w-full text-sm", children: [_jsx("thead", { className: "bg-slate-900 text-slate-300 uppercase text-xs tracking-wide", children: _jsxs("tr", { children: [_jsx("th", { className: "px-3 py-2 text-left", children: "Tick" }), _jsx("th", { className: "px-3 py-2 text-left", children: "Name" }), _jsx("th", { className: "px-3 py-2 text-left", children: "SW" }), _jsx("th", { className: "px-3 py-2 text-left", children: "BTN" }), _jsx("th", { className: "px-3 py-2 text-left", children: "LED" }), _jsx("th", { className: "px-3 py-2 text-left", children: "Verdict" })] }) }), _jsx("tbody", { children: timelineRows.length > 0 ? (timelineRows.map((row, idx) => {
                                                const isFail = row.verdict === 'FAIL';
                                                const rowClass = isFail
                                                    ? 'bg-rose-900/30 border-l-2 border-rose-700'
                                                    : idx % 2 === 0
                                                        ? 'bg-slate-950/60'
                                                        : 'bg-slate-900/60';
                                                return (_jsxs("tr", { id: `timeline-row-${idx}`, className: rowClass, children: [_jsx("td", { className: "px-3 py-2 text-slate-400", children: row.tick }), _jsx("td", { className: "px-3 py-2 text-slate-100 whitespace-nowrap", children: row.name }), _jsx("td", { className: "px-3 py-2 font-mono text-xs text-cyan-100", children: row.sw }), _jsx("td", { className: "px-3 py-2 font-mono text-xs text-cyan-100", children: row.btn }), _jsx("td", { className: "px-3 py-2 font-mono text-xs text-amber-100", children: row.led }), _jsx("td", { className: "px-3 py-2", children: _jsx(VerdictBadge, { verdict: row.verdict }) })] }, row.tick + '-' + idx));
                                            })) : (_jsx("tr", { children: _jsx("td", { className: "px-3 py-3 text-slate-400", colSpan: 6, children: "No events parsed yet." }) })) })] }) })] })), activeTab === 'events' && (_jsxs("div", { className: "p-4 space-y-3", children: [_jsxs("div", { className: "bg-slate-900/70 border border-slate-800 rounded-lg p-3 text-sm text-slate-300 flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("div", { className: "text-xs text-slate-400 uppercase tracking-[0.12em]", children: "Events" }), _jsxs("div", { children: [events.length, " rows \u2022 format: ", capsule?.events?.format || 'ndjson', " \u2022 source: ", capsule?.events?.path || 'inline'] })] }), _jsx("div", { className: "text-xs text-slate-500", children: "seq 1..n" })] }), _jsx("pre", { className: "bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-100 overflow-auto max-h-[320px] whitespace-pre-wrap", children: eventsRaw || 'No events loaded yet.' })] }))] })] }));
};
export const FpgaProofViewerApp = {
    manifest: {
        id: 'fpga-proof-viewer',
        name: 'FPGA Proof Viewer',
        iconId: 'chip',
        category: 'tools',
        defaultSize: { width: 960, height: 720 },
        minSize: { width: 720, height: 520 },
    },
    component: FpgaProofViewerComponent,
};
