import {
  BASYS3_F4PGA_V0_CONTRACT,
  isBasys3BuildpackSignature,
} from "./toolchain-buildpack-contracts.js";

const IMPLEMENT_PLAN_SCHEMA_VERSION = "toolchain_implement_plan_v1";
const IMPLEMENT_PLAN_REQUEST_SCHEMA_VERSION = "toolchain_implement_plan_request_v1";

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

function sortEntries(values, keyFn) {
  return [...values].sort((left, right) => keyFn(left).localeCompare(keyFn(right)));
}

function normalizeSourcePath(rawPath) {
  if (typeof rawPath !== "string") return null;
  let value = rawPath.trim().replace(/\\/g, "/");
  if (!value) return null;
  if (value.startsWith("/") || /^[A-Za-z]:/.test(value)) return null;
  while (value.startsWith("./")) value = value.slice(2);
  const segments = value
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
  if (segments.length === 0 || segments.some((segment) => segment === "." || segment === "..")) return null;
  return segments.map((segment) => segment.replace(/[^a-zA-Z0-9._-]/g, "_") || "_").join("/");
}

function normalizeTop(rawTop) {
  const value = typeof rawTop === "string" ? rawTop.trim() : "";
  if (!value) return null;
  return /^[A-Za-z_][A-Za-z0-9_$]*$/.test(value) ? value : null;
}

function normalizeProject(rawProject) {
  const rawHdl = rawProject?.hdl && typeof rawProject.hdl === "object" ? rawProject.hdl : {};
  const rawFpga = rawProject?.fpga && typeof rawProject.fpga === "object" ? rawProject.fpga : {};
  const board = rawFpga.board === "basys3" ? "basys3" : "basys3";
  const rawSources = Array.isArray(rawHdl.sources) ? rawHdl.sources : [];
  const sources = rawSources
    .map((source) => {
      const path = normalizeSourcePath(source?.path);
      const language = source?.language === "vhdl" ? "vhdl" : "verilog";
      const text = typeof source?.text === "string" ? source.text : "";
      if (!path) return null;
      return { path, language, text };
    })
    .filter(Boolean)
    .sort((left, right) => left.path.localeCompare(right.path));
  const top = normalizeTop(rawHdl.top) || normalizeTop(rawFpga.top) || "top";
  const constraintsText = rawFpga?.constraints?.type === "xdc" && typeof rawFpga?.constraints?.text === "string"
    ? rawFpga.constraints.text
    : "";
  const preset = typeof rawFpga.preset === "string" && rawFpga.preset.trim().length > 0 ? rawFpga.preset.trim() : null;
  return {
    hdl: { sources, top },
    fpga: {
      board,
      constraints: constraintsText.trim().length > 0 ? { type: "xdc", text: constraintsText } : null,
      preset,
      top,
    },
  };
}

const TOOL_DEFS_BY_BACKEND = {
  "buildpack-open": [
    { name: "yosys", capKey: "yosys", why: "required for RTL synthesis frontend (bundled/buildpack verified)" },
    { name: "f4pga", capKey: "f4pga", why: "required buildpack-backed xc7 implementation flow" },
  ],
  "nextpnr-xilinx": [
    { name: "yosys", capKey: "yosys", why: "required for RTL synthesis before open P&R" },
    { name: "nextpnr-xilinx", capKey: "nextpnrXilinx", why: "required for open Xilinx 7-series placement/routing" },
  ],
  f4pga: [
    { name: "yosys", capKey: "yosys", why: "required for RTL synthesis frontend" },
    { name: "f4pga", capKey: "f4pga", why: "required for the F4PGA xc7 implementation flow" },
  ],
  "vivado-fallback": [
    { name: "vivado", capKey: "vivado", why: "required fallback for implementation and bitstream generation" },
  ],
  none: [
    { name: "yosys", capKey: "yosys", why: "required for open-source synthesis" },
    { name: "nextpnr-xilinx", capKey: "nextpnrXilinx", why: "preferred open-source Artix-7 place-and-route backend" },
    { name: "f4pga", capKey: "f4pga", why: "fallback open-source xc7 implementation flow" },
    { name: "vivado", capKey: "vivado", why: "last-resort proprietary fallback implementation backend" },
  ],
};

