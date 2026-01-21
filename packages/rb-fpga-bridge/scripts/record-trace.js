import fs from 'fs';
import http from 'http';

const args = process.argv.slice(2);
let url = null;
let outPath = null;
let durationMs = 0;

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--url') url = args[i + 1];
    if (args[i] === '--out') outPath = args[i + 1];
    if (args[i] === '--duration') durationMs = parseInt(args[i + 1], 10);
}

if (!url || !outPath) {
    console.error("Usage: node record-trace.js --url <http://...> --out <file.ndjson> [--duration <ms>]");
    process.exit(1);
}

console.log(`Recording from ${url} to ${outPath}...`);
const fileStream = fs.createWriteStream(outPath, { flags: 'w' });

const req = http.get(url, (res) => {
    if (res.statusCode !== 200) {
        console.error(`Failed to connect: ${res.statusCode}`);
        process.exit(1);
    }

    res.on('data', (chunk) => {
        const text = chunk.toString();
        const lines = text.split('\n');
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const json = line.slice(6).trim();
                if (json) {
                    // Validate JSON or just append? 
                    // To ensure valid ndjson, lets parse and stringify or just trust the source?
                    // Trust source to be JSON.
                    fileStream.write(json + '\n');
                }
            }
        }
    });

    res.on('end', () => {
        console.log("Stream ended by server.");
        fileStream.end();
        process.exit(0);
    });
});

req.on('error', (e) => {
    console.error(`Request error: ${e.message}`);
    process.exit(1);
});

// Stop mechanism
const stop = () => {
    console.log("Stopping recording...");
    req.destroy();
    fileStream.end();
    process.exit(0);
};

if (durationMs > 0) {
    setTimeout(stop, durationMs);
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);
