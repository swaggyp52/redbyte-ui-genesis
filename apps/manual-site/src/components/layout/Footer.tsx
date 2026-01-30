import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-zinc-950 border-t border-zinc-800">
      <div className="container mx-auto px-6 max-w-5xl py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: '#3B82F6' }}>
                <span className="text-[9px] font-bold text-white leading-none">R</span>
              </div>
              <span className="text-sm font-semibold text-zinc-50">RedByte</span>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed max-w-sm">
              A browser-based environment for learning digital logic.
              Build circuits visually, simulate deterministically, debug with waveforms.
            </p>
          </div>

          {/* Docs */}
          <div>
            <h4 className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-3">Documentation</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/manual/playground" className="text-zinc-500 hover:text-zinc-300 transition-colors">
                  Playground
                </Link>
              </li>
              <li>
                <Link to="/manual" className="text-zinc-500 hover:text-zinc-300 transition-colors">
                  User Manual
                </Link>
              </li>
              <li>
                <Link to="/about" className="text-zinc-500 hover:text-zinc-300 transition-colors">
                  About
                </Link>
              </li>
            </ul>
          </div>

          {/* Project */}
          <div>
            <h4 className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-3">Project</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <a
                  href="https://github.com/swaggyp52/redbyte-ui-genesis"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  GitHub
                </a>
              </li>
              <li>
                <Link to="/about" className="text-zinc-500 hover:text-zinc-300 transition-colors">
                  About
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-10 pt-6 border-t border-zinc-800/50 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-[10px] text-zinc-600">
            {new Date().getFullYear()} RedByte. Built by Connor Angiel.
          </p>
          <p className="text-[10px] text-zinc-600">
            Local-first. Open source. Accessible.
          </p>
        </div>
      </div>
    </footer>
  );
}
