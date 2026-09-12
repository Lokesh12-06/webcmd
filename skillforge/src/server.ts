import { createReadStream, existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { runFullSkillForgeBenchmark } from './orchestrator.js';
import { loadAttempts, loadSkill } from './strategy-store.js';

const PORT = 8080;
const MOCK_DIR = resolve('skillforge/mock-sites');
const DASHBOARD_DIR = resolve('skillforge/src/dashboard');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
};

async function handleApiRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = req.url || '/';

  if (url === '/api/skill') {
    const skill = await loadSkill('job-application');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, skill }));
    return true;
  }

  if (url === '/api/attempts') {
    const attempts = await loadAttempts();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, attempts }));
    return true;
  }

  if (url === '/api/run-benchmark' && req.method === 'POST') {
    try {
      const results = await runFullSkillForgeBenchmark(`http://localhost:${PORT}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(results));
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return true;
  }

  return false;
}

export function startServer(port: number = PORT): Promise<any> {
  return new Promise((resServer) => {
    const server = createServer(async (req, res) => {
      const isApi = await handleApiRequest(req, res);
      if (isApi) return;

      let filepath = '';
      const urlPath = req.url === '/' ? '/dashboard' : req.url || '/';

      if (urlPath === '/dashboard' || urlPath === '/dashboard/') {
        filepath = join(DASHBOARD_DIR, 'index.html');
      } else if (urlPath.startsWith('/variant-')) {
        filepath = join(MOCK_DIR, urlPath.replace(/^\//, ''));
      } else {
        filepath = join(MOCK_DIR, urlPath.replace(/^\//, ''));
      }

      if (!existsSync(filepath)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
        return;
      }

      const ext = extname(filepath);
      const mime = MIME_TYPES[ext] || 'text/plain';

      res.writeHead(200, { 'Content-Type': mime });
      createReadStream(filepath).pipe(res);
    });

    server.listen(port, () => {
      console.log(`SkillForge Dev Server running at http://localhost:${port}`);
      console.log(`- Dashboard: http://localhost:${port}/dashboard`);
      console.log(`- Mock Variant A: http://localhost:${port}/variant-a.html`);
      console.log(`- Mock Variant B: http://localhost:${port}/variant-b.html`);
      console.log(`- Mock Variant C: http://localhost:${port}/variant-c.html`);
      console.log(`- Mock Variant D: http://localhost:${port}/variant-d.html`);
      console.log(`- Mock Variant E (UNSEEN): http://localhost:${port}/variant-e.html`);
      resServer(server);
    });
  });
}

// Allow direct CLI launch: node skillforge/src/server.js
if (process.argv[1] && process.argv[1].includes('server')) {
  startServer();
}
