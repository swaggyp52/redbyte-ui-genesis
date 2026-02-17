// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * LabSelectorModal — Template browser overlay.
 *
 * Triggered by the "Labs" button in IDEModeNav.
 * Labs are circuit templates that load INTO the IDE workspace.
 * No course language, no progress tracking, no gamification.
 */

import React, { useEffect, useCallback } from 'react';
import { LAB_CATALOG, type LabDefinition } from '../labs/labCatalog';
import styles from './LabSelectorModal.module.css';

interface LabSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLab: (lab: LabDefinition) => void;
}

const LabCard: React.FC<{ lab: LabDefinition; onSelect: () => void }> = ({ lab, onSelect }) => (
  <div className={styles.card}>
    <div className={styles.cardHeader}>
      <span className={styles.labNum}>{lab.number}</span>
      <span className={styles.timeChip}>{lab.timeEstimate}</span>
    </div>
    <h3 className={styles.cardTitle}>{lab.title}</h3>
    <p className={styles.cardDesc}>{lab.description}</p>
    <div className={styles.tags}>
      {lab.tags.map((tag) => (
        <span key={tag} className={styles.tag}>{tag}</span>
      ))}
    </div>
    <button
      type="button"
      className={styles.loadBtn}
      onClick={onSelect}
    >
      Load Template
      <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
        <path d="M2 5.5h7M6 2.5l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  </div>
);

export const LabSelectorModal: React.FC<LabSelectorModalProps> = ({
  isOpen,
  onClose,
  onSelectLab,
}) => {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, handleEscape]);

  if (!isOpen) return null;

  return (
    <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true" aria-label="Lab template selector">
      <div
        className={styles.panel}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.headerChip}>LOAD TEMPLATE</span>
            <span className={styles.headerSub}>Templates load into your current workspace</span>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Lab grid */}
        <div className={styles.grid}>
          {LAB_CATALOG.map((lab) => (
            <LabCard
              key={lab.id}
              lab={lab}
              onSelect={() => onSelectLab(lab)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
