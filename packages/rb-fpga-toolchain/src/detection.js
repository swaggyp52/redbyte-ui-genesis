// Copyright 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
const execAsync = promisify(exec);
/**
 * Common Vivado installation paths by platform
 */
const VIVADO_SEARCH_PATHS = {
    win32: [
        'C:\\Xilinx\\Vivado',
        'D:\\Xilinx\\Vivado',
        'C:\\Program Files\\Xilinx\\Vivado',
    ],
    linux: ['/opt/Xilinx/Vivado', '/tools/Xilinx/Vivado'],
    darwin: ['/Applications/Xilinx/Vivado', '/opt/Xilinx/Vivado'],
};
/**
 * Find Vivado executable by searching common paths and PATH
 */
async function findVivado() {
    const platform = os.platform();
    const vivadoExe = platform === 'win32' ? 'vivado.bat' : 'vivado';
    // First, check if vivado is in PATH
    try {
        const { stdout } = await execAsync(`${vivadoExe} -version`, {
            timeout: 10000,
        });
        const versionMatch = stdout.match(/Vivado v?(\d+\.\d+(?:\.\d+)?)/i);
        if (versionMatch) {
            // Get the actual path from 'where' (Windows) or 'which' (Unix)
            const whichCmd = platform === 'win32' ? 'where' : 'which';
            try {
                const { stdout: pathOut } = await execAsync(`${whichCmd} ${vivadoExe}`);
                const vivadoPath = pathOut.trim().split('\n')[0];
                return { path: vivadoPath, version: versionMatch[1] };
            }
            catch {
                return { path: vivadoExe, version: versionMatch[1] };
            }
        }
    }
    catch {
        // Not in PATH, search common locations
    }
    // Search common installation directories
    const searchPaths = VIVADO_SEARCH_PATHS[platform] || [];
    for (const basePath of searchPaths) {
        if (!fs.existsSync(basePath))
            continue;
        try {
            const versions = fs.readdirSync(basePath).filter((d) => /^\d+\.\d+/.test(d));
            // Sort versions descending to get newest first
            versions.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
            for (const version of versions) {
                const binPath = path.join(basePath, version, 'bin', vivadoExe);
                if (fs.existsSync(binPath)) {
                    return { path: binPath, version };
                }
            }
        }
        catch {
            continue;
        }
    }
    return null;
}
/**
 * Check for Yosys installation
 */
async function findYosys() {
    const platform = os.platform();
    const yosysExe = platform === 'win32' ? 'yosys.exe' : 'yosys';
    try {
        const { stdout } = await execAsync(`${yosysExe} -V`, { timeout: 5000 });
        const versionMatch = stdout.match(/Yosys (\d+\.\d+(?:\+\d+)?)/i);
        if (versionMatch) {
            const whichCmd = platform === 'win32' ? 'where' : 'which';
            try {
                const { stdout: pathOut } = await execAsync(`${whichCmd} ${yosysExe}`);
                return { path: pathOut.trim().split('\n')[0], version: versionMatch[1] };
            }
            catch {
                return { path: yosysExe, version: versionMatch[1] };
            }
        }
    }
    catch {
        // Not found
    }
    // Check oss-cad-suite locations
    const ossCadPaths = platform === 'win32'
        ? ['C:\\oss-cad-suite\\bin', 'D:\\oss-cad-suite\\bin']
        : ['/opt/oss-cad-suite/bin', path.join(os.homedir(), 'oss-cad-suite/bin')];
    for (const binPath of ossCadPaths) {
        const yosysPath = path.join(binPath, yosysExe);
        if (fs.existsSync(yosysPath)) {
            try {
                const { stdout } = await execAsync(`"${yosysPath}" -V`, { timeout: 5000 });
                const versionMatch = stdout.match(/Yosys (\d+\.\d+(?:\+\d+)?)/i);
                if (versionMatch) {
                    return { path: yosysPath, version: versionMatch[1] };
                }
            }
            catch {
                continue;
            }
        }
    }
    return null;
}
/**
 * Check for nextpnr-xilinx installation
 */
