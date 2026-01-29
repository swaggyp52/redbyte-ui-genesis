import React from 'react';

const Instructors = () => {
  return (
    <div className="bg-rb-bg min-h-screen text-gray-300">
      <div className="container mx-auto px-6 py-16 max-w-4xl">

        <h1 className="text-4xl font-black text-white mb-8">Instructor Setup Guide</h1>

        <div className="prose prose-invert prose-lg max-w-none">
          <p className="text-xl text-gray-400 mb-12">
            RedByte OS is designed to be "Day 1 Ready" for digital logic labs.
            Follow this guide to prepare your classroom environment.
          </p>

          <Section title="1. The Lab Bundle">
            <p>
              We provide a single <code>RedByte_Lab_Bundle.zip</code> that works on locked-down Windows PCs
              without requiring Administrator privileges (mostly).
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-4 text-base">
              <li><strong>Runtime:</strong> Includes a portable Node.js runtime (if missing).</li>
              <li><strong>Drivers:</strong> FTDI drivers for Basys3 must be pre-installed by IT.</li>
              <li><strong>Network:</strong> No internet connection required after download.</li>
            </ul>
          </Section>

          <Section title="2. Hardware Prep (One-Time)">
            <p>
              Before the semester starts, you must flash the <strong>RedByte Bridge Core</strong> onto your Basys 3 boards.
            </p>
            <div className="bg-gray-800 p-4 rounded-lg mt-4 font-mono text-sm border border-gray-700">
              # From the instructor workstation with Vivado:<br />
              cd packages/rb-fpga-toolchain<br />
              vivado -mode batch -source scripts/build_basys3.tcl
            </div>
            <p className="mt-4 text-sm text-gray-400">
              This creates the <code>top.bit</code> file that bridges the switches/LEDs to the UART port.
              Flash this to the board's non-volatile memory.
            </p>
          </Section>

          <Section title="3. Grading with Evidence">
            <p>
              Students export <strong>.labcapsule.json</strong> files. You do not need to reproduce their circuit manually.
            </p>
            <ol className="list-decimal pl-6 space-y-2 mt-4 text-base">
              <li>Open your Instructor Dashboard (RedByte OS).</li>
              <li>Drag & Drop the student's capsule.</li>
              <li>The environment <strong>Replays</strong> their session deterministically.</li>
              <li>Check the <strong>Truth HUD</strong> for the "VERIFIED" badge.</li>
            </ol>
          </Section>

        </div>
      </div>
    </div>
  );
};

const Section = ({ title, children }: { title: string, children: React.ReactNode }) => (
  <div className="mb-12 border-l-4 border-blue-900 pl-6 py-2">
    <h2 className="text-2xl font-bold text-white mb-4">{title}</h2>
    {children}
  </div>
);

export default Instructors;
