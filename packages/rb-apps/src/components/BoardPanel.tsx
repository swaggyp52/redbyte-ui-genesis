// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * BoardPanel - Photorealistic hardware board visualization
 *
 * Renders stunning, interactive FPGA board visualizations with
 * authentic PCB aesthetics. Supports Basys3, Spartan-3E, and
 * falls back to GenericIOGrid for unknown boards.
 */

import React from 'react';
import { useHardwareStore, type HardwareState } from '../stores/hardwareStore';
import { hardwareClient, type BoardCapabilities } from '../services/hardwareClient';
import { ConnectionStatusBadge } from './ConnectionStatusBadge';
import { GenericIOGrid } from './GenericIOGrid';
import { Basys3Board } from './boards/Basys3Board';
import { Spartan3EBoard } from './boards/Spartan3EBoard';

// Helper types for interaction
export type BoardInteractionHandler = (componentId: string, value: number) => void;

interface BoardPanelProps {
  className?: string;
  // Overrides for Simulation / Replay
  snapshot?: HardwareState['ioSnapshot'];
  capabilities?: BoardCapabilities | null;
  onInteraction?: BoardInteractionHandler;
  readOnly?: boolean;
  // Display mode
  compact?: boolean;
  // Execution source for proper UI state
  executionSource?: 'sim' | 'hardware' | 'replay';
}

// Helper: robust device ID extraction
const getDeviceKey = (d: any) => d.deviceId ?? d.id ?? '';

