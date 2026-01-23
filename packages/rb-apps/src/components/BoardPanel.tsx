// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * BoardPanel - Hardware board visualization with capabilities-driven layout
 *
 * Renders board-specific layouts when available (Basys3, Spartan-3E),
 * falls back to GenericIOGrid for unknown boards.
 */

import React from 'react';
import { useHardwareStore, type HardwareState } from '../stores/hardwareStore';
import { hardwareClient } from '../services/hardwareClient';
import { ConnectionStatusBadge } from './ConnectionStatusBadge';
import { GenericIOGrid } from './GenericIOGrid';

interface BoardPanelProps {
  className?: string;
}

// Helper: robust device ID extraction
// Handles inconsistencies between device.deviceId and device.id
const getDeviceKey = (d: any) => d.deviceId ?? d.id ?? '';


// Basys3-specific layout component
const Basys3Layout: React.FC<{
  ioSnapshot: HardwareState['ioSnapshot'];
  onSetOutput: (signal: string, value: number) => void;
}> = ({ ioSnapshot, onSetOutput }) => {
  // Parse SW value (16-bit)
  const swValue = ioSnapshot?.inputs.SW;
  const swBits = typeof swValue === 'string' ? swValue : (swValue ?? 0).toString(2).padStart(16, '0');

  // Parse BTN value (5-bit)
  const btnValue = ioSnapshot?.inputs.BTN;
  const btnBits = typeof btnValue === 'string' ? btnValue : (btnValue ?? 0).toString(2).padStart(5, '0');

  // Parse LED value (16-bit)
  const ledValue = ioSnapshot?.outputs.LED;
  const ledBits = typeof ledValue === 'string' ? ledValue : (ledValue ?? 0).toString(2).padStart(16, '0');

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Board visual representation */}
      <div className="relative bg-[#1a472a] rounded-lg p-4 border-2 border-gray-700">
        {/* Board title */}
        <div className="absolute top-2 left-2 text-xs font-bold text-white/60">
          BASYS3
        </div>

        <div className="flex justify-center gap-1 mb-6 mt-4">
          {ledBits.split('').map((bit: string, idx: number) => (
            <div
              key={`led-${15 - idx}`}
              className={`w-3 h-3 rounded-full transition-all duration-100 ${bit === '1'
                ? 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.8)]'
                : 'bg-gray-800 border border-gray-600'
                }`}
              title={`LD${15 - idx}: ${bit === '1' ? 'ON' : 'OFF'}`}
            />
          ))}
        </div>

        {/* Buttons (center, cross pattern) */}
        <div className="flex justify-center mb-6">
          <div className="grid grid-cols-3 gap-1 w-20">
            {/* BTNU */}
            <div className="col-start-2 flex justify-center">
              <div
                className={`w-4 h-4 rounded-full ${btnBits[1] === '1'
                  ? 'bg-yellow-400 border-2 border-yellow-300'
                  : 'bg-gray-700 border-2 border-gray-600'
                  }`}
                title={`BTNU: ${btnBits[1] === '1' ? 'PRESSED' : 'released'}`}
              />
            </div>
            {/* BTNL */}
            <div className="flex justify-center items-center">
              <div
                className={`w-4 h-4 rounded-full ${btnBits[2] === '1'
                  ? 'bg-yellow-400 border-2 border-yellow-300'
                  : 'bg-gray-700 border-2 border-gray-600'
                  }`}
                title={`BTNL: ${btnBits[2] === '1' ? 'PRESSED' : 'released'}`}
              />
            </div>
            {/* BTNC */}
            <div className="flex justify-center items-center">
              <div
                className={`w-5 h-5 rounded-full ${btnBits[0] === '1'
                  ? 'bg-red-400 border-2 border-red-300'
                  : 'bg-gray-700 border-2 border-gray-600'
                  }`}
                title={`BTNC: ${btnBits[0] === '1' ? 'PRESSED' : 'released'}`}
              />
            </div>
            {/* BTNR */}
            <div className="flex justify-center items-center">
              <div
                className={`w-4 h-4 rounded-full ${btnBits[3] === '1'
                  ? 'bg-yellow-400 border-2 border-yellow-300'
                  : 'bg-gray-700 border-2 border-gray-600'
                  }`}
                title={`BTNR: ${btnBits[3] === '1' ? 'PRESSED' : 'released'}`}
              />
            </div>
            {/* BTND */}
            <div className="col-start-2 flex justify-center">
              <div
                className={`w-4 h-4 rounded-full ${btnBits[4] === '1'
                  ? 'bg-yellow-400 border-2 border-yellow-300'
                  : 'bg-gray-700 border-2 border-gray-600'
                  }`}
                title={`BTND: ${btnBits[4] === '1' ? 'PRESSED' : 'released'}`}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-center gap-1">
          {swBits.split('').map((bit: string, idx: number) => (
            <div
              key={`sw-${15 - idx}`}
              className={`w-2 h-5 rounded-sm transition-all ${bit === '1'
                ? 'bg-cyan-500 border border-cyan-400'
                : 'bg-gray-700 border border-gray-600'
                }`}
              title={`SW${15 - idx}: ${bit === '1' ? 'ON' : 'OFF'}`}
            />
          ))}
        </div>

        {/* Switch labels */}
        <div className="flex justify-center gap-1 mt-1">
          {Array.from({ length: 16 }, (_, i) => (
            <span key={i} className="text-[8px] text-white/40 w-2 text-center">
              {15 - i}
            </span>
          ))}
        </div>
      </div>

      {/* Tick counter */}
      {ioSnapshot?.tick !== undefined && (
        <div className="text-center text-xs text-gray-500">
          TICK: <span className="font-mono text-cyan-400">{ioSnapshot.tick}</span>
        </div>
      )}
    </div>
  );
};

