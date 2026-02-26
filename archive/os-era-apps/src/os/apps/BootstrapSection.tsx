import React from "react";

const BootstrapSection: React.FC = () => {
  return (
    <section className="max-w-xl mx-auto mt-10 mb-10 p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg text-slate-100">
      <h2 className="text-2xl font-bold mb-2 text-sky-300">RedByte Quick Install</h2>
      <p className="mb-4 text-slate-400">
        <strong>One-liner install:</strong> Installs all dependencies (Git, Node.js LTS, pnpm), clones RedByte, and sets up everything for you. Safe to run multiple times.
      </p>
      <div className="mb-4">
        <div className="bg-slate-800 rounded-lg p-4 flex flex-col gap-2">
          <span className="text-xs text-slate-400">Copy &amp; paste into PowerShell:</span>
          <pre className="bg-slate-950 text-green-300 p-2 rounded font-mono text-sm select-all overflow-x-auto">
            iwr -useb "https://redbyteapps.dev/bootstrap.ps1" | iex
          </pre>
        </div>
      </div>
      <p className="text-xs text-slate-400">
        <strong>Manual install:</strong> If <span className="font-mono">winget</span> is missing, install Git and Node.js LTS manually, then re-run the above command.
      </p>
      <details className="mt-4">
        <summary className="cursor-pointer text-sky-400">What does this do?</summary>
        <ul className="list-disc ml-6 mt-2 text-slate-300 text-sm">
          <li>Installs <b>Git</b>, <b>Node.js LTS</b>, and <b>pnpm</b> (if missing)</li>
          <li>Clones or updates the RedByte repo</li>
          <li>Installs all dependencies</li>
          <li>Creates <span className="font-mono">run-dev.ps1</span> and <span className="font-mono">update.ps1</span> for easy re-running</li>
          <li>Starts the dev server</li>
        </ul>
      </details>
    </section>
  );
};

export default BootstrapSection;
