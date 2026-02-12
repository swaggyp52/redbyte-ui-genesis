const BASYS3_F4PGA_V0_CONTRACT_ID = "basys3-f4pga-v0";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeToolName(value) {
  return normalizeString(value).toLowerCase();
}

export const BASYS3_F4PGA_V0_CONTRACT = Object.freeze({
  contractId: BASYS3_F4PGA_V0_CONTRACT_ID,
  board: "basys3",
  backend: "buildpack-open",
  plannerVersion: "toolchain_planner_v1",
  acceptedBuildpackNames: Object.freeze([
    "basys3-open-toolchain",
    "basys3-open",
  ]),
  allowedPlatformKeys: Object.freeze(["win32-x64"]),
  requiredTools: Object.freeze([
    Object.freeze({
      name: "f4pga",
      relPathByPlatform: Object.freeze({
        "win32-x64": "bin/win32-x64/f4pga.exe",
        "linux-x64": "bin/linux-x64/f4pga",
        "darwin-arm64": "bin/darwin-arm64/f4pga",
        "darwin-x64": "bin/darwin-x64/f4pga",
      }),
      verifyArgs: Object.freeze(["--help"]),
    }),
  ]),
  requiredPaths: Object.freeze([
    Object.freeze({ relPath: "bin", kind: "dir" }),
    Object.freeze({ relPath: "share", kind: "dir" }),
    Object.freeze({ relPath: "licenses", kind: "dir" }),
  ]),
  expectedOutputs: Object.freeze(["out/top.bit"]),
  requiredEnvKeys: Object.freeze(["RB_FPGA_BUILDPACKS_DIR"]),
});

export function getBasys3F4pgaV0Contract() {
  return BASYS3_F4PGA_V0_CONTRACT;
}

export function isBasys3F4pgaContractId(value) {
  return normalizeString(value) === BASYS3_F4PGA_V0_CONTRACT_ID;
}

export function isBasys3BuildpackSignature(signature) {
  const contract = BASYS3_F4PGA_V0_CONTRACT;
  const name = normalizeString(signature?.name);
  const version = normalizeString(signature?.version);
  const contractId = normalizeString(signature?.contractId);
  if (contractId) {
    return contractId === contract.contractId;
  }
  if (!name || !version) return false;
  return contract.acceptedBuildpackNames.includes(name);
}

export function resolveBasys3ContractTool(toolName, platformKey) {
  const normalizedToolName = normalizeToolName(toolName);
  const normalizedPlatformKey = normalizeString(platformKey);
  const contractTool = BASYS3_F4PGA_V0_CONTRACT.requiredTools.find(
    (tool) => normalizeToolName(tool?.name) === normalizedToolName
  );
  if (!contractTool) return null;
  const relPath = contractTool?.relPathByPlatform?.[normalizedPlatformKey];
  if (typeof relPath !== "string" || relPath.trim().length === 0) return null;
  return {
    name: contractTool.name,
    relPath: relPath.replace(/\\/g, "/"),
    verifyArgs: Array.isArray(contractTool.verifyArgs) ? [...contractTool.verifyArgs] : [],
  };
}

export function listBasys3ContractTools(platformKey) {
  const normalizedPlatformKey = normalizeString(platformKey);
  return BASYS3_F4PGA_V0_CONTRACT.requiredTools
    .map((tool) => resolveBasys3ContractTool(tool.name, normalizedPlatformKey))
    .filter(Boolean)
    .sort((left, right) => left.name.localeCompare(right.name));
}
