import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/install', label: 'Install' },
  { to: '/getting-started', label: 'Getting Started' },
  { to: '/examples', label: 'Examples' },
  { to: '/guide', label: 'Guide' },
  { to: '/demo', label: 'For Educators' },
  { to: '/about', label: 'About' },
];

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <header className="sticky top-0 z-50 bg-rb-bg/95 backdrop-blur-sm border-b border-rb-border">
      <nav className="content-container px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 bg-rb-accent rounded flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-rb-bg">
                <path d="M3 3h4v4H3V3zm6 0h4v4H9V3zM3 9h4v4H3V9zm6 0h4v4H9V9z" fill="currentColor" />
              </svg>
            </div>
            <span className="text-lg font-semibold text-rb-text group-hover:text-rb-accent transition-colors">
              RedByte
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`px-3 py-2 text-sm rounded transition-colors ${
                  isActive(to)
                    ? 'text-rb-text bg-rb-surface'
                    : 'text-rb-muted hover:text-rb-text hover:bg-rb-surface/50'
                }`}
              >
                {label}
              </Link>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            <a
              href="https://github.com/swaggyp52/redbyte-ui-genesis"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-rb-muted hover:text-rb-text transition-colors"
              aria-label="GitHub repository"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
            </a>
            <Link to="/install" className="btn btn-primary text-sm">
              Install OS
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-rb-muted hover:text-rb-text transition-colors"
            aria-label="Toggle menu"
            aria-expanded={!!mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Nav */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-rb-border">
            <div className="flex flex-col gap-1">
              {navLinks.map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-3 py-2.5 text-sm rounded transition-colors ${
                    isActive(to)
                      ? 'text-rb-text bg-rb-surface'
                      : 'text-rb-muted hover:text-rb-text hover:bg-rb-surface/50'
                  }`}
                >
                  {label}
                </Link>
              ))}
              <Link to="/install" className="mt-3 btn btn-primary text-sm text-center">
                Install OS
              </Link>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