export const BoardPanel: React.FC<BoardPanelProps> = ({
  className = '',
  snapshot: propSnapshot,
  capabilities: propCapabilities,
  onInteraction,
  readOnly = false,
  compact = false,
  executionSource = 'sim',
}) => {
  const connectionState = useHardwareStore((s) => s.connectionState);
  const storeCapabilities = useHardwareStore((s) => s.capabilities);
  const capabilities = propCapabilities ?? storeCapabilities;

  const storeSnapshot = useHardwareStore((s) => s.ioSnapshot);
  const ioSnapshot = propSnapshot ?? storeSnapshot;

  const availableDevices = useHardwareStore((s) => s.availableDevices);
  const activeDevice = useHardwareStore((s) => s.activeDevice);
  const lastError = useHardwareStore((s) => s.lastError);
  const connect = useHardwareStore((s) => s.connect);
  const selectDevice = useHardwareStore((s) => s.selectDevice);
  const isRecording = useHardwareStore((s) => s.isRecording);

  const handleSetOutput = async (signal: string, value: number) => {
    await hardwareClient.setOutputs({ [signal]: value });
  };

  const handleSelectDevice = async (deviceId: string) => {
    await selectDevice(deviceId);
  };

  // Render board visualization based on capabilities
  const renderBoardLayout = () => {
    if (!capabilities) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div
              className="w-20 h-20 mx-auto mb-4 rounded-lg opacity-20"
              style={{
                background: 'linear-gradient(135deg, #1a3a2a 0%, #0a1a10 100%)',
                border: '2px dashed #2a4a3a',
              }}
            />
            <div className="text-sm text-gray-500 font-medium">No Board Connected</div>
            <div className="text-xs text-gray-600 mt-1">Connect hardware or select a simulation</div>
          </div>
        </div>
      );
    }

    const boardId = capabilities.boardId.toLowerCase();
    const scale = compact ? 0.8 : 1;

    // Basys3 - Photorealistic green PCB
    if (boardId === 'basys3' || boardId.includes('basys')) {
      return (
        <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
          <Basys3Board
            ioSnapshot={ioSnapshot}
            onInteraction={onInteraction}
            readOnly={readOnly}
            scale={scale}
          />
        </div>
      );
    }

    // Spartan-3E - Red PCB with LCD
    if (boardId === 'spartan3e-starter' || boardId.includes('spartan')) {
      return (
        <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
          <Spartan3EBoard
            ioSnapshot={ioSnapshot}
            onInteraction={onInteraction}
            readOnly={readOnly}
            scale={scale}
          />
        </div>
      );
    }

    // Generic fallback
    return (
      <div className="flex-1 overflow-auto p-4">
        <GenericIOGrid
          inputs={capabilities.inputs}
          outputs={capabilities.outputs}
          ioSnapshot={ioSnapshot}
          onSetOutput={handleSetOutput}
          readOnly={readOnly}
        />
      </div>
    );
  };

  return (
    <div
      className={`flex flex-col h-full ${className}`}
      style={{
        background: 'linear-gradient(180deg, #0a0f14 0%, #050810 100%)',
      }}
    >
      {/* Header with lab equipment styling */}
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{
          background: 'linear-gradient(180deg, #1a1f24 0%, #10151a 100%)',
          borderBottom: '1px solid #2a3540',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        }}
      >
        <div className="flex items-center gap-3">
          {/* Equipment badge */}
          <div
            className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider"
            style={{
              background: 'linear-gradient(180deg, #2a3a2a 0%, #1a2a1a 100%)',
              border: '1px solid #3a4a3a',
              color: '#8a9a8a',
            }}
          >
            FPGA DEV
          </div>
          <ConnectionStatusBadge state={connectionState} />
        </div>

        {/* Connect button — show when hardware source and disconnected */}
        {executionSource === 'hardware' && connectionState === 'disconnected' && (
          <button
            type="button"
            onClick={() => connect()}
            className="px-3 py-1 text-[10px] font-bold tracking-wider rounded transition-all"
            style={{
              background: 'linear-gradient(180deg, #1a4a3a 0%, #0a3a2a 100%)',
              border: '1px solid #2a5a4a',
              color: '#4ade80',
              boxShadow: '0 2px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
            }}
          >
            CONNECT
          </button>
        )}
        {/* Sim mode indicator */}
        {executionSource === 'sim' && (
          <span className="text-[9px] font-medium text-emerald-500/80 tracking-wide">
            SIM — click board to interact
          </span>
        )}
        {/* Replay mode indicator */}
        {executionSource === 'replay' && (
          <span className="text-[9px] font-medium text-amber-500/80 tracking-wide">
            REPLAY — use scrubber
          </span>
        )}
      </div>

      {/* Error display */}
      {lastError && (
        <div
          className="px-4 py-2 text-xs flex items-center gap-2"
          style={{
            background: 'linear-gradient(90deg, #3a1a1a 0%, #2a1010 100%)',
            borderBottom: '1px solid #4a2a2a',
          }}
        >
          <span className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-red-400">{lastError}</span>
        </div>
      )}

      {/* No devices found — show microcopy when hardware source */}
      {executionSource === 'hardware' && connectionState === 'ready' && availableDevices.length === 0 && (
        <div
          className="p-4"
          style={{
            background: 'rgba(0,0,0,0.3)',
            borderBottom: '1px solid #2a3540',
          }}
        >
          <div className="text-[10px] font-bold tracking-wider text-amber-500/80 mb-1">NO DEVICES FOUND</div>
          <div className="text-[9px] text-gray-500">
            Start bridge with <code className="text-cyan-400/80 bg-black/30 px-1 rounded">RB_FPGA_MOCK=1</code> for mock Basys3
          </div>
        </div>
      )}

      {/* Device selector */}
      {connectionState === 'ready' && !activeDevice && availableDevices.length > 0 && (
        <div
          className="p-4"
          style={{
            background: 'rgba(0,0,0,0.3)',
            borderBottom: '1px solid #2a3540',
          }}
        >
          <div className="text-[10px] font-bold tracking-wider text-gray-500 mb-2">SELECT DEVICE</div>
          <div className="flex flex-col gap-2">
            {availableDevices.map((device) => {
              const id = getDeviceKey(device);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleSelectDevice(id)}
                  className="px-3 py-2 text-left rounded transition-all hover:brightness-110"
                  style={{
                    background: 'linear-gradient(180deg, #1a2a1a 0%, #0a1a0a 100%)',
                    border: '1px solid #2a3a2a',
                  }}
                >
                  <div className="text-sm text-gray-200">{device.boardModel || 'Unknown'}</div>
                  <div className="text-[10px] text-gray-500 font-mono">{device.serial || id}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Board info badge */}
      {capabilities && (
        <div
          className="px-4 py-1.5 flex items-center justify-between text-[10px]"
          style={{
            background: 'rgba(0,0,0,0.2)',
            borderBottom: '1px solid #1a2530',
          }}
        >
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-300">{capabilities.boardName}</span>
            {capabilities.manufacturer && (
              <span className="text-gray-600">by {capabilities.manufacturer}</span>
            )}
          </div>
          {capabilities.clock && (
            <span className="font-mono text-gray-600">
              {(capabilities.clock.frequencyHz / 1e6).toFixed(0)}MHz
            </span>
          )}
        </div>
      )}

      {/* Board visualization area */}
      <div className="flex-1 overflow-hidden relative">
        {/* Ambient glow effect */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: capabilities
              ? 'radial-gradient(circle at 50% 50%, rgba(0,100,50,0.05) 0%, transparent 70%)'
              : 'none',
          }}
        />
        {renderBoardLayout()}
      </div>

      {/* Recording indicator */}
      {isRecording && (
        <div
          className="px-4 py-2 flex items-center gap-2"
          style={{
            background: 'linear-gradient(90deg, #3a1a1a 0%, #2a1010 100%)',
            borderTop: '1px solid #4a2a2a',
          }}
        >
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs text-red-400 font-medium">REC</span>
          <span className="text-[10px] text-red-400/60 font-mono">Recording trace...</span>
        </div>
      )}

      {/* Bottom status bar */}
      <div
        className="px-4 py-1 flex items-center justify-between text-[9px] font-mono"
        style={{
          background: '#050810',
          borderTop: '1px solid #1a2530',
        }}
      >
        <span className="text-gray-600">
          {connectionState === 'ready' ? 'ONLINE' : connectionState.toUpperCase()}
        </span>
        {ioSnapshot?.tick !== undefined && (
          <span className="text-cyan-600">T:{ioSnapshot.tick}</span>
        )}
      </div>
    </div>
  );
};

export default BoardPanel;
