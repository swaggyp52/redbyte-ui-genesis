import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockBackend = {
  id: "vivado" as const,
  probeTools: vi.fn(),
  detectBoards: vi.fn(),
  resolveBuildPath: vi.fn(),
  preflight: vi.fn(),
  doctorReport: vi.fn(),
  getBuildpackStatus: vi.fn(),
  installBuildpack: vi.fn(),
  getBuildpackRunStatus: vi.fn(),
  openBuildpackRunStream: vi.fn(),
  removeBuildpack: vi.fn(),
};

vi.mock("../fpga/toolchainBackend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../fpga/toolchainBackend")>();
  return {
    ...actual,
    getToolchainBackend: vi.fn(() => mockBackend),
    getToolchainBackendId: vi.fn(() => "vivado"),
  };
});

const { ToolchainSetupApp } = await import("../apps/ToolchainSetupApp");
const Component = ToolchainSetupApp.component;

describe("ToolchainSetupApp", () => {
  const submissionStatusKey = "rb:submission-bundle:last";
  const uiModeKey = "rb:mode:v1";
  const lockdownKey = "rb:classroom-lockdown:v1";

  beforeEach(() => {
    mockBackend.probeTools.mockReset();
    mockBackend.detectBoards.mockReset();
    mockBackend.resolveBuildPath.mockReset();
    mockBackend.preflight.mockReset();
    mockBackend.doctorReport.mockReset();
    mockBackend.getBuildpackStatus.mockReset();
    mockBackend.installBuildpack.mockReset();
    mockBackend.getBuildpackRunStatus.mockReset();
    mockBackend.openBuildpackRunStream.mockReset();
    mockBackend.removeBuildpack.mockReset();

    mockBackend.probeTools.mockResolvedValue({
      schema_version: "toolchain_probe_v1",
      ok: true,
      run_id: "probe-1",
      env: { platform: "win32", arch: "x64", node: "20.11.0" },
      tools: [
        { name: "vivado", ok: true, status: "ok", version: "2024.2" },
        { name: "openFPGALoader", ok: true, status: "ok", version: "0.13.0" },
        { name: "yosys", ok: true, status: "ok", source: "bundled", integrity: "verified", version: "0.48.0" },
      ],
      logs: [],
    });

    mockBackend.detectBoards.mockResolvedValue({
      schema_version: "toolchain_board_detect_v1",
      ok: true,
      run_id: "detect-1",
      boards: [{ type: "basys3", transport: "usb-jtag", detectedBy: "openFPGALoader" }],
      tools: { openFPGALoader: { ok: true, version: "0.13.0" } },
      logs: [],
    });

    mockBackend.resolveBuildPath.mockResolvedValue({
      schema_version: "toolchain_build_path_v1",
      plannerVersion: "toolchain_planner_v1",
      planId: "plan-1",
      backend: "vivado-fallback",
      board: "basys3",
      top: "top",
      constraintsPreset: "basys3-switches-leds-7seg",
      requiredTools: [],
      commands: [],
      outputs: [],
      warnings: [],
    });

    mockBackend.preflight.mockResolvedValue({
      schema_version: "toolchain_preflight_v1",
      run_id: "preflight-1",
      ts: 0,
      project: { board: "basys3", hasHdl: true, top: "top", hasXdc: true, preset: "basys3-switches-leds-7seg" },
      lint: { ok: true, warnings: [], errors: [] },
      tools: [],
      overallOk: true,
    });

    mockBackend.getBuildpackStatus.mockResolvedValue({
      schema_version: "toolchain_buildpack_status_v1",
      ok: false,
      run_id: "buildpack-status-1",
      platformKey: "win32-x64",
      storeRoot: "C:\\Users\\Student\\AppData\\Local\\redbyte\\buildpacks",
      installed: [],
      tools: {},
      logs: [],
    });
    mockBackend.installBuildpack.mockResolvedValue({
      runId: "buildpack-run-1",
      artifactId: "buildpack-artifact-1",
      state: "done",
      ok: true,
      exitCode: 0,
      logs: [],
      nextOffset: 0,
    });
    mockBackend.getBuildpackRunStatus.mockResolvedValue({
      runId: "buildpack-run-1",
      artifactId: "buildpack-artifact-1",
      state: "done",
      ok: true,
      exitCode: 0,
      logs: [],
      nextOffset: 0,
    });
    mockBackend.openBuildpackRunStream.mockReturnValue(null);
    mockBackend.removeBuildpack.mockResolvedValue({
      schema_version: "toolchain_buildpack_remove_v1",
      ok: true,
      run_id: "buildpack-remove-1",
      removed: false,
      logs: [],
    });

    window.localStorage.setItem(
      submissionStatusKey,
      JSON.stringify({
        schema_version: "rb_submission_bundle_status_v1",
        bundleId: "bundle-1",
        filename: "rb-submission-bundle-1.zip",
        reproducibilityStatus: "pass",
      })
    );
    window.localStorage.setItem(uiModeKey, "ta");
    window.localStorage.setItem(lockdownKey, JSON.stringify({ enabled: false }));
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders the setup page route surface", async () => {
    render(<Component />);
    expect(screen.getByTestId("toolchain-setup-page")).toBeTruthy();
    expect(screen.getByText("Toolchain Setup")).toBeTruthy();
    expect(screen.getByTestId("toolchain-setup-student-readiness")).toBeTruthy();
    await waitFor(() => {
      expect(mockBackend.getBuildpackStatus).toHaveBeenCalledTimes(1);
    });
  });

  it("defaults to student mode and hides TA-only sections", async () => {
    window.localStorage.removeItem(uiModeKey);
    window.localStorage.setItem(lockdownKey, JSON.stringify({ enabled: false }));
    render(<Component />);
    expect(screen.getByTestId("toolchain-setup-mode-label").textContent).toContain("student");
    expect(screen.queryByTestId("toolchain-setup-buildpack")).toBeNull();
    expect(screen.queryByTestId("toolchain-setup-ta-mode")).toBeNull();
    expect(screen.queryByTestId("toolchain-setup-open-submission-cta")).toBeNull();
    expect(screen.queryByTestId("toolchain-setup-export-diagnostics-button")).toBeNull();
  });

  it("shows minimal readiness view when classroom lockdown is enabled for students", async () => {
    window.localStorage.setItem(uiModeKey, "student");
    window.localStorage.setItem(lockdownKey, JSON.stringify({ enabled: true }));

    render(<Component />);
    expect(screen.getByTestId("toolchain-setup-lockdown-label").textContent).toContain("on");
    expect(screen.getByTestId("toolchain-setup-lockdown-minimal")).toBeInTheDocument();
    expect(screen.queryByTestId("toolchain-setup-required-tools")).toBeNull();
    expect(screen.queryByTestId("toolchain-setup-buildpack")).toBeNull();
    expect(screen.queryByTestId("toolchain-setup-export-diagnostics-button")).toBeNull();
  });

  it("keeps TA surfaces visible under lockdown when TA override is enabled", async () => {
    window.localStorage.setItem(uiModeKey, "ta");
    window.localStorage.setItem(lockdownKey, JSON.stringify({ enabled: true }));

    render(<Component />);
    await waitFor(() => {
      expect(mockBackend.getBuildpackStatus).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByTestId("toolchain-setup-lockdown-toggle")).toBeInTheDocument();
    expect(screen.getByTestId("toolchain-setup-buildpack")).toBeInTheDocument();
    expect(screen.getByTestId("toolchain-setup-export-diagnostics-button")).toBeInTheDocument();
  });

  it("shows found_not_in_path with suggested fix after verify", async () => {
    mockBackend.probeTools.mockResolvedValueOnce({
      schema_version: "toolchain_probe_v1",
      ok: false,
      run_id: "probe-2",
      env: { platform: "win32", arch: "x64", node: "20.11.0" },
      tools: [
        {
          name: "vivado",
          ok: false,
          status: "found_not_in_path",
          error: "not_on_path",
          suggestedFix: "Add C:\\Xilinx\\Vivado\\2024.2\\bin to PATH and restart RedByte.",
        },
        { name: "openFPGALoader", ok: true, status: "ok", version: "0.13.0" },
        { name: "yosys", ok: true, status: "ok", source: "bundled", integrity: "verified", version: "0.48.0" },
      ],
      logs: [],
    });

    render(<Component />);
    fireEvent.click(screen.getByTestId("toolchain-setup-verify-button"));

    await waitFor(() => {
      expect(screen.getByTestId("toolchain-setup-tool-vivado").textContent).toContain("found_not_in_path");
    });
    expect(screen.getByTestId("toolchain-setup-tool-vivado").textContent).toContain(
      "Add C:\\Xilinx\\Vivado\\2024.2\\bin to PATH and restart RedByte."
    );
  });

  it("runs verify calls in probe -> detect -> plan order", async () => {
    render(<Component />);
    fireEvent.click(screen.getByTestId("toolchain-setup-verify-button"));

    await waitFor(() => {
      expect(mockBackend.probeTools).toHaveBeenCalledTimes(1);
      expect(mockBackend.detectBoards).toHaveBeenCalledTimes(1);
      expect(mockBackend.resolveBuildPath).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/Selected backend: vivado-fallback/i)).toBeTruthy();
    });

    const probeOrder = mockBackend.probeTools.mock.invocationCallOrder[0];
    const detectOrder = mockBackend.detectBoards.mock.invocationCallOrder[0];
    const planOrder = mockBackend.resolveBuildPath.mock.invocationCallOrder[0];

    expect(probeOrder).toBeLessThan(detectOrder);
    expect(detectOrder).toBeLessThan(planOrder);
    expect(screen.getByTestId("toolchain-setup-student-readiness-overall").textContent).toContain("ready");
  });

  it("marks student readiness needs_action when preflight fails", async () => {
    mockBackend.preflight.mockResolvedValueOnce({
      schema_version: "toolchain_preflight_v1",
      run_id: "preflight-fail-1",
      ts: 0,
      project: { board: "basys3", hasHdl: true, top: "top", hasXdc: false, preset: null },
      lint: {
        ok: false,
        warnings: [],
        errors: [{ run_id: "preflight-fail-1", ts: 0, step: "preflight", level: "error", msg: "xdc_missing" }],
      },
      tools: [],
      overallOk: false,
    });

    render(<Component />);
    fireEvent.click(screen.getByTestId("toolchain-setup-verify-button"));

    await waitFor(() => {
      expect(screen.getByTestId("toolchain-setup-student-readiness-overall").textContent).toContain("needs_action");
    });
    expect(screen.getByTestId("toolchain-setup-readiness-preflight").textContent).toContain("fail");
  });

  it("renders buildpack-open backend with buildpack version in verify summary", async () => {
    mockBackend.resolveBuildPath.mockResolvedValueOnce({
      schema_version: "toolchain_build_path_v1",
      plannerVersion: "toolchain_planner_v1",
      planId: "plan-buildpack-1",
      backend: "buildpack-open",
      buildpack: { name: "basys3-open-toolchain", version: "0.1.0-dev" },
      board: "basys3",
      top: "top",
      constraintsPreset: "basys3-switches-leds-7seg",
      requiredTools: [],
      commands: [],
      outputs: [],
      warnings: [],
    });

    render(<Component />);
    fireEvent.click(screen.getByTestId("toolchain-setup-verify-button"));

    await waitFor(() => {
      expect(screen.getByText(/Selected backend: buildpack-open \(basys3-open-toolchain@0.1.0-dev\)\./i)).toBeTruthy();
    });
  });

  it("shows no-installs-needed summary when required tools are ready", async () => {
    render(<Component />);
    fireEvent.click(screen.getByTestId("toolchain-setup-verify-button"));

    await waitFor(() => {
      const summaryText = screen.getByTestId("toolchain-setup-no-installs-summary").textContent ?? "";
      expect(summaryText).toContain("Setup complete");
      expect(summaryText).toContain("no additional downloads needed.");
    });
  });

  it("renders submission inspector CTA and opens the inspector route", async () => {
    const onOpenApp = vi.fn();
    render(<Component onOpenApp={onOpenApp} />);
    await waitFor(() => {
      expect(mockBackend.getBuildpackStatus).toHaveBeenCalledTimes(1);
    });

    const helperText = screen.getByTestId("toolchain-setup-open-submission-help").textContent ?? "";
    expect(helperText).toContain("Grade or troubleshoot a student submission (.zip).");

    fireEvent.click(screen.getByTestId("toolchain-setup-open-submission-cta"));
    expect(onOpenApp).toHaveBeenCalledWith("submission-inspector");
  });

  it("renders diagnostics bundle export action in TA mode", async () => {
    render(<Component />);
    await waitFor(() => {
      expect(mockBackend.getBuildpackStatus).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByTestId("toolchain-setup-export-diagnostics-button")).toBeInTheDocument();
  });

  it("is discoverable in launcher navigation when registered", async () => {
    const { registerApp } = await import("../AppRegistry");
    const { getAppsForLauncher } = await import("../launcherData");

    registerApp(ToolchainSetupApp);

    const apps = await getAppsForLauncher();
    const ids = apps.map((entry) => entry.id);
    expect(ids).toContain("toolchain-setup");
  });

  it("filters tool rows by source and needs-action state", async () => {
    mockBackend.probeTools.mockResolvedValueOnce({
      schema_version: "toolchain_probe_v1",
      ok: true,
      run_id: "probe-3",
      env: { platform: "win32", arch: "x64", node: "20.11.0" },
      tools: [
        {
          name: "vivado",
          ok: false,
          status: "found_not_in_path",
          source: "found_not_in_path",
          error: "not_on_path",
          suggestedFix: "Add Vivado bin to PATH.",
        },
        {
          name: "openFPGALoader",
          ok: true,
          status: "ok",
          source: "bundled",
          version: "0.13.0",
          path: ".redbyte/tools/win32/openfpgaloader/openFPGALoader.exe",
        },
        {
          name: "yosys",
          ok: true,
          status: "ok",
          source: "bundled",
          integrity: "verified",
          version: "0.48.0",
          path: ".redbyte/tools/win32/yosys/yosys.exe",
        },
      ],
      logs: [],
    });

    render(<Component />);
    fireEvent.click(screen.getByTestId("toolchain-setup-verify-button"));

    await waitFor(() => {
      expect(screen.getByTestId("toolchain-setup-tool-vivado").textContent).toContain("found_not_in_path");
    });
    expect(screen.queryByTestId("toolchain-setup-tool-openFPGALoader")).toBeNull();

    fireEvent.click(screen.getByTestId("toolchain-setup-filter-bundled"));

    await waitFor(() => {
      expect(screen.getByTestId("toolchain-setup-tool-openFPGALoader")).toBeTruthy();
    });
    expect(screen.queryByTestId("toolchain-setup-tool-vivado")).toBeNull();
    expect(screen.getByTestId("toolchain-setup-tool-source-openFPGALoader").textContent).toContain("Bundled");
  });

  it("shows bundled corruption as needs-action with repair guidance", async () => {
    mockBackend.probeTools.mockResolvedValueOnce({
      schema_version: "toolchain_probe_v1",
      ok: false,
      run_id: "probe-4",
      env: { platform: "win32", arch: "x64", node: "20.11.0" },
      tools: [
        {
          name: "vivado",
          ok: true,
          status: "ok",
          source: "system",
          version: "2024.2",
        },
        {
          name: "openFPGALoader",
          ok: false,
          status: "missing",
          source: "bundled",
          integrity: "corrupt",
          error: "bundled_sha256_mismatch",
          suggestedFix: "Repair bundled tools by reinstalling RedByte.",
        },
        {
          name: "yosys",
          ok: false,
          status: "missing",
          source: "bundled",
          integrity: "corrupt",
          error: "bundled_sha256_mismatch",
          suggestedFix: "Repair Yosys bundle: delete bundled yosys payload and reinstall RedByte.",
        },
      ],
      logs: [],
    });

    render(<Component />);
    fireEvent.click(screen.getByTestId("toolchain-setup-verify-button"));

    await waitFor(() => {
      expect(screen.getByTestId("toolchain-setup-tool-openFPGALoader").textContent).toContain(
        "Corrupt bundle detected"
      );
    });
    await waitFor(() => {
      const yosysRow = screen.getByTestId("toolchain-setup-tool-yosys");
      expect(yosysRow.textContent).toContain("Corrupt bundle detected");
      expect(yosysRow.textContent).toContain("Repair Yosys bundle");
    });
  });

  it("runs buildpack install action and shows section", async () => {
    render(<Component />);

    await waitFor(() => {
      expect(screen.getByTestId("toolchain-setup-buildpack")).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId("toolchain-setup-buildpack-install"));

    await waitFor(() => {
      expect(mockBackend.installBuildpack).toHaveBeenCalledTimes(1);
    });
    expect(mockBackend.installBuildpack).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "basys3-open-toolchain",
        version: "0.1.0-dev",
      })
    );
  });

  it("shows submission bundle gate CTA when bundle has not been generated", async () => {
    window.localStorage.removeItem(submissionStatusKey);
    const onOpenApp = vi.fn();
    render(<Component onOpenApp={onOpenApp} />);

    const submissionGate = await screen.findByTestId("toolchain-setup-readiness-submission_bundle");
    expect(submissionGate.textContent).toContain("fail");

    fireEvent.click(screen.getByTestId("toolchain-setup-readiness-submission-cta"));
    expect(onOpenApp).toHaveBeenCalledWith("logic-playground");
  });

  it("updates submission bundle gate when a submission-generated event is emitted", async () => {
    window.localStorage.removeItem(submissionStatusKey);
    render(<Component />);

    await waitFor(() => {
      expect(screen.getByTestId("toolchain-setup-readiness-submission_bundle").textContent).toContain("fail");
    });

    const status = {
      schema_version: "rb_submission_bundle_status_v1" as const,
      bundleId: "bundle-lab-1",
      filename: "rb-submission-lab-1.zip",
      reproducibilityStatus: "pass" as const,
    };
    await act(async () => {
      window.localStorage.setItem(submissionStatusKey, JSON.stringify(status));
      window.dispatchEvent(new CustomEvent("rb:submission-bundle-generated", { detail: status }));
    });

    await waitFor(() => {
      const gate = screen.getByTestId("toolchain-setup-readiness-submission_bundle");
      expect(gate.textContent).toContain("pass");
      expect(gate.textContent).toContain("rb-submission-lab-1.zip");
    });
  });
});
