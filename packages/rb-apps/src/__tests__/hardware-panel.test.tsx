import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type MockConnectionState =
  | { status: "offline"; reason: "disabled" | "unavailable" | "failed"; message: string }
  | {
      status: "connected";
      bridge: { ok: boolean; version?: string; uptimeMs?: number; status?: string; wsPort?: number; activeRunCount?: number };
      devices: Array<{ deviceId: string; boardModel: string; transport?: string; runtime?: { status?: string } }>;
      ws: null;
    };

const mockBackend = {
  id: "vivado" as const,
  synthesize: vi.fn(async () => ({ kind: "netlist", backend: "vivado", format: "stub" })),
  implement: vi.fn(async () => ({ kind: "implemented", backend: "vivado", format: "stub" })),
  bitgen: vi.fn(async () => ({ kind: "bitstream", backend: "vivado", format: "stub" })),
  program: vi.fn(async () => ({ ok: false, backend: "vivado" })),
  probeTools: vi.fn(async () => ({
    schema_version: "toolchain_probe_v1",
    ok: true,
    run_id: "probe-0",
    tools: [{ name: "openFPGALoader", ok: true }],
    logs: [],
  })),
  preflight: vi.fn(async () => ({
    schema_version: "toolchain_preflight_v1",
    run_id: "preflight-0",
    ts: 0,
    project: { board: "basys3", hasHdl: true, top: "top", hasXdc: true, preset: null },
    lint: { ok: true, warnings: [], errors: [] },
    tools: [],
    overallOk: true,
  })),
  programBitstream: vi.fn(),
  getRunStatus: vi.fn(),
  cancelRun: vi.fn(),
  detectBoards: vi.fn(),
  openRunStream: vi.fn(),
  doctorReport: vi.fn(async () => ({
    schema_version: "rb_toolchain_doctor_v1",
    reportId: "report-0",
    backend_id: "vivado",
    bridge_url: "http://127.0.0.1:4242",
    probe: null,
    logs: [],
  })),
};

let hardwareState: MockConnectionState = {
  status: "offline",
  reason: "disabled",
  message: "Hardware integration disabled (demo mode)",
};

const hardwareClientMock = {
  getState: vi.fn(() => hardwareState),
  subscribe: vi.fn((listener: (state: MockConnectionState) => void) => {
    listener(hardwareState);
    return () => {};
  }),
  connect: vi.fn(),
};

vi.mock("../fpga/toolchainBackend", () => ({
  getToolchainBackend: vi.fn(() => mockBackend),
  getToolchainBackendId: vi.fn(() => "vivado"),
}));

vi.mock("../services/hardwareClient", () => ({
  hardwareClient: hardwareClientMock,
}));

class MockFileReader {
  result: string | null = null;

  onload: (() => void) | null = null;

  onerror: (() => void) | null = null;

  readAsDataURL() {
    this.result = "data:application/octet-stream;base64,QUJDRA==";
    this.onload?.();
  }
}

const { HardwarePanelApp } = await import("../apps/HardwarePanelApp");
const Component = HardwarePanelApp.component;

describe("HardwarePanelApp", () => {
  beforeEach(() => {
    vi.stubGlobal("FileReader", MockFileReader as unknown as typeof FileReader);
    hardwareState = {
      status: "offline",
      reason: "disabled",
      message: "Hardware integration disabled (demo mode)",
    };
    hardwareClientMock.subscribe.mockClear();
    hardwareClientMock.getState.mockClear();
    hardwareClientMock.connect.mockClear();
    mockBackend.programBitstream.mockReset();
    mockBackend.getRunStatus.mockReset();
    mockBackend.cancelRun.mockReset();
    mockBackend.detectBoards.mockReset();
    mockBackend.openRunStream.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("shows offline state in demo mode", async () => {
    render(<Component />);
    const offlineMatches = await screen.findAllByText(/hardware integration disabled \(demo mode\)/i);
    expect(offlineMatches.length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Program FPGA/i })).toBeDisabled();
  });

  it("program flow tries stream then falls back to polling with incremental logs", async () => {
    vi.useFakeTimers();
    hardwareState = {
      status: "connected",
      bridge: { ok: true, version: "dev", activeRunCount: 0 },
      devices: [
        {
          deviceId: "basys3-0",
          boardModel: "Basys 3",
          transport: "serial",
          runtime: { status: "ready" },
        },
      ],
      ws: null,
    };

    mockBackend.programBitstream.mockResolvedValue({
      ok: true,
      runId: "program-bitstream-aaaa-r0000",
      artifactId: "program-bitstream-aaaa",
      state: "running",
      nextOffset: 1,
      logs: [
        {
          run_id: "program-bitstream-aaaa-r0000",
          ts: 0,
          step: "program",
          level: "info",
          msg: "start",
        },
      ],
    });

    mockBackend.openRunStream.mockReturnValue(null);
    mockBackend.getRunStatus
      .mockResolvedValueOnce({
        runId: "program-bitstream-aaaa-r0000",
        artifactId: "program-bitstream-aaaa",
        state: "running",
        ok: null,
        exitCode: null,
        logs: [
          {
            run_id: "program-bitstream-aaaa-r0000",
            ts: 1,
            step: "program",
            level: "info",
            msg: "poll-1",
          },
        ],
        nextOffset: 2,
      })
      .mockResolvedValueOnce({
        runId: "program-bitstream-aaaa-r0000",
        artifactId: "program-bitstream-aaaa",
        state: "done",
        ok: true,
        exitCode: 0,
        logs: [
          {
            run_id: "program-bitstream-aaaa-r0000",
            ts: 2,
            step: "program",
            level: "info",
            msg: "poll-2",
          },
        ],
        nextOffset: 3,
      });

    render(<Component />);

    const fileInput = screen.getByTitle("Select Bitstream File") as HTMLInputElement;
    const bitFile = new File(["bit"], "demo.bit", { type: "application/octet-stream" });
    fireEvent.change(fileInput, { target: { files: [bitFile] } });

    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText(/demo\.bit/i)).toBeTruthy();

    const programButton = screen.getByRole("button", { name: /Program FPGA/i });
    expect(programButton).not.toBeDisabled();
    fireEvent.click(programButton);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockBackend.programBitstream).toHaveBeenCalledTimes(1);
    expect(mockBackend.openRunStream).toHaveBeenCalledTimes(1);
    expect(mockBackend.getRunStatus).toHaveBeenCalledTimes(1);

    expect(screen.getByText("Running")).toBeTruthy();
    expect(
      screen.getByText((content, element) => {
        if (element?.tagName.toLowerCase() !== "pre") return false;
        return content.includes("start") && content.includes("poll-1");
      })
    ).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
      await Promise.resolve();
    });

    expect(mockBackend.getRunStatus).toHaveBeenCalledTimes(2);
    expect(
      screen.getByText((content, element) => {
        if (element?.tagName.toLowerCase() !== "pre") return false;
        return content.includes("poll-2");
      })
    ).toBeTruthy();
    expect(screen.getByText("Success")).toBeTruthy();
  });

  it("shows cancel control while running and transitions to canceled", async () => {
    hardwareState = {
      status: "connected",
      bridge: { ok: true, version: "dev", activeRunCount: 0 },
      devices: [
        {
          deviceId: "basys3-0",
          boardModel: "Basys 3",
          transport: "serial",
          runtime: { status: "ready" },
        },
      ],
      ws: null,
    };

    mockBackend.programBitstream.mockResolvedValue({
      ok: true,
      runId: "program-bitstream-cccc-r0000",
      artifactId: "program-bitstream-cccc",
      state: "running",
      nextOffset: 1,
      logs: [
        {
          run_id: "program-bitstream-cccc-r0000",
          ts: 0,
          step: "program",
          level: "info",
          msg: "start",
        },
      ],
    });

    mockBackend.openRunStream.mockReturnValue({ close: vi.fn() });
    mockBackend.cancelRun.mockResolvedValue({
      runId: "program-bitstream-cccc-r0000",
      artifactId: "program-bitstream-cccc",
      state: "canceled",
      ok: false,
      exitCode: -1,
      logs: [
        {
          run_id: "program-bitstream-cccc-r0000",
          ts: 1,
          step: "program",
          level: "warn",
          msg: "Canceled by user",
        },
      ],
      nextOffset: 2,
      error: "canceled_by_user",
    });

    render(<Component />);

    const fileInput = screen.getByTitle("Select Bitstream File") as HTMLInputElement;
    const bitFile = new File(["bit"], "demo.bit", { type: "application/octet-stream" });
    fireEvent.change(fileInput, { target: { files: [bitFile] } });
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole("button", { name: /Program FPGA/i }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const cancelButton = screen.getByRole("button", { name: /Cancel Program/i });
    expect(cancelButton).toBeTruthy();
    fireEvent.click(cancelButton);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockBackend.cancelRun).toHaveBeenCalledWith("program-bitstream-cccc-r0000");
    expect(screen.getByText("Canceled")).toBeTruthy();
    expect(
      screen.getByText((content, element) => {
        if (element?.tagName.toLowerCase() !== "pre") return false;
        return content.toLowerCase().includes("canceled by user");
      })
    ).toBeTruthy();
  });

  it("renders not-detected board state from detect endpoint", async () => {
    hardwareState = {
      status: "connected",
      bridge: { ok: true, version: "dev", activeRunCount: 0 },
      devices: [],
      ws: null,
    };

    mockBackend.detectBoards.mockResolvedValue({
      schema_version: "toolchain_board_detect_v1",
      ok: true,
      run_id: "board-detect-0",
      boards: [],
      tools: {
        openFPGALoader: { ok: true, version: "0.12.0", path: "openFPGALoader.exe" },
      },
      logs: [],
    });

    render(<Component />);
    fireEvent.click(screen.getByRole("button", { name: /Detect Board/i }));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockBackend.detectBoards).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Not detected\./i)).toBeTruthy();
  });

  it("shows board busy banner and cancels active run", async () => {
    hardwareState = {
      status: "connected",
      bridge: { ok: true, version: "dev", activeRunCount: 1 },
      devices: [
        {
          deviceId: "basys3-0",
          boardModel: "Basys 3",
          transport: "serial",
          runtime: { status: "ready" },
        },
      ],
      ws: null,
    };

    mockBackend.programBitstream.mockResolvedValue({
      ok: false,
      runId: "program-bitstream-busy-r0000",
      artifactId: "program-bitstream-busy",
      activeRunId: "program-bitstream-active-r0001",
      error: "BOARD_BUSY",
      logs: [
        {
          run_id: "program-bitstream-active-r0001",
          ts: 0,
          step: "program",
          level: "warn",
          msg: "Board busy: another run is active.",
        },
      ],
      nextOffset: 1,
      state: "running",
    });
    mockBackend.cancelRun.mockResolvedValue({
      runId: "program-bitstream-active-r0001",
      artifactId: "program-bitstream-busy",
      state: "canceled",
      ok: false,
      exitCode: -1,
      logs: [
        {
          run_id: "program-bitstream-active-r0001",
          ts: 1,
          step: "program",
          level: "warn",
          msg: "Canceled by user",
        },
      ],
      nextOffset: 2,
      error: "canceled_by_user",
    });
    mockBackend.openRunStream.mockReturnValue(null);

    render(<Component />);

    const fileInput = screen.getByTitle("Select Bitstream File") as HTMLInputElement;
    const bitFile = new File(["bit"], "demo.bit", { type: "application/octet-stream" });
    fireEvent.change(fileInput, { target: { files: [bitFile] } });
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole("button", { name: /Program FPGA/i }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const busyMatches = screen.getAllByText(/Board Busy/i);
    expect(busyMatches.length).toBeGreaterThan(0);
    const cancelBusyButton = screen.getByRole("button", { name: /Cancel Active Run/i });
    fireEvent.click(cancelBusyButton);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockBackend.cancelRun).toHaveBeenCalledWith("program-bitstream-active-r0001");
    expect(screen.queryByRole("button", { name: /Cancel Active Run/i })).toBeNull();
  });
});
