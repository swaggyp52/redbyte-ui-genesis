import React from 'react';
import styles from './StatusPill.module.css';

export type StatusPillTone =
  | 'build'
  | 'simulate'
  | 'hardware'
  | 'submit'
  | 'ready'
  | 'notReady'
  | 'running'
  | 'done'
  | 'error'
  | 'warning'
  | 'saved'
  | 'unsaved'
  | 'complete';

interface StatusPillProps extends React.HTMLAttributes<HTMLSpanElement> {
  label: string;
  tone?: StatusPillTone;
}

export const StatusPill: React.FC<StatusPillProps> = ({ label, tone = 'warning', className, ...rest }) => {
  const toneClass = styles[tone] ?? '';
  const mergedClassName = [styles.pill, toneClass, className].filter(Boolean).join(' ');

  return <span className={mergedClassName} {...rest}>{label}</span>;
};
