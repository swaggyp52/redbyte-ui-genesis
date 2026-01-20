import fs from "fs";
import path from "path";

const VIVADO_VERSION = "2024.1";
const VIVADO_NOT_FOUND_MESSAGE =
  "Vivado not found. Install Vivado 2024.1 or set VIVADO_PATH to the folder containing vivado.bat.";

const COMMON_VIVADO_PATHS = [
  `C:\\Xilinx\\Vivado\\${VIVADO_VERSION}\\bin\\vivado.bat`,
  `D:\\Xilinx\\Vivado\\${VIVADO_VERSION}\\bin\\vivado.bat`,
  `C:\\Program Files\\Xilinx\\Vivado\\${VIVADO_VERSION}\\bin\\vivado.bat`,
];

function resolveEnvVivadoPath(rawPath) {
  const trimmed = rawPath.trim();
  if (!trimmed) return null;

  const resolved = path.resolve(trimmed);
  if (resolved.toLowerCase().endsWith("vivado.bat")) {
    return resolved;
  }
  return path.join(resolved, "vivado.bat");
}

export function findVivado() {
  const envPath = process.env.VIVADO_PATH;
  if (envPath) {
    const candidate = resolveEnvVivadoPath(envPath);
    if (candidate && fs.existsSync(candidate)) {
      return path.resolve(candidate);
    }
    throw new Error(VIVADO_NOT_FOUND_MESSAGE);
  }

  for (const candidate of COMMON_VIVADO_PATHS) {
    if (fs.existsSync(candidate)) {
      return path.resolve(candidate);
    }
  }

  throw new Error(VIVADO_NOT_FOUND_MESSAGE);
}

export { VIVADO_NOT_FOUND_MESSAGE };