const COMMANDS_BY_BACKEND = {
  "buildpack-open": [
    {
      step: "synth",
      argv: [
        "f4pga",
        "build",
        "--flow",
        "xc7",
        "--part",
        "xc7a35tcpg236-1",
        "--top",
        "<top>",
        "--sources",
        "<sources>",
        "--xdc",
        "<constraints>",
        "--out",
        "out",
      ],
      envKeysUsed: ["PATH", "F4PGA_INSTALL_DIR", "RB_FPGA_BUILDPACKS_DIR"],
    },
    {
      step: "pnr",
      argv: ["f4pga", "build", "--stage", "place_route", "--out", "out"],
      envKeysUsed: ["PATH", "F4PGA_INSTALL_DIR", "RB_FPGA_BUILDPACKS_DIR"],
    },
    {
      step: "bitgen",
      argv: ["f4pga", "build", "--stage", "bitstream", "--out", "out"],
      envKeysUsed: ["PATH", "F4PGA_INSTALL_DIR", "RB_FPGA_BUILDPACKS_DIR"],
    },
  ],
  "nextpnr-xilinx": [
    {
      step: "synth",
      argv: [
        "yosys",
        "-p",
        "read_verilog -sv <sources>; hierarchy -top <top>; synth_xilinx -top <top> -family xc7; write_json out/netlist.json",
      ],
      envKeysUsed: ["PATH"],
    },
    {
      step: "pnr",
      argv: ["nextpnr-xilinx", "--json", "out/netlist.json", "--xdc", "constraints.xdc", "--write", "out/routed.json"],
      envKeysUsed: ["PATH"],
    },
    {
      step: "bitgen",
      argv: ["python", "-m", "f4pga.utils.xc7.bitgen", "--input", "out/routed.json", "--output", "out/design.bit"],
      envKeysUsed: ["PATH", "F4PGA_INSTALL_DIR"],
    },
  ],
  f4pga: [
    {
      step: "synth",
      argv: ["f4pga", "build", "--flow", "xc7", "--part", "xc7a35tcpg236-1", "--top", "<top>"],
      envKeysUsed: ["PATH", "F4PGA_INSTALL_DIR"],
    },
    {
      step: "pnr",
      argv: ["f4pga", "build", "--stage", "place_route"],
      envKeysUsed: ["PATH", "F4PGA_INSTALL_DIR"],
    },
    {
      step: "bitgen",
      argv: ["f4pga", "build", "--stage", "bitstream"],
      envKeysUsed: ["PATH", "F4PGA_INSTALL_DIR"],
    },
  ],
  "vivado-fallback": [
    {
      step: "synth",
      argv: ["vivado", "-mode", "batch", "-source", "scripts/redbyte_synth.tcl"],
      envKeysUsed: ["PATH", "XILINX_VIVADO"],
    },
    {
      step: "pnr",
      argv: ["vivado", "-mode", "batch", "-source", "scripts/redbyte_impl.tcl"],
      envKeysUsed: ["PATH", "XILINX_VIVADO"],
    },
    {
      step: "bitgen",
      argv: ["vivado", "-mode", "batch", "-source", "scripts/redbyte_bitgen.tcl"],
      envKeysUsed: ["PATH", "XILINX_VIVADO"],
    },
  ],
  none: [],
};

const OUTPUTS_BY_BACKEND = {
  "buildpack-open": [
    { name: "eblif", pathHint: "out/top.eblif" },
    { name: "fasm", pathHint: "out/top.fasm" },
    { name: "bitstream", pathHint: "out/top.bit" },
  ],
  "nextpnr-xilinx": [
    { name: "netlist-json", pathHint: "out/netlist.json" },
    { name: "routed-json", pathHint: "out/routed.json" },
    { name: "bitstream", pathHint: "out/design.bit" },
  ],
  f4pga: [
    { name: "eblif", pathHint: "build/top.eblif" },
    { name: "fasm", pathHint: "build/top.fasm" },
    { name: "bitstream", pathHint: "build/top.bit" },
  ],
  "vivado-fallback": [
    { name: "synth-checkpoint", pathHint: "out/post_synth.dcp" },
    { name: "impl-checkpoint", pathHint: "out/post_route.dcp" },
    { name: "bitstream", pathHint: "out/design.bit" },
  ],
  none: [],
};

const UNSUPPORTED_MARKERS = [
  { token: "DSP48", pattern: /\bDSP48E\d?\b/i },
  { token: "MMCM/PLL", pattern: /\b(MMCME2|PLLE2)\b/i },
  { token: "SERDES", pattern: /\b(I|O)SERDESE2\b/i },
  { token: "ILA/VIO", pattern: /\b(ILA|VIO)\b/i },
];

