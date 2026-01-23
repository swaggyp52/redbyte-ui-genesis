import { Link as RouterLink } from 'react-router-dom';
import CodeBlock from '../components/CodeBlock';
import { mvpFacts } from '../content/mvpFacts';

const Link = RouterLink as React.ComponentType<{ to: string; className?: string; children: React.ReactNode }>;

export default function Install() {
  return (
    <div className="py-24 bg-rb-bg min-h-[60vh] flex items-center">
      <div className="content-container px-6">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-rb-surface border border-rb-border mb-8">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-rb-muted">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" />
            </svg>
          </div>
          <h1 className="text-h1 text-rb-text mb-4">Install temporarily disabled</h1>
          <p className="text-lg text-rb-muted mb-10 leading-relaxed">
            Local installation instructions and bootstrap scripts are temporarily offline.
            The project remains fully accessible and functional as open source.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <a
              href="https://github.com/swaggyp52/redbyte-ui-genesis"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary px-8"
            >
              View on GitHub
            </a>
            <Link to="/about" className="btn btn-secondary px-8">
              About RedByte
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
