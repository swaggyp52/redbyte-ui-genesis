import { describe, expect, it } from 'vitest';
import { encodeToolchainDoctorReport } from '../fpga/toolchainBackend';

describe('encodeToolchainDoctorReport', () => {
  it('sorts tools deterministically and includes required fields', () => {
    const json = encodeToolchainDoctorReport({
      backend_id: 'vivado',
      bridge_url: 'http://127.0.0.1:4242',
      probe: {
        schema_version: 'toolchain_probe_v1',
        ok: true,
        run_id: 'bridge-probe-0',
        env: { platform: 'win32', arch: 'x64', node: 'v20.0.0' },
        tools: [
          { name: 'yosys', ok: false, error: 'not_found' },
          { name: 'openFPGALoader', ok: true, version: '0.12.0', path: 'openFPGALoader.exe' },
        ],
        logs: [
          { run_id: 'bridge-probe-0', ts: 1, step: 'probe', level: 'info', msg: 'b' },
          { run_id: 'bridge-probe-0', ts: 0, step: 'probe', level: 'info', msg: 'a' },
        ],
      },
      logs: Array.from({ length: 250 }, (_, i) => ({
        run_id: 'ui-probe',
        ts: i,
        step: 'probe',
        level: 'info',
        msg: `log-${i}`,
      })),
    });

    const parsed = JSON.parse(json) as any;
    expect(parsed.schema_version).toBe('rb_toolchain_doctor_v1');
    expect(typeof parsed.reportId).toBe('string');
    expect(parsed.backend_id).toBe('vivado');
    expect(parsed.bridge_url).toBe('http://127.0.0.1:4242');
    expect(parsed.probe.schema_version).toBe('toolchain_probe_v1');
    expect(parsed.probe.tools.map((t: any) => t.name)).toEqual(['openFPGALoader', 'yosys']);
    expect(parsed.probe.logs.map((l: any) => l.ts)).toEqual([0, 1]);

    expect(parsed.logs).toHaveLength(200);
    expect(parsed.logs[0].msg).toBe('log-50');
    expect(parsed.logs.at(-1).msg).toBe('log-249');
    expect(parsed.studentReadiness.schema_version).toBe('student_readiness_v1');
    expect(Array.isArray(parsed.studentReadiness.gates)).toBe(true);
    expect(parsed.studentReadiness.gates.map((gate: any) => gate.id)).toEqual([
      'toolchain_probe',
      'preflight',
      'implement_plan',
      'toolchain_ui',
      'doctor_export',
    ]);
  });

  it('embeds preflight + project summary and is deterministic for same project', () => {
    const input = {
      backend_id: 'vivado' as const,
      bridge_url: 'http://127.0.0.1:4242',
      probe: {
        schema_version: 'toolchain_probe_v1' as const,
        ok: true,
        run_id: 'bridge-probe-0',
        env: { platform: 'win32', arch: 'x64', node: 'v20.0.0' },
        tools: [
          { name: 'openFPGALoader', ok: true, status: 'ok' as const, source: 'bundled' as const, version: '0.12.0', path: 'openFPGALoader.exe' },
          { name: 'vivado', ok: true, status: 'ok' as const, source: 'system' as const, version: '2024.2' },
        ],
        logs: [{ run_id: 'bridge-probe-0', ts: 0, step: 'probe' as const, level: 'info' as const, msg: '[bridge] ok' }],
      },
      buildPath: {
        schema_version: 'toolchain_build_path_v1' as const,
        plannerVersion: 'toolchain_planner_v1' as const,
        planId: 'plan-vivado-ok',
        backend: 'vivado-fallback' as const,
        board: 'basys3' as const,
        top: 'top',
        constraintsPreset: null,
        requiredTools: [{ name: 'vivado', ok: true, source: 'system' as const, why: 'stable backend' }],
        commands: [],
        outputs: [],
        warnings: [],
      },
      project: {
        hdl: {
          sources: [
            {
              path: 'top.v',
              language: 'verilog' as const,
              text: [
                'module top(',
                '  input wire clk,',
                '  input wire [15:0] sw,',
                '  input wire [4:0] btn,',
                '  output wire [15:0] led,',
                '  output wire [6:0] seg,',
                '  output wire [3:0] an,',
                '  output wire dp',
                ');',
                'assign led = sw;',
                "assign seg = 7'b1111111;",
                "assign an = 4'b1111;",
                "assign dp = 1'b1;",
                'endmodule',
                '',
              ].join('\n'),
            },
          ],
          top: 'top',
        },
        fpga: {
          board: 'basys3' as const,
          constraints: {
            type: 'xdc' as const,
            text: [
              'set_property -dict { PACKAGE_PIN W5 IOSTANDARD LVCMOS33 } [get_ports clk]',
              'set_property -dict { PACKAGE_PIN U16 IOSTANDARD LVCMOS33 } [get_ports {led[0]}]',
              '',
            ].join('\n'),
          },
        },
      },
      logs: [{ run_id: 'ui', ts: 0, step: 'probe' as const, level: 'info' as const, msg: 'ui-log' }],
    };

    const jsonA = encodeToolchainDoctorReport(input);
    const jsonB = encodeToolchainDoctorReport(input);
    const parsedA = JSON.parse(jsonA) as any;
    const parsedB = JSON.parse(jsonB) as any;

    expect(jsonA).toBe(jsonB);
    expect(parsedA.reportId).toBe(parsedB.reportId);
    expect(parsedA.preflight).toBeDefined();
    expect(parsedA.buildPath).toBeDefined();
    expect(parsedA.projectSummary).toEqual({
      board: 'basys3',
      preset: null,
      top: 'top',
      hdlFilesCount: 1,
      hasXdc: true,
    });
    expect(parsedA.preflight.project.hasHdl).toBe(true);
    expect(parsedA.preflight.lint.ok).toBe(true);
    expect(typeof parsedA.buildPath.planId).toBe('string');
    expect(parsedA.buildPath.backend).toBeDefined();
    expect(parsedA.studentReadiness.overall).toBe('ready');
    expect(parsedA.studentReadiness.gates.every((gate: any) => gate.state === 'pass')).toBe(true);
  });
});
