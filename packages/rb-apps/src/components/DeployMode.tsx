
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLabEngineStore } from '@redbyte/rb-lab-engine';
import { Basys3BoardView } from './boards/Basys3BoardView';
import { ArduinoInstrument } from './boards/ArduinoInstrument';
import { loadBoardProfile } from '@redbyte/rb-board-profiles';
import { getSignalValue, getAvailableSignals } from '@redbyte/rb-lab-engine/signals/signalSemantics';

export const DeployMode: React.FC = () => {
  const { project, dispatch } = useLabEngineStore();

  // Local UI state
  const [inspectorLed, setInspectorLed] = useState<number | null>(null);

  // 1. Ensure Profile Exists (Default to Basys3 if empty)
  useEffect(() => {
    if (!project) return;
    if (!project.boardMap?.boardProfileId) {
      dispatch({
        v: 1,
        t: 'board/setProfile',
        p: { profileId: 'basys3' },
      });
    }
  }, [project?.boardMap?.boardProfileId, dispatch]);

  // 2. Tick Policy
  useEffect(() => {
    if (project) {
      dispatch({ v: 1, t: 'sim/tick', p: { count: 1 } });
    }
  }, []);

  useEffect(() => {
    if (project && project.boardMap?.signalToPinMap) {
      dispatch({ v: 1, t: 'sim/tick', p: { count: 1 } });
    }
  }, [project?.boardMap?.signalToPinMap, dispatch]);


  // 3. Data Extraction & Logic
  const boardId = project?.boardMap?.boardProfileId || 'basys3';

  // Basys3 Specifics
  const signalToPinMap = useMemo(() => project?.boardMap?.signalToPinMap ?? {}, [project?.boardMap?.signalToPinMap]);
  const switchesIO = useMemo(() => project?.boardMap?.virtualIOState?.switches ?? Array(16).fill(false), [project?.boardMap?.virtualIOState?.switches]);
  const buttons = useMemo(() => {
    const arr = project?.boardMap?.virtualIOState?.buttons ?? Array(5).fill(false);
    return {
      BTNC: arr[0], BTNU: arr[1], BTNL: arr[2], BTNR: arr[3], BTND: arr[4]
    };
  }, [project?.boardMap?.virtualIOState?.buttons]);

  // Mapped Logic (Basys3)
  const basys3Mapped = useMemo(() => {
    const sw: Record<number, string> = {};
    const ld: Record<number, string> = {};
    Object.entries(signalToPinMap as Record<string, string>).forEach(([signal, pin]) => {
      if (pin.startsWith('SW')) {
        const idx = parseInt(pin.replace('SW', ''));
        if (!isNaN(idx)) sw[idx] = signal;
      } else if (pin.startsWith('LD')) {
        const idx = parseInt(pin.replace('LD', ''));
        if (!isNaN(idx)) ld[idx] = signal;
      }
    });
    return { switches: sw, leds: ld, buttons: {} };
  }, [signalToPinMap]);

  // LED States (Basys3)
  const leds = useMemo(() => {
    const states = Array(16).fill(false);
    if (!project) return states;
    Object.entries(basys3Mapped.leds).forEach(([idxStr, signal]) => {
      const idx = parseInt(idxStr);
      const val = getSignalValue(project, signal);
      if (val !== undefined) states[idx] = val;
    });
    return states;
  }, [project, basys3Mapped.leds]);

  // Arduino Specifics: Pin Values
  // We need to resolve all mapped pins to their signal values for the instrument
  const arduinoPinValues = useMemo(() => {
    const values: Record<string, number | boolean> = {};
    if (boardId === 'arduino') {
      Object.entries(signalToPinMap as Record<string, string>).forEach(([signal, pin]) => {
        const val = getSignalValue(project, signal);
        if (val !== undefined) values[pin] = val;
      });
    }
    return values;
  }, [project, boardId, signalToPinMap]);


  // 7. Filter Signals
  const availableSignals = useMemo(() => {
    return getAvailableSignals(project);
  }, [project?.circuit.nodes]);


  // --- Actions ---

  const handleSetProfile = (id: string) => {
    dispatch({ v: 1, t: 'board/setProfile', p: { profileId: id } });
  };

  const handleToggleSwitch = (index: number) => {
    const newSwitches = [...switchesIO];
    newSwitches[index] = !newSwitches[index];
    dispatch({ v: 1, t: 'board/setSwitches', p: { switches: newSwitches } });
    dispatch({ v: 1, t: 'sim/tick', p: { count: 1 } });
  };

  const handlePressButton = (id: string, down: boolean) => { }; // TODO

  const handleMapSignal = (signal: string, pin: string) => {
    dispatch({ v: 1, t: 'board/mapSignal', p: { signal, pin } });
  };

  // Arduino: Set Output (Drive Circuit)
  const handleSetPinOutput = (pin: string, value: number | boolean) => {
    // This requires virtual IO support for generic pins in the reducer? 
    // For now, Basys3 reducer uses specific 'switches' array. 
    // Arduino might need a generic 'io' record or we map D-pins to switches array?
    // Reuse Switches Array for Arduino Digital Pins?
    // D0-D13 -> Switches 0-13?
    // Hacky but works for v1 if documented.

    // Let's assume D0-D15 maps to Switches 0-15 for storage simplification in MVP
    if (pin.startsWith('D')) {
      const idx = parseInt(pin.slice(1));
      if (!isNaN(idx) && idx < 16) {
        const newSwitches = [...switchesIO];
        newSwitches[idx] = !!value; // Boolean force for now
        dispatch({ v: 1, t: 'board/setSwitches', p: { switches: newSwitches } });
        dispatch({ v: 1, t: 'sim/tick', p: { count: 1 } });
      }
    }
  };

  const handleCaptureSnapshot = () => {
    // Construct compliant EvidenceSnapshot
    const snapshot = {
      timestamp: new Date().toISOString(),
      tick: project.simulation.currentTick,
      probeValues: {}, // TODO: Capture probes if relevant
      circuitHash: 'PENDING', // Compute if necessary
      projectHash: 'PENDING',
      boardState: {
        leds: leds.map(l => !!l),
        switches: switchesIO.map(s => !!s),
        pinValues: boardId === 'arduino' ? arduinoPinValues : undefined
      }
    };
    dispatch({ v: 1, t: 'evidence/addSnapshot', p: snapshot });
  };


  if (!project) return <div>Loading...</div>;

  const currentInspectorValue = inspectorLed !== null ? getSignalValue(project, basys3Mapped.leds[inspectorLed] ?? '') : undefined;

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-200">
      {/* Header: Board Selector */}
      <div className="h-12 border-b border-gray-800 bg-gray-900 flex items-center px-4 justify-between shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="font-bold text-sm tracking-wide text-gray-400 uppercase">Deploy Target</h2>
          <select
            className="bg-black border border-gray-600 rounded text-gray-200 text-xs px-2 py-1"
            value={boardId}
            onChange={(e) => handleSetProfile(e.target.value)}
            aria-label="Select Board Profile"
          >
            <option value="basys3">Basys3 (FPGA)</option>
            <option value="arduino">Arduino Uno (MCU)</option>
          </select>
        </div>
        <div>
          {/* Global Status / Sim State */}
          <span className="text-xs text-green-500 font-mono">SIMULATION ACTIVE</span>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 min-h-0 relative">
        {boardId === 'basys3' ? (
          <div className="flex h-full">
            {/* Basys3 Mapping Panel */}
            <div className="w-80 flex flex-col border-r border-gray-800 bg-gray-900 shrink-0">
              <div className="p-4 border-b border-gray-800">
                <h2 className="font-bold text-sm tracking-wide text-gray-400 uppercase">IO Mapping</h2>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-4">
                {/* (Reusing previous Basys3 mapping UI code logic) */}
                {/* Outputs -> LEDs */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-gray-500 uppercase px-2 mb-1 flex items-center justify-between">
                    <span>Circuit Signals</span>
                    <span className="text-gray-600">→ Board LEDs</span>
                  </div>
                  {availableSignals.outputs.filter(n => n.label || n.type === 'LED' || n.type === 'OUTPUT').map(sig => {
                    const mappedPin = signalToPinMap[sig.label];
                    return (
                      <div key={sig.id} className="flex items-center justify-between text-xs bg-gray-800 p-2 rounded border border-gray-700 hover:border-gray-600 transition-colors">
                        <div className="font-mono text-blue-300 truncate max-w-[100px]" title={sig.label}>{sig.label}</div>
                        <div className="text-gray-500">→</div>
                        <select
                          className={`bg-black border rounded text-gray-300 w-24 text-[10px] focus:ring-1 focus:ring-blue-500 outline-none ${mappedPin ? 'border-blue-500/50' : 'border-gray-600'}`}
                          value={mappedPin || ''}
                          onChange={(e) => handleMapSignal(sig.label, e.target.value)}
                        >
                          <option value="">(Unmapped)</option>
                          <optgroup label="LEDs">
                            {Array.from({ length: 16 }).map((_, i) => (
                              <option key={`LD${i}`} value={`LD${i}`}>LD{i}</option>
                            ))}
                          </optgroup>
                        </select>
                      </div>
                    );
                  })}
                </div>

                <div className="h-px bg-gray-800 my-2" />

                {/* Inputs <- Switches */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-gray-500 uppercase px-2 mb-1 flex items-center justify-between">
                    <span>Circuit Inputs</span>
                    <span className="text-gray-600">← Board Switches</span>
                  </div>
                  {availableSignals.inputs.map(sig => {
                    const mappedPin = signalToPinMap[sig.label];
                    return (
                      <div key={sig.id} className="flex items-center justify-between text-xs bg-gray-800 p-2 rounded border border-gray-700 hover:border-gray-600 transition-colors">
                        <div className="font-mono text-green-300 truncate max-w-[100px]" title={sig.label}>{sig.label}</div>
                        <div className="text-gray-500">←</div>
                        <select
                          className={`bg-black border rounded text-gray-300 w-24 text-[10px] focus:ring-1 focus:ring-green-500 outline-none ${mappedPin ? 'border-green-500/50' : 'border-gray-600'}`}
                          value={mappedPin || ''}
                          onChange={(e) => handleMapSignal(sig.label, e.target.value)}
                        >
                          <option value="">(Unmapped)</option>
                          <optgroup label="Switches">
                            {Array.from({ length: 16 }).map((_, i) => (
                              <option key={`SW${i}`} value={`SW${i}`}>SW{i}</option>
                            ))}
                          </optgroup>
                        </select>
                      </div>
                    );
                  })}
                  {availableSignals.inputs.length === 0 && (
                    <div className="text-xs text-center text-gray-600 py-4 italic">
                      No Switch/Input components found.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Basys3 Instrument */}
            <div className="flex-1 flex flex-col relative bg-gray-950 overflow-hidden shadow-inner">
              <Basys3BoardView
                switches={switchesIO}
                leds={leds}
                buttons={buttons}
                mappedSignals={basys3Mapped}
                onToggleSwitch={handleToggleSwitch}
                onPressButton={handlePressButton}
                onInspectLED={(idx) => setInspectorLed(idx)}
              />
              {/* Inspector Overlay (Basys3) */}
              {inspectorLed !== null && (
                <div className="absolute top-6 right-6 bg-gray-900 border border-gray-700 p-4 rounded-lg shadow-2xl w-72 z-20 backdrop-blur-sm bg-gray-900/95">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-bold text-gray-200 text-sm">Signal Inspector</h3>
                    <button onClick={() => setInspectorLed(null)} className="text-gray-500 hover:text-white transition-colors">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 1l12 12M13 1l-12 12" /></svg>
                    </button>
                  </div>
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between border-b border-gray-800 pb-2">
                      <span className="text-gray-500 font-medium">PIN</span>
                      <span className="font-mono text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5 rounded">LD{inspectorLed}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-800 pb-2">
                      <span className="text-gray-500 font-medium">MAPPED SIGNAL</span>
                      <span className={`font-mono px-1.5 py-0.5 rounded ${basys3Mapped.leds[inspectorLed] ? 'text-blue-400 bg-blue-400/10' : 'text-gray-500 italic'}`}>
                        {basys3Mapped.leds[inspectorLed] || 'Unconnected'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-gray-500 font-medium">LOGIC STATE</span>
                      <span className={`font-bold px-2 py-1 rounded flex items-center gap-2 ${currentInspectorValue === true ? 'text-green-400 bg-green-900/30' :
                        currentInspectorValue === false ? 'text-gray-400 bg-gray-800' :
                          'text-amber-500 bg-amber-900/30'
                        }`}>
                        {currentInspectorValue === true ? (
                          <><span>HIGH</span> <span>(1)</span></>
                        ) : currentInspectorValue === false ? (
                          <><span>LOW</span> <span>(0)</span></>
                        ) : (
                          <><span>UNKNOWN</span> <span className="text-[10px] opacity-75">?</span></>
                        )}
                      </span>
                    </div>
                    {currentInspectorValue === undefined && basys3Mapped.leds[inspectorLed] && (
                      <div className="mt-2 text-[10px] text-amber-500/80 bg-amber-900/20 p-2 rounded">
                        Signal path unresolved. Ensure simulation is running and node has valid state.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Arduino View */
          <ArduinoInstrument
            signalToPinMap={signalToPinMap}
            availableSignals={availableSignals}
            pinValues={arduinoPinValues}
            onMapSignal={handleMapSignal}
            onSetPinOutput={handleSetPinOutput}
            onCaptureSnapshot={handleCaptureSnapshot}
          />
        )}
      </div>
    </div>
  );
};
