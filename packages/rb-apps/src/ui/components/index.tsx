import React from 'react';

type ButtonTone = 'primary' | 'secondary' | 'danger';

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: ButtonTone }> = ({
  tone = 'primary',
  style,
  children,
  ...rest
}) => {
  const toneStyle: React.CSSProperties =
    tone === 'danger'
      ? {
          background: 'color-mix(in srgb, var(--rb-ui-lab-danger) 18%, var(--rb-ui-lab-bg-elevated))',
          borderColor: 'color-mix(in srgb, var(--rb-ui-lab-danger) 55%, var(--rb-ui-lab-border))',
          color: 'var(--rb-ui-lab-text)',
        }
      : tone === 'secondary'
        ? {
            background: 'var(--rb-ui-lab-bg-elevated)',
            borderColor: 'var(--rb-ui-lab-border)',
            color: 'var(--rb-ui-lab-text-muted)',
          }
        : {
            background: 'var(--rb-ui-lab-accent-soft)',
            borderColor: 'var(--rb-ui-lab-border-strong)',
            color: 'var(--rb-ui-lab-text)',
          };

  return (
    <button
      type="button"
      {...rest}
      style={{
        border: '1px solid var(--rb-ui-lab-border)',
        borderRadius: '10px',
        padding: '8px 12px',
        fontSize: '12px',
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        transition: 'transform var(--rb-ui-lab-fast) var(--rb-ui-lab-ease)',
        ...toneStyle,
        ...(typeof style === 'object' ? style : {}),
      }}
    >
      {children}
    </button>
  );
};

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, style, ...rest }) => (
  <div
    {...rest}
    style={{
      border: '1px solid var(--rb-ui-lab-border)',
      borderRadius: '12px',
      background: 'var(--rb-ui-lab-bg-surface)',
      boxShadow: 'var(--rb-ui-lab-shadow-soft)',
      ...((style as React.CSSProperties) ?? {}),
    }}
  >
    {children}
  </div>
);

export const Badge: React.FC<React.HTMLAttributes<HTMLSpanElement>> = ({ children, style, ...rest }) => (
  <span
    {...rest}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      border: '1px solid var(--rb-ui-lab-border)',
      borderRadius: '999px',
      padding: '2px 8px',
      fontSize: '11px',
      fontWeight: 700,
      ...((style as React.CSSProperties) ?? {}),
    }}
  >
    {children}
  </span>
);

export const Pill = Badge;

export const Divider: React.FC = () => <hr style={{ border: 0, borderTop: '1px solid var(--rb-ui-lab-border)', margin: '10px 0' }} />;

export const SectionHeader: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => (
  <div>
    <h3 style={{ margin: 0, fontSize: '14px', color: 'var(--rb-ui-lab-text)' }}>{title}</h3>
    {subtitle ? <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--rb-ui-lab-text-muted)' }}>{subtitle}</p> : null}
  </div>
);

export const ProgressRail: React.FC<{ steps: Array<{ label: string; state: 'done' | 'current' | 'todo' }> }> = ({ steps }) => (
  <ol style={{ display: 'grid', gap: 6, margin: 0, padding: 0, listStyle: 'none' }}>
    {steps.map((step) => (
      <li
        key={step.label}
        style={{
          border: '1px solid var(--rb-ui-lab-border)',
          borderRadius: 10,
          padding: '6px 10px',
          background:
            step.state === 'current'
              ? 'color-mix(in srgb, var(--rb-ui-lab-accent) 14%, var(--rb-ui-lab-bg-surface))'
              : 'var(--rb-ui-lab-bg-surface)',
          color: step.state === 'todo' ? 'var(--rb-ui-lab-text-muted)' : 'var(--rb-ui-lab-text)',
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        {step.label}
      </li>
    ))}
  </ol>
);

export const Callout: React.FC<{ tone: 'info' | 'warn' | 'error' | 'success'; children: React.ReactNode }> = ({ tone, children }) => {
  const toneColor =
    tone === 'error'
      ? 'var(--rb-ui-lab-danger)'
      : tone === 'warn'
        ? 'var(--rb-ui-lab-warning)'
        : tone === 'success'
          ? 'var(--rb-ui-lab-success)'
          : 'var(--rb-ui-lab-info)';
  return (
    <div
      role="status"
      style={{
        border: `1px solid color-mix(in srgb, ${toneColor} 55%, var(--rb-ui-lab-border))`,
        background: `color-mix(in srgb, ${toneColor} 12%, var(--rb-ui-lab-bg-elevated))`,
        borderRadius: 10,
        padding: '8px 10px',
        fontSize: 12,
        color: 'var(--rb-ui-lab-text)',
      }}
    >
      {children}
    </div>
  );
};

export const Skeleton: React.FC<{ width?: string; height?: string }> = ({ width = '100%', height = '14px' }) => (
  <div
    aria-hidden="true"
    style={{
      width,
      height,
      borderRadius: 8,
      background: 'linear-gradient(90deg, var(--rb-ui-lab-bg-elevated) 0%, color-mix(in srgb, var(--rb-ui-lab-accent) 12%, var(--rb-ui-lab-bg-elevated)) 50%, var(--rb-ui-lab-bg-elevated) 100%)',
      backgroundSize: '200% 100%',
      animation: 'rbLabSkeleton 1.2s var(--rb-ui-lab-ease) infinite',
    }}
  />
);

export const Toast: React.FC<{ message: string; tone?: 'info' | 'warn' | 'error' | 'success' }> = ({ message, tone = 'info' }) => (
  <Callout tone={tone}>
    {message}
  </Callout>
);
