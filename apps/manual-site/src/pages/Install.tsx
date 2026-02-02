export default function Download() {
  return (
    <div className="bg-zinc-950 min-h-screen text-zinc-100" style={{ fontFamily: '"Geist", sans-serif' }}>
      <div className="container mx-auto px-6 py-20 max-w-5xl text-center">

        <h1 className="text-5xl md:text-6xl font-black text-white mb-6 tracking-tight">
          Get RedByte OS
        </h1>
        <p className="text-xl text-zinc-400 mb-16 max-w-2xl mx-auto leading-relaxed">
          The all-in-one lab environment. <br />
          Open source, offline-first, and privacy-respecting.
        </p>

        {/* Primary Download Card */}
        <div className="bg-zinc-900/50 p-10 rounded-2xl border border-zinc-800 inline-block text-left relative overflow-hidden group max-w-md w-full shadow-2xl">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-cyan-500"></div>

          <div className="flex items-start justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">Windows Bundle</h2>
              <div className="text-sm text-zinc-500 font-mono">v1.0.0-stable • x64</div>
            </div>
            <div className="text-4xl">🪟</div>
          </div>

          <button className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-lg shadow-lg mb-4 transition-all hover:shadow-blue-500/20 active:scale-[0.98]">
            Download Explorer (.zip)
          </button>

          <p className="text-xs text-center text-zinc-500 font-mono">
            SHA256: e3b0c442... • 145 MB
          </p>
        </div>

        {/* Secondary Platforms */}
        <div className="mt-12 grid md:grid-cols-3 gap-6 max-w-3xl mx-auto">
          <PlatformCard
            icon="🍎"
            title="macOS"
            status="Coming Soon"
          />
          <PlatformCard
            icon="🐧"
            title="Linux"
            status="Build from Source"
            link="https://github.com/swaggyp52/redbyte-ui-genesis"
          />
          <PlatformCard
            icon="🌐"
            title="Web Demo"
            status="Try Instantly"
            link="/demo"
            active
          />
        </div>

        <div className="mt-20 grid md:grid-cols-3 gap-8 text-left border-t border-zinc-900 pt-16">
          <Feature title="Portable" desc="No administrator rights required. Just unzip and run on any lab computer." />
          <Feature title="Air-Gapped Ready" desc="Zero internet dependency after download. Perfect for secure exam environments." />
          <Feature title="Everything Included" desc="Bundled with Node.js runtime, hardware drivers, and documentation." />
        </div>

      </div>
    </div>
  );
};

const PlatformCard = ({ icon, title, status, link, active }: { icon: string, title: string, status: string, link?: string, active?: boolean }) => {
  const content = (
    <div className={`p-4 rounded-lg border ${active ? 'bg-zinc-900 border-zinc-700' : 'bg-zinc-950 border-zinc-900'} flex items-center gap-4 transition-colors hover:border-zinc-700`}>
      <div className="text-2xl">{icon}</div>
      <div className="text-left">
        <div className="font-bold text-sm text-zinc-200">{title}</div>
        <div className={`text-xs ${active ? 'text-green-400' : 'text-zinc-500'}`}>{status}</div>
      </div>
    </div>
  );

  return link ? (
    <Link to={link.startsWith('http') ? '' : link} onClick={link.startsWith('http') ? () => window.open(link) : undefined}>
      {content}
    </Link>
  ) : content;
}

const Feature = ({ title, desc }: { title: string, desc: string }) => (
  <div className="block">
    <h3 className="font-bold text-zinc-200 mb-2 flex items-center gap-2">
      <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" /> {title}
    </h3>
    <p className="text-sm text-zinc-400 leading-relaxed pl-3.5 border-l border-zinc-800">{desc}</p>
  </div>
);
