// Copyright 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { spawn } from 'child_process';
import * as fs from 'fs';
/**
 * Program FPGA using openFPGALoader
 */
export async function programFpgaWithOpenFPGALoader(loaderPath, bitstreamPath, board = 'basys3', onProgress) {
    const logs = [];
    const log = (msg) => {
        logs.push(msg);
        onProgress?.('programming', 50, msg);
    };
    // Verify bitstream exists
    if (!fs.existsSync(bitstreamPath)) {
        return {
            success: false,
            logs: ['Bitstream file not found'],
            error: `Bitstream file not found: ${bitstreamPath}`,
        };
    }
    log(`Programming ${board} with ${bitstreamPath}`);
    onProgress?.('connecting', 10, 'Connecting to FPGA...');
    try {
        await new Promise((resolve, reject) => {
            // openFPGALoader -b <board> <bitstream>
            const args = ['-b', board, bitstreamPath];
            const proc = spawn(loaderPath, args, { shell: true });
            proc.stdout?.on('data', (data) => {
                const text = data.toString().trim();
                log(text);
                // Parse progress from output
                if (text.includes('Open')) {
                    onProgress?.('connecting', 20, 'Opened connection');
                }
                else if (text.includes('IDCODE')) {
                    onProgress?.('connecting', 30, 'Detected FPGA');
                }
                else if (text.includes('Loading')) {
                    onProgress?.('uploading', 50, 'Loading bitstream...');
                }
                else if (text.includes('Done')) {
                    onProgress?.('complete', 100, 'Programming complete');
                }
            });
            proc.stderr?.on('data', (data) => {
                const text = data.toString().trim();
                // openFPGALoader outputs progress to stderr
                log(text);
                if (text.includes('%')) {
                    // Parse percentage
                    const match = text.match(/(\d+)%/);
                    if (match) {
                        const percent = parseInt(match[1]);
                        onProgress?.('uploading', Math.min(90, 30 + percent * 0.6), `Uploading: ${percent}%`);
                    }
                }
            });
            proc.on('close', (code) => {
                if (code === 0) {
                    resolve();
                }
                else {
                    reject(new Error(`openFPGALoader exited with code ${code}`));
                }
            });
            proc.on('error', (err) => {
                reject(new Error(`Failed to start openFPGALoader: ${err.message}`));
            });
        });
        log('Programming complete!');
        onProgress?.('complete', 100, 'Programming complete');
        return { success: true, logs };
    }
    catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        log(`Programming failed: ${errorMsg}`);
        onProgress?.('failed', 0, errorMsg);
        return { success: false, logs, error: errorMsg };
    }
}
/**
 * Detect connected FPGA boards using openFPGALoader
 */
export async function detectBoardsWithOpenFPGALoader(loaderPath) {
    try {
        return await new Promise((resolve) => {
            const proc = spawn(loaderPath, ['--detect'], { shell: true });
            let output = '';
            proc.stdout?.on('data', (data) => {
                output += data.toString();
            });
            proc.stderr?.on('data', (data) => {
                output += data.toString();
            });
            proc.on('close', (code) => {
                if (code === 0) {
                    // Parse detected boards from output
                    const boards = [];
                    const lines = output.split('\n');
                    for (const line of lines) {
                        if (line.includes('IDCODE') || line.includes('found')) {
                            boards.push(line.trim());
                        }
                    }
                    resolve({ success: true, boards });
                }
                else {
                    resolve({
                        success: false,
                        boards: [],
                        error: `Detection failed with code ${code}`,
                    });
                }
            });
            proc.on('error', (err) => {
                resolve({
                    success: false,
                    boards: [],
                    error: `Failed to run openFPGALoader: ${err.message}`,
                });
            });
        });
    }
    catch (error) {
        return {
            success: false,
            boards: [],
            error: error instanceof Error ? error.message : String(error),
        };
    }
}
/**
 * Write bitstream to flash memory (persistent)
 */
export async function writeFpgaFlashWithOpenFPGALoader(loaderPath, bitstreamPath, board = 'basys3', onProgress) {
    const logs = [];
    const log = (msg) => {
        logs.push(msg);
        onProgress?.('programming', 50, msg);
    };
    if (!fs.existsSync(bitstreamPath)) {
        return {
            success: false,
            logs: ['Bitstream file not found'],
            error: `Bitstream file not found: ${bitstreamPath}`,
        };
    }
    log(`Writing to flash on ${board} with ${bitstreamPath}`);
    onProgress?.('connecting', 10, 'Connecting to FPGA...');
    try {
        await new Promise((resolve, reject) => {
            // openFPGALoader -b <board> -f <bitstream> (flash write)
            const args = ['-b', board, '-f', bitstreamPath];
            const proc = spawn(loaderPath, args, { shell: true });
            proc.stdout?.on('data', (data) => {
                log(data.toString().trim());
            });
            proc.stderr?.on('data', (data) => {
                const text = data.toString().trim();
                log(text);
                if (text.includes('%')) {
                    const match = text.match(/(\d+)%/);
                    if (match) {
                        const percent = parseInt(match[1]);
                        onProgress?.('uploading', Math.min(90, 30 + percent * 0.6), `Writing flash: ${percent}%`);
                    }
                }
            });
            proc.on('close', (code) => {
                if (code === 0) {
                    resolve();
                }
                else {
                    reject(new Error(`openFPGALoader exited with code ${code}`));
                }
            });
            proc.on('error', reject);
        });
        log('Flash write complete!');
        onProgress?.('complete', 100, 'Flash write complete');
        return { success: true, logs };
    }
    catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        log(`Flash write failed: ${errorMsg}`);
        return { success: false, logs, error: errorMsg };
    }
}
