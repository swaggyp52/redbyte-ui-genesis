import React from 'react';
import styles from './EmptyStateCard.module.css';

interface EmptyStateCardProps {
  headline: string;
  description: string;
  primaryLabel: string;
  onPrimaryClick: () => void;
  secondaryLabel?: string;
  onSecondaryClick?: () => void;
  className?: string;
  testId?: string;
}

export const EmptyStateCard: React.FC<EmptyStateCardProps> = ({
  headline,
  description,
  primaryLabel,
  onPrimaryClick,
  secondaryLabel,
  onSecondaryClick,
  className,
  testId,
}) => {
  return (
    <div className={[styles.card, className ?? ''].filter(Boolean).join(' ')} data-testid={testId}>
      <div className={styles.inner}>
        <h3 className={styles.headline}>{headline}</h3>
        <p className={styles.description}>{description}</p>
        <div className={styles.actions}>
          <button type="button" className={styles.primaryButton} onClick={onPrimaryClick}>
            {primaryLabel}
          </button>
          {secondaryLabel ? (
            onSecondaryClick ? (
              <button type="button" className={styles.secondaryButton} onClick={onSecondaryClick}>
                {secondaryLabel}
              </button>
            ) : (
              <span className={styles.secondaryText}>{secondaryLabel}</span>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
};
