import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-rb-surface border-t border-rb-border">
      <div className="content-container px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-6 h-6 bg-rb-accent rounded flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-rb-bg">
                  <path d="M3 3h4v4H3V3zm6 0h4v4H9V3zM3 9h4v4H3V9zm6 0h4v4H9V9z" fill="currentColor" />
                </svg>
              </div>
              <span className="font-semibold text-rb-text">RedByte</span>
            </div>
            <p className="text-sm text-rb-muted leading-relaxed max-w-sm">
              A browser-based environment for learning digital logic. Build circuits visually,
              simulate deterministically, debug with waveforms.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-rb-dim mb-4">Documentation</h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/getting-started" className="text-rb-muted hover:text-rb-text transition-colors">
                  Getting Started
                </Link>
              </li>
              <li>
                <Link to="/examples" className="text-rb-muted hover:text-rb-text transition-colors">
                  Examples
                </Link>
              </li>
              <li>
                <Link to="/manual" className="text-rb-muted hover:text-rb-text transition-colors">
                  Manual
                </Link>
              </li>
              <li>
                <Link to="/demo" className="text-rb-muted hover:text-rb-text transition-colors">
                  For Educators
                </Link>
              </li>
            </ul>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-rb-dim mb-4">Project</h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/about" className="text-rb-muted hover:text-rb-text transition-colors">
                  About
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/your-repo/redbyte"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-rb-muted hover:text-rb-text transition-colors"
                >
                  GitHub
                </a>
              </li>
              <li>
                <a
                  href="#download"
                  className="text-rb-muted hover:text-rb-text transition-colors"
                >
                  Download
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-6 border-t border-rb-border flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-rb-dim">
            Built by Connor Angiel
          </p>
          <p className="text-xs text-rb-dim">
            {new Date().getFullYear()} RedByte. Local-first, privacy-respecting.
          </p>
        </div>
      </div>
    </footer>
  );
}
