const BASYS3_LINE_PATTERN = /(basys\s*3|basys3|xc7a35t)/i;

export function selectOpenFPGALoaderDetectCommands(helpText) {
  const text = String(helpText || "").toLowerCase();
  const commands = [];

  if (text.includes("--scan")) commands.push(["--scan"]);
  if (text.includes("--detect")) commands.push(["--detect"]);
  if (text.includes("--list-cables")) commands.push(["--list-cables"]);
  if (text.includes("--list-boards")) commands.push(["--list-boards"]);

  if (commands.length > 0) return commands;
  return [["--scan"], ["--detect"], ["--list-cables"], ["--list-boards"]];
}

export function parseOpenFPGALoaderDetectOutput(rawOutput) {
  const lines = String(rawOutput || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const matchedLines = lines
    .filter((line) => BASYS3_LINE_PATTERN.test(line))
    .sort((a, b) => a.localeCompare(b));

  const uniqueLines = Array.from(new Set(matchedLines));
  if (uniqueLines.length === 0) return [];
  return [
    {
      type: "basys3",
      transport: "usb-jtag",
      detectedBy: "openFPGALoader",
      details: { raw: uniqueLines.join(" | ") },
    },
  ];
}
