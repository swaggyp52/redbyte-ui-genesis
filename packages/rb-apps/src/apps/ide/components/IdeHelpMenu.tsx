import React from 'react';
import { createPortal } from 'react-dom';
import type { IdeBuildIdentity } from '../buildIdentity';

export interface IdeHelpMenuProps {
  buildIdentity?: IdeBuildIdentity;
  onKeyboardShortcuts?: () => void;
}

type HelpPanel = 'about' | 'diagnostics' | null;

export const IdeHelpMenu: React.FC<IdeHelpMenuProps> = ({
  buildIdentity,
  onKeyboardShortcuts,
}) => {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [panel, setPanel] = React.useState<HelpPanel>(null);
  const portalHost = typeof document === 'undefined'
    ? null
    : document.querySelector('.ide-root') ?? document.body;

  React.useEffect(() => {
    if (!menuOpen && panel === null) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMenuOpen(false);
      setPanel(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen, panel]);

  return (
    <div className="ide-help-menu" data-testid="ide-help-menu">
      <button
        type="button"
        className="ide-topbar-help-btn"
        onClick={() => setMenuOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={menuOpen ? 'true' : 'false'}
        title="Help"
        data-testid="ide-topbar-help-btn"
      >
        Help
      </button>
      {menuOpen && portalHost ? createPortal(
        <div className="ide-help-menu-popover" role="menu" data-testid="ide-help-menu-popover">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              setPanel('about');
            }}
            data-testid="ide-help-about"
          >
            About RedByte
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              setPanel('diagnostics');
            }}
            data-testid="ide-help-diagnostics"
          >
            Diagnostics
          </button>
          {onKeyboardShortcuts ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onKeyboardShortcuts();
              }}
              data-testid="ide-help-keyboard"
            >
              Keyboard shortcuts
            </button>
          ) : null}
        </div>,
        portalHost
      ) : null}
      {panel && portalHost ? createPortal(
        <HelpDialog
          panel={panel}
          buildIdentity={buildIdentity}
          onClose={() => setPanel(null)}
        />,
        portalHost
      ) : null}
    </div>
  );
};

const HelpDialog: React.FC<{
  panel: Exclude<HelpPanel, null>;
  buildIdentity?: IdeBuildIdentity;
  onClose: () => void;
}> = ({ panel, buildIdentity, onClose }) => (
  <div className="ide-help-dialog-backdrop" role="presentation">
    <section
      className="ide-help-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`ide-help-dialog-${panel}-title`}
      data-testid={panel === 'about' ? 'ide-about-dialog' : 'ide-diagnostics-dialog'}
    >
      <header className="ide-help-dialog-header">
        <div>
          <span className="ide-help-dialog-kicker">Help</span>
          <h2 id={`ide-help-dialog-${panel}-title`}>
            {panel === 'about' ? 'About RedByte' : 'Diagnostics'}
          </h2>
        </div>
        <button
          type="button"
          className="ide-help-dialog-close"
          onClick={onClose}
          aria-label="Close help dialog"
          data-testid="ide-help-dialog-close"
        >
          Close
        </button>
      </header>
      {panel === 'about' ? (
        <div className="ide-help-dialog-body">
          <p>
            RedByte is a browser workspace for building, checking, mapping, and exporting
            classroom FPGA labs.
          </p>
          <p>
            The app can generate project files and keep the workflow state organized. Vivado
            build logs, board programming, and physical board observations are recorded outside
            this browser workspace.
          </p>
        </div>
      ) : (
        <div className="ide-help-dialog-body ide-diagnostics-grid">
          <DiagnosticRow label="Build fingerprint" value={buildIdentity?.fullSha ?? 'dev'} />
          <DiagnosticRow label="Environment" value={buildIdentity?.envLabel ?? 'dev'} />
          <DiagnosticRow label="Built" value={buildIdentity?.buildDate ?? 'local session'} />
          <DiagnosticRow
            label="Evidence boundary"
            value="Browser package generation only; external build and board records are separate."
          />
        </div>
      )}
    </section>
  </div>
);

const DiagnosticRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="ide-diagnostics-row">
    <span>{label}</span>
    <code>{value}</code>
  </div>
);
