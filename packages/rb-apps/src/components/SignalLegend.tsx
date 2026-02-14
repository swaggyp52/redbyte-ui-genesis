import React from 'react';
import styles from './SignalLegend.module.css';

export interface SignalLegendProps {
  title?: string;
  hint?: string;
  showExpectedVsActual?: boolean;
  showDebounce?: boolean;
  compact?: boolean;
  collapsible?: boolean;
  defaultOpen?: boolean;
  testId?: string;
}

const BASE_ITEMS = [
  { key: 'high', icon: '1', label: 'HIGH', note: 'Logical high / asserted' },
  { key: 'low', icon: '0', label: 'LOW', note: 'Logical low / deasserted' },
  { key: 'rise', icon: '↗', label: 'Rising edge', note: 'Clock low → high' },
  { key: 'fall', icon: '↘', label: 'Falling edge', note: 'Clock high → low' },
  { key: 'x', icon: 'X', label: 'Undefined (X)', note: 'Unknown / conflict state' },
  { key: 'z', icon: 'Z', label: 'Tri-state (Z)', note: 'High impedance / not driven' },
] as const;

export const SignalLegend: React.FC<SignalLegendProps> = ({
  title = 'Signal Legend',
  hint,
  showExpectedVsActual = false,
  showDebounce = false,
  compact = false,
  collapsible = false,
  defaultOpen = true,
  testId,
}) => {
  const items = [
    ...BASE_ITEMS,
    ...(showDebounce ? [{ key: 'debounce', icon: '≈', label: 'Debounced', note: 'Input stabilized before read' }] : []),
    ...(showExpectedVsActual ? [{ key: 'compare', icon: '≟', label: 'Expected vs Actual', note: 'Compare sim and hardware outcomes' }] : []),
  ];

  const content = (
    <div className={styles.root} data-testid={testId}>
      <div className={styles.header}>
        <div className={styles.title}>{title}</div>
        {hint ? <div className={styles.hint}>{hint}</div> : null}
      </div>
      <div className={styles.grid}>
        {items.map((item) => (
          <div
            key={item.key}
            className={`${styles.item} ${item.key === 'compare' || item.key === 'debounce' ? styles.itemEmphasis : ''}`}
          >
            <span className={styles.icon}>{item.icon}</span>
            <div>
              <div className={styles.label}>{item.label}</div>
              {!compact ? <div className={styles.note}>{item.note}</div> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (!collapsible) return content;

  return (
    <details open={defaultOpen}>
      <summary className={styles.hint}>{title}</summary>
      <div style={{ marginTop: 6 }}>{content}</div>
    </details>
  );
};
