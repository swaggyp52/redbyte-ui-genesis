
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
     * Compile and upload a sketch to the specified board.
     */
    async upload(
        sketchText: string,
        port: string,
        fqbn: string,
        compileOnly: boolean = false
    ): Promise<UploadResult> {
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
                await execAsync(`arduino-cli compile --fqbn ${fqbn} "${sketchDir}"`);
            } catch (err: any) {
                return { ok: false, error: 'COMPILE_ERROR', message: err.stderr || err.message };
            }

            if (compileOnly) {
                return { ok: true, sketchSha256: hash, message: 'Compiled successfully.' };
            }

            // 4. Upload
            try {
                await execAsync(`arduino-cli upload -p ${port} --fqbn ${fqbn} "${sketchDir}"`);
            } catch (err: any) {
                return { ok: false, error: 'UPLOAD_ERROR', message: err.stderr || err.message };
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
            await execAsync('arduino-cli version');
            return true;
        } catch {
            return false;
        }
    }
}
