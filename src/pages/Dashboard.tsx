import React from "react";

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-black text-white p-8">
      <h1 className="text-4xl font-bold holo mb-8 text-center">
        RedByte OS • HyperGrid v3.0
      </h1>

      <div className="hypergrid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="hg-card">
            <h2 className="text-xl font-semibold mb-2">Panel {i + 1}</h2>
            <p className="text-gray-400">This is a HyperGrid card block.</p>
          </div>
        ))}
      </div>
    </div>
  );
}

