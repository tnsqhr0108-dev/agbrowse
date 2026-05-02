import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, '../fixtures/provider-dom');

export function startSmokeServer(port = 0) {
    const server = createServer((req, res) => {
        const fileName = req.url === '/' ? 'index.html' : req.url.slice(1);
        const filePath = join(FIXTURES_DIR, fileName);
        try {
            const content = readFileSync(filePath, 'utf8');
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(content);
        } catch {
            res.writeHead(404);
            res.end('Not found');
        }
    });

    return new Promise((resolve) => {
        server.listen(port, () => {
            const addr = server.address();
            resolve({ server, url: `http://127.0.0.1:${addr.port}` });
        });
    });
}

export function stopSmokeServer(server) {
    return new Promise((resolve) => server.close(resolve));
}
