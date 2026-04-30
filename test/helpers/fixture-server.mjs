import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = join(__dirname, '..', 'fixtures', 'site');

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
};

export async function startFixtureServer() {
    const server = http.createServer((req, res) => {
        const url = new URL(req.url, 'http://127.0.0.1');
        if (url.pathname === '/favicon.ico') {
            res.writeHead(204);
            res.end();
            return;
        }

        let pathname = url.pathname === '/' ? '/index.html' : url.pathname;
        pathname = normalize(pathname).replace(/^(\.\.[/\\])+/, '');
        const targetPath = join(SITE_ROOT, pathname);

        if (!existsSync(targetPath)) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('not found');
            return;
        }

        const body = readFileSync(targetPath);
        const contentType = MIME_TYPES[extname(targetPath)] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
        res.end(body);
    });

    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const port = address.port;

    return {
        port,
        url: `http://127.0.0.1:${port}`,
        close: async () => {
            await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
        },
    };
}