async function findNextpnr() {
    const platform = os.platform();
    const nextpnrExe = platform === 'win32' ? 'nextpnr-xilinx.exe' : 'nextpnr-xilinx';
    try {
        const { stdout } = await execAsync(`${nextpnrExe} --version`, { timeout: 5000 });
        const versionMatch = stdout.match(/nextpnr-xilinx[^\d]*(\d+\.\d+(?:\.\d+)?)/i);
        if (versionMatch) {
            return { path: nextpnrExe, version: versionMatch[1] };
        }
    }
    catch {
        // Not found
    }
    return null;
}
/**
 * Check for openFPGALoader installation
 */
async function findOpenFPGALoader() {
    const platform = os.platform();
    const loaderExe = platform === 'win32' ? 'openFPGALoader.exe' : 'openFPGALoader';
    try {
        const { stdout: versionOut } = await execAsync(`${loaderExe} --version`, {
            timeout: 5000,
        });
        const versionMatch = versionOut.match(/openFPGALoader v?(\d+\.\d+(?:\.\d+)?)/i);
        if (versionMatch) {
            // Get supported boards
            let boards = [];
            try {
                const { stdout: boardsOut } = await execAsync(`${loaderExe} --list-boards`, {
                    timeout: 10000,
                });
                // Parse board list (format varies, extract board names)
                const boardMatches = boardsOut.match(/^\s*(\w+)/gm);
                if (boardMatches) {
                    boards = boardMatches.map((b) => b.trim()).filter((b) => b.length > 0);
                }
            }
            catch {
                // Could not list boards
            }
            return { path: loaderExe, version: versionMatch[1], boards };
        }
    }
    catch {
        // Not found
    }
    return null;
}
/**
 * Detect all available FPGA toolchains
 */
export async function detectToolchain() {
    const capabilities = {};
    // Run all detections in parallel
    const [vivado, yosys, nextpnr, openFPGALoader] = await Promise.all([
        findVivado(),
        findYosys(),
        findNextpnr(),
        findOpenFPGALoader(),
    ]);
    if (vivado) {
        capabilities.vivado = {
            version: vivado.version,
            path: vivado.path,
            canSynthesize: true,
            canProgram: true,
        };
    }
    if (yosys) {
        capabilities.yosys = {
            version: yosys.version,
            path: yosys.path,
        };
    }
    if (nextpnr) {
        capabilities.nextpnr = {
            version: nextpnr.version,
            path: nextpnr.path,
        };
    }
    if (openFPGALoader) {
        capabilities.openFPGALoader = {
            version: openFPGALoader.version,
            path: openFPGALoader.path,
            supportedBoards: openFPGALoader.boards,
        };
    }
    return capabilities;
}
/**
 * Check if any synthesis toolchain is available
 */
export function canSynthesize(capabilities) {
    return !!(capabilities.vivado?.canSynthesize || capabilities.yosys);
}
/**
 * Check if any programming tool is available
 */
export function canProgram(capabilities) {
    return !!(capabilities.vivado?.canProgram || capabilities.openFPGALoader);
}
/**
 * Get the preferred synthesis tool
 */
export function getPreferredSynthesisTool(capabilities) {
    // Prefer Vivado for Artix-7 (most reliable)
    if (capabilities.vivado?.canSynthesize)
        return 'vivado';
    if (capabilities.yosys)
        return 'yosys';
    return null;
}
/**
 * Get the preferred programming tool
 */
export function getPreferredProgrammingTool(capabilities) {
    // Prefer Vivado for reliability
    if (capabilities.vivado?.canProgram)
        return 'vivado';
    if (capabilities.openFPGALoader)
        return 'openFPGALoader';
    return null;
}
