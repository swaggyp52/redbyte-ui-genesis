import React from 'react';

type ButtonTone = 'primary' | 'secondary' | 'ghost' | 'danger';

export const IdeCard: React.FC<{
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  testId?: string;
}> = ({ title, subtitle, children, testId }) => {
  return (
    <section className="ide-card" data-testid={testId}>
      {(title || subtitle) && (
        <header className="ide-card-header">
          {title && <h3 className="ide-card-title">{title}</h3>}
          {subtitle && <p className="ide-card-subtitle">{subtitle}</p>}
        </header>
      )}
      <div className="ide-card-body">{children}</div>
    </section>
  );
};

export const IdeGrid: React.FC<{
  columns?: 1 | 2 | 3;
  children: React.ReactNode;
  testId?: string;
}> = ({ columns = 2, children, testId }) => {
  return (
    <div className={`ide-grid ide-grid-${columns}`} data-testid={testId}>
      {children}
    </div>
  );
};

export const IdeSectionHeader: React.FC<{
  title: string;
  meta?: React.ReactNode;
  testId?: string;
}> = ({ title, meta, testId }) => {
  return (
    <header className="ide-section-header" data-testid={testId}>
      <h3>{title}</h3>
      {meta ? <span className="ide-section-header-meta">{meta}</span> : null}
    </header>
  );
};

export const IdePanel: React.FC<{
  title: string;
  description?: string;
  children: React.ReactNode;
  right?: React.ReactNode;
  actions?: React.ReactNode;
  testId?: string;
}> = ({ title, description, children, right, actions, testId }) => {
  return (
    <section className="ide-panel" data-testid={testId}>
      <header className="ide-panel-header" data-testid="ide-panel-title-row">
        <div className="ide-surface-header" data-testid="ide-surface-header">
          <div>
            <h2 className="ide-panel-title" data-testid="ide-surface-title">
              {title}
            </h2>
            {description && <p className="ide-panel-description">{description}</p>}
          </div>
          {right}
        </div>
      </header>
      <div className="ide-panel-actions" data-testid="ide-panel-action-row">
        <div className="ide-surface-actions" data-testid="ide-surface-actions">
          {actions}
        </div>
      </div>
      <div className="ide-panel-body">{children}</div>
    </section>
  );
};

export const IdeButton: React.FC<{
  tone?: ButtonTone;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  testId?: string;
  type?: 'button' | 'submit';
}> = ({ tone = 'secondary', children, onClick, disabled = false, testId, type = 'button' }) => {
  return (
    <button
      type={type}
      className={`ide-button ide-button-${tone}`}
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
    >
      {children}
    </button>
  );
};

export const IdeStatusPill: React.FC<{
  tone: 'idle' | 'ok' | 'warn' | 'error';
  children: React.ReactNode;
  testId?: string;
}> = ({ tone, children, testId }) => {
  return (
    <span className={`ide-status-pill ide-status-${tone}`} data-testid={testId}>
      {children}
    </span>
  );
};

export const IdeCallout: React.FC<{
  tone?: 'info' | 'warn' | 'error' | 'success';
  title?: string;
  children: React.ReactNode;
  testId?: string;
}> = ({ tone = 'info', title, children, testId }) => {
  return (
    <div className={`ide-callout ide-callout-${tone}`} data-testid={testId}>
      {title && <strong className="ide-callout-title">{title}</strong>}
      <div className="ide-callout-body">{children}</div>
    </div>
  );
};

export const IdeEmptyState: React.FC<{
  title: string;
  body: string;
  primaryAction: React.ReactNode;
  secondaryAction?: React.ReactNode;
  testId?: string;
}> = ({ title, body, primaryAction, secondaryAction, testId }) => {
  return (
    <div className="ide-empty-state" data-testid={testId}>
      <h3 className="ide-empty-title">{title}</h3>
      <p className="ide-empty-body">{body}</p>
      <div className="ide-empty-actions">
        {primaryAction}
        {secondaryAction}
      </div>
    </div>
  );
};

export const IdeInspectorSection: React.FC<{
  title: string;
  children: React.ReactNode;
  testId?: string;
}> = ({ title, children, testId }) => {
  return (
    <section className="ide-inspector-section" data-testid={testId}>
      <h4 className="ide-inspector-title">{title}</h4>
      <div className="ide-inspector-content">{children}</div>
    </section>
  );
};

export const IdeDataTable: React.FC<{
  columns: string[];
  rows: Array<Array<React.ReactNode>>;
  testId?: string;
}> = ({ columns, rows, testId }) => {
  return (
    <div className="ide-table-wrap" data-testid={testId}>
      <table className="ide-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? (
            rows.map((row, rowIndex) => (
              <tr key={`row-${rowIndex}`}>
                {row.map((cell, cellIndex) => (
                  <td key={`cell-${rowIndex}-${cellIndex}`}>{cell}</td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className="ide-table-empty">
                No rows
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
