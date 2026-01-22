const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3001;
const ARTIFACT_PATH = path.resolve(__dirname, '../artifacts/deadzones/latest.json');

// Ensure directory exists
const dir = path.dirname(ARTIFACT_PATH);
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}

const server = http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (req.method === 'POST' && req.url === '/report') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const report = JSON.parse(body);
                fs.writeFileSync(ARTIFACT_PATH, JSON.stringify(report, null, 2));
                console.log(`[Report Server] Saved report to ${ARTIFACT_PATH}`);
                console.log(`[Report Server] Top blocker: ${report.topOffenders?.[0]?.selector || 'None'}`);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, path: ARTIFACT_PATH }));
            } catch (e) {
                console.error('[Report Server] Error parsing/saving report:', e);
                res.writeHead(400);
                res.end(JSON.stringify({ error: e.message }));
            }
        });
    } else {
        res.writeHead(404);
        res.end();
    }
});

server.listen(PORT, () => {
    console.log(`[Report Server] Listening on port ${PORT}`);
    console.log(`[Report Server] Ready to receive reports at http://localhost:${PORT}/report`);
});
