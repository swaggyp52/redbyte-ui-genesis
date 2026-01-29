const http = require('http');
const fs = require('fs');
const path = require('path');

// Port 4243 for UI to avoid conflict with Bridge (4242)
const PORT = 4243;
// Relative to this script (apps/playground/scripts/prod-server.js)
const DIST_DIR = path.join(__dirname, '../dist');

const MIM_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2'
};

const server = http.createServer((req, res) => {
    // Normalize URL
    let url = req.url.split('?')[0];
    if (url === '/') url = '/index.html';

    // Security: prevent directory traversal
    const safePath = path.normalize(url).replace(/^(\.\.[\/\\])+/, '');
    let filePath = path.join(DIST_DIR, safePath);

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            // SPA Fallback: serve index.html for non-asset routes
            if (!path.extname(url)) {
                filePath = path.join(DIST_DIR, 'index.html');
            } else {
                res.writeHead(404);
                res.end('Not found');
                return;
            }
        }

        // Read file (re-check if falling back to index)
        fs.readFile(filePath, (err, content) => {
            if (err) {
                res.writeHead(500);
                res.end('Server error');
                return;
            }

            const ext = path.extname(filePath).toLowerCase();
            const contentType = MIM_TYPES[ext] || 'application/octet-stream';

            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        });
    });
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`RedByte OS Production Server running at http://127.0.0.1:${PORT}`);
});
