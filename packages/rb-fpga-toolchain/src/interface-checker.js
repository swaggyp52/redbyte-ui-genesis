const REQUIRED_PORTS = [
  { name: "clk", direction: "input", width: 1 },
  { name: "sw", direction: "input", width: 16 },
  { name: "btn", direction: "input", width: 5 },
  { name: "led", direction: "output", width: 16 },
  { name: "seg", direction: "output", width: 7 },
  { name: "an", direction: "output", width: 4 },
  { name: "dp", direction: "output", width: 1 },
];

function stripComments(source) {
  const noBlock = source.replace(/\/\*[\s\S]*?\*\//g, "");
  return noBlock.replace(/\/\/.*$/gm, "");
}

function parseWidth(token) {
  const range = token.match(/\[\s*(\d+)\s*:\s*(\d+)\s*\]/);
  if (!range) return 1;
  const msb = Number(range[1]);
  const lsb = Number(range[2]);
  return Math.abs(msb - lsb) + 1;
}

function parseHeaderPorts(headerText) {
  const ports = new Map();
  if (!headerText) return ports;
  const parts = headerText.split(",");
  for (const raw of parts) {
    const part = raw.trim();
    if (!part) continue;
    const dirMatch = part.match(/\b(input|output|inout)\b/);
    if (!dirMatch) continue;
    const direction = dirMatch[1];
    const width = parseWidth(part);
    const nameMatch = part.match(/([a-zA-Z_][\w$]*)\s*$/);
    if (!nameMatch) continue;
    ports.set(nameMatch[1], { direction, width });
  }
  return ports;
}

function parseBodyPorts(bodyText) {
  const ports = new Map();
  if (!bodyText) return ports;
  const declRegex = /\b(input|output|inout)\b([^;]*);/g;
  let match = null;
  while ((match = declRegex.exec(bodyText)) !== null) {
    const direction = match[1];
    const decl = match[2];
    const width = parseWidth(decl);
    const names = decl
      .replace(/\[[^\]]*\]/g, "")
      .replace(/\b(reg|wire|logic|signed|unsigned)\b/g, "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    for (const name of names) {
      const clean = name.match(/([a-zA-Z_][\w$]*)/);
      if (!clean) continue;
      ports.set(clean[1], { direction, width });
    }
  }
  return ports;
}

function extractModuleBlock(source, moduleName) {
  const regex = new RegExp(
    `module\\s+${moduleName}\\s*(#\\s*\\([\\s\\S]*?\\)\\s*)?\\(([\\s\\S]*?)\\)\\s*;([\\s\\S]*?)endmodule`,
    "m"
  );
  const match = source.match(regex);
  if (!match) return null;
  return { header: match[2], body: match[3] };
}

export function checkTopInterface({ sources, topName }) {
  const missing = [];
  const invalid = [];
  let found = false;
  let ports = new Map();

  for (const source of sources) {
    const cleaned = stripComments(source);
    const block = extractModuleBlock(cleaned, topName);
    if (!block) continue;
    found = true;
    const headerPorts = parseHeaderPorts(block.header);
    const bodyPorts = parseBodyPorts(block.body);
    ports = headerPorts.size > 0 ? headerPorts : bodyPorts;
    if (ports.size === 0 && bodyPorts.size > 0) {
      ports = bodyPorts;
    }
    break;
  }

  if (!found) {
    for (const req of REQUIRED_PORTS) {
      missing.push(req.name);
    }
    return { ok: false, missing, invalid, foundModule: false };
  }

  for (const req of REQUIRED_PORTS) {
    const actual = ports.get(req.name);
    if (!actual) {
      missing.push(req.name);
      continue;
    }
    const directionOk = actual.direction === req.direction;
    const widthOk = actual.width === req.width;
    if (!directionOk || !widthOk) {
      invalid.push({
        name: req.name,
        expected_direction: req.direction,
        actual_direction: actual.direction,
        expected_width: req.width,
        actual_width: actual.width,
      });
    }
  }

  return {
    ok: missing.length === 0 && invalid.length === 0,
    missing,
    invalid,
    foundModule: true,
  };
}

export function getRequiredInterface() {
  return REQUIRED_PORTS.map((entry) => ({ ...entry }));
}
