
import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { ElementPosition } from './Basys3Layout'; // Types might be useful, or define new ones

// --- Arduino Pin Definitions ---
const ANALOG_PINS = ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'];
const DIGITAL_PINS = ['D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12', 'D13'];
const PWM_PINS = ['D3', 'D5', 'D6', 'D9', 'D10', 'D11']; // Subset of Digital

export interface ArduinoInstrumentProps {
    // Current Mappings
    signalToPinMap: Record<string, string>; // SignalName -> PinID

    // Available Logic Signals
    availableSignals: {
        inputs: Array<{ id: string, label: string }>; // Driveable by Arduino (Outputs FROM Arduino)
        outputs: Array<{ id: string, label: string }>; // Observable by Arduino (Inputs TO Arduino)
    };

    // Current Sim Values (Pin -> Value)
    // We expect the parent to resolve Signal -> Value and pass it keyed by Pin
    pinValues: Record<string, number | boolean>;

    // Callbacks
    onMapSignal: (signal: string, pin: string) => void;
    onSetPinOutput: (pin: string, value: number | boolean) => void; // For driving circuit (Arduino Output)
    onCaptureSnapshot: () => void;
}

export const ArduinoInstrument: React.FC<ArduinoInstrumentProps> = ({
    signalToPinMap,
    availableSignals,
    pinValues,
    onMapSignal,
    onSetPinOutput,
    onCaptureSnapshot
}) => {
    // Local State for Plot
    const [selectedPlotPin, setSelectedPlotPin] = useState<string | null>(null);
    const [plotHistory, setPlotHistory] = useState<number[]>([]);

    // Invert Map for easier lookup: Pin -> Signal
    const pinToSignalMap = useMemo(() => {
        const map: Record<string, string> = {};
        Object.entries(signalToPinMap).forEach(([sig, pin]) => map[pin] = sig);
        return map;
    }, [signalToPinMap]);

    // Update Plot History
    useEffect(() => {
        if (!selectedPlotPin) return;

        const val = pinValues[selectedPlotPin];
        const numVal = typeof val === 'boolean' ? (val ? 1 : 0) : (typeof val === 'number' ? val : 0);

        setPlotHistory(prev => {
            const next = [...prev, numVal];
            if (next.length > 50) next.shift(); // Keep last 50 points
            return next;
        });
    }, [pinValues, selectedPlotPin]); // Dependent on parent tick rate

    // Helper to render Pin Row
    const renderPinRow = (pin: string, type: 'ANALOG' | 'DIGITAL' | 'PWM') => {
        const mappedSignal = pinToSignalMap[pin];
        const isPWM = PWM_PINS.includes(pin);

        // Value Display
        const rawVal = pinValues[pin];
        let displayVal = '—';
        if (rawVal !== undefined) {
            if (typeof rawVal === 'boolean') displayVal = rawVal ? 'HIGH' : 'LOW';
            else displayVal = rawVal.toFixed(2);
        }

        // Determine Direction based on mapped signal type? Or allow user to set Mode?
        // For v1: 
        // Analog: Inputs TO Arduino (Read circuit)
        // Digital: Configurable? Let's assume Digital can be Output (Drive Circuit) or Input (Read Circuit).
        // For simplicity: If we map a Circuit Input -> Pin, Pin is Output. If Circuit Output -> Pin, Pin is Input.
        // We can infer from availableSignals lists.

        const isDrivingCircuit = mappedSignal && availableSignals.inputs.some(s => s.label === mappedSignal);

        return (
            <div key={pin} className={`flex items-center justify-between p-2 rounded border border-gray-800 bg-gray-900/50 text-xs ${selectedPlotPin === pin ? 'border-cyan-500/50 bg-cyan-900/20' : ''}`}>

                {/* Pin ID & Plot Toggle */}
                <div
                    className="flex items-center gap-2 w-16 cursor-pointer hover:text-cyan-400 font-mono font-bold text-gray-400"
                    onClick={() => { setSelectedPlotPin(pin); setPlotHistory([]); }}
                >
                    <div className={`w-2 h-2 rounded-full ${selectedPlotPin === pin ? 'bg-cyan-400' : 'bg-gray-700'}`} />
                    {pin}
                </div>

                {/* Mapping Dropdown */}
                <select
                    className="bg-black border border-gray-700 rounded text-gray-300 w-32 text-[10px] outline-none focus:border-blue-500"
                    value={mappedSignal || ''}
                    onChange={(e) => onMapSignal(e.target.value, pin)}
                    aria-label={`Map Channel ${pin}`}
                >
                    <option value="">(Unconnected)</option>

                    {/* If Analog Pin, prefer Circuit Outputs (to Measure) */}
                    {type === 'ANALOG' && (
                        <optgroup label="Measure (Circuit Outputs)">
                            {availableSignals.outputs.map(s => <option key={s.id} value={s.label}>{s.label}</option>)}
                        </optgroup>
                    )}

                    {/* If Digital, could be either */}
                    {/* But splitting nicely is hard in select. Let's show both groups. */}
                    {type !== 'ANALOG' && (
                        <>
                            <optgroup label="Drive (Circuit Inputs)">
                                {availableSignals.inputs.map(s => <option key={s.id} value={s.label}>{s.label}</option>)}
                            </optgroup>
                            <optgroup label="Measure (Circuit Outputs)">
                                {availableSignals.outputs.map(s => <option key={s.id} value={s.label}>{s.label}</option>)}
                            </optgroup>
                        </>
                    )}
                </select>

                {/* Controls / Value */}
                <div className="w-24 flex justify-end gap-2 items-center">
                    {/* Output Controls (Drive Circuit) */}
                    {isDrivingCircuit && (
                        <>
                            {isPWM ? (
                                <input
                                    type="range" min="0" max="1" step="0.1"
                                    className="w-16 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                                    onChange={(e) => onSetPinOutput(pin, parseFloat(e.target.value))}
                                    aria-label={`PWM Control for ${pin}`}
                                />
                            ) : (
                                <button
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${pinValues[pin] ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-400'}`}
                                    onClick={() => onSetPinOutput(pin, pinValues[pin] ? 0 : 1)}
                                >
                                    {pinValues[pin] ? 'HIGH' : 'LOW'}
                                </button>
                            )}
                        </>
                    )}

                    {/* Readout (Measure Circuit) */}
                    {!isDrivingCircuit && (
                        <span className="font-mono text-cyan-300">{displayVal}</span>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="flex w-full h-full bg-gray-950 gap-px">
            {/* Left Panel: Channels */}
            <div className="w-1/2 flex flex-col border-r border-gray-800 bg-gray-900/30">
                <div className="p-3 border-b border-gray-800 flex justify-between items-center">
                    <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider">IO Channels</h2>
                    <div className="text-[10px] bg-green-900/30 text-green-400 px-2 py-1 rounded border border-green-900/50 flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        Device Active
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-4">
                    <div>
                        <div className="text-[10px] font-bold text-gray-500 mb-2 uppercase px-1">Analog Inputs (Measure)</div>
                        <div className="space-y-1">
                            {ANALOG_PINS.map(pin => renderPinRow(pin, 'ANALOG'))}
                        </div>
                    </div>

                    <div>
                        <div className="text-[10px] font-bold text-gray-500 mb-2 uppercase px-1">Digital I/O</div>
                        <div className="space-y-1">
                            {DIGITAL_PINS.map(pin => renderPinRow(pin, 'DIGITAL'))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Panel: Instrument */}
            <div className="w-1/2 flex flex-col bg-black">
                {/* Plot Area */}
                <div className="flex-1 p-4 relative overflow-hidden flex flex-col">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h3 className="text-gray-400 text-xs font-bold uppercase">Live Signal Plot</h3>
                            <div className="text-cyan-400 font-mono text-sm">
                                {selectedPlotPin ? `${selectedPlotPin} → ${pinToSignalMap[selectedPlotPin] || 'Unmapped'}` : 'No Channel Selected'}
                            </div>
                        </div>
                        <button
                            onClick={onCaptureSnapshot}
                            className="bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs px-3 py-1.5 rounded border border-gray-600 flex items-center gap-2 transition-colors"
                        >
                            <div className="w-2 h-2 bg-red-500 rounded-full" />
                            Capture Snapshot
                        </button>
                    </div>

                    {/* SVG Chart */}
                    <div className="flex-1 border border-gray-800 rounded bg-gray-900/50 relative">
                        {selectedPlotPin && plotHistory.length > 1 ? (
                            <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                                {/* Grid Lines */}
                                <line x1="0" y1="50%" x2="100%" y2="50%" stroke="#333" strokeDasharray="4 4" />

                                <polyline
                                    points={plotHistory.map((val, i) => {
                                        const x = (i / 49) * 100 + '%';
                                        const y = (1 - val) * 100 + '%'; // Assuming normalized 0-1 range for bool/PWM
                                        return `${x},${y}`;
                                    }).join(' ')}
                                    fill="none"
                                    stroke="#06b6d4"
                                    strokeWidth="2"
                                    vectorEffect="non-scaling-stroke"
                                />
                            </svg>
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-gray-700 text-xs text-center p-8">
                                Select a channel on the left to confirm data stream.
                            </div>
                        )}
                    </div>

                    {/* Legend / Stats */}
                    <div className="mt-4 flex gap-4 text-xs font-mono text-gray-500">
                        <div>SAMPLES: {plotHistory.length}</div>
                        <div>RATE: SIM_TICK</div>
                    </div>
                </div>

                {/* Console Log / Events (Stub) */}
                <div className="h-32 border-t border-gray-800 p-2 font-mono text-[10px] text-gray-400 overflow-y-auto">
                    <div className="text-gray-600 mb-1">EVENT LOG</div>
                    <div>&gt; Instrument initialized (Virtual)</div>
                    {pinToSignalMap['D13'] && <div>&gt; D13 mapped to {pinToSignalMap['D13']}</div>}
                </div>
            </div>
        </div>
    );
};
