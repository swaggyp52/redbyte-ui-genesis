// Copyright 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
const execAsync = promisify(exec);
/**
 * Basys 3 board configuration
 */
const BASYS3_CONFIG = {
    part: 'xc7a35tcpg236-1',
    clockFrequency: 100_000_000,
};
/**
 * Generate Tcl script for Vivado batch mode synthesis
 */
export function generateVivadoTcl(options) {
    const { verilogFile, constraintsFile, outputDir, topModule, part } = options;
    return `# RedByte Vivado Synthesis Script
# Auto-generated - do not edit manually

# Set project directory
set output_dir "${outputDir.replace(/\\/g, '/')}"

# Create in-memory project
create_project -in_memory -part ${part}

# Read design files
read_verilog "${verilogFile.replace(/\\/g, '/')}"

# Read constraints
read_xdc "${constraintsFile.replace(/\\/g, '/')}"

# Synthesize design
synth_design -top ${topModule} -part ${part}

# Write checkpoint after synthesis
write_checkpoint -force \${output_dir}/post_synth.dcp

# Report utilization after synthesis
report_utilization -file \${output_dir}/post_synth_util.rpt

# Optimize design
opt_design

# Place design
place_design

# Write checkpoint after placement
write_checkpoint -force \${output_dir}/post_place.dcp

# Report timing after placement
report_timing_summary -file \${output_dir}/post_place_timing.rpt

# Route design
route_design

# Write checkpoint after routing
write_checkpoint -force \${output_dir}/post_route.dcp

# Report timing
report_timing_summary -file \${output_dir}/post_route_timing.rpt

# Report utilization
report_utilization -file \${output_dir}/post_route_util.rpt

# Generate bitstream
write_bitstream -force \${output_dir}/output.bit

puts "Synthesis complete. Bitstream written to \${output_dir}/output.bit"
exit
`;
}
/**
 * Parse Vivado timing report
 */
export function parseTimingReport(reportPath) {
    try {
        const content = fs.readFileSync(reportPath, 'utf-8');
        // Look for WNS (Worst Negative Slack)
        const wnsMatch = content.match(/WNS\s*\(ns\)\s*:\s*([-\d.]+)/i);
        const tnsMatch = content.match(/TNS\s*\(ns\)\s*:\s*([-\d.]+)/i);
        const wns = wnsMatch ? parseFloat(wnsMatch[1]) : 0;
        const tns = tnsMatch ? parseFloat(tnsMatch[1]) : 0;
        return {
            wns,
            tns,
            met: wns >= 0,
        };
    }
    catch {
        return null;
    }
}
/**
 * Parse Vivado utilization report
 */
export function parseUtilizationReport(reportPath) {
    try {
        const content = fs.readFileSync(reportPath, 'utf-8');
        // Parse LUT utilization
        const lutMatch = content.match(/Slice LUTs\s*\|\s*(\d+)\s*\|\s*\d+\s*\|\s*(\d+)\s*\|\s*([\d.]+)/i);
        // Parse FF utilization
        const ffMatch = content.match(/Slice Registers\s*\|\s*(\d+)\s*\|\s*\d+\s*\|\s*(\d+)\s*\|\s*([\d.]+)/i);
        // Parse BRAM utilization
        const bramMatch = content.match(/Block RAM Tile\s*\|\s*(\d+)\s*\|\s*\d+\s*\|\s*(\d+)\s*\|\s*([\d.]+)/i);
        // Parse DSP utilization
        const dspMatch = content.match(/DSPs\s*\|\s*(\d+)\s*\|\s*\d+\s*\|\s*(\d+)\s*\|\s*([\d.]+)/i);
        return {
            luts: lutMatch
                ? {
                    used: parseInt(lutMatch[1]),
                    available: parseInt(lutMatch[2]),
                    percent: parseFloat(lutMatch[3]),
                }
                : { used: 0, available: 20800, percent: 0 },
            ffs: ffMatch
                ? {
                    used: parseInt(ffMatch[1]),
                    available: parseInt(ffMatch[2]),
                    percent: parseFloat(ffMatch[3]),
                }
                : { used: 0, available: 41600, percent: 0 },
            brams: bramMatch
                ? {
                    used: parseInt(bramMatch[1]),
                    available: parseInt(bramMatch[2]),
                    percent: parseFloat(bramMatch[3]),
                }
                : { used: 0, available: 50, percent: 0 },
            dsps: dspMatch
                ? {
                    used: parseInt(dspMatch[1]),
                    available: parseInt(dspMatch[2]),
                    percent: parseFloat(dspMatch[3]),
                }
                : { used: 0, available: 90, percent: 0 },
        };
    }
    catch {
        return null;
    }
}
/**
 * Run Vivado synthesis
 */
