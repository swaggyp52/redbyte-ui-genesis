import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './SubmissionInspectorApp.module.css';
import JSZip from 'jszip';
import { replayHardwareTrace, evaluateChecks, } from '@redbyte/rb-fpga-proof-core';
import { verifyBundleSignature } from '../utils/bundleSignature';
import { getLabTemplate } from '../utils/labTemplates';
import { assertAppOutput, registerAppInvariants } from '../utils/appInvariants';
import { hashEvidence, canonicalizeEvidence } from '../utils/evidenceExport';
const INSPECTOR_INVARIANTS = {
    reads: ['bundle', 'lab_templates'],
    writes: ['replay_cursor'],
    outputs: ['grading-report.json'],
};
registerAppInvariants('submission-inspector', INSPECTOR_INVARIANTS);
export const SubmissionInspectorAppContent = ({ loadSample }) => {
    const [bundle, setBundle] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('summary');
    const [demoMode, setDemoMode] = useState(false);
    const [traceCursor, setTraceCursor] = useState(0);
    const [traceCurrent, setTraceCurrent] = useState(null);
    const hasAutoLoadedSample = useRef(false);
    const fileInputRef = useRef(null);
    const parseJsonEvidence = useCallback(async (file) => {
        try {
            const text = await file.text();
            const json = JSON.parse(text);
            // Verify Integrity
            const { integrity, ...rest } = json;
            const canonical = canonicalizeEvidence(rest);
            const { hash } = hashEvidence(canonical);
            const isVerified = integrity?.integrityHash === hash;
            const signatureStatus = isVerified ? 'Valid' : 'Invalid';
            // Map to BundleData
            setBundle({
                manifest: {
                    lab_id: json.context.selectedExampleId || 'Unknown Lab',
                    created_at: json.exportedAtIso,
                    redbyte_version: json.app.version,
                    student: { name: 'Unknown (v1)' },
                },
                capsule: null,
                events: [],
                schemaVersion: 'v1', // Using v1 for JSON evidence
                signatureStatus,
                traceEvents: [],
                traceReplay: [],
                traceFilePresent: false,
                bitstreamFilePresent: false,
                missingArtifacts: [],
                checkResults: [],
                checksPass: isVerified,
                traceStats: undefined,
                hardware: undefined,
                grade: undefined,
                circuitSnapshot: json.circuitSnapshot,
                probesSnapshot: json.probesSnapshot,
            });
            setActiveTab('summary');
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to parse JSON evidence');
            setBundle(null);
        }
    }, []);
    const parseBundle = useCallback(async (file) => {
        setLoading(true);
        setError(null);
        if (file.name.endsWith('.json')) {
            await parseJsonEvidence(file);
            setLoading(false);
            return;
        }
        try {
            const zipBytes = new Uint8Array(await file.arrayBuffer());
            const zip = new JSZip();
            const loaded = await zip.loadAsync(zipBytes);
            // Parse manifest
            const manifestFile = loaded.file('manifest.json');
            if (!manifestFile)
                throw new Error('manifest.json not found');
            const manifest = JSON.parse(await manifestFile.async('string'));
            const schemaVersion = manifest.schema_version === 'v2' ? 'v2' : 'v1';
            // Parse capsule (v1 proof capsule only)
            const capsulePath = schemaVersion === 'v2' ? null : 'proofs/capsule.json';
            const capsuleFile = capsulePath ? loaded.file(capsulePath) : null;
            const capsule = capsuleFile ? JSON.parse(await capsuleFile.async('string')) : null;
            // Parse events (NDJSON)
            let events = [];
            let traceEvents = [];
            let traceFilePresent = false;
            let bitstreamFilePresent = false;
            let traceStats = undefined;
            let missingArtifacts = [];
            if (schemaVersion === 'v2') {
                const traceFile = loaded.file('trace/hw_trace.ndjson');
                const traceText = traceFile ? await traceFile.async('string') : '';
                traceFilePresent = !!traceFile;
                traceEvents = traceText
                    .split('\n')
                    .filter((line) => line.trim())
                    .map((line) => JSON.parse(line))
                    .filter((event) => typeof event?.hw_tick === 'number' && typeof event?.mono_seq === 'number');
                bitstreamFilePresent = !!loaded.file('bitstream/design.bit');
                if (!traceFilePresent)
                    missingArtifacts.push('trace/hw_trace.ndjson');
                if (!bitstreamFilePresent)
                    missingArtifacts.push('bitstream/design.bit');
                let minTick = null;
                let maxTick = null;
                let monoNondecreasing = true;
                let prevSeq = null;
                for (const event of traceEvents) {
                    if (minTick === null || event.hw_tick < minTick)
                        minTick = event.hw_tick;
                    if (maxTick === null || event.hw_tick > maxTick)
                        maxTick = event.hw_tick;
                    if (prevSeq !== null && event.mono_seq < prevSeq) {
                        monoNondecreasing = false;
                    }
                    prevSeq = event.mono_seq;
                }
                traceStats = {
                    event_count: traceEvents.length,
                    hw_tick_min: minTick,
                    hw_tick_max: maxTick,
                    mono_seq_nondecreasing: monoNondecreasing,
                };
            }
            else {
                const eventsFile = loaded.file('proofs/events.ndjson');
                events = eventsFile
                    ? (await eventsFile.async('string'))
                        .split('\n')
                        .filter((line) => line.trim())
                        .map((line) => JSON.parse(line))
                    : [];
            }
            // Parse hardware if present
            const hardwarePath = schemaVersion === 'v2' ? null : 'proofs/hardware.json';
            const hardwareFile = hardwarePath ? loaded.file(hardwarePath) : null;
            const hardware = hardwareFile ? JSON.parse(await hardwareFile.async('string')) : null;
            // Parse grade artifacts if present
            const gradeJsonFile = loaded.file('grade.json');
            const gradeMdFile = loaded.file('grade.md');
            const grade = {
                json: gradeJsonFile ? JSON.parse(await gradeJsonFile.async('string')) : null,
                md: gradeMdFile ? await gradeMdFile.async('string') : null,
            };
            // Parse circuit snapshot if present
            const circuitSnapshotFile = loaded.file('proofs/circuit_snapshot.json');
            const circuitSnapshot = circuitSnapshotFile
                ? JSON.parse(await circuitSnapshotFile.async('string'))
                : null;
            const signatureStatus = await verifyBundleSignature(zipBytes);
            const traceReplay = traceEvents.length > 0 ? Array.from(replayHardwareTrace(traceEvents)) : [];
            const labTemplate = manifest?.lab_id ? getLabTemplate(String(manifest.lab_id)) : null;
            const checkEvaluation = evaluateChecks(labTemplate, traceReplay);
            setBundle({
                manifest,
                capsule,
                events,
                schemaVersion,
                signatureStatus,
                traceEvents,
                traceReplay,
                traceFilePresent,
                bitstreamFilePresent,
                labTemplate,
                checkResults: checkEvaluation.results,
                checksPass: checkEvaluation.pass,
                traceStats,
                missingArtifacts,
                hardware,
                grade,
                circuitSnapshot,
            });
            setTraceCursor(0);
            setTraceCurrent(null);
            setActiveTab('summary');
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to parse bundle');
            setBundle(null);
        }
        finally {
            setLoading(false);
        }
    }, []);
    const handleLoadSample = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/samples/basys3_mvp_sample.rb-lab.zip');
            if (!response.ok) {
                throw new Error('Sample bundle not found');
            }
            const buffer = await response.arrayBuffer();
            const file = new File([buffer], 'basys3_mvp_sample.rb-lab.zip', { type: 'application/zip' });
            await parseBundle(file);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load sample bundle');
            setLoading(false);
        }
    }, [parseBundle]);
    useEffect(() => {
        if (!loadSample || hasAutoLoadedSample.current)
            return;
        hasAutoLoadedSample.current = true;
        handleLoadSample();
    }, [handleLoadSample, loadSample]);
    const handleFileSelect = (e) => {
        const file = e.currentTarget.files?.[0];
        if (file) {
            parseBundle(file);
        }
    };
    const handleDragOver = (e) => {
        e.preventDefault();
        e.currentTarget.style.background = 'rgba(0, 135, 255, 0.1)';
    };
    const handleDragLeave = (e) => {
        e.currentTarget.style.background = '';
    };
    const handleDrop = (e) => {
        e.preventDefault();
        e.currentTarget.style.background = '';
        const file = e.dataTransfer.files?.[0];
        if (file && (file.name.endsWith('.rb-lab.zip') || file.name.endsWith('.json'))) {
            parseBundle(file);
        }
    };
    const handleTraceStep = () => {
        if (!bundle?.traceReplay || bundle.traceReplay.length === 0)
            return;
        if (traceCursor >= bundle.traceReplay.length)
            return;
        const next = bundle.traceReplay[traceCursor];
        setTraceCurrent(next);
        setTraceCursor(traceCursor + 1);
    };
    const handleExportGradingReport = () => {
        if (!bundle)
            return;
        assertAppOutput('submission-inspector', 'grading-report.json');
        const report = {
            schema_version: 'grade_v1',
            bundle: {
                lab_id: bundle.manifest?.lab_id ?? null,
                lab_version: bundle.manifest?.lab_version ?? null,
                signature_status: bundle.signatureStatus ?? 'Unsigned',
                event_count: bundle.traceStats?.event_count ?? 0,
                hw_tick_min: bundle.traceStats?.hw_tick_min ?? null,
                hw_tick_max: bundle.traceStats?.hw_tick_max ?? null,
                mono_seq_monotonic: bundle.traceStats?.mono_seq_nondecreasing ?? null,
            },
            checks: bundle.checkResults ?? [],
            overall_pass: bundle.checksPass ?? true,
            generated_ts_wall: Date.now(),
            redbyte_version: bundle.manifest?.redbyte_version ?? 'unknown',
        };
        const json = JSON.stringify(report, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const labId = bundle.manifest?.lab_id ?? 'lab';
        link.href = url;
        link.download = `${labId}_grading_report.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    };
    if (!bundle) {
        return (_jsxs("div", { className: styles.container, children: [_jsxs("div", { className: styles.header, children: [_jsx("h1", { className: styles.title, children: "Submission Inspector" }), _jsx("p", { className: styles.subtitle, children: "Open a .rb-lab.zip bundle to inspect student submissions" })] }), _jsxs("div", { className: `${styles.dropZone} rbEmptyState`, onDragOver: handleDragOver, onDragLeave: handleDragLeave, onDrop: handleDrop, children: [_jsx("div", { className: styles.dropZoneIcon, children: "\uD83D\uDCE6" }), _jsx("div", { className: styles.dropZoneTitle, children: "Drop .rb-lab.zip file here" }), _jsx("div", { className: styles.dropZoneOr, children: "or" }), _jsx("button", { className: `${styles.browseButton} rbButtonPrimary`, onClick: () => fileInputRef.current?.click(), children: "Browse for File" }), _jsx("div", { className: styles.dropZoneOr, children: "or" }), _jsx("button", { className: `${styles.browseButton} rbButtonPrimary`, onClick: handleLoadSample, type: "button", children: "Load Sample Submission" }), _jsx("input", { ref: fileInputRef, type: "file", accept: ".rb-lab.zip,.json", onChange: handleFileSelect, style: { display: 'none' }, "aria-label": "Upload submission file" })] }), error && (_jsxs("div", { className: styles.error, children: [_jsx("strong", { children: "Error:" }), " ", error] })), loading && (_jsx("div", { className: styles.loading, children: "Loading bundle..." }))] }));
    }
    return (_jsxs("div", { className: styles.container, children: [_jsxs("div", { className: styles.header, children: [_jsx("h1", { className: styles.title, children: "Submission Inspector" }), _jsxs("div", { style: { display: 'flex', gap: '0.5rem' }, children: [_jsx("button", { className: styles.closeButton, onClick: () => {
                                    setBundle(null);
                                    setError(null);
                                    setDemoMode(false);
                                }, children: "\u2190 Open Another" }), _jsx("button", { className: styles.closeButton, onClick: () => setDemoMode(!demoMode), style: {
                                    background: demoMode ? 'rgba(34, 211, 238, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                    borderColor: demoMode ? 'rgba(34, 211, 238, 0.5)' : 'rgba(255, 255, 255, 0.1)',
                                    color: demoMode ? '#3B82F6' : '#94a3b8',
                                }, children: demoMode ? '✓ Demo Mode' : 'Demo Mode' })] })] }), demoMode ? (
            // Demo Mode: Presentation layout
            _jsxs("div", { className: styles.demoModeContainer, children: [_jsx("div", { className: styles.demoVerdictSection, children: _jsx("div", { className: styles.demoVerdictBadge, style: {
                                background: bundle.capsule?.summary?.all_passed
                                    ? 'rgba(16, 185, 129, 0.2)'
                                    : 'rgba(239, 68, 68, 0.2)',
                                borderColor: bundle.capsule?.summary?.all_passed
                                    ? 'rgba(16, 185, 129, 0.5)'
                                    : 'rgba(239, 68, 68, 0.5)',
                                color: bundle.capsule?.summary?.all_passed ? '#10b981' : '#ef4444',
                            }, children: bundle.capsule?.summary?.all_passed ? 'PASS' : 'FAIL' }) }), _jsxs("div", { className: styles.demoHeader, children: [_jsxs("div", { children: [_jsx("h2", { className: styles.demoTitle, children: bundle.manifest.student?.name || 'Unknown Student' }), _jsx("p", { className: styles.demoSubtitle, children: bundle.manifest.lab_id })] }), _jsxs("div", { className: styles.demoStats, children: [_jsxs("div", { className: styles.demoStat, children: [_jsx("span", { className: styles.demoStatLabel, children: "Passed" }), _jsx("span", { className: styles.demoStatValue, style: { color: '#10b981' }, children: bundle.capsule?.summary?.passed || 0 })] }), _jsxs("div", { className: styles.demoStat, children: [_jsx("span", { className: styles.demoStatLabel, children: "Failed" }), _jsx("span", { className: styles.demoStatValue, style: { color: '#ef4444' }, children: bundle.capsule?.summary?.failed || 0 })] }), _jsxs("div", { className: styles.demoStat, children: [_jsx("span", { className: styles.demoStatLabel, children: "Total" }), _jsx("span", { className: styles.demoStatValue, children: bundle.capsule?.summary?.total || 0 })] })] })] }), _jsxs("div", { className: styles.demoContent, children: [_jsxs("div", { className: styles.demoVectors, children: [_jsx("h3", { children: "Test Vectors" }), _jsx("div", { className: styles.demoVectorsList, children: bundle.capsule?.vectors?.map((vec, idx) => (_jsxs("div", { className: styles.demoVectorRow, children: [_jsx("span", { className: styles.demoVectorName, children: vec.name }), _jsx("span", { className: `${styles.demoVectorResult} ${vec.pass ? styles.demoResultPass : styles.demoResultFail}`, children: vec.pass ? '✓ PASS' : '✗ FAIL' })] }, idx))) || _jsx("div", { className: styles.demoEmpty, children: "No vectors" }) })] }), bundle.hardware && (_jsxs("div", { className: styles.demoHardware, children: [_jsx("h3", { children: "Hardware Snapshots" }), _jsx("div", { className: styles.demoSnapshotGallery, children: bundle.hardware.snapshots?.map((snap, idx) => (_jsxs("div", { className: styles.demoSnapshotTile, children: [_jsx("div", { className: styles.demoSnapshotTime, children: snap.timestamp }), _jsxs("div", { className: styles.demoSnapshotData, children: [_jsxs("div", { children: [_jsx("strong", { children: "In:" }), " ", JSON.stringify(snap.inputs)] }), _jsxs("div", { children: [_jsx("strong", { children: "Out:" }), " ", JSON.stringify(snap.outputs)] })] })] }, idx))) || _jsx("div", { className: styles.demoEmpty, children: "No snapshots" }) })] })), _jsxs("div", { className: styles.demoEvents, children: [_jsx("h3", { children: "Timeline" }), _jsx("div", { className: styles.demoEventsList, children: bundle.events?.slice(0, 10).map((event, idx) => (_jsxs("div", { className: styles.demoEventRow, children: [_jsx("span", { className: styles.demoEventTime, children: new Date(event.timestamp).toLocaleTimeString() }), _jsx("span", { className: styles.demoEventType, children: event.type })] }, idx))) || _jsx("div", { className: styles.demoEmpty, children: "No events" }) })] })] })] })) : (
            // Normal Mode: Tabs
            _jsxs(_Fragment, { children: [_jsxs("div", { className: styles.tabs, children: [_jsx("button", { className: `${styles.tab} ${activeTab === 'summary' ? styles.tabActive : ''}`, onClick: () => setActiveTab('summary'), children: "Summary" }), _jsxs("button", { className: `${styles.tab} ${activeTab === 'vectors' ? styles.tabActive : ''}`, onClick: () => setActiveTab('vectors'), children: ["Vectors (", bundle.capsule?.vectors?.length || 0, ")"] }), _jsxs("button", { className: `${styles.tab} ${activeTab === 'events' ? styles.tabActive : ''}`, onClick: () => setActiveTab('events'), children: ["Events (", bundle.events.length, ")"] }), bundle.hardware && (_jsxs("button", { className: `${styles.tab} ${activeTab === 'hardware' ? styles.tabActive : ''}`, onClick: () => setActiveTab('hardware'), children: ["Hardware (", bundle.hardware.snapshots?.length || 0, ")"] })), _jsx("button", { className: `${styles.tab} ${activeTab === 'files' ? styles.tabActive : ''}`, onClick: () => setActiveTab('files'), children: "Files" })] }), _jsxs("div", { className: styles.content, children: [activeTab === 'summary' && (_jsxs("div", { className: styles.panel, children: [_jsxs("div", { className: styles.sectionHeader, children: [_jsx("h2", { className: styles.sectionTitle, children: "Submission Summary" }), _jsx("button", { className: styles.exportButton, onClick: handleExportGradingReport, children: "Export Grading Report" })] }), _jsxs("div", { className: styles.summaryGrid, children: [_jsxs("div", { className: styles.summaryCard, children: [_jsx("div", { className: styles.summaryLabel, children: "Lab ID" }), _jsx("div", { className: styles.summaryValue, children: bundle.manifest.lab_id })] }), _jsxs("div", { className: styles.summaryCard, children: [_jsx("div", { className: styles.summaryLabel, children: "Schema" }), _jsx("div", { className: styles.summaryValue, children: bundle.schemaVersion || 'unknown' })] }), _jsxs("div", { className: styles.summaryCard, children: [_jsx("div", { className: styles.summaryLabel, children: "Lab Version" }), _jsx("div", { className: styles.summaryValue, children: bundle.manifest.lab_version || 'N/A' })] }), _jsxs("div", { className: styles.summaryCard, children: [_jsx("div", { className: styles.summaryLabel, children: "Student" }), _jsx("div", { className: styles.summaryValue, children: bundle.manifest.student?.name || 'Unknown' })] }), _jsxs("div", { className: styles.summaryCard, children: [_jsx("div", { className: styles.summaryLabel, children: "Student ID" }), _jsx("div", { className: styles.summaryValue, children: bundle.manifest.student?.id || '—' })] }), _jsxs("div", { className: styles.summaryCard, children: [_jsx("div", { className: styles.summaryLabel, children: "Created" }), _jsx("div", { className: styles.summaryValue, children: new Date(bundle.manifest.created_at).toLocaleString() })] }), _jsxs("div", { className: styles.summaryCard, children: [_jsx("div", { className: styles.summaryLabel, children: "Signature" }), _jsx("div", { className: styles.summaryValue, children: bundle.signatureStatus || 'Unsigned' })] }), bundle.schemaVersion === 'v2' && (_jsxs(_Fragment, { children: [_jsxs("div", { className: styles.summaryCard, children: [_jsx("div", { className: styles.summaryLabel, children: "Trace" }), _jsx("div", { className: styles.summaryValue, children: bundle.traceFilePresent
                                                                    ? `${bundle.traceReplay?.length ?? 0} events`
                                                                    : 'Missing' })] }), _jsxs("div", { className: styles.summaryCard, children: [_jsx("div", { className: styles.summaryLabel, children: "Bitstream" }), _jsx("div", { className: styles.summaryValue, children: bundle.bitstreamFilePresent ? 'Present' : 'Missing' })] })] }))] }), bundle.schemaVersion === 'v2' && bundle.missingArtifacts && bundle.missingArtifacts.length > 0 && (_jsx("div", { className: styles.missingSection, children: bundle.missingArtifacts.map((artifact) => (_jsxs("div", { className: styles.missingItem, children: ["Missing: ", artifact] }, artifact))) })), bundle.capsule && (_jsxs("div", { className: styles.summarySection, children: [_jsx("h3", { children: "Self-Check Summary" }), _jsxs("div", { className: styles.summaryStats, children: [_jsxs("div", { className: styles.stat, children: [_jsx("span", { className: styles.statLabel, children: "Passed" }), _jsx("span", { className: styles.statValue, style: { color: '#10b981' }, children: bundle.capsule.summary?.passed || 0 })] }), _jsxs("div", { className: styles.stat, children: [_jsx("span", { className: styles.statLabel, children: "Failed" }), _jsx("span", { className: styles.statValue, style: { color: '#ef4444' }, children: bundle.capsule.summary?.failed || 0 })] }), _jsxs("div", { className: styles.stat, children: [_jsx("span", { className: styles.statLabel, children: "Total" }), _jsx("span", { className: styles.statValue, children: bundle.capsule.summary?.total || 0 })] }), bundle.capsule.summary?.score != null && (_jsxs("div", { className: styles.stat, children: [_jsx("span", { className: styles.statLabel, children: "Score" }), _jsxs("span", { className: styles.statValue, children: [bundle.capsule.summary.score, "%"] })] }))] })] })), bundle.capsule?.completedSteps && (_jsxs("div", { className: styles.summarySection, children: [_jsx("h3", { children: "Lab Progress" }), _jsxs("div", { className: styles.summaryStats, children: [_jsxs("div", { className: styles.stat, children: [_jsx("span", { className: styles.statLabel, children: "Steps Completed" }), _jsx("span", { className: styles.statValue, children: bundle.capsule.completedSteps.length })] }), _jsxs("div", { className: styles.stat, children: [_jsx("span", { className: styles.statLabel, children: "Verdict" }), _jsx("span", { className: styles.statValue, style: {
                                                                    color: bundle.capsule.isPass ? '#10b981' : '#ef4444'
                                                                }, children: bundle.capsule.isPass ? 'PASS' : 'FAIL' })] })] }), bundle.capsule.evidenceHash && (_jsxs("div", { style: { marginTop: '0.5rem', fontSize: '0.75rem', color: '#64748b' }, children: ["Integrity Hash: ", _jsx("code", { children: bundle.capsule.evidenceHash })] }))] })), bundle.circuitSnapshot && (_jsxs("div", { className: styles.summarySection, children: [_jsx("h3", { children: "Circuit Snapshot" }), _jsxs("div", { className: styles.summaryStats, children: [_jsxs("div", { className: styles.stat, children: [_jsx("span", { className: styles.statLabel, children: "Nodes" }), _jsx("span", { className: styles.statValue, children: bundle.circuitSnapshot.nodeCount ?? '?' })] }), _jsxs("div", { className: styles.stat, children: [_jsx("span", { className: styles.statLabel, children: "Wires" }), _jsx("span", { className: styles.statValue, children: bundle.circuitSnapshot.wireCount ?? '?' })] }), _jsxs("div", { className: styles.stat, children: [_jsx("span", { className: styles.statLabel, children: "Tick" }), _jsx("span", { className: styles.statValue, children: bundle.circuitSnapshot.tick ?? '?' })] })] })] })), bundle.schemaVersion === 'v2' && (_jsxs("div", { className: styles.summarySection, children: [_jsx("h3", { children: "Hardware Trace" }), bundle.traceReplay && bundle.traceReplay.length > 0 ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: styles.summaryStats, children: [_jsxs("div", { className: styles.stat, children: [_jsx("span", { className: styles.statLabel, children: "Events" }), _jsx("span", { className: styles.statValue, children: bundle.traceReplay.length })] }), _jsxs("div", { className: styles.stat, children: [_jsx("span", { className: styles.statLabel, children: "First hw_tick" }), _jsx("span", { className: styles.statValue, children: bundle.traceReplay[0]?.hw_tick ?? 0 })] }), _jsxs("div", { className: styles.stat, children: [_jsx("span", { className: styles.statLabel, children: "Last hw_tick" }), _jsx("span", { className: styles.statValue, children: bundle.traceReplay[bundle.traceReplay.length - 1]?.hw_tick ?? 0 })] })] }), _jsx("button", { className: styles.closeButton, onClick: handleTraceStep, disabled: traceCursor >= bundle.traceReplay.length, children: "Next Trace Event" }), traceCurrent && (_jsx("pre", { className: styles.codeBlock, children: JSON.stringify(traceCurrent, null, 2) }))] })) : (_jsx("div", { className: styles.empty, children: "No hardware trace in bundle" }))] })), bundle.schemaVersion === 'v2' && bundle.traceStats && (_jsxs("div", { className: styles.summarySection, children: [_jsx("h3", { children: "Bundle Health" }), _jsxs("div", { className: styles.summaryStats, children: [_jsxs("div", { className: styles.stat, children: [_jsx("span", { className: styles.statLabel, children: "Event Count" }), _jsx("span", { className: styles.statValue, children: bundle.traceStats.event_count })] }), _jsxs("div", { className: styles.stat, children: [_jsx("span", { className: styles.statLabel, children: "hw_tick Min" }), _jsx("span", { className: styles.statValue, children: bundle.traceStats.hw_tick_min ?? 'N/A' })] }), _jsxs("div", { className: styles.stat, children: [_jsx("span", { className: styles.statLabel, children: "hw_tick Max" }), _jsx("span", { className: styles.statValue, children: bundle.traceStats.hw_tick_max ?? 'N/A' })] }), _jsxs("div", { className: styles.stat, children: [_jsx("span", { className: styles.statLabel, children: "mono_seq OK" }), _jsx("span", { className: styles.statValue, children: bundle.traceStats.mono_seq_nondecreasing ? 'Yes' : 'No' })] })] })] })), bundle.checkResults && bundle.checkResults.length > 0 && (_jsxs("div", { className: styles.summarySection, children: [_jsx("h3", { children: "Checks" }), _jsx("div", { className: styles.summaryStats, children: _jsxs("div", { className: styles.stat, children: [_jsx("span", { className: styles.statLabel, children: "Overall" }), _jsx("span", { className: `${styles.statValue} ${bundle.checksPass ? styles.checkPass : styles.checkFail}`, children: bundle.checksPass ? 'PASS' : 'FAIL' })] }) }), _jsx("div", { className: styles.checkList, children: bundle.checkResults.map((result) => (_jsxs("div", { className: styles.checkItem, children: [_jsx("span", { className: `${styles.checkStatus} ${result.pass ? styles.checkPass : styles.checkFail}`, children: result.pass ? 'PASS' : 'FAIL' }), _jsx("span", { className: styles.checkLabel, children: result.id }), _jsx("span", { className: styles.checkMessage, children: result.message })] }, result.id))) })] })), bundle.grade?.json && (_jsxs("div", { className: styles.summarySection, children: [_jsx("h3", { children: "Grade" }), _jsx("pre", { className: styles.codeBlock, children: JSON.stringify(bundle.grade.json, null, 2) })] })), bundle.grade?.md && (_jsxs("div", { className: styles.summarySection, children: [_jsx("h3", { children: "Grade Details" }), _jsx("pre", { className: styles.codeBlock, children: bundle.grade.md })] }))] })), activeTab === 'vectors' && (_jsxs("div", { className: styles.panel, children: [_jsx("h2", { className: styles.sectionTitle, children: "Test Vectors" }), bundle.capsule?.vectors && bundle.capsule.vectors.length > 0 ? (_jsx("div", { className: styles.vectorsList, children: bundle.capsule.vectors.map((vec, idx) => (_jsxs("div", { className: styles.vectorCard, children: [_jsxs("div", { className: styles.vectorHeader, children: [_jsx("span", { className: styles.vectorName, children: vec.name }), _jsx("span", { className: `${styles.vectorBadge} ${vec.pass ? styles.badgePass : styles.badgeFail}`, children: vec.pass ? 'PASS' : 'FAIL' })] }), vec.error && (_jsx("div", { className: styles.vectorError, children: vec.error }))] }, idx))) })) : (_jsx("div", { className: styles.empty, children: "No vectors in this submission" }))] })), activeTab === 'events' && (_jsxs("div", { className: styles.panel, children: [_jsx("h2", { className: styles.sectionTitle, children: "Event Timeline" }), bundle.events.length > 0 ? (_jsx("div", { className: styles.eventsList, children: bundle.events.map((event, idx) => (_jsxs("div", { className: styles.eventCard, children: [_jsx("div", { className: styles.eventTime, children: new Date(event.timestamp).toLocaleTimeString() }), _jsx("div", { className: styles.eventType, children: event.type }), Object.keys(event.data || {}).length > 0 && (_jsx("pre", { className: styles.eventData, children: JSON.stringify(event.data, null, 2) }))] }, idx))) })) : (_jsx("div", { className: styles.empty, children: "No events recorded" }))] })), activeTab === 'hardware' && (_jsxs("div", { className: styles.panel, children: [_jsx("h2", { className: styles.sectionTitle, children: "Hardware Evidence" }), bundle.hardware ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: styles.hardwareInfo, children: [_jsxs("div", { className: styles.infoRow, children: [_jsx("span", { className: styles.infoLabel, children: "Bridge Status:" }), _jsx("span", { className: styles.infoValue, children: bundle.hardware.bridge_status })] }), _jsxs("div", { className: styles.infoRow, children: [_jsx("span", { className: styles.infoLabel, children: "Board Status:" }), _jsx("span", { className: styles.infoValue, children: bundle.hardware.board_status })] }), bundle.hardware.board_model && (_jsxs("div", { className: styles.infoRow, children: [_jsx("span", { className: styles.infoLabel, children: "Board Model:" }), _jsx("span", { className: styles.infoValue, children: bundle.hardware.board_model })] }))] }), bundle.hardware.snapshots && bundle.hardware.snapshots.length > 0 ? (_jsxs("div", { className: styles.snapshotsList, children: [_jsxs("h3", { children: ["Snapshots (", bundle.hardware.snapshots.length, ")"] }), bundle.hardware.snapshots.map((snap, idx) => (_jsxs("div", { className: styles.snapshotCard, children: [_jsxs("div", { className: styles.snapshotTime, children: [new Date(snap.timestamp).toLocaleTimeString(), snap.source && (_jsx("span", { className: `${styles.snapshotSource} ${snap.source === 'bridge' ? styles.sourceBridge : styles.sourceManual}`, children: snap.source }))] }), _jsxs("div", { className: styles.snapshotData, children: [_jsxs("div", { children: [_jsx("strong", { children: "Inputs:" }), " ", _jsx("code", { children: JSON.stringify(snap.inputs) })] }), _jsxs("div", { children: [_jsx("strong", { children: "Outputs:" }), " ", _jsx("code", { children: JSON.stringify(snap.outputs) })] }), snap.notes && _jsxs("div", { children: [_jsx("strong", { children: "Notes:" }), " ", snap.notes] })] })] }, idx)))] })) : (_jsx("div", { className: styles.empty, children: "No snapshots recorded" }))] })) : (_jsx("div", { className: styles.empty, children: "No hardware evidence in this bundle" }))] })), activeTab === 'files' && (_jsxs("div", { className: styles.panel, children: [_jsx("h2", { className: styles.sectionTitle, children: "Bundle Contents" }), _jsx("div", { className: styles.filesList, children: bundle.schemaVersion === 'v2' ? (_jsxs(_Fragment, { children: [_jsx("div", { className: styles.fileItem, children: "manifest.json" }), _jsx("div", { className: `${styles.fileItem} ${!bundle.traceFilePresent ? styles.fileMissing : ''}`, children: "trace/hw_trace.ndjson" }), _jsx("div", { className: `${styles.fileItem} ${!bundle.bitstreamFilePresent ? styles.fileMissing : ''}`, children: "bitstream/design.bit" }), _jsx("div", { className: styles.fileItem, children: "meta/board_profile.json" }), _jsx("div", { className: styles.fileItem, children: "integrity/capsule.json" }), _jsx("div", { className: styles.fileItem, children: "integrity/signature.sig" })] })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: styles.fileItem, children: "manifest.json" }), _jsx("div", { className: styles.fileItem, children: "proofs/capsule.json" }), _jsx("div", { className: styles.fileItem, children: "proofs/events.ndjson" }), bundle.hardware && _jsx("div", { className: styles.fileItem, children: "proofs/hardware.json" }), bundle.grade?.json && _jsx("div", { className: styles.fileItem, children: "grade.json" }), bundle.grade?.md && _jsx("div", { className: styles.fileItem, children: "grade.md" })] })) })] }))] })] }))] }));
};
export const SubmissionInspectorApp = {
    manifest: {
        id: 'submission-inspector',
        name: 'Submission Inspector',
        iconId: 'search',
        category: 'tools',
        defaultSize: {
            width: 1000,
            height: 750,
        },
    },
    component: SubmissionInspectorAppContent,
};
