// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { progressFail, progressStart, progressSucceed, progressUpdate, RbUserError, toStudentFacingError } from '@redbyte/rb-utils';

export const OPS_SERVER = 'http://127.0.0.1:3001';

let opsActionCounter = 0;

function nextOpsActionId(action) {
    opsActionCounter += 1;
    const shortId = `${Date.now()}-${opsActionCounter}`;
    return `rb:ops:${action}:${shortId}`;
}

async function readResponseBody(response) {
    const contentType = response.headers.get('content-type') ?? '';
    try {
        if (contentType.includes('application/json')) {
            return await response.json();
        }
        return await response.text();
    }
    catch (err) {
        return {
            error: 'Failed to parse response body',
            cause: err,
        };
    }
}

function emitOpsFailure(actionId, action, endpoint, err, details) {
    const studentError = toStudentFacingError(err);
    progressFail(actionId, {
        code: studentError.code,
        studentMessage: studentError.message,
        details: {
            action,
            endpoint,
            details,
            error: err,
        },
    });
}

export async function ingestLabSubmission(bytes) {
    const action = 'ingest';
    const actionId = nextOpsActionId(action);
    const endpoint = `${OPS_SERVER}/api/labs/ingest`;
    progressStart(actionId, 'Uploading submission...');
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'content-type': 'application/zip' },
            body: bytes,
        });
        progressUpdate(actionId, 0.6, 'Processing submission...');
        const body = await readResponseBody(response);
        if (!response.ok) {
            throw new RbUserError('UNEXPECTED_ERROR', 'Upload failed.', {
                details: {
                    status: response.status,
                    statusText: response.statusText,
                    body,
                },
            });
        }
        const runId = body?.run_id;
        if (!runId || typeof runId !== 'string') {
            throw new RbUserError('UNEXPECTED_ERROR', 'Upload succeeded but server did not return a run_id', {
                details: { body },
            });
        }
        progressSucceed(actionId, 'Submission ingested');
        return runId;
    }
    catch (err) {
        emitOpsFailure(actionId, action, endpoint, err);
        throw err;
    }
}

export async function fetchLabRuns() {
    const action = 'runs';
    const actionId = nextOpsActionId(action);
    const endpoint = `${OPS_SERVER}/api/labs/runs`;
    progressStart(actionId, 'Loading lab runs...');
    try {
        const response = await fetch(endpoint);
        const body = await readResponseBody(response);
        if (!response.ok) {
            throw new RbUserError('UNEXPECTED_ERROR', 'Failed to load runs.', {
                details: {
                    status: response.status,
                    statusText: response.statusText,
                    body,
                },
            });
        }
        progressSucceed(actionId, 'Lab runs loaded');
        return Array.isArray(body) ? body : (body?.runs ?? []);
    }
    catch (err) {
        emitOpsFailure(actionId, action, endpoint, err);
        throw err;
    }
}

export async function fetchLabRunDetail(runId) {
    const action = 'run-detail';
    const actionId = nextOpsActionId(action);
    const endpoint = `${OPS_SERVER}/api/labs/runs/${runId}`;
    progressStart(actionId, 'Loading run details...');
    try {
        const response = await fetch(endpoint);
        const body = await readResponseBody(response);
        if (!response.ok) {
            throw new RbUserError('UNEXPECTED_ERROR', 'Failed to load run.', {
                details: {
                    status: response.status,
                    statusText: response.statusText,
                    body,
                },
            });
        }
        progressSucceed(actionId, 'Run details loaded');
        return body;
    }
    catch (err) {
        emitOpsFailure(actionId, action, endpoint, err, { runId });
        throw err;
    }
}

export async function diffLabRun(runId, goldenFixture) {
    const action = 'diff';
    const actionId = nextOpsActionId(action);
    const endpoint = `${OPS_SERVER}/api/labs/diff`;
    progressStart(actionId, 'Diffing lab run...');
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ run_id: runId, golden_fixture: goldenFixture }),
        });
        progressUpdate(actionId, 0.6, 'Computing diff...');
        const body = await readResponseBody(response);
        if (!response.ok) {
            throw new RbUserError('UNEXPECTED_ERROR', 'Diff failed.', {
                details: {
                    status: response.status,
                    statusText: response.statusText,
                    body,
                },
            });
        }
        progressSucceed(actionId, 'Diff complete');
        return body;
    }
    catch (err) {
        emitOpsFailure(actionId, action, endpoint, err, { runId, goldenFixture });
        throw err;
    }
}