export async function runVivadoSynthesis(vivadoPath, request, onProgress) {
    const logs = [];
    const log = (msg) => {
        logs.push(msg);
        onProgress?.('synthesizing', 0, msg);
    };
    // Create temporary directory for synthesis
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rb-synthesis-'));
    log(`Created temp directory: ${tempDir}`);
    try {
        // Write Verilog files
        const primitivesFile = path.join(tempDir, 'rb_primitives.v');
        const topFile = path.join(tempDir, 'top.v');
        const constraintsFile = path.join(tempDir, 'constraints.xdc');
        const tclFile = path.join(tempDir, 'synthesis.tcl');
        // Combine primitives and top module
        const combinedVerilog = `${request.primitivesLibrary}\n\n${request.verilog}`;
        fs.writeFileSync(topFile, combinedVerilog);
        log('Wrote Verilog files');
        fs.writeFileSync(constraintsFile, request.constraints);
        log('Wrote constraints file');
        // Generate Tcl script
        const tclScript = generateVivadoTcl({
            verilogFile: topFile,
            constraintsFile,
            outputDir: tempDir,
            topModule: request.topModule || 'top',
            part: BASYS3_CONFIG.part,
        });
        fs.writeFileSync(tclFile, tclScript);
        log('Generated Tcl script');
        // Run Vivado
        log('Starting Vivado synthesis...');
        onProgress?.('synthesizing', 10, 'Starting Vivado...');
        const platform = os.platform();
        const vivadoCmd = platform === 'win32' ? `"${vivadoPath}"` : vivadoPath;
        await new Promise((resolve, reject) => {
            const proc = spawn(vivadoCmd, ['-mode', 'batch', '-source', tclFile], {
                cwd: tempDir,
                shell: true,
            });
            let stdout = '';
            let stderr = '';
            proc.stdout?.on('data', (data) => {
                const text = data.toString();
                stdout += text;
                // Parse progress from Vivado output
                if (text.includes('synth_design')) {
                    onProgress?.('synthesizing', 30, 'Synthesizing design...');
                }
                else if (text.includes('opt_design')) {
                    onProgress?.('synthesizing', 50, 'Optimizing design...');
                }
                else if (text.includes('place_design')) {
                    onProgress?.('routing', 60, 'Placing design...');
                }
                else if (text.includes('route_design')) {
                    onProgress?.('routing', 70, 'Routing design...');
                }
                else if (text.includes('write_bitstream')) {
                    onProgress?.('generating', 90, 'Generating bitstream...');
                }
                log(text.trim());
            });
            proc.stderr?.on('data', (data) => {
                stderr += data.toString();
                log(`[STDERR] ${data.toString().trim()}`);
            });
            proc.on('close', (code) => {
                if (code === 0) {
                    resolve();
                }
                else {
                    reject(new Error(`Vivado exited with code ${code}\n${stderr}`));
                }
            });
            proc.on('error', (err) => {
                reject(err);
            });
        });
        // Check for bitstream
        const bitstreamPath = path.join(tempDir, 'output.bit');
        if (!fs.existsSync(bitstreamPath)) {
            throw new Error('Bitstream was not generated');
        }
        log('Synthesis complete!');
        onProgress?.('complete', 100, 'Synthesis complete');
        // Read bitstream
        const bitstream = fs.readFileSync(bitstreamPath);
        // Parse reports
        const timingPath = path.join(tempDir, 'post_route_timing.rpt');
        const utilPath = path.join(tempDir, 'post_route_util.rpt');
        const timing = fs.existsSync(timingPath) ? parseTimingReport(timingPath) : null;
        const utilization = fs.existsSync(utilPath) ? parseUtilizationReport(utilPath) : null;
        return {
            success: true,
            bitstream,
            timing: timing || undefined,
            utilization: utilization || undefined,
            logs,
        };
    }
    catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        log(`Synthesis failed: ${errorMsg}`);
        onProgress?.('failed', 0, errorMsg);
        return {
            success: false,
            logs,
            error: errorMsg,
        };
    }
    finally {
        // Cleanup temp directory (optional - keep for debugging)
        // fs.rmSync(tempDir, { recursive: true, force: true });
    }
}
/**
 * Generate Vivado programming Tcl script
 */
