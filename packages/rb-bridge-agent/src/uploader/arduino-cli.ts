
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import os from 'os';

const execAsync = promisify(exec);

export interface UploadResult {
    ok: boolean;
    sketchSha256?: string;
    error?: string;
    message?: string;
}

export class ArduinoCliUploader {
    /**
     * Resolve the arduino-cli path based on the contract:
     * 1. RED_BYTE_ARDUINO_CLI env var
     * 2. PATH
     */
    private async getCliPath(): Promise<string> {
        if (process.env.RED_BYTE_ARDUINO_CLI) {
            return process.env.RED_BYTE_ARDUINO_CLI;
        }
        return 'arduino-cli';
    }

    /**
     * Compile and upload a sketch to the specified board.
     */
    async upload(
        sketchText: string,
        port: string,
        fqbn: string,
        compileOnly: boolean = false
    ): Promise<UploadResult> {
        const cli = await this.getCliPath();
        // 1. Calculate Hash
        const hash = crypto.createHash('sha256').update(sketchText).digest('hex');

        // 2. Setup Temp Directory
        const tempBase = path.join(os.tmpdir(), 'rb-arduino-' + Date.now());
        const sketchName = 'sketch';
        const sketchDir = path.join(tempBase, sketchName);
        const sketchPath = path.join(sketchDir, sketchName + '.ino');

        try {
            await fs.mkdir(sketchDir, { recursive: true });
            await fs.writeFile(sketchPath, sketchText);

            // 3. Compile
            // Note: arduino-cli must be in PATH
            try {
                await execAsync(`"${cli}" compile --fqbn ${fqbn} "${sketchDir}"`);
            } catch (err: any) {
                const msg = err.stderr || err.message || '';
                if (msg.includes('not found') || msg.includes('is not recognized')) {
                    const resolved = await this.getCliPath();
                    return {
                        ok: false,
                        error: 'NOT_SUPPORTED',
                        message: `arduino-cli not found. Resolved path: "${resolved}".\n\nTo fix:\n1. Install arduino-cli\n2. Add to PATH or set RED_BYTE_ARDUINO_CLI env var.`
                    };
                }
                return { ok: false, error: 'COMPILE_ERROR', message: msg };
            }

            if (compileOnly) {
                return { ok: true, sketchSha256: hash, message: 'Compiled successfully.' };
            }

            // 4. Upload
            try {
                await execAsync(`"${cli}" upload -p ${port} --fqbn ${fqbn} "${sketchDir}"`);
            } catch (err: any) {
                const msg = err.stderr || err.message || '';
                if (msg.includes('not found') || msg.includes('is not recognized')) {
                    const resolved = await this.getCliPath();
                    return {
                        ok: false,
                        error: 'NOT_SUPPORTED',
                        message: `arduino-cli not found. Resolved path: "${resolved}".`
                    };
                }
                return { ok: false, error: 'UPLOAD_ERROR', message: msg };
            }

            return { ok: true, sketchSha256: hash, message: 'Uploaded successfully.' };

        } catch (err: any) {
            if (err.message && (err.message.includes('not found') || err.message.includes('is not recognized'))) {
                return { ok: false, error: 'NOT_SUPPORTED', message: 'arduino-cli not found in system PATH' };
            }
            return { ok: false, error: 'INTERNAL_ERROR', message: err.message };
        } finally {
            // Cleanup
            try {
                await fs.rm(tempBase, { recursive: true, force: true });
            } catch {
                // Ignore cleanup errors
            }
        }
    }

    /**
     * Check if arduino-cli is available.
     */
    async isAvailable(): Promise<boolean> {
        try {
            const cli = await this.getCliPath();
            await execAsync(`"${cli}" version`);
            return true;
        } catch {
            return false;
        }
    }
}