export function chooseImplementBackend(capabilities, platform, backendId = "open") {
  const normalizedPlatform = typeof platform === "string" ? platform : "unknown";
  const sourceFor = (tool) =>
    tool?.source === "bundled" ||
    tool?.source === "buildpack" ||
    tool?.source === "system" ||
    tool?.source === "found_not_in_path" ||
    tool?.source === "not_found"
      ? tool.source
      : "not_found";
  const statusFor = (tool) =>
    tool?.status === "ok" || tool?.status === "found_not_in_path" || tool?.status === "missing" ? tool.status : "ok";
  const integrityFor = (tool) =>
    tool?.integrity === "verified" || tool?.integrity === "corrupt" || tool?.integrity === "unknown"
      ? tool.integrity
      : sourceFor(tool) === "bundled" || sourceFor(tool) === "buildpack"
        ? "unknown"
        : "unknown";
  const isReady = (tool) => statusFor(tool) === "ok";
  const isVerifiedManagedOpenTool = (tool) => {
    const source = sourceFor(tool);
    return isReady(tool) && (source === "bundled" || source === "buildpack") && integrityFor(tool) === "verified";
  };
  const isVerifiedBuildpackTool = (tool) => {
    return isReady(tool) && sourceFor(tool) === "buildpack" && integrityFor(tool) === "verified";
  };
  const isVerifiedSystemTool = (tool) => {
    return isReady(tool) && sourceFor(tool) === "system";
  };
  const isVerifiedVivadoFallback = (tool) => {
    const source = sourceFor(tool);
    if (!isReady(tool)) return false;
    if (source === "system") return true;
    if ((source === "bundled" || source === "buildpack") && integrityFor(tool) === "verified") return true;
    return false;
  };

  const hasBuildpackYosys = isVerifiedManagedOpenTool(capabilities?.yosys);
  const hasBuildpackF4pga = isVerifiedBuildpackTool(capabilities?.f4pga);
  const buildpackSignature = {
    name:
      typeof capabilities?.f4pga?.buildpackName === "string" && capabilities.f4pga.buildpackName.trim().length > 0
        ? capabilities.f4pga.buildpackName.trim()
        : typeof capabilities?.yosys?.buildpackName === "string" && capabilities.yosys.buildpackName.trim().length > 0
          ? capabilities.yosys.buildpackName.trim()
          : "",
    version:
      typeof capabilities?.f4pga?.buildpackVersion === "string" && capabilities.f4pga.buildpackVersion.trim().length > 0
        ? capabilities.f4pga.buildpackVersion.trim()
        : typeof capabilities?.yosys?.buildpackVersion === "string" && capabilities.yosys.buildpackVersion.trim().length > 0
          ? capabilities.yosys.buildpackVersion.trim()
          : "",
    contractId:
      typeof capabilities?.f4pga?.buildpackContractId === "string" &&
      capabilities.f4pga.buildpackContractId.trim().length > 0
        ? capabilities.f4pga.buildpackContractId.trim()
        : typeof capabilities?.yosys?.buildpackContractId === "string" &&
            capabilities.yosys.buildpackContractId.trim().length > 0
          ? capabilities.yosys.buildpackContractId.trim()
          : "",
  };
  const buildpackSignatureReady = isBasys3BuildpackSignature(buildpackSignature);
  const hasVivado = isVerifiedVivadoFallback(capabilities?.vivado);
  const hasSystemYosys = isVerifiedSystemTool(capabilities?.yosys);
  const hasSystemNextpnr = isVerifiedSystemTool(capabilities?.nextpnrXilinx);
  const hasSystemF4pga = isVerifiedSystemTool(capabilities?.f4pga);
  const systemNextpnrKnownSupported = hasSystemYosys && hasSystemNextpnr && normalizedPlatform !== "win32";

  const buildpackOpenReady = hasBuildpackYosys && hasBuildpackF4pga && buildpackSignatureReady;
  if (buildpackOpenReady) return "buildpack-open";
  if (backendId === "vivado" && hasVivado) return "vivado-fallback";
  if (hasVivado) return "vivado-fallback";
  if (systemNextpnrKnownSupported) return "nextpnr-xilinx";
  if (hasSystemYosys && hasSystemF4pga) return "f4pga";
  return "none";
}

function resolvePlanBuildpack(capabilities, backend) {
  if (backend !== "buildpack-open") return null;
  const candidates = [capabilities?.f4pga, capabilities?.nextpnrXilinx, capabilities?.yosys]
    .filter(Boolean)
    .filter((tool) => tool?.source === "buildpack" && tool?.integrity === "verified")
    .map((tool) => ({
      name: typeof tool.buildpackName === "string" ? tool.buildpackName.trim() : "",
      version: typeof tool.buildpackVersion === "string" ? tool.buildpackVersion.trim() : "",
      contractId:
        typeof tool.buildpackContractId === "string" && tool.buildpackContractId.trim().length > 0
          ? tool.buildpackContractId.trim()
          : "",
    }))
    .filter((entry) => isBasys3BuildpackSignature(entry));
  if (candidates.length === 0) return null;
  candidates.sort((left, right) => {
    if (left.name !== right.name) return left.name.localeCompare(right.name);
    if (left.version !== right.version) return left.version.localeCompare(right.version);
    return left.contractId.localeCompare(right.contractId);
  });
  const selected = candidates[0];
  return {
    name: selected.name,
    version: selected.version,
    ...(selected.contractId.length > 0 ? { contractId: selected.contractId } : {}),
  };
}

