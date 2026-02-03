import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from '@redbyte/rb-primitives';
import { Rb3DSceneLab, useLabStore, PART_DEFINITIONS, validateLabGraph, validateTimeline, repairLabGraph, repairTimeline, fingerprintCapsuleContent, fingerprintStateSync, hashSketchSource, evaluateAtTick, fingerprintLabTemplate, resolveSelectorPins, } from '@redbyte/rb-logic-3d';
import { InstrumentDock, useInstrumentState } from '@redbyte/rb-instruments';
import { useFileSystemStore } from '../stores/fileSystemStore';
import { VIRTUAL_LAB_TEMPLATES } from './virtual-lab-templates';
import { useVirtualLabSignalSource } from '../instruments/virtualLabSignalSource';
import { GuidedLabSidebar } from '../components/GuidedLabSidebar';
import { useUnifiedProjectStore } from '@redbyte/rb-lab-engine';
import { ErrorBoundary } from '../components/ErrorBoundary';
// Lazy load panels to break circular dependency / TDZ issues during initialization
const HardwareRackPanel = React.lazy(() => import('../panels/HardwareRackPanel').then(m => ({ default: m.HardwareRackPanel })));
const HardwareStatusOverlay = React.lazy(() => import('../panels/HardwareStatusOverlay').then(m => ({ default: m.HardwareStatusOverlay })));
import { HardwareAutoAdopt } from '../components/HardwareAutoAdopt';
import { HardwareClientTransport } from '../services/hardwareClientTransport';
const DEFAULT_SKETCH = `void setup() {
        pinMode(13, OUTPUT);
}

    void loop() {
        digitalWrite(13, HIGH);
    delay(1000);
    digitalWrite(13, LOW);
    delay(1000);
}`;
const VirtualLabAppComponent = ({ resourceId, resourceType }) => {
    const addNode = useLabStore((state) => state.addNode);
    const reset = useLabStore((state) => state.reset);
    const toggleSimulation = useLabStore((state) => state.toggleSimulation);
    const runSimulationStep = useLabStore((state) => state.runSimulationStep);
    const setTransport = useLabStore((state) => state.setTransport);
    const setUserPinState = useLabStore((state) => state.setUserPinState);
    // SHIP-GRADE: Override default transport with HardwareClient bridge
    useEffect(() => {
        const transport = new HardwareClientTransport();
        transport.connect().then(() => {
            useLabStore.setState({ activeTransport: transport });
        });
        return () => {
            void transport.disconnect();
        };
    }, []);
    const setPlaybackMode = useLabStore((state) => state.setPlaybackMode);
    const scrub = useLabStore((state) => state.scrub);
    const recover = useLabStore((state) => state.recover);
    const setSketchSource = useLabStore((state) => state.setSketchSource);
    const loadSketch = useLabStore((state) => state.loadSketch);
    const clearSerial = useLabStore((state) => state.clearSerial);
    const setHighlightedPins = useLabStore((state) => state.setHighlightedPins);
    const startLabSession = useLabStore((state) => state.startLabSession);
    const clearLabSession = useLabStore((state) => state.clearLabSession);
    const setSelectedNetId = useLabStore((state) => state.setSelectedNetId);
    const getFile = useFileSystemStore((state) => state.getFile);
    const getAllFiles = useFileSystemStore((state) => state.getAllFiles);
    // Selectors
    const isRunning = useLabStore((state) => state.simulation.isRunning);
    const tick = useLabStore((state) => state.simulation.tick);
    useEffect(() => {
        window.rbTickCount = tick;
    }, [tick]);
    const playbackMode = useLabStore((state) => state.simulation.playbackMode);
    const replayScrubTick = useLabStore((state) => state.simulation.replayScrubTick);
    const integrityError = useLabStore((state) => state.integrityError);
    const graph = useLabStore((state) => state.graph);
    // Hardware State Selectors (Primitives to avoid infinite loops)
    const activeTransportType = useLabStore((state) => state.activeTransport.type);
    const activeDeviceVerified = useLabStore((state) => state.activeTransport.getStatus().deviceVerified);
    const timeline = useLabStore((state) => state.timeline);
    const pinStates = useLabStore((state) => state.simulation.pinStates);
    const labSession = useLabStore((state) => state.labSession);
    const selectedNetId = useLabStore((state) => state.interaction.selectedNetId);
    const sketchSource = useLabStore((state) => state.sketch.source);
    const sketchStatus = useLabStore((state) => state.sketch.status);
    const sketchError = useLabStore((state) => state.sketch.error);
    const sketchSerial = useLabStore((state) => state.sketch.serial);
    const sketchHash = useLabStore((state) => state.sketch.sketchHash);
    const unifiedProject = useUnifiedProjectStore((s) => s.currentProject);
    const updateUnifiedProject = useUnifiedProjectStore((s) => s.updateProject);
    const lastAppliedIoRef = useRef(null);
    const lastSyncedIoRef = useRef(null);
    // Export/Import
    const fileInputRef = useRef(null);
    // Simulation Loop (20Hz)
    useEffect(() => {
        let interval;
        if (isRunning) {
            interval = window.setInterval(() => {
                runSimulationStep();
            }, 50);
        }
        return () => window.clearInterval(interval);
    }, [isRunning, runSimulationStep, playbackMode]);
    // Cleanup on unmount
    useEffect(() => {
        return () => useLabStore.getState().reset();
    }, []);
    // Sync unified project IO state -> Virtual Lab pin states
    useEffect(() => {
        if (!unifiedProject?.boardMap?.virtualIOState)
            return;
        const switches = unifiedProject.boardMap.virtualIOState.switches || [];
        const buttons = unifiedProject.boardMap.virtualIOState.buttons || [];
        const ioKey = JSON.stringify({ switches, buttons });
        if (ioKey === lastAppliedIoRef.current)
            return;
        const fpgaNode = useLabStore.getState().graph.nodes.find((n) => n.type === 'fpga-basys3');
        if (!fpgaNode)
            return;
        switches.forEach((value, idx) => {
            setUserPinState(fpgaNode.id, `SW${idx}`, value ? 1 : 0);
        });
        buttons.forEach((value, idx) => {
            setUserPinState(fpgaNode.id, `BTN${idx}`, value ? 1 : 0);
        });
        lastAppliedIoRef.current = ioKey;
    }, [unifiedProject, setUserPinState]);
    // Sync Virtual Lab pin states -> unified project IO state
    useEffect(() => {
        if (!unifiedProject)
            return;
        const fpgaNode = useLabStore.getState().graph.nodes.find((n) => n.type === 'fpga-basys3');
        if (!fpgaNode)
            return;
        const getPin = (pinId) => pinStates[`${fpgaNode.id}:${pinId}`] ?? 0;
        const switches = Array.from({ length: 8 }, (_, i) => Boolean(getPin(`SW${i}`)));
        const buttons = Array.from({ length: 4 }, (_, i) => Boolean(getPin(`BTN${i}`)));
        const ioKey = JSON.stringify({ switches, buttons });
        if (ioKey === lastSyncedIoRef.current)
            return;
        updateUnifiedProject((project) => ({
            ...project,
            boardMap: {
                boardProfileId: project.boardMap?.boardProfileId || 'basys3',
                signalToPinMap: project.boardMap?.signalToPinMap || {},
                virtualIOState: { switches, buttons },
            },
        }));
        lastSyncedIoRef.current = ioKey;
    }, [pinStates, unifiedProject, updateUnifiedProject]);
    useEffect(() => {
        if (!useLabStore.getState().sketch.source) {
            setSketchSource(DEFAULT_SKETCH);
        }
    }, [setSketchSource]);
    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key.toLowerCase() === 'h' && !(e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement)) {
                const setActive = useInstrumentState.getState().setActiveInstrumentId;
                const current = useInstrumentState.getState().activeInstrumentId;
                setActive(current === 'hardware' ? 'net-inspector' : 'hardware');
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);
    useEffect(() => {
        if (!resourceId || resourceType !== 'file')
            return;
        const file = getFile(resourceId);
        const candidate = file ?? getAllFiles().find((entry) => entry.name.toLowerCase().includes(resourceId.toLowerCase()));
        if (!candidate || !candidate.content)
            return;
        const load = async () => {
            try {
                const json = JSON.parse(candidate.content || '{ }');
                const prepared = await prepareCapsule(json);
                if (prepared) {
                    setPendingCapsule(prepared);
                }
            }
            catch (error) {
                console.error(error);
                window.alert('Failed to load capsule from file.');
            }
        };
        void load();
    }, [resourceId, resourceType, getFile, getAllFiles]);
    const [selectedTemplateId, setSelectedTemplateId] = useState(VIRTUAL_LAB_TEMPLATES[0]?.lab_id ?? '');
    const [selectedPinKey, setSelectedPinKey] = useState(null);
    const [pendingCapsule, setPendingCapsule] = useState(null);
    const activeTemplate = useMemo(() => {
        if (labSession) {
            return VIRTUAL_LAB_TEMPLATES.find((template) => template.lab_id === labSession.templateId) ?? null;
        }
        return VIRTUAL_LAB_TEMPLATES.find((template) => template.lab_id === selectedTemplateId) ?? null;
    }, [labSession, selectedTemplateId]);
    const evaluationTick = playbackMode === 'replay' ? replayScrubTick : tick;
    const { signalSource, netlist } = useVirtualLabSignalSource({
        graph,
        timeline,
        pinStates,
        serial: sketchSerial,
        onLocatePins: setHighlightedPins,
        onClearSerial: clearSerial,
    });
    const gradeReport = useMemo(() => {
        if (!activeTemplate)
            return null;
        const templateHash = fingerprintLabTemplate(activeTemplate);
        return evaluateAtTick(graph, timeline, activeTemplate, templateHash, evaluationTick);
    }, [activeTemplate, graph, timeline, evaluationTick]);
    const wiringSummary = useMemo(() => {
        if (!gradeReport)
            return { pass: 0, total: 0 };
        const wiring = gradeReport.checks.filter((check) => check.category === 'wiring');
        return {
            pass: wiring.filter((check) => check.status === 'pass').length,
            total: wiring.length
        };
    }, [gradeReport]);
    const behaviorSummary = useMemo(() => {
        if (!gradeReport)
            return { pass: 0, total: 0 };
        const behavior = gradeReport.checks.filter((check) => check.category === 'behavior');
        return {
            pass: behavior.filter((check) => check.status === 'pass').length,
            total: behavior.length
        };
    }, [gradeReport]);
    const statusLabel = (status) => {
        if (status === 'pass')
            return { label: 'PASS', color: 'text-green-400' };
        if (status === 'partial')
            return { label: 'WARN', color: 'text-amber-400' };
        return { label: 'FAIL', color: 'text-red-400' };
    };
    const selectedSignalId = selectedNetId
        ? `net:${selectedNetId}`
        : selectedPinKey
            ? `pin:${selectedPinKey}`
            : null;
    const eventFeed = useMemo(() => {
        const items = timeline.events
            .filter((event) => {
            if (event.type === 'SIMULATION_START' || event.type === 'SIMULATION_STOP')
                return true;
            if (event.type === 'PLACE_PART' || event.type === 'ADD_WIRE' || event.type === 'REMOVE_WIRE')
                return true;
            if (event.type === 'SERIAL_OUTPUT' || event.type === 'SKETCH_ERROR' || event.type === 'SKETCH_LOADED')
                return true;
            if (event.type === 'SIM_PIN_DIFF') {
                return Object.keys(event.pinDiffs).some((key) => key.endsWith(':D13') || key.endsWith(':D2'));
            }
            return false;
        })
            .map((event) => {
            switch (event.type) {
                case 'SIMULATION_START':
                    return { tick: event.tick, label: 'Simulation started', seq: event.seq };
                case 'SIMULATION_STOP':
                    return { tick: event.tick, label: 'Simulation stopped', seq: event.seq };
                case 'PLACE_PART':
                    return { tick: event.tick, label: `Placed ${event.part.type}`, seq: event.seq };
                case 'ADD_WIRE':
                    return { tick: event.tick, label: `Added wire ${event.wire.sourcePinId} → ${event.wire.targetPinId}`, seq: event.seq };
                case 'REMOVE_WIRE':
                    return { tick: event.tick, label: `Removed wire ${event.wireId}`, seq: event.seq };
                case 'SERIAL_OUTPUT':
                    return { tick: event.tick, label: `Serial: ${event.text.trim()}`, seq: event.seq };
                case 'SKETCH_LOADED':
                    return { tick: event.tick, label: 'Sketch loaded', seq: event.seq };
                case 'SKETCH_ERROR':
                    return { tick: event.tick, label: `Sketch error: ${event.message}`, seq: event.seq };
                case 'SIM_PIN_DIFF':
                    return { tick: event.tick, label: 'Pin change detected', seq: event.seq };
                default:
                    return { tick: event.tick, label: event.type, seq: event.seq };
            }
        });
        return items.slice(-20);
    }, [timeline.events]);
    const bookmarks = useMemo(() => {
        const marks = [];
        const start = timeline.events.find((event) => event.type === 'SIMULATION_START');
        if (start)
            marks.push({ tick: start.tick, label: 'Simulation started' });
        const firstSerial = timeline.events.find((event) => event.type === 'SERIAL_OUTPUT');
        if (firstSerial && firstSerial.type === 'SERIAL_OUTPUT') {
            marks.push({ tick: firstSerial.tick, label: 'First serial output' });
        }
        const firstLed = timeline.events.find((event) => event.type === 'SIM_PIN_DIFF' && Object.keys(event.pinDiffs).some((key) => key.endsWith(':D13') && event.pinDiffs[key] === 1));
        if (firstLed && firstLed.type === 'SIM_PIN_DIFF') {
            marks.push({ tick: firstLed.tick, label: 'First LED ON' });
        }
        return marks;
    }, [timeline.events]);
    const lastIntegrityToast = useRef(null);
    useEffect(() => {
        if (integrityError && integrityError !== lastIntegrityToast.current) {
            toast.error({ message: integrityError });
            lastIntegrityToast.current = integrityError;
        }
        if (!integrityError) {
            lastIntegrityToast.current = null;
        }
    }, [integrityError]);
    const handleAddPart = (type) => {
        if (playbackMode === 'replay') {
            window.alert('Cannot edit graph in Replay Mode. Switch to Live Mode first.');
            return;
        }
        if (integrityError) {
            window.alert('Integrity Warning active. Recover or re-import before editing.');
            return;
        }
        const def = PART_DEFINITIONS[type];
        if (!def)
            return;
        const count = useLabStore.getState().graph.nodes.length;
        // Smarter default placements for automatic MVP success
        let pose = { position: { x: count * 2, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } };
        if (type === 'breadboard-half') {
            pose.position = { x: 0, y: 0, z: 0 };
        }
        else if (type === 'arduino-nano') {
            pose.position = { x: -3, y: 0, z: 0 };
        }
        else if (type === 'led-5mm') {
            pose.position = { x: 1, y: 0.5, z: 0 };
        }
        const node = {
            id: `${type}-${tick}-${count}`,
            type,
            pose,
            properties: {},
        };
        addNode(node);
    };
    const handleScrub = (e) => {
        const t = parseInt(e.target.value);
        scrub(t);
    };
    const handleStartLab = () => {
        if (!activeTemplate)
            return;
        startLabSession(activeTemplate);
    };
    const handleLocatePins = (selectors) => {
        const pins = selectors.flatMap((selector) => resolveSelectorPins(graph, selector));
        const parsed = pins.map((pinKey) => {
            const [nodeId, pinId] = pinKey.split(':');
            return { nodeId, pinId };
        });
        setHighlightedPins(parsed);
        setSelectedPinKey(pins[0] ?? null);
        setSelectedNetId(null);
    };
    const handleSelectNet = (netId) => {
        setSelectedNetId(netId);
        setSelectedPinKey(null);
        const net = netlist.nets.find((entry) => entry.id === netId);
        if (net && net.pins.length > 0) {
            const pins = net.pins.map((pin) => ({ nodeId: pin.nodeId, pinId: pin.pinId }));
            setHighlightedPins(pins);
            const first = net.pins[0];
            setSelectedPinKey(`${first.nodeId}:${first.pinId}`);
        }
    };
    const handleSelectSignalId = (signalId) => {
        if (!signalId) {
            setSelectedNetId(null);
            setSelectedPinKey(null);
            return;
        }
        if (signalId.startsWith('net:')) {
            const netId = signalId.slice(4);
            handleSelectNet(netId);
            return;
        }
        if (signalId.startsWith('pin:')) {
            const pinKey = signalId.slice(4);
            const [nodeId, pinId] = pinKey.split(':');
            if (nodeId && pinId) {
                setSelectedNetId(null);
                setSelectedPinKey(pinKey);
                setHighlightedPins([{ nodeId, pinId }]);
            }
        }
    };
    const handleShowEvidence = (evidence) => {
        if (!evidence)
            return;
        const fromTick = typeof evidence.fromTick === 'number' ? evidence.fromTick : null;
        if (fromTick === null)
            return;
        setPlaybackMode('replay');
        scrub(fromTick);
        if (typeof evidence.pinKey === 'string') {
            setSelectedNetId(null);
            const [nodeId, pinId] = evidence.pinKey.split(':');
            setHighlightedPins([{ nodeId, pinId }]);
            setSelectedPinKey(evidence.pinKey);
        }
    };
    const applyCapsule = (capsule) => {
        const templateId = capsule.meta?.labTemplateId;
        const templateHash = capsule.meta?.labTemplateHash;
        const sessionId = capsule.meta?.labSessionId ?? `lab-${Date.now()}`;
        const playbackMode = capsule.loadedAsReadOnly ? 'replay' : 'live';
        const playbackState = capsule.loadedAsReadOnly ? 'replay:paused' : 'live:stopped';
        useLabStore.setState({
            graph: capsule.graph,
            timeline: capsule.history,
            simulation: {
                playbackState,
                isRunning: false,
                playbackMode,
                tick: capsule.lastTick,
                pinStates: {},
                partStates: {}, // Fix missing partStates
                replayScrubTick: capsule.loadedAsReadOnly ? 0 : capsule.lastTick,
                lastReconstructionMs: 0,
            },
            sketch: {
                source: capsule.sketchSource,
                status: 'idle',
                error: null,
                serial: [],
                sketchHash: capsule.meta?.sketchHash ?? null,
            },
            integrityError: capsule.integrityErrorMsg,
            lastGoodSnapshot: capsule.history.snapshots[capsule.history.snapshots.length - 1] ?? null,
            labSession: templateId && templateHash ? {
                sessionId,
                templateId,
                templateHash,
                startedAtTick: 0,
                status: 'active'
            } : null
        });
        if (templateId) {
            setSelectedTemplateId(templateId);
        }
        if (!capsule.loadedAsReadOnly && capsule.sketchSource.trim()) {
            useLabStore.getState().loadSketch();
        }
        if (capsule.loadedAsReadOnly) {
            scrub(0);
        }
        else {
            useLabStore.getState().setPlaybackMode('live');
        }
    };
    const handleExportCapsule = async () => {
        const state = useLabStore.getState();
        const headerSnapshot = state.timeline.snapshots[0];
        const sketchHash = state.sketch.source ? hashSketchSource(state.sketch.source) : undefined;
        const templateHash = activeTemplate ? fingerprintLabTemplate(activeTemplate) : undefined;
        // Prepare Content
        const capsuleContent = {
            meta: {
                capsuleVersion: 'labcapsule.v1',
                engineVersion: '1.0.0',
                appVersion: '1.0.0',
                createdAt: new Date().toISOString(),
                seed: 0, // Deterministic seed placeholder
                sketchHash,
                labTemplateId: labSession?.templateId ?? activeTemplate?.lab_id,
                labTemplateHash: labSession?.templateHash ?? templateHash,
                labSessionId: labSession?.sessionId,
            },
            graph: headerSnapshot.graph,
            history: {
                events: state.timeline.events,
                snapshots: state.timeline.snapshots
            },
            artifacts: {
                sketchSource: state.sketch.source
            }
        };
        // Compute Canonical Hash
        const hashHex = await fingerprintCapsuleContent(capsuleContent);
        const capsule = {
            meta: { ...capsuleContent.meta, capsuleHash: hashHex, deterministicHash: hashHex },
            graph: capsuleContent.graph,
            history: capsuleContent.history,
            artifacts: capsuleContent.artifacts
        };
        const blob = new Blob([JSON.stringify(capsule, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lab-replay-${Date.now()}.rb-lab.zip`;
        a.click();
        URL.revokeObjectURL(url);
    };
    const prepareCapsule = async (json) => {
        if (json.meta?.capsuleVersion !== 'labcapsule.v1') {
            throw new Error(`Unsupported capsule version: ${json.meta?.capsuleVersion}`);
        }
        const historyInput = json.history ?? { events: [], snapshots: [] };
        const normalizedHistory = {
            events: Array.isArray(historyInput.events) ? historyInput.events : [],
            snapshots: Array.isArray(historyInput.snapshots) ? historyInput.snapshots : [],
        };
        const eventCount = normalizedHistory.events.length;
        if (eventCount > 200000) {
            const proceed = window.confirm(`Capsule has ${eventCount} events.\n\nLarge capsules can stall playback.\nContinue import?`);
            if (!proceed)
                return null;
        }
        const graphValid = validateLabGraph(json.graph);
        const timelineValid = validateTimeline(normalizedHistory);
        let graphToLoad = json.graph;
        let historyToLoad = normalizedHistory;
        let integrityErrorMsg = null;
        let loadedAsReadOnly = false;
        const expectedHash = json.meta?.capsuleHash ?? json.meta?.deterministicHash;
        const actualHash = await fingerprintCapsuleContent({
            meta: json.meta ?? {},
            graph: json.graph,
            history: normalizedHistory,
            artifacts: json.artifacts ?? {}
        });
        const hashMatch = typeof expectedHash === 'string' && expectedHash === actualHash;
        if (!hashMatch) {
            const expectedLabel = expectedHash ? `${expectedHash.slice(0, 8)}...` : 'missing';
            const openReadOnly = window.confirm(`Integrity Warning!\n\nThe capsule hash does not match its content.\nExpected: ${expectedLabel}\nActual: ${actualHash.slice(0, 8)}...\n\nOpen in READ-ONLY mode?`);
            if (!openReadOnly) {
                const repairMode = window.confirm(`Repair Mode:\nAttempt to sanitize and load this capsule (still unverified)?`);
                if (!repairMode)
                    return null;
                const gRep = repairLabGraph(json.graph);
                const tRep = repairTimeline(normalizedHistory);
                graphToLoad = gRep.repaired;
                historyToLoad = tRep.repaired;
                const fixCount = gRep.warnings.length + tRep.warnings.length;
                integrityErrorMsg = `Integrity Warning: Repaired (${fixCount} fixes)`;
                if (gRep.warnings.length > 0)
                    console.warn("Graph Repairs:", gRep.warnings);
                if (tRep.warnings.length > 0)
                    console.warn("Timeline Repairs:", tRep.warnings);
            }
            else {
                integrityErrorMsg = 'Integrity Warning: Unverified capsule';
            }
            loadedAsReadOnly = true;
        }
        else if (!graphValid.valid || !timelineValid.valid) {
            const repair = window.confirm(`Corruption Detected!\n\nGraph Errors: ${graphValid.errors.length}\nTimeline Errors: ${timelineValid.errors.length}\n\nAttempt repair?`);
            if (!repair)
                return null;
            const gRep = repairLabGraph(json.graph);
            const tRep = repairTimeline(normalizedHistory);
            graphToLoad = gRep.repaired;
            historyToLoad = tRep.repaired;
            const fixCount = gRep.warnings.length + tRep.warnings.length;
            integrityErrorMsg = `Integrity Warning: Repaired (${fixCount} fixes)`;
            loadedAsReadOnly = true;
            if (gRep.warnings.length > 0)
                console.warn("Graph Repairs:", gRep.warnings);
            if (tRep.warnings.length > 0)
                console.warn("Timeline Repairs:", tRep.warnings);
        }
        if (!historyToLoad.snapshots || historyToLoad.snapshots.length === 0) {
            const fallbackSnapshot = {
                tick: 0,
                graph: graphToLoad,
                pinStates: {},
                traceHash: fingerprintStateSync({ graph: graphToLoad, pinStates: {}, tick: 0 })
            };
            historyToLoad = { ...historyToLoad, snapshots: [fallbackSnapshot] };
        }
        const lastTick = historyToLoad.events[historyToLoad.events.length - 1]?.tick || 0;
        const sketchSourceFromCapsule = json.artifacts?.sketchSource ?? '';
        return {
            meta: json.meta ?? {},
            graph: graphToLoad,
            history: historyToLoad,
            loadedAsReadOnly,
            integrityErrorMsg,
            sketchSource: sketchSourceFromCapsule,
            lastTick,
            actualHash,
            expectedHash
        };
    };
    const handleImportCapsule = (e) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                const json = JSON.parse(ev.target?.result);
                const prepared = await prepareCapsule(json);
                if (!prepared)
                    return;
                setPendingCapsule(prepared);
            }
            catch (err) {
                console.error(err);
                window.alert('Failed to load capsule. See console.');
            }
            if (fileInputRef.current)
                fileInputRef.current.value = '';
        };
        reader.readAsText(file);
    };
    return (_jsxs("div", { className: "flex h-full w-full bg-[#1e1e1e] text-gray-200 overflow-hidden relative", children: [pendingCapsule && (_jsx("div", { className: "absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center", children: _jsxs("div", { className: "bg-[#111] border border-gray-700 rounded-lg p-6 w-[420px] text-sm", children: [_jsx("div", { className: "text-sm font-semibold text-white", children: "Capsule Review" }), _jsx("div", { className: "text-[11px] text-gray-400 mt-1", children: "Review and open this lab capsule." }), _jsxs("div", { className: "mt-4 space-y-2 text-[11px] text-gray-300", children: [_jsxs("div", { children: ["Created: ", pendingCapsule.meta?.createdAt ?? 'Unknown'] }), _jsxs("div", { children: ["Template: ", pendingCapsule.meta?.labTemplateId ?? 'Unknown'] }), _jsxs("div", { children: ["Template Hash: ", pendingCapsule.meta?.labTemplateHash ?? 'Unknown'] }), _jsxs("div", { children: ["Integrity: ", pendingCapsule.expectedHash && pendingCapsule.expectedHash === pendingCapsule.actualHash ? 'Verified' : 'Unverified'] })] }), _jsxs("div", { className: "mt-4 flex items-center gap-2", children: [_jsx("button", { onClick: () => {
                                        applyCapsule(pendingCapsule);
                                        setPendingCapsule(null);
                                    }, className: "px-3 py-2 rounded bg-blue-700 hover:bg-blue-600 text-white text-xs", children: "Open Review" }), _jsx("button", { onClick: () => setPendingCapsule(null), className: "px-3 py-2 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs", children: "Cancel" })] })] }) })), _jsxs("div", { className: "w-64 flex flex-col border-r border-gray-700 bg-[#252526]", children: [_jsxs("div", { className: "p-3 border-b border-gray-700", children: [_jsx("div", { className: "text-xs uppercase tracking-wider text-gray-500", children: "Lab Catalog" }), _jsxs("div", { className: "mt-2 space-y-2", children: [_jsx("select", { value: selectedTemplateId, onChange: (e) => setSelectedTemplateId(e.target.value), className: "w-full bg-[#1a1a1a] border border-gray-700 rounded px-2 py-1 text-xs text-gray-200", disabled: !!labSession, title: "Lab Catalog", children: VIRTUAL_LAB_TEMPLATES.map((template) => {
                                            const LOCKED_LABS = ['lab3_7seg', 'lab4_alu', 'lab5_adder_signed', 'lab6_ff', 'lab7_counters'];
                                            const isLocked = LOCKED_LABS.includes(template.lab_id);
                                            return (_jsxs("option", { value: template.lab_id, disabled: isLocked, children: [template.name, " ", isLocked ? '(LOCKED)' : ''] }, template.lab_id));
                                        }) }), _jsx("button", { onClick: handleStartLab, disabled: !activeTemplate || !!labSession, className: `w-full px-3 py-2 rounded text-xs ${labSession ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-green-700/70 hover:bg-green-600 text-white'}`, children: "Start Lab" }), labSession && activeTemplate && (_jsx("button", { onClick: () => clearLabSession(), className: "w-full px-3 py-2 rounded text-xs bg-gray-700 hover:bg-gray-600 text-gray-200", children: "End Lab Session" }))] })] }), _jsx("div", { className: "p-3 font-semibold text-sm border-b border-gray-700 uppercase tracking-wider text-gray-500", children: "Parts Palette" }), _jsx("div", { className: "flex-1 overflow-y-auto p-2 space-y-2", children: Object.values(PART_DEFINITIONS).map((part) => (_jsxs("button", { onClick: () => handleAddPart(part.type), disabled: playbackMode === 'replay' || !!integrityError, className: `w-full text-left px-3 py-2 rounded bg-[#333] hover:bg-[#444] transition-colors flex items-center gap-2 group ${playbackMode === 'replay' || integrityError ? 'opacity-50 cursor-not-allowed' : ''}`, children: [_jsx("div", { className: "w-6 h-6 rounded bg-gray-600 flex items-center justify-center text-xs font-bold text-white group-hover:bg-blue-500", children: "+" }), _jsxs("div", { className: "flex-1", children: [_jsx("div", { className: "text-sm font-medium text-white", children: part.name }), _jsx("div", { className: "text-[10px] text-gray-400 font-mono", children: part.type })] })] }, part.type))) }), _jsxs("div", { className: "p-2 border-t border-gray-700 space-y-2", children: [_jsxs("button", { onClick: handleExportCapsule, className: "w-full px-3 py-2 rounded bg-blue-900/50 hover:bg-blue-900 text-blue-100 text-xs transition-colors flex items-center justify-center gap-2", children: [_jsx("span", { children: "\uD83D\uDCBE" }), " Export Capsule"] }), _jsx("button", { onClick: () => fileInputRef.current?.click(), className: "w-full px-3 py-2 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs transition-colors", children: "\uD83D\uDCC2 Import Capsule" }), _jsx("input", { type: "file", ref: fileInputRef, onChange: handleImportCapsule, accept: ".json", className: "hidden", title: "Upload Capsule Input" }), _jsx("div", { className: "h-px bg-gray-700 my-2" }), _jsx("button", { onClick: () => reset(), className: "w-full px-3 py-2 rounded bg-red-900/50 hover:bg-red-900 text-red-100 text-xs transition-colors", children: "Clear Bench" })] })] }), _jsxs("div", { className: `flex-1 relative bg-black ${playbackMode === 'replay' ? 'border-4 border-amber-500 box-border' : ''} ${integrityError ? 'border-4 border-red-600 box-border' : ''}`, children: [_jsx(Rb3DSceneLab, {}), _jsx("div", { className: "absolute top-4 left-4 bg-black/50 backdrop-blur rounded px-3 py-1.5 text-xs text-gray-300 pointer-events-none", children: "Virtual Lab Bench (MVP)" }), _jsxs("div", { className: "absolute top-4 right-4 flex flex-col items-end gap-2 pointer-events-none", children: [integrityError && (_jsx("div", { className: "bg-red-600 text-white font-bold px-4 py-1 rounded-full shadow-lg animate-pulse flex items-center gap-2", children: _jsxs("span", { children: ["\u26A0\uFE0F ", integrityError] }) })), playbackMode === 'replay' && (_jsx("div", { className: "bg-amber-600 text-black font-bold px-4 py-1 rounded-full shadow-lg", children: "REPLAY MODE (READ ONLY)" }))] }), _jsx("div", { className: "absolute top-12 left-1/2 -translate-x-1/2 pointer-events-none select-none opacity-20", children: activeTransportType === 'bridge' ? (_jsxs("div", { className: "flex flex-col items-center gap-1", children: [_jsx("span", { className: `text-[40px] font-black tracking-tighter leading-none ${activeDeviceVerified ? 'text-green-500' : 'text-red-500'}`, children: activeDeviceVerified ? 'REAL HARDWARE' : 'HARDWARE (UNVERIFIED)' }), _jsxs("div", { className: "flex gap-4", children: [_jsx("span", { className: "text-[10px] font-bold tracking-[0.4em] uppercase text-green-600/60", children: "UNO // COM8" }), _jsx("span", { className: "text-[10px] font-bold tracking-[0.4em] uppercase text-blue-600/60", children: "BASYS3 // COM7" })] })] })) : (_jsxs("div", { className: "flex flex-col items-center", children: [_jsx("span", { className: "text-[60px] font-black tracking-tighter text-blue-500 leading-none", children: "SIMULATION" }), _jsx("span", { className: "text-[12px] font-bold text-blue-600 tracking-[0.4em] uppercase", children: "deterministic-engine // virtual-physics" })] })) }), _jsx(React.Suspense, { fallback: null, children: _jsx(HardwareStatusOverlay, {}) }), integrityError && (_jsx("div", { className: "absolute top-16 right-4 pointer-events-auto", children: _jsx("button", { onClick: () => recover(), className: "bg-red-800 hover:bg-red-700 text-white px-3 py-1 rounded text-xs shadow-lg border border-red-500", children: "Recover Last Good State" }) })), _jsxs("div", { className: "absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#222] flex flex-col items-center gap-2 rounded-xl px-6 py-3 shadow-2xl border border-gray-600 min-w-[400px]", children: [_jsxs("div", { className: "flex items-center gap-6 w-full justify-center", children: [_jsxs("div", { className: "flex bg-black rounded p-0.5", children: [_jsx("button", { onClick: () => setPlaybackMode('live'), disabled: !!integrityError, className: `px-3 py-1 text-xs rounded ${playbackMode === 'live' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'} ${integrityError ? 'cursor-not-allowed opacity-50' : ''}`, children: "LIVE" }), _jsx("button", { onClick: () => setPlaybackMode('replay'), className: `px-3 py-1 text-xs rounded ${playbackMode === 'replay' ? 'bg-amber-600 text-black' : 'text-gray-400 hover:text-white'}`, children: "REPLAY" })] }), _jsx("button", { onClick: () => toggleSimulation(), disabled: !!integrityError, className: `w-12 h-12 rounded-full flex items-center justify-center transition-colors text-xl shadow-lg
                                ${integrityError ? 'bg-gray-700 text-gray-500 cursor-not-allowed' :
                                            isRunning ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-green-500 hover:bg-green-600 text-white'}`, children: isRunning ? '⬛' : '▶' }), _jsxs("div", { className: "flex flex-col items-start w-20", children: [_jsx("span", { className: "text-[10px] uppercase font-bold text-gray-500", children: "Tick" }), _jsxs("span", { className: "text-xl font-mono text-white leading-none", children: [playbackMode === 'live' ? tick : replayScrubTick, " ", _jsxs("span", { className: "text-xs text-gray-500", children: ["/ ", tick] })] })] })] }), _jsxs("div", { className: "w-full pt-2 flex items-center gap-3", children: [_jsx("span", { className: "text-xs text-gray-500 font-mono", children: "0" }), _jsx("input", { type: "range", min: 0, max: tick, value: playbackMode === 'live' ? tick : replayScrubTick, onChange: handleScrub, 
                                        /* When scrubbing in Live mode, we should ideally auto-switch to replay, but for MVP keep explicit */
                                        onMouseDown: () => { if (playbackMode === 'live')
                                            setPlaybackMode('replay'); }, title: "Timeline Scrubber", className: `flex-1 h-2 rounded-lg appearance-none cursor-pointer
                                ${playbackMode === 'replay' ? 'bg-amber-900 accent-amber-500' : 'bg-gray-700 accent-blue-500'}` }), _jsx("span", { className: "text-xs text-gray-500 font-mono", children: tick })] })] }), bookmarks.length > 0 && (_jsxs("div", { className: "absolute bottom-6 right-4 bg-black/60 border border-gray-700 rounded p-3 text-[10px] text-gray-300 w-48", children: [_jsx("div", { className: "text-[10px] uppercase text-gray-500 mb-2", children: "Bookmarks" }), _jsx("div", { className: "space-y-1", children: bookmarks.map((mark, index) => (_jsxs("button", { onClick: () => {
                                        setPlaybackMode('replay');
                                        scrub(mark.tick);
                                    }, className: "w-full text-left text-blue-300 hover:text-blue-200", children: [mark.label, " \u00B7 ", mark.tick] }, `${mark.tick}-${mark.label}-${index}`))) })] })), _jsxs("div", { className: "absolute bottom-4 left-4 bg-black/50 backdrop-blur p-4 rounded text-xs text-gray-400 pointer-events-none max-w-xs", children: [_jsx("p", { className: "font-bold text-white mb-1", children: "Controls:" }), _jsxs("ul", { className: "list-disc pl-4 space-y-1", children: [_jsx("li", { children: "Click pin to start wire" }), _jsx("li", { children: "Connect D13 to LED Anode" }), _jsxs("li", { children: ["Switch to ", _jsx("strong", { children: "REPLAY" }), " to scrub history"] })] })] })] }), _jsxs("div", { className: "w-96 flex flex-col border-l border-gray-700 bg-[#1b1c1f] min-h-0", children: [_jsxs("div", { className: "p-3 border-b border-gray-700", children: [_jsx("div", { className: "text-sm font-semibold text-white", children: "Sketch Editor" }), _jsx("div", { className: "text-[10px] text-gray-400", children: "Arduino subset: setup/loop, pinMode, digitalWrite, delay, millis, Serial" })] }), _jsxs("div", { className: "p-3 flex flex-col gap-2", children: [_jsx("textarea", { value: sketchSource, onChange: (e) => setSketchSource(e.target.value), readOnly: playbackMode === 'replay' || !!integrityError, className: `h-56 w-full resize-none rounded border border-gray-700 bg-[#111] text-gray-200 font-mono text-xs p-2 focus:outline-none focus:border-blue-500 ${playbackMode === 'replay' || integrityError ? 'opacity-60' : ''}`, spellCheck: false, title: "Sketch Source Code" }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("button", { onClick: () => loadSketch(), disabled: playbackMode === 'replay' || !!integrityError, className: `px-3 py-1.5 rounded text-blue-100 text-xs ${playbackMode === 'replay' || integrityError ? 'bg-gray-700 cursor-not-allowed' : 'bg-blue-900/60 hover:bg-blue-900'}`, children: "Load Sketch" }), _jsxs("div", { className: "text-[10px] text-gray-400", children: ["Status: ", _jsx("span", { className: sketchStatus === 'error' ? 'text-red-400' : sketchStatus === 'loaded' ? 'text-green-400' : 'text-gray-400', children: sketchStatus.toUpperCase() })] })] }), sketchError && (_jsx("div", { className: "text-[10px] text-red-400 bg-red-950/40 border border-red-800 rounded p-2", children: sketchError })), sketchHash && (_jsxs("div", { className: "text-[10px] text-gray-500 font-mono", children: ["Sketch Hash: ", sketchHash.slice(0, 8), "..."] }))] }), _jsxs("div", { className: "flex-1 min-h-0 overflow-y-auto", children: [activeTemplate && gradeReport && (_jsxs("div", { className: "border-t border-gray-700 p-3 flex flex-col gap-2", children: [_jsx("div", { className: "text-xs font-semibold text-gray-200", children: "Lab Review" }), _jsx("div", { className: "text-[11px] text-gray-400", children: activeTemplate.summary }), _jsxs("div", { className: "grid grid-cols-3 gap-2 text-[10px]", children: [_jsxs("div", { className: "bg-[#111] border border-gray-700 rounded px-2 py-1", children: [_jsx("div", { className: "text-gray-500 uppercase", children: "Wiring" }), _jsxs("div", { className: "text-white", children: [wiringSummary.pass, "/", wiringSummary.total, " verified"] })] }), _jsxs("div", { className: "bg-[#111] border border-gray-700 rounded px-2 py-1", children: [_jsx("div", { className: "text-gray-500 uppercase", children: "Behavior" }), _jsxs("div", { className: "text-white", children: [behaviorSummary.pass, "/", behaviorSummary.total, " verified"] })] }), _jsxs("div", { className: "bg-[#111] border border-gray-700 rounded px-2 py-1", children: [_jsx("div", { className: "text-gray-500 uppercase", children: "Evidence" }), _jsx("div", { className: "text-white", children: playbackMode === 'live' && isRunning ? 'Recording' : 'Idle' })] })] }), _jsxs("div", { className: "mt-2 text-[10px] text-gray-500 bg-[#111] border border-gray-800 rounded px-2 py-1", children: ["Template: ", activeTemplate.name, " \u00B7 Version ", activeTemplate.lab_version, " \u00B7 Integrity ", integrityError ? 'Unverified' : 'Verified'] }), _jsxs("div", { className: "mt-2 space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("div", { className: "text-[11px] text-gray-300 font-semibold", children: "Parts" }), _jsx("button", { onClick: () => useLabStore.getState().resetLayout(), className: "text-[10px] text-red-400 hover:text-red-300", children: "Reset Layout" })] }), gradeReport.checks
                                                .filter((check) => check.category === 'parts')
                                                .map((check) => {
                                                const status = statusLabel(check.status);
                                                return (_jsxs("div", { className: "text-[10px] bg-[#111] border border-gray-800 rounded px-2 py-1", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { children: check.label }), _jsx("span", { className: status.color, children: status.label })] }), check.details && (_jsx("div", { className: "text-[10px] text-gray-500 mt-1", children: check.details }))] }, check.id));
                                            }), _jsx("div", { className: "text-[11px] text-gray-300 font-semibold mt-2", children: "Wiring" }), activeTemplate.required_nets.map((net) => {
                                                const check = gradeReport.checks.find((entry) => entry.id === `wiring:${net.id}`);
                                                const status = statusLabel(check?.status ?? 'missing');
                                                return (_jsxs("div", { className: "text-[10px] bg-[#111] border border-gray-800 rounded px-2 py-1", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { children: net.label }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { onClick: () => handleLocatePins(net.pins), className: "text-[10px] text-blue-300 hover:text-blue-200", children: "Locate" }), _jsx("span", { className: status.color, children: status.label })] })] }), net.hint && (_jsxs("div", { className: "text-[10px] text-gray-500 mt-1", children: ["Hint: ", net.hint] }))] }, net.id));
                                            }), activeTemplate.behavior_checks && (_jsxs(_Fragment, { children: [_jsx("div", { className: "text-[11px] text-gray-300 font-semibold mt-2", children: "Behavior" }), activeTemplate.behavior_checks.map((behavior) => {
                                                        const check = gradeReport.checks.find((entry) => entry.id === `behavior:${behavior.id}`);
                                                        const status = statusLabel(check?.status ?? 'fail');
                                                        return (_jsxs("div", { className: "text-[10px] bg-[#111] border border-gray-800 rounded px-2 py-1", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { children: behavior.id }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { onClick: () => handleLocatePins([behavior.pin]), className: "text-[10px] text-blue-300 hover:text-blue-200", children: "Locate" }), check?.evidence && (_jsx("button", { onClick: () => handleShowEvidence(check.evidence), className: "text-[10px] text-blue-300 hover:text-blue-200", children: "Show evidence" })), _jsx("span", { className: status.color, children: status.label })] })] }), check?.details && (_jsxs("div", { className: "text-[10px] text-gray-500 mt-1", children: ["What this means: ", check.details] })), 'hint' in behavior && behavior.hint && (_jsxs("div", { className: "text-[10px] text-gray-500 mt-1", children: ["Hint: ", behavior.hint] }))] }, behavior.id));
                                                    })] }))] })] })), _jsxs("div", { className: "border-t border-gray-700 p-3 flex flex-col gap-2", children: [_jsx("div", { className: "text-xs font-semibold text-gray-200", children: "Event Feed" }), _jsx("div", { className: "text-[10px] text-gray-500", children: "Latest actions & signals" }), _jsx("div", { className: "max-h-24 overflow-auto space-y-1", children: eventFeed.length === 0 ? (_jsx("div", { className: "text-[10px] text-gray-500", children: "No events yet." })) : (eventFeed.map((item, index) => (_jsxs("button", { onClick: () => {
                                                setPlaybackMode('replay');
                                                scrub(item.tick);
                                            }, className: "w-full text-left text-[10px] text-blue-300 hover:text-blue-200", children: ["Tick ", item.tick, ": ", item.label] }, item.seq ?? `${item.tick}-${item.label}-${index}`)))) })] }), _jsxs("div", { className: "flex-1 border-t border-gray-700 min-h-[240px] flex flex-col", children: [_jsxs("div", { className: "p-3 border-b border-gray-700", children: [_jsx("div", { className: "text-xs font-semibold text-gray-200", children: "Instruments" }), _jsx("div", { className: "text-[10px] text-gray-500", children: "Scope, probe, net inspector, serial" })] }), _jsx("div", { className: "flex-1 min-h-0", children: (() => {
                                            const DockComponent = InstrumentDock;
                                            return (_jsx(DockComponent, { signalSource: signalSource, currentTick: evaluationTick, selectedSignalId: selectedSignalId, onSelectSignalId: handleSelectSignalId, hardwarePanel: _jsx(HardwareRackPanel, {}) }));
                                        })() })] })] })] }), _jsx(GuidedLabSidebar, {}), _jsx(HardwareAutoAdopt, {})] }));
};
const VirtualLabAppWithBoundary = (props) => (_jsx(ErrorBoundary, { fallbackTitle: "Virtual Lab Error", children: _jsx(VirtualLabAppComponent, { ...props }) }));
export const VirtualLabApp = {
    manifest: {
        id: 'virtual-lab',
        name: 'Virtual Lab',
        iconId: 'tool-build',
        category: 'tools',
        defaultSize: { width: 1200, height: 800 },
        minSize: { width: 800, height: 600 },
    },
    component: VirtualLabAppWithBoundary,
};
