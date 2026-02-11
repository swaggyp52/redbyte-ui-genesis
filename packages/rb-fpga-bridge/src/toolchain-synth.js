export const YOSYS_SYNTH_SCRIPT_VERSION = "rb_yosys_synth_v1";

function stableStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const keys = Object.keys(value).sort((a, b) => a.localeCompare(b));
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

function deterministicId(prefix, payload) {
  const text = stableStringify(payload);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function sanitizePathSegment(segment) {
  if (!segment) return "_";
  const sanitized = String(segment).replace(/[^a-zA-Z0-9._-]/g, "_");
  return sanitized.length > 0 ? sanitized : "_";
}

export function normalizeSynthSourcePath(rawPath) {
  if (typeof rawPath !== "string") return null;
  let value = rawPath.trim().replace(/\\/g, "/");
  if (!value) return null;
  if (value.startsWith("/") || /^[A-Za-z]:/.test(value)) return null;
  while (value.startsWith("./")) {
    value = value.slice(2);
  }

  const segments = value
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
  if (segments.length === 0) return null;
  if (segments.some((segment) => segment === "." || segment === "..")) return null;

  return segments.map((segment) => sanitizePathSegment(segment)).join("/");
}

export function normalizeSynthTop(rawTop) {
  const top = typeof rawTop === "string" ? rawTop.trim() : "";
  if (!/^[A-Za-z_][A-Za-z0-9_$]*$/.test(top)) return null;
  return top;
}

export function normalizeSynthSources(rawSources) {
  if (!Array.isArray(rawSources)) {
    return { sources: [], nonVerilogCount: 0, invalidCount: 0 };
  }

  const normalized = [];
  let nonVerilogCount = 0;
  let invalidCount = 0;
  for (const source of rawSources) {
    const path = normalizeSynthSourcePath(source?.path);
    const language = source?.language === "verilog" ? "verilog" : source?.language;
    if (language !== "verilog") {
      nonVerilogCount += 1;
      continue;
    }
    const text = typeof source?.text === "string" ? source.text : "";
    if (!path) {
      invalidCount += 1;
      continue;
    }
    normalized.push({ path, language: "verilog", text });
  }

  normalized.sort((left, right) => left.path.localeCompare(right.path));
  return {
    sources: normalized,
    nonVerilogCount,
    invalidCount,
  };
}

function quoteYosysPath(path) {
  return `"${String(path || "").replace(/\\/g, "/").replace(/"/g, '\\"')}"`;
}

export function buildYosysSynthScript(input) {
  const top = normalizeSynthTop(input?.top) || "top";
  const sourcePaths = Array.isArray(input?.sourcePaths) ? input.sourcePaths.slice() : [];
  sourcePaths.sort((left, right) => String(left).localeCompare(String(right)));

  const lines = [
    `# RedByte Yosys synth script (${YOSYS_SYNTH_SCRIPT_VERSION})`,
    "yosys -import",
  ];
  for (const sourcePath of sourcePaths) {
    lines.push(`read_verilog -sv ${quoteYosysPath(sourcePath)}`);
  }
  lines.push(`hierarchy -check -top ${top}`);
  lines.push("proc");
  lines.push("opt");
  lines.push("techmap");
  lines.push("opt");
  lines.push(`synth_xilinx -top ${top} -family xc7`);
  lines.push(`stat -top ${top}`);
  lines.push(`write_verilog -noattr ${quoteYosysPath("out/netlist.v")}`);
  lines.push("");
  return lines.join("\n");
}

export function createSynthArtifactId(input) {
  const sources = normalizeSynthSources(input?.sources).sources.map((source) => ({
    path: source.path,
    text: source.text,
  }));
  const top = normalizeSynthTop(input?.top) || "top";
  const board = input?.board === "basys3" ? "basys3" : "basys3";
  const yosysVersion = typeof input?.yosysVersion === "string" ? input.yosysVersion : null;
  const scriptVersion = typeof input?.scriptVersion === "string" ? input.scriptVersion : YOSYS_SYNTH_SCRIPT_VERSION;
  return deterministicId("toolchain-synth", {
    board,
    top,
    yosysVersion,
    scriptVersion,
    sources,
  });
}

export function extractYosysStatText(stdoutText) {
  const text = typeof stdoutText === "string" ? stdoutText : "";
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const startIndex = lines.findIndex((line) => line.trim().startsWith("==="));
  if (startIndex < 0) return text.trim();
  return lines.slice(startIndex).join("\n").trim();
}
