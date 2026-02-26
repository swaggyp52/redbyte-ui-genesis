import React, { useState } from "react";

const INSTALL_CMD = 'iwr -useb "https://redbyteapps.dev/bootstrap.ps1" | iex';
const SCRIPT_URL = "https://redbyteapps.dev/bootstrap.ps1";

const InstallScriptSection: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const copyCommand = async () => {
    try {
      await navigator.clipboard.writeText(INSTALL_CMD);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = INSTALL_CMD;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <section className="max-w-xl mx-auto mt-10 mb-10 p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg text-slate-100">
      <h2 className="text-2xl font-bold mb-2 text-sky-300">Install RedByte (Windows)</h2>
      <p className="mb-4 text-slate-400">
        Paste this into PowerShell. It installs everything and launches RedByte.
      </p>
      <div className="mb-4">
        <div className="bg-slate-800 rounded-lg p-4 flex flex-col gap-2">
          <span className="text-xs text-slate-400">Copy &amp; paste into PowerShell:</span>
          <pre className="bg-slate-950 text-green-300 p-2 rounded font-mono text-sm select-all overflow-x-auto">
            {INSTALL_CMD}
          </pre>
          <div className="flex gap-2 mt-2">
            <button
              className="px-4 py-2 rounded bg-sky-500 text-slate-950 font-semibold hover:bg-sky-400 transition"
              onClick={copyCommand}
            >
              {copied ? "Copied!" : "Copy command"}
            </button>
            <a
              href={SCRIPT_URL}
              className="px-4 py-2 rounded bg-slate-700 text-slate-100 font-semibold hover:bg-slate-600 transition"
              download
            >
              Download bootstrap.ps1
            </a>
          </div>
        </div>
      </div>
      <p className="text-xs text-slate-400">
        <strong>Manual fallback:</strong> If <span className="font-mono">winget</span> is missing, install Git and Node.js LTS manually, then re-run the above command.
      </p>
    </section>
  );
};

export default InstallScriptSection;
