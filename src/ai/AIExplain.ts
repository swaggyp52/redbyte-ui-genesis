/**
 * AIExplain
 *
 * Local explanation engine for RedByte apps.
 * This can later be wired to Workers AI / external models.
 */

export async function explainApp(appId: string, title: string) {
  const KNOW: Record<string, string> = {
    "redstone-lab":
      "Redstone Lab is your 2D+3D digital logic sandbox. It shows dust power levels, repeaters, comparators and lets you build working circuits.",
    "logic-workspace":
      "Logic Designer is a 2D diagramming tool for gates, clocks and small controllers. It includes a natural-language helper and export panel.",
    "cpu-designer":
      "CPU Designer is a high-level studio for CPUs: ALU, registers, control unit, program counter and memory. It helps explain how a CPU is structured.",
    "terminal":
      "The Terminal is a command-line window inside RedByte OS. It is useful for experiments, logs and scripted workflows.",
    "notes":
      "Notes is a lightweight editor for writing ideas, design notes and circuit documentation.",
    "system-monitor":
      "System Monitor shows OS-like stats: window counts, simulation load and other health indicators.",
    "file-explorer":
      "File Explorer lets you browse the RedByte virtual filesystem: Documents, Projects and Exports. It includes a Quick Access sidebar and a Recent Files list so you can quickly find your work.",
    "settings":
      "Settings is the control panel for RedByte OS. It controls boot mode (cinematic vs instant), user-facing hints, theme preferences and favorite apps. In future versions it can sync these settings to cloud accounts.",
  };

  if (KNOW[appId]) {
    return `**${title}**\n\n${KNOW[appId]}`;
  }

  return `**${title}**\n\nThis RedByte application is active but does not yet have a specific AI explanation.`;
}
