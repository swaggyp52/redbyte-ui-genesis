import { test, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const SERVER_URL = 'http://127.0.0.1:3001';
const TEST_TOKEN = 'test-token-' + randomBytes(16).toString('hex');

/**
 * Start the API server for testing
 */
function startServer(withAuth = false) {
    const env = { ...process.env };
    if (withAuth) {
        env.RB_API_TOKEN = TEST_TOKEN;
    }

    const proc = spawn('node', ['api/server.mjs'], {
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false
    });

    return new Promise((resolve, reject) => {
        let started = false;
        const timeout = setTimeout(() => {
            if (!started) {
                proc.kill();
                reject(new Error('Server startup timeout'));
            }
        }, 5000);

        proc.stdout.on('data', (data) => {
            if (data.toString().includes('listening on')) {
                started = true;
                clearTimeout(timeout);
                resolve(proc);
            }
        });

        proc.stderr.on('data', (data) => {
            console.error('Server error:', data.toString());
        });

        proc.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
        });
    });
}

/**
 * Wait for server to be ready
 */
async function waitForServer(maxAttempts = 10) {
    for (let i = 0; i < maxAttempts; i++) {
        try {
            const res = await fetch(`${SERVER_URL}/health`);
            if (res.ok) return true;
        } catch (e) {
            await new Promise(r => setTimeout(r, 300));
        }
    }
    throw new Error('Server not ready');
}

test('API Authentication - Health endpoint is public', async () => {
    const server = await startServer(true);
    try {
        await waitForServer();

        const res = await fetch(`${SERVER_URL}/health`);
        expect(res.status).toBe(200);

        const data = await res.json();
        expect(data.status).toBe('ok');
        expect(data.authEnabled).toBe(true);
    } finally {
        server.kill();
        await new Promise(r => setTimeout(r, 100));
    }
}, 10000);

test('API Authentication - Protected endpoint rejects without token', async () => {
    const server = await startServer(true);
    try {
        await waitForServer();

        const testZip = Buffer.from('PK\\x03\\x04'); // Minimal ZIP header
        const res = await fetch(`${SERVER_URL}/api/labs/runs`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        expect(res.status).toBe(401);
        const data = await res.json();
        expect(data.error).toBe('Authentication required');
        expect(data.message).toContain('authorization token');
    } finally {
        server.kill();
        await new Promise(r => setTimeout(r, 100));
    }
}, 10000);

test('API Authentication - Protected endpoint accepts valid token', async () => {
    const server = await startServer(true);
    try {
        await waitForServer();

        const res = await fetch(`${SERVER_URL}/api/labs/runs`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${TEST_TOKEN}`
            }
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(Array.isArray(data)).toBe(true);
    } finally {
        server.kill();
        await new Promise(r => setTimeout(r, 100));
    }
}, 10000);

test('API Authentication - No auth required when token not set', async () => {
    const server = await startServer(false);
    try {
        await waitForServer();

        const res = await fetch(`${SERVER_URL}/api/labs/runs`);
        expect(res.status).toBe(200);

        const healthRes = await fetch(`${SERVER_URL}/health`);
        const healthData = await healthRes.json();
        expect(healthData.authEnabled).toBe(false);
    } finally {
        server.kill();
        await new Promise(r => setTimeout(r, 100));
    }
}, 10000);

test('Request Size Limit - Rejects oversized upload', async () => {
    const server = await startServer(false);
    try {
        await waitForServer();

        // Create 11MB file (exceeds 10MB limit)
        const oversizedData = Buffer.alloc(11 * 1024 * 1024, 'X');

        const res = await fetch(`${SERVER_URL}/api/labs/ingest`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/zip'
            },
            body: oversizedData
        });

        expect(res.status).toBe(500); // Server should reject or error
        const data = await res.json();
        expect(data.error).toContain('size');
    } finally {
        server.kill();
        await new Promise(r => setTimeout(r, 100));
    }
}, 15000);
