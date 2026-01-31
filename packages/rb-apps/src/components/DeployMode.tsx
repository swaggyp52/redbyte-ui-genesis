// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Deploy Mode — Board Mapping + Virtual I/O
 *
 * Map circuit signals to board pins, toggle virtual switches, see LEDs.
 */

import React, { useState, useEffect } from 'react';
import { useLabEngineStore } from '@redbyte/rb-lab-engine';
import { loadBoardProfile, type BoardProfile } from '@redbyte/rb-board-profiles';

export const DeployMode: React.FC = () => {
  const { project, dispatch } = useLabEngineStore();
  const [boardProfile, setBoardProfile] = useState<BoardProfile | null>(null);

  // Load board profile
  useEffect(() => {
    if (project?.boardMap?.boardProfileId) {
      try {
        const profile = loadBoardProfile(project.boardMap.boardProfileId);
        setBoardProfile(profile);
      } catch (err) {
        console.error('Failed to load board profile:', err);
      }
    } else {
      // Default to basys3
      try {
        const profile = loadBoardProfile('basys3');
        setBoardProfile(profile);
        dispatch({
          v: 1,
          t: 'board/setProfile',
          p: { profileId: 'basys3' },
        });
      } catch (err) {
        console.error('Failed to load default board profile:', err);
      }
    }
  }, [project?.boardMap?.boardProfileId, dispatch]);

  if (!project || !boardProfile) {
    return (
      <div style={{ padding: 20 }}>
        Loading board profile...
      </div>
    );
  }

  const handleMapSignal = (signal: string, pin: string) => {
    dispatch({
      v: 1,
      t: 'board/mapSignal',
      p: { signal, pin },
    });
  };

  const handleToggleSwitch = (index: number) => {
    const currentSwitches = project.boardMap?.virtualIOState?.switches ?? Array(16).fill(false);
    const newSwitches = [...currentSwitches];
    newSwitches[index] = !newSwitches[index];

    dispatch({
      v: 1,
      t: 'board/setSwitches',
      p: { switches: newSwitches },
    });
  };

  const switches = project.boardMap?.virtualIOState?.switches ?? Array(16).fill(false);
  const signalToPinMap = project.boardMap?.signalToPinMap ?? {};

  // Extract potential signals from circuit (nodes with labels or specific types)
  const potentialSignals = project.circuit.nodes
    .filter((n) => n.label || n.type === 'SWITCH' || n.type === 'LED')
    .map((n) => n.label || n.id);

  return (
    <div style={{ padding: 20, height: '100%', overflow: 'auto' }}>
      <h2 style={{ marginTop: 0, fontSize: 16, fontWeight: 600 }}>Deploy Mode — Board Mapping</h2>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, marginBottom: 8, color: 'var(--rb-text-2, #a1a1aa)' }}>
          Board: <strong>{boardProfile.name}</strong> ({boardProfile.fpga})
        </div>
      </div>

      {/* Signal to Pin Mapping */}
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Signal → Pin Mapping</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
          {potentialSignals.map((signal) => (
            <div
              key={signal}
              style={{
                padding: 8,
                borderRadius: 4,
                border: '1px solid var(--rb-border, #333)',
                background: 'var(--rb-surface-2, #252538)',
                fontSize: 12,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{signal}</div>
              <select
                value={signalToPinMap[signal] ?? ''}
                onChange={(e) => handleMapSignal(signal, e.target.value)}
                style={{
                  width: '100%',
                  padding: 4,
                  borderRadius: 3,
                  border: '1px solid var(--rb-border, #333)',
                  background: 'var(--rb-surface-1, #1e1e2e)',
                  color: 'var(--rb-text, #e4e4e7)',
                  fontSize: 11,
                }}
              >
                <option value="">— Unmapped —</option>
                <optgroup label="Switches">
                  {boardProfile.components.switches.map((sw) => (
                    <option key={sw.id} value={sw.id}>
                      {sw.id} ({sw.pin})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="LEDs">
                  {boardProfile.components.leds.map((led) => (
                    <option key={led.id} value={led.id}>
                      {led.id} ({led.pin})
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Virtual Switches */}
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Virtual Switches</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {boardProfile.components.switches.slice(0, 8).map((sw, idx) => (
            <button
              key={sw.id}
              onClick={() => handleToggleSwitch(idx)}
              style={{
                padding: '12px 16px',
                borderRadius: 6,
                border: `2px solid ${switches[idx] ? 'var(--rb-accent, #3b82f6)' : 'var(--rb-border, #333)'}`,
                background: switches[idx] ? 'rgba(59, 130, 246, 0.2)' : 'var(--rb-surface-2, #252538)',
                color: 'var(--rb-text, #e4e4e7)',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {sw.id}
              <div style={{ fontSize: 10, fontWeight: 400, marginTop: 4, color: 'var(--rb-text-3, #71717a)' }}>
                {switches[idx] ? 'ON' : 'OFF'}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Virtual LEDs */}
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Virtual LEDs</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {boardProfile.components.leds.slice(0, 8).map((led, idx) => (
            <div
              key={led.id}
              style={{
                padding: '12px 16px',
                borderRadius: 6,
                border: '1px solid var(--rb-border, #333)',
                background: 'var(--rb-surface-2, #252538)',
                fontSize: 12,
                textAlign: 'center',
              }}
            >
              {led.id}
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: false ? '#22c55e' : '#333', // TODO: compute from circuit
                  margin: '6px auto',
                }}
              />
              <div style={{ fontSize: 10, color: 'var(--rb-text-3, #71717a)' }}>
                {false ? 'ON' : 'OFF'}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          marginTop: 20,
          padding: 12,
          borderRadius: 6,
          background: 'rgba(59, 130, 246, 0.1)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          fontSize: 12,
          color: 'var(--rb-text-2, #a1a1aa)',
        }}
      >
        <strong style={{ color: 'var(--rb-accent, #3b82f6)' }}>Note:</strong> LED state computation from circuit
        outputs deferred until full simulation integration.
      </div>
    </div>
  );
};
