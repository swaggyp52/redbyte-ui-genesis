import React from 'react';
import { Link } from 'react-router-dom';

const Install = () => {
  return (
    <div className="bg-rb-bg min-h-screen text-gray-300">
      <div className="container mx-auto px-6 py-16 max-w-4xl text-center">

        <h1 className="text-5xl font-black text-white mb-6">Get RedByte OS</h1>
        <p className="text-xl text-gray-400 mb-12 max-w-2xl mx-auto">
          The all-in-one lab environment. Includes the bridge agent, drivers, and the offline web app.
        </p>

        <div className="bg-[#1a1a1a] p-10 rounded-2xl border border-gray-700 inline-block text-left relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500"></div>

          <h2 className="text-2xl font-bold text-white mb-2">RedByte Lab Bundle</h2>
          <div className="text-sm text-gray-500 mb-6 font-mono">v1.0.0 • Windows 10/11 • 64-bit</div>

          <button className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-lg shadow-lg mb-4 transition-colors">
            Download .zip (145 MB)
          </button>

          <p className="text-xs text-center text-gray-500">
            MD5: 7a9...f42 • <Link to="/instructors" className="text-blue-400 hover:underline">Installation Guide</Link>
          </p>
        </div>

        <div className="mt-16 grid md:grid-cols-3 gap-8 text-left">
          <Feature title="Portable" desc="No administrator rights required for basic usage. Just unzip and run." />
          <Feature title="Offline" desc="Zero internet dependency. Perfect for air-gapped lab networks." />
          <Feature title="Complete" desc="Includes Node.js runtime, Drivers, and Documentation." />
        </div>

      </div>
    </div>
  );
};

const Feature = ({ title, desc }: { title: string, desc: string }) => (
  <div className="p-6 bg-[#111] rounded-lg border border-gray-800">
    <h3 className="font-bold text-white mb-2">{title}</h3>
    <p className="text-sm text-gray-400">{desc}</p>
  </div>
);

export default Install;
