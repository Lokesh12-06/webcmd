import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface WebCmdTaskResult {
  ok: boolean;
  result?: any;
  page?: {
    id?: string;
    url?: string;
    title?: string;
  };
  timings?: {
    program_ms?: number;
    browser_wait_ms?: number;
  };
  error?: {
    code?: string;
    message?: string;
  };
  raw: string;
}

export async function runWebCmdScript(
  scriptContent: string,
  options?: { profile?: string; session?: string; timeoutMs?: number }
): Promise<WebCmdTaskResult> {
  const profile = options?.profile || 'skillforge';
  const session = options?.session || 'skillforge-hackathon-xe';
  const tmpDir = resolve('skillforge/.tmp');
  
  await mkdir(tmpDir, { recursive: true });
  const scriptPath = resolve(tmpDir, `task-${Date.now()}-${Math.floor(Math.random()*1000)}.js`);
  await writeFile(scriptPath, scriptContent, 'utf8');

  const args = [
    'node_modules/tsx/dist/cli.mjs',
    'src/main.ts',
    '--profile',
    profile,
    '--session',
    session,
    'browser',
    'run',
    '--file',
    scriptPath,
    '--no-snapshot-diff',
  ];

  if (options?.timeoutMs) {
    args.push('--timeout', String(options.timeoutMs));
  }

  try {
    const { stdout, stderr } = await execFileAsync('node', args, {
      cwd: process.cwd(),
      maxBuffer: 10 * 1024 * 1024,
    });

    const raw = stdout.trim() || stderr.trim();

    try {
      const parsed = JSON.parse(raw) as WebCmdTaskResult;
      return { ...parsed, raw };
    } catch {
      return {
        ok: false,
        error: {
          code: 'WEBCMD_JSON_PARSE_ERROR',
          message: 'Output was not valid JSON: ' + raw.slice(0, 300),
        },
        raw,
      };
    }
  } catch (error: any) {
    const stderr = error.stderr || error.stdout || error.message || 'Execution error';
    return {
      ok: false,
      error: {
        code: 'WEBCMD_EXECUTION_FAILED',
        message: String(stderr).slice(0, 500),
      },
      raw: String(stderr),
    };
  }
}