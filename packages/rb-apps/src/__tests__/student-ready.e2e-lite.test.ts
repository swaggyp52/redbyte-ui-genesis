import { describe, expect, it } from 'vitest';
import { createToolchainDoctorReport } from '../fpga/toolchainBackend';

describe('student-ready.e2e-lite', () => {
  it('reports needs_action when toolchain is unavailable', () => {
    const report = createToolchainDoctorReport({
      backend_id: 'vivado',
      bridge_url: 'http://127.0.0.1:4242',
      probe: {
        schema_version: 'toolchain_probe_v1',
        ok: false,
        run_id: 'probe-missing',
        tools: [
          {
            name: 'vivado',
            ok: false,
            status: 'missing',
            source: 'not_found',
            error: 'not_found',
          },
          {
            name: 'openFPGALoader',
            ok: false,
            status: 'missing',
            source: 'not_found',
            error: 'not_found',
          },
        ],
        logs: [],
      },
      project: {
        hdl: {
          top: 'top',
          sources: [{ path: 'top.v', language: 'verilog', text: 'module top; endmodule\n' }],
        },
        fpga: { board: 'basys3' },
      },
      logs: [],
    });

    expect(report.studentReadiness?.overall).toBe('needs_action');
    expect(report.studentReadiness?.gates.map((gate) => gate.id)).toEqual([
      'toolchain_probe',
      'preflight',
      'implement_plan',
      'toolchain_ui',
      'doctor_export',
    ]);
    expect(report.studentReadiness?.gates.find((gate) => gate.id === 'toolchain_probe')?.state).toBe('warn');
    expect(report.studentReadiness?.gates.find((gate) => gate.id === 'implement_plan')?.state).toBe('warn');
    expect(report.studentReadiness?.gates.find((gate) => gate.id === 'doctor_export')?.state).toBe('pass');
  });

  it('reports ready when probe, preflight, and plan are all green', () => {
    const report = createToolchainDoctorReport({
      backend_id: 'vivado',
      bridge_url: 'http://127.0.0.1:4242',
      probe: {
        schema_version: 'toolchain_probe_v1',
        ok: true,
        run_id: 'probe-ok',
        tools: [
          { name: 'vivado', ok: true, status: 'ok', source: 'system', version: '2024.2' },
          { name: 'openFPGALoader', ok: true, status: 'ok', source: 'bundled', integrity: 'verified', version: '0.13.0' },
        ],
        logs: [],
      },
      preflight: {
        schema_version: 'toolchain_preflight_v1',
        run_id: 'preflight-ok',
        ts: 0,
        project: {
          board: 'basys3',
          hasHdl: true,
          top: 'top',
          hasXdc: true,
          preset: 'basys3-switches-leds-7seg',
        },
        lint: { ok: true, warnings: [], errors: [] },
        tools: [{ name: 'vivado', ok: true, status: 'ok', source: 'system', version: '2024.2' }],
        overallOk: true,
      },
      buildPath: {
        schema_version: 'toolchain_build_path_v1',
        plannerVersion: 'toolchain_planner_v1',
        planId: 'plan-1',
        backend: 'vivado-fallback',
        board: 'basys3',
        top: 'top',
        constraintsPreset: 'basys3-switches-leds-7seg',
        requiredTools: [{ name: 'vivado', ok: true, source: 'system', why: 'stable backend' }],
        commands: [],
        outputs: [],
        warnings: [],
      },
      project: {
        hdl: {
          top: 'top',
          sources: [{ path: 'top.v', language: 'verilog', text: 'module top; endmodule\n' }],
        },
        fpga: {
          board: 'basys3',
          constraints: { type: 'xdc', text: 'set_property -dict { PACKAGE_PIN W5 IOSTANDARD LVCMOS33 } [get_ports clk]\n' },
        },
      },
      logs: [],
    });

    expect(report.studentReadiness?.overall).toBe('ready');
    expect(report.studentReadiness?.gates.every((gate) => gate.state === 'pass')).toBe(true);
  });
});

