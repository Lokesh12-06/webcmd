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

// Global SSE clients for streaming live telemetry
const sseClients: ServerResponse[] = [];

export function broadcastTelemetry(event: string, data: any) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {}
  }
}

async function handleApiRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = req.url || '/';

  // SSE Telemetry Stream
  if (url === '/api/telemetry') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write('retry: 1000\n\n');
    sseClients.push(res);
    req.on('close', () => {
      const idx = sseClients.indexOf(res);
      if (idx >= 0) sseClients.splice(idx, 1);
    });
    return true;
  }

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

  // Handle manual human form submission from mock pages
  if (url === '/api/submit' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let parsed = {};
      try { parsed = JSON.parse(body); } catch {}
      broadcastTelemetry('human_submission', { timestamp: new Date().toISOString(), data: parsed });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, message: 'Application submitted successfully and recorded by SkillForge!' }));
    });
    return true;
  }

  if (url === '/api/run-benchmark' && req.method === 'POST') {
    try {
      broadcastTelemetry('benchmark_start', { timestamp: new Date().toISOString() });
      
      const results = await runFullSkillForgeBenchmark(
        `http://localhost:${PORT}`,
        (step) => {
          broadcastTelemetry('benchmark_step', step);
        }
      );
      
      broadcastTelemetry('benchmark_end', results);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(results));
    } catch (err: any) {
      broadcastTelemetry('benchmark_error', { message: err.message });
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

if (process.argv[1] && process.argv[1].includes('server')) {
  startServer();
}
