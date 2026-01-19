import { Link } from 'react-router-dom';

export default function Header() {
  return (
    <header className="sticky top-0 z-50 bg-rb-bg/95 backdrop-blur-sm border-b border-rb-border">
      <nav className="content-container px-6 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-2 group">
            <div className="w-6 h-6 bg-rb-accent rounded"></div>
            <span className="text-xl font-semibold text-rb-text group-hover:text-rb-accent transition-colors">RedByte</span>
          </Link>
          
          <div className="hidden md:flex items-center space-x-6">
            <Link to="/" className="text-sm text-rb-muted hover:text-rb-text transition-colors">Home</Link>
            <Link to="/getting-started" className="text-sm text-rb-muted hover:text-rb-text transition-colors">Getting Started</Link>
            <Link to="/demo" className="text-sm text-rb-muted hover:text-rb-text transition-colors">Demo</Link>
            <Link to="/examples" className="text-sm text-rb-muted hover:text-rb-text transition-colors">Examples</Link>
            <Link to="/manual" className="text-sm text-rb-muted hover:text-rb-text transition-colors">Manual</Link>
            <Link to="/about" className="text-sm text-rb-muted hover:text-rb-text transition-colors">About</Link>
            <a 
              href="#download" 
              className="ml-2 px-4 py-2 bg-rb-accent text-rb-bg text-sm font-medium rounded hover:bg-rb-accent-dim transition-colors"
            >
              Download
            </a>
          </div>
        </div>
      </nav>
    </header>
  );
}

