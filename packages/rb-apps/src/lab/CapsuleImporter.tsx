// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useCallback, useState } from 'react';
import { parseCapsuleFile } from '@redbyte/rb-logic-core/lab/CapsuleV1';
import type { CapsuleV1 } from '@redbyte/rb-logic-core/lab/CapsuleV1';

/**
 * Props for CapsuleImporter component
 */
export interface CapsuleImporterProps {
  /**
   * Callback when capsule is successfully imported
   */
  onImport: (capsule: CapsuleV1) => void;

  /**
   * Optional callback for errors
   */
  onError?: (error: string) => void;

  /**
   * Optional className for styling
   */
  className?: string;
}

/**
 * CapsuleImporter component
 *
 * Provides drag-drop zone and file input for student capsule imports.
 * Accepts .rbcapsule and .json files.
 *
 * Non-singleton: Multiple import windows can be open simultaneously.
 *
 * Usage:
 * ```tsx
 * <CapsuleImporter
 *   onImport={(capsule) => handleReplay(capsule)}
 *   onError={(err) => showAlert(err)}
 * />
 * ```
 */
export const CapsuleImporter: React.FC<CapsuleImporterProps> = ({
  onImport,
  onError,
  className,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  /**
   * Handle file processing (common logic for drop and input)
   */
  const handleFile = useCallback(
    async (file: File) => {
      setIsLoading(true);
      setMessage(null);

      try {
        const result = await parseCapsuleFile(file);

        if (result.valid && result.capsule) {
          setMessage({
            type: 'success',
            text: `Successfully imported capsule from ${result.capsule.studentName}`,
          });
          onImport(result.capsule);
        } else {
          const errorMsg = result.error || 'Unknown error during import';
          setMessage({
            type: 'error',
            text: errorMsg,
          });
          onError?.(errorMsg);
        }
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : 'Unknown error occurred';
        setMessage({
          type: 'error',
          text: errorMsg,
        });
        onError?.(errorMsg);
      } finally {
        setIsLoading(false);
      }
    },
    [onImport, onError]
  );

  /**
   * Handle drag over
   */
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  /**
   * Handle drag leave
   */
  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  /**
   * Handle drop
   */
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        const file = files[0];
        handleFile(file);
      }
    },
    [handleFile]
  );

  /**
   * Handle file input change
   */
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.currentTarget.files;
      if (files && files.length > 0) {
        const file = files[0];
        handleFile(file);
      }
    },
    [handleFile]
  );

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${isDragging ? '#4a9eff' : '#666'}`,
          borderRadius: '8px',
          padding: '32px',
          textAlign: 'center',
          cursor: 'pointer',
          backgroundColor: isDragging ? 'rgba(74, 158, 255, 0.1)' : 'transparent',
          transition: 'all 0.2s ease',
        }}
      >
        <div style={{ color: '#ccc', marginBottom: '8px' }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>📁</div>
          <p style={{ margin: 0, marginBottom: '4px' }}>
            {isLoading ? 'Loading...' : 'Drag & drop capsule file here'}
          </p>
          <p style={{ margin: 0, fontSize: '12px', color: '#999' }}>
            or click to browse
          </p>
        </div>

        {/* Hidden file input */}
        <input
          type="file"
          accept=".json,.rbcapsule"
          onChange={handleInputChange}
          disabled={isLoading}
          style={{
            position: 'absolute',
            opacity: 0,
            width: 0,
            height: 0,
          }}
          id="capsule-file-input"
        />
        <label
          htmlFor="capsule-file-input"
          style={{
            cursor: 'pointer',
            textDecoration: 'underline',
            color: '#4a9eff',
          }}
        >
          Browse files
        </label>
      </div>

      {/* Status Message */}
      {message && (
        <div
          style={{
            padding: '12px',
            borderRadius: '4px',
            backgroundColor:
              message.type === 'error' ? 'rgba(255, 0, 0, 0.1)' : 'rgba(0, 255, 0, 0.1)',
            color:
              message.type === 'error' ? '#ff6b6b' : '#51cf66',
            fontSize: '13px',
            lineHeight: '1.4',
          }}
        >
          {message.type === 'error' && '❌ '}
          {message.type === 'success' && '✅ '}
          {message.text}
        </div>
      )}

      {/* File format info */}
      <div
        style={{
          fontSize: '11px',
          color: '#666',
          lineHeight: '1.5',
        }}
      >
        <strong>Supported formats:</strong>
        <div>.rbcapsule (recommended) or .json</div>
        <strong style={{ display: 'block', marginTop: '4px' }}>Schema:</strong>
        <div>labId, version, studentName, timestamp, circuitSnapshot, checkpointResults</div>
      </div>
    </div>
  );
};

export default CapsuleImporter;