function buildRequiredTools(backend, capabilities) {
  const defs = TOOL_DEFS_BY_BACKEND[backend] || TOOL_DEFS_BY_BACKEND.none;
  return sortEntries(
    defs.map((toolDef) => {
      const cap = capabilities?.[toolDef.capKey];
      const status = cap?.status === "ok" || cap?.status === "found_not_in_path" || cap?.status === "missing"
        ? cap.status
        : cap
          ? "ok"
          : "missing";
      return {
        name: toolDef.name,
        ok: Boolean(cap) && status === "ok",
        ...(typeof cap?.version === "string" ? { version: cap.version } : {}),
        ...(cap?.source === "bundled" ||
        cap?.source === "buildpack" ||
        cap?.source === "system" ||
        cap?.source === "not_found" ||
        cap?.source === "found_not_in_path"
          ? { source: cap.source }
          : {}),
        ...(cap?.integrity === "verified" || cap?.integrity === "corrupt" || cap?.integrity === "unknown"
          ? { integrity: cap.integrity }
          : {}),
        why: toolDef.why,
      };
    }),
    (tool) => tool.name
  );
}

function resolveCapabilityExecutable(commandName, capabilities) {
  if (typeof commandName !== "string" || commandName.trim().length === 0) return commandName;
  const CAPABILITY_BY_COMMAND = {
    yosys: "yosys",
    "nextpnr-xilinx": "nextpnrXilinx",
    f4pga: "f4pga",
    vivado: "vivado",
  };
  const capabilityKey = CAPABILITY_BY_COMMAND[commandName];
  if (!capabilityKey) return commandName;
  const capability = capabilities?.[capabilityKey];
  const isReady = capability?.status === "ok" || capability?.status === undefined;
  if (!isReady) return commandName;
  if (typeof capability?.path === "string" && capability.path.trim().length > 0) {
    return capability.path.trim();
  }
  return commandName;
}

function buildCommands(backend, context, capabilities) {
  const commands = COMMANDS_BY_BACKEND[backend] || [];
  return sortEntries(
    commands.map((command) => ({
      step: command.step,
      argv: command.argv.map((arg, index) => {
        const resolved = String(arg)
          .split("<top>")
          .join(context.top)
          .split("<sources>")
          .join(context.sourceArgs)
          .split("<constraints>")
          .join(context.constraintsPath);
        if (index !== 0) return resolved;
        return resolveCapabilityExecutable(resolved, capabilities);
      }),
      envKeysUsed: [...command.envKeysUsed].sort((a, b) => a.localeCompare(b)),
    })),
    (command) => `${command.step}\u0000${command.argv.join("\u0001")}`
  );
}

function buildOutputs(backend) {
  return sortEntries(
    (OUTPUTS_BY_BACKEND[backend] || []).map((output) => ({ ...output })),
    (output) => `${output.name}\u0000${output.pathHint}`
  );
}

function extractUnsupportedMarkers(project) {
  const joined = project.hdl.sources
    .filter((source) => source.language === "verilog")
    .map((source) => source.text)
    .join("\n");
  return UNSUPPORTED_MARKERS
    .filter((entry) => entry.pattern.test(joined))
    .map((entry) => entry.token)
    .sort((a, b) => a.localeCompare(b));
}

