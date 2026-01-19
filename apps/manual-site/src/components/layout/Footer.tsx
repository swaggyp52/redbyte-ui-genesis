export default function Footer() {
  return (
    <footer className="bg-rb-surface border-t border-rb-border py-12">
      <div className="content-container px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-lg font-semibold mb-3 text-rb-text">RedByte</h3>
            <p className="text-sm text-rb-muted leading-relaxed">
              Deterministic digital logic simulator and FPGA development environment.
            </p>
          </div>
          
          <div>
            <h4 className="text-sm font-semibold mb-3 text-rb-text">Quick Links</h4>
            <ul className="space-y-2 text-sm text-rb-muted">
              <li><a href="/#/" className="hover:text-rb-accent transition-colors">Home</a></li>
              <li><a href="/#/getting-started" className="hover:text-rb-accent transition-colors">Getting Started</a></li>
              <li><a href="/#/examples" className="hover:text-rb-accent transition-colors">Interactive Examples</a></li>
              <li><a href="/#/manual" className="hover:text-rb-accent transition-colors">Manual</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-sm font-semibold mb-3 text-rb-text">Built by</h4>
            <p className="text-sm text-rb-muted">Connor Angiel</p>
            <p className="text-xs text-rb-muted mt-2">© {new Date().getFullYear()} All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
