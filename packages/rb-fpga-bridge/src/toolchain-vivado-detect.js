import * as path from "path";

export const VIVADO_SEARCH_PATHS = {
  win32: [
    "C:\\Xilinx\\Vivado",
    "D:\\Xilinx\\Vivado",
    "C:\\Program Files\\Xilinx\\Vivado",
  ],
  linux: ["/opt/Xilinx/Vivado", "/tools/Xilinx/Vivado"],
  darwin: ["/Applications/Xilinx/Vivado", "/opt/Xilinx/Vivado"],
};

export function parseVivadoVersion(outputText) {
  const text = typeof outputText === "string" ? outputText : "";
  const match = text.match(/Vivado v?(\d+\.\d+(?:\.\d+)?)/i);
  return match ? match[1] : null;
}

export function buildVivadoPathFixSuggestion({ platform, discoveredPath }) {
  const safePath = typeof discoveredPath === "string" ? discoveredPath.trim() : "";
  if (!safePath) return "Add Vivado bin to PATH and restart RedByte.";
  if (platform === "win32") {
    const dir = path.dirname(safePath);
    return `Vivado found outside PATH. Add "${dir}" to your PATH (System Environment Variables), restart terminal, then re-run Verify Setup.`;
  }
  return `Vivado found outside PATH at ${safePath}. Add its bin directory to PATH and restart RedByte.`;
}

function sortVersionDirectories(directories) {
  return [...directories].sort((left, right) =>
    String(right).localeCompare(String(left), undefined, { numeric: true, sensitivity: "base" })
  );
}

async function runVersionCommand({ executable, execCommand, timeoutMs = 15000 }) {
  const quotedExecutable = executable.includes(" ") ? `"${executable}"` : executable;
  const stdout = await execCommand(`${quotedExecutable} -version`, timeoutMs);
  return parseVivadoVersion(stdout);
}

async function detectVivadoFromPath({ platform, execCommand }) {
  const vivadoExe = platform === "win32" ? "vivado.bat" : "vivado";
  try {
    const version = await runVersionCommand({ executable: vivadoExe, execCommand });
    if (!version) return null;
    const whichCommand = platform === "win32" ? "where" : "which";
    let resolvedPath = vivadoExe;
    try {
      const locationOutput = await execCommand(`${whichCommand} ${vivadoExe}`, 5000);
      const firstLine = String(locationOutput || "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line.length > 0);
      if (firstLine) resolvedPath = firstLine;
    } catch {
      // ignore path lookup failures
    }
    return {
      path: resolvedPath,
      version,
      status: "ok",
      foundInPath: true,
    };
  } catch {
    return null;
  }
}

async function detectVivadoFromSearchPaths({
  platform,
  execCommand,
  existsSync,
  readdirSync,
  searchPaths,
}) {
  const vivadoExe = platform === "win32" ? "vivado.bat" : "vivado";
  const roots = Array.isArray(searchPaths) ? searchPaths : [];
  for (const basePath of roots) {
    if (!existsSync(basePath)) continue;
    let versionDirs = [];
    try {
      versionDirs = readdirSync(basePath).filter((entry) => /^\d+\.\d+/.test(String(entry)));
    } catch {
      continue;
    }
    for (const versionDir of sortVersionDirectories(versionDirs)) {
      const candidate = path.join(basePath, versionDir, "bin", vivadoExe);
      if (!existsSync(candidate)) continue;
      let detectedVersion = String(versionDir);
      try {
        const parsed = await runVersionCommand({ executable: candidate, execCommand });
        if (parsed) detectedVersion = parsed;
      } catch {
        // keep folder-derived version
      }
      return {
        path: candidate,
        version: detectedVersion,
        status: "found_not_in_path",
        foundInPath: false,
        suggestedFix: buildVivadoPathFixSuggestion({
          platform,
          discoveredPath: candidate,
        }),
      };
    }
  }
  return null;
}

export async function detectVivado({
  platform,
  execCommand,
  existsSync,
  readdirSync,
  searchPathsByPlatform = VIVADO_SEARCH_PATHS,
}) {
  const detectedPlatform = typeof platform === "string" ? platform : process.platform;
  const pathHit = await detectVivadoFromPath({
    platform: detectedPlatform,
    execCommand,
  });
  if (pathHit) return pathHit;

  const searchPaths = searchPathsByPlatform?.[detectedPlatform] || [];
  return detectVivadoFromSearchPaths({
    platform: detectedPlatform,
    execCommand,
    existsSync,
    readdirSync,
    searchPaths,
  });
}