export const BoardPanel: React.FC<BoardPanelProps> = ({ className = '' }) => {
  const connectionState = useHardwareStore((s) => s.connectionState);
  const capabilities = useHardwareStore((s) => s.capabilities);
  const ioSnapshot = useHardwareStore((s) => s.ioSnapshot);
  const availableDevices = useHardwareStore((s) => s.availableDevices);
  const activeDevice = useHardwareStore((s) => s.activeDevice);
  const lastError = useHardwareStore((s) => s.lastError);
  const connect = useHardwareStore((s) => s.connect);
  const selectDevice = useHardwareStore((s) => s.selectDevice);
  const isRecording = useHardwareStore((s) => s.isRecording);

  // Handle output changes
  const handleSetOutput = async (signal: string, value: number) => {
    await hardwareClient.setOutputs({ [signal]: value });
  };

  // Handle device selection
  const handleSelectDevice = async (deviceId: string) => {
    await selectDevice(deviceId);
  };

  // Render board layout based on capabilities
  const renderBoardLayout = () => {
    if (!capabilities) {
      return (
        <div className="text-center text-gray-500 py-8">
          No device connected
        </div>
      );
    }

    // Use board-specific layout if available
    if (capabilities.boardId.toLowerCase() === 'basys3') {
      return <Basys3Layout ioSnapshot={ioSnapshot} onSetOutput={handleSetOutput} />;
    }

    // Explicit fallback: Spartan-3E and all other boards use GenericIOGrid
    return (
      <GenericIOGrid
        inputs={capabilities.inputs}
        outputs={capabilities.outputs}
        ioSnapshot={ioSnapshot}
        onSetOutput={handleSetOutput}
      />
    );
  };

  return (
    <div className={`flex flex-col h-full bg-gray-950 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-gray-200">Hardware</h2>
          <ConnectionStatusBadge state={connectionState} />
        </div>

        {/* Connect button */}
        {connectionState === 'disconnected' && (
          <button
            onClick={() => connect()}
            className="px-3 py-1 text-xs bg-cyan-600 hover:bg-cyan-500 text-white rounded transition-colors"
          >
            Connect
          </button>
        )}
      </div>

      {/* Error display */}
      {lastError && (
        <div className="px-3 py-2 bg-red-900/30 border-b border-red-800 text-xs text-red-400">
          {lastError}
        </div>
      )}

      {/* Device selector (when connected but no device selected) */}
      {connectionState === 'ready' && !activeDevice && availableDevices.length > 0 && (
        <div className="p-3 border-b border-gray-800">
          <label className="text-xs text-gray-400 block mb-2">Select Device:</label>
          <div className="flex flex-col gap-2">
            {availableDevices.map((device) => {
              const id = getDeviceKey(device);
              return (
                <button
                  key={id}
                  onClick={() => handleSelectDevice(id)}
                  className="px-3 py-2 text-left text-sm bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 transition-colors"
                >
                  <div className="text-gray-200">{device.boardModel || 'Unknown Device'}</div>
                  <div className="text-xs text-gray-500">
                    {device.serial || id}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Board info */}
      {capabilities && (
        <div className="px-3 py-2 border-b border-gray-800 text-xs text-gray-500">
          <span className="text-gray-300">{capabilities.boardName}</span>
          {capabilities.manufacturer && ` by ${capabilities.manufacturer}`}
        </div>
      )}

      {/* Board layout */}
      <div className="flex-1 overflow-auto">
        {renderBoardLayout()}
      </div>

      {/* Recording indicator */}
      {isRecording && (
        <div className="px-3 py-2 bg-red-900/30 border-t border-red-800 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs text-red-400">Recording trace...</span>
        </div>
      )}
    </div>
  );
};

export default BoardPanel;
