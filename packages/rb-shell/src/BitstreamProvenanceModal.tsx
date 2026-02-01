// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import type { BitstreamProvenanceMetadata } from '@redbyte/rb-fpga-toolchain';

interface BitstreamProvenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  metadata: BitstreamProvenanceMetadata;
}

export function BitstreamProvenanceModal({ isOpen, onClose, metadata }: BitstreamProvenanceModalProps) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999,
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 8,
          padding: 24,
          maxWidth: 700,
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Bitstream Provenance</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 24,
              cursor: 'pointer',
              color: 'var(--color-text)',
              padding: 4,
            }}
          >
            ×
          </button>
        </div>

        <p style={{ marginBottom: 24, opacity: 0.7, fontSize: 14 }}>
          Cryptographic integrity proof for HDL and bitstream artifacts
        </p>

        {/* Project Info */}
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, opacity: 0.6, textTransform: 'uppercase' }}>
            Project
          </h3>
          <div style={{ display: 'grid', gap: 8, fontSize: 14 }}>
            <MetadataRow label="Name" value={metadata.projectName} />
            <MetadataRow label="Project ID" value={metadata.projectId} />
            <MetadataRow label="Timestamp" value={new Date(metadata.timestamp).toLocaleString()} />
            <MetadataRow label="Board Profile" value={metadata.boardProfile} />
          </div>
        </div>

        {/* Circuit Integrity */}
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, opacity: 0.6, textTransform: 'uppercase' }}>
            Circuit Integrity
          </h3>
          <div style={{ display: 'grid', gap: 8, fontSize: 14 }}>
            <MetadataRow label="Circuit Hash" value={metadata.circuitHash} mono />
            <MetadataRow label="Nodes" value={metadata.nodeCount.toString()} />
            <MetadataRow label="Connections" value={metadata.connectionCount.toString()} />
            {metadata.ioMappingHash && <MetadataRow label="IO Mapping Hash" value={metadata.ioMappingHash} mono />}
          </div>
        </div>

        {/* HDL Artifacts */}
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, opacity: 0.6, textTransform: 'uppercase' }}>
            HDL Artifacts
          </h3>
          <div style={{ display: 'grid', gap: 8, fontSize: 14 }}>
            <MetadataRow label="Verilog Hash" value={metadata.verilogHash} mono />
            <MetadataRow label="Verilog Lines" value={metadata.verilogLines.toString()} />
            {metadata.constraintsHash && (
              <MetadataRow label="Constraints Hash" value={metadata.constraintsHash} mono />
            )}
          </div>
        </div>

        {/* Bitstream */}
        {metadata.bitstreamHash && (
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, opacity: 0.6, textTransform: 'uppercase' }}>
              Bitstream
            </h3>
            <div style={{ display: 'grid', gap: 8, fontSize: 14 }}>
              <MetadataRow label="Bitstream Hash" value={metadata.bitstreamHash} mono />
              {metadata.bitstreamSize && (
                <MetadataRow label="Size" value={`${(metadata.bitstreamSize / 1024).toFixed(2)} KB`} />
              )}
            </div>
          </div>
        )}

        {/* Toolchain */}
        {metadata.toolchainVersion && (
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, opacity: 0.6, textTransform: 'uppercase' }}>
              Toolchain
            </h3>
            <div style={{ display: 'grid', gap: 8, fontSize: 14 }}>
              <MetadataRow label="Version" value={metadata.toolchainVersion} />
            </div>
          </div>
        )}

        {/* Warnings */}
        {(metadata.warnings.length > 0 || metadata.unsupportedNodes.length > 0) && (
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, opacity: 0.6, textTransform: 'uppercase' }}>
              Warnings
            </h3>
            {metadata.unsupportedNodes.length > 0 && (
              <div
                style={{
                  padding: 12,
                  backgroundColor: 'rgba(255, 165, 0, 0.1)',
                  borderLeft: '3px solid #ffa500',
                  marginBottom: 12,
                  fontSize: 13,
                }}
              >
                <strong>Unsupported nodes:</strong> {metadata.unsupportedNodes.join(', ')}
              </div>
            )}
            {metadata.warnings.map((warning, idx) => (
              <div
                key={idx}
                style={{
                  padding: 12,
                  backgroundColor: 'rgba(255, 165, 0, 0.1)',
                  borderLeft: '3px solid #ffa500',
                  marginBottom: 8,
                  fontSize: 13,
                }}
              >
                {warning}
              </div>
            ))}
          </div>
        )}

        <div
          style={{
            marginTop: 24,
            padding: 12,
            backgroundColor: 'rgba(0, 212, 255, 0.1)',
            borderRadius: 4,
            fontSize: 13,
          }}
        >
          <strong>Verification:</strong> All hashes are SHA-256 and deterministic. An instructor can verify this
          bitstream came from the exact circuit by re-hashing the source files.
        </div>
      </div>
    </div>
  );
}

function MetadataRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
      <span style={{ opacity: 0.7 }}>{label}:</span>
      <span
        style={{
          fontFamily: mono ? 'monospace' : 'inherit',
          fontSize: mono ? 12 : 14,
          wordBreak: 'break-all',
          textAlign: 'right',
        }}
      >
        {value}
      </span>
    </div>
  );
}