export function buildImplementPlan(input) {
  const backendId = input?.backendId === "open" ? "open" : "vivado";
  const normalizedProject = normalizeProject(input?.project || {});
  const capabilities = input?.capabilities && typeof input.capabilities === "object" ? input.capabilities : {};
  const platform = typeof input?.platform === "string" ? input.platform : "unknown";
  const backend = chooseImplementBackend(capabilities, platform, backendId);
  const requiredTools = buildRequiredTools(backend, capabilities);
  const buildpack = resolvePlanBuildpack(capabilities, backend);
  const commandContext = {
    top: normalizedProject.hdl.top || "top",
    sourceArgs: normalizedProject.hdl.sources
      .map((source) => source.path)
      .sort((left, right) => left.localeCompare(right))
      .map((entry) => (entry.includes(" ") ? `"${entry}"` : entry))
      .join(" "),
    constraintsPath: normalizedProject.fpga.constraints?.text?.trim() ? "constraints.xdc" : "constraints.xdc",
  };
  const commands = buildCommands(backend, commandContext, capabilities);
  const outputs = buildOutputs(backend);
  const run_id = deterministicId("bridge-implement-plan-run", {
    backend_id: backendId,
    backend,
    platform,
    project: {
      board: normalizedProject.fpga.board,
      top: normalizedProject.hdl.top,
      hasXdc: Boolean(normalizedProject.fpga.constraints?.text?.trim()),
      sourceCount: normalizedProject.hdl.sources.length,
      preset: normalizedProject.fpga.preset || null,
    },
    tools: requiredTools.map((tool) => ({
      name: tool.name,
      ok: tool.ok,
      version: tool.version || null,
      why: tool.why,
    })),
  });

  const warningMessages = [];
  if (normalizedProject.hdl.sources.some((source) => source.language === "vhdl")) {
    warningMessages.push("[implement-plan] vhdl_sources_present: current open-flow plan models verilog-first execution.");
  }
  if (!normalizedProject.fpga.constraints?.text?.trim()) {
    warningMessages.push("[implement-plan] missing_xdc_constraints: implementation will fail without constraints.");
  }
  const unsupportedMarkers = extractUnsupportedMarkers(normalizedProject);
  if (unsupportedMarkers.length > 0) {
    warningMessages.push(`[implement-plan] unsupported_constructs_hint: ${unsupportedMarkers.join(", ")}`);
  }
  if (backend === "none") {
    warningMessages.push("[implement-plan] no_viable_backend: install nextpnr-xilinx/f4pga or Vivado fallback.");
  }
  if (backend === "buildpack-open" && !buildpack) {
    warningMessages.push("[implement-plan] buildpack_metadata_missing: selected buildpack-open but no compatible Basys3 buildpack signature was detected.");
  }
  if (backend !== "buildpack-open") {
    const hasManagedBuildpackCandidates =
      (capabilities?.yosys?.source === "buildpack" && capabilities?.yosys?.status === "ok") ||
      (capabilities?.f4pga?.source === "buildpack" && capabilities?.f4pga?.status === "ok");
    if (hasManagedBuildpackCandidates) {
      warningMessages.push(
        `[implement-plan] buildpack_contract_mismatch: available buildpack does not match required contract (${BASYS3_F4PGA_V0_CONTRACT.contractId}).`
      );
    }
  }

  const warnings = warningMessages
    .sort((a, b) => a.localeCompare(b))
    .map((msg, index) => ({
      run_id,
      ts: index,
      step: "pnr",
      level: "warn",
      msg,
    }));

  const logs = [
    {
      run_id,
      ts: 0,
      step: "pnr",
      level: "info",
      msg: `[${backendId}] implement-plan: selected backend ${backend}`,
      data: {
        board: normalizedProject.fpga.board,
        top: normalizedProject.hdl.top,
        sourceCount: normalizedProject.hdl.sources.length,
        ...(buildpack ? { buildpack } : {}),
      },
    },
    {
      run_id,
      ts: 1,
      step: "pnr",
      level: "info",
      msg: `[${backendId}] implement-plan: required tools checked (${requiredTools.length})`,
    },
    {
      run_id,
      ts: 2,
      step: "pnr",
      level: "info",
      msg: `[${backendId}] implement-plan: command steps prepared (${commands.length})`,
    },
  ];

  const planId = deterministicId("bridge-implement-plan", {
    backend,
    requiredTools: requiredTools.map((tool) => ({
      name: tool.name,
      ok: tool.ok,
      version: tool.version || null,
      source: tool.source || null,
      integrity: tool.integrity || null,
      why: tool.why,
    })),
    commands,
    outputs,
    warnings: warnings.map((entry) => entry.msg),
  });

  return {
    schema_version: IMPLEMENT_PLAN_SCHEMA_VERSION,
    ok: backend !== "none",
    run_id,
    planId,
    backend,
    ...(buildpack ? { buildpack } : {}),
    requiredTools,
    commands,
    outputs,
    warnings,
    logs,
  };
}

export function isImplementPlanRequest(value) {
  if (!value || typeof value !== "object") return false;
  if (value.schema_version !== IMPLEMENT_PLAN_REQUEST_SCHEMA_VERSION) return false;
  if (value.backend_id !== "open" && value.backend_id !== "vivado") return false;
  if (typeof value.refresh_probe !== "boolean") return false;
  if (!value.project || typeof value.project !== "object") return false;
  return true;
}