export function generateVivadoProgramTcl(bitstreamPath) {
    return `# RedByte Vivado Programming Script
# Auto-generated

# Open hardware manager
open_hw_manager

# Connect to hardware server
connect_hw_server

# Open target (auto-detect)
open_hw_target

# Get first device
current_hw_device [lindex [get_hw_devices] 0]

# Set bitstream file
set_property PROGRAM.FILE {${bitstreamPath.replace(/\\/g, '/')}} [current_hw_device]

# Program device
program_hw_devices [current_hw_device]

# Close hardware manager
close_hw_manager

puts "Programming complete!"
exit
`;
}
/**
 * Program FPGA using Vivado
 */
export async function programFpgaWithVivado(vivadoPath, bitstreamPath, onProgress) {
    const logs = [];
    const log = (msg) => {
        logs.push(msg);
        onProgress?.('programming', 50, msg);
    };
    // Create temp directory for Tcl script
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rb-program-'));
    try {
        const tclFile = path.join(tempDir, 'program.tcl');
        const tclScript = generateVivadoProgramTcl(bitstreamPath);
        fs.writeFileSync(tclFile, tclScript);
        log('Generated programming script');
        onProgress?.('connecting', 10, 'Connecting to hardware...');
        const platform = os.platform();
        const vivadoCmd = platform === 'win32' ? `"${vivadoPath}"` : vivadoPath;
        await new Promise((resolve, reject) => {
            const proc = spawn(vivadoCmd, ['-mode', 'batch', '-source', tclFile], {
                cwd: tempDir,
                shell: true,
            });
            proc.stdout?.on('data', (data) => {
                const text = data.toString();
                log(text.trim());
                if (text.includes('connect_hw_server')) {
                    onProgress?.('connecting', 20, 'Connected to hardware server');
                }
                else if (text.includes('open_hw_target')) {
                    onProgress?.('connecting', 40, 'Opened hardware target');
                }
                else if (text.includes('program_hw_devices')) {
                    onProgress?.('uploading', 70, 'Programming device...');
                }
                else if (text.includes('Programming complete')) {
                    onProgress?.('complete', 100, 'Programming complete');
                }
            });
            proc.stderr?.on('data', (data) => {
                log(`[STDERR] ${data.toString().trim()}`);
            });
            proc.on('close', (code) => {
                if (code === 0) {
                    resolve();
                }
                else {
                    reject(new Error(`Vivado exited with code ${code}`));
                }
            });
            proc.on('error', reject);
        });
        return { success: true, logs };
    }
    catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        log(`Programming failed: ${errorMsg}`);
        return { success: false, logs, error: errorMsg };
    }
    finally {
        // Cleanup
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
}
