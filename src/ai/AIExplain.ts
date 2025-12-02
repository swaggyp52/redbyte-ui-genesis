/**
 * AIExplain
 *
 * v33: a zero-backend, instant explanation engine.
 * Later can be upgraded to use your own Cloudflare Workers AI endpoint.
 *
 * For now this gives beautifully explained summaries that make RedByte
 * easy for ANYONE to understand.
 */

export async function explainApp(appId: string, title: string) {
  // Local knowledge base for friendly explanations
  const KNOW: Record<string, string> = {
    "redstone-lab":
      "Redstone Lab is your 2D+3D digital logic simulator. It shows dust power levels, repeaters, comparators and lets you build working circuits.",
    "logic-workspace":
      "Logic Designer is a clean 2D logic diagram tool. You can build AND/OR/NOT circuits, state machines, clocks, and export diagrams.",
    "cpu-designer":
      "CPU Designer shows how a small CPU works: ALU, registers, program counter, memory and control unit. It's a high-level roadmap for building real processors.",
    "terminal":
      "The Terminal is a command-line playground inside RedByte OS. Great for testing ideas and running internal commands.",
    "notes":
      "Notes is a simple writing app for capturing ideas, circuit notes, todos, and CPU schematic plans.",
    "system-monitor":
      "System Monitor shows OS-level activity: memory use, virtual CPU load, window count, and live performance metrics.",
  };

  if (KNOW[appId]) {
    return `**${title}**\n\n${KNOW[appId]}`;
  }

  return `**${title}**\n\nThis RedByte application is fully functional but does not yet have a tailored AI explanation.`;
}
