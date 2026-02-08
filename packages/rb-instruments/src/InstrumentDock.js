import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useInstrumentState } from './useInstrumentState';
import { NetInspectorPanel } from './NetInspectorPanel';
import { ProbePanel } from './ProbePanel';
import { ScopePanel } from './ScopePanel';
import { SerialPanel } from './SerialPanel';
const instruments = [
    { id: 'net-inspector', label: 'Net Inspector' },
    { id: 'scope', label: 'Scope' },
    { id: 'probe', label: 'Probe' },
    { id: 'serial', label: 'Serial' },
    { id: 'hardware', label: 'Hardware' },
];
export const InstrumentDock = ({ signalSource, currentTick, selectedSignalId, onSelectSignalId, defaultInstrumentId, hardwarePanel, }) => {
    const activeInstrumentId = useInstrumentState((state) => state.activeInstrumentId);
    const setActiveInstrumentId = useInstrumentState((state) => state.setActiveInstrumentId);
    const internalSelectedSignalId = useInstrumentState((state) => state.selectedSignalId);
    const setInternalSelectedSignalId = useInstrumentState((state) => state.setSelectedSignalId);
    const resolvedSelectedSignalId = selectedSignalId ?? internalSelectedSignalId;
    const handleSelectSignalId = onSelectSignalId ?? setInternalSelectedSignalId;
    const currentInstrument = activeInstrumentId ?? defaultInstrumentId ?? 'net-inspector';
    return (_jsxs("div", { className: "flex flex-col min-h-0", children: [_jsx("div", { className: "flex items-center gap-1 border-b border-gray-700 px-2 py-1", children: instruments.map((instrument) => (_jsx("button", { onClick: () => setActiveInstrumentId(instrument.id), className: `px-2 py-1 text-[10px] rounded border ${currentInstrument === instrument.id
                        ? 'border-blue-400 text-blue-200 bg-blue-900/30'
                        : 'border-gray-800 text-gray-400 hover:text-blue-200'}`, children: instrument.label }, instrument.id))) }), _jsxs("div", { className: "flex-1 min-h-0 overflow-auto p-3", children: [currentInstrument === 'net-inspector' && (_jsx(NetInspectorPanel, { signalSource: signalSource, currentTick: currentTick, selectedSignalId: resolvedSelectedSignalId, onSelectSignalId: handleSelectSignalId })), currentInstrument === 'scope' && (_jsx(ScopePanel, { signalSource: signalSource, currentTick: currentTick, selectedSignalId: resolvedSelectedSignalId })), currentInstrument === 'probe' && (_jsx(ProbePanel, { signalSource: signalSource, currentTick: currentTick, selectedSignalId: resolvedSelectedSignalId })), currentInstrument === 'serial' && (_jsx(SerialPanel, { signalSource: signalSource })), currentInstrument === 'hardware' && hardwarePanel] })] }));
};
