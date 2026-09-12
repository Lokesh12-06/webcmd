import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

export interface Strategy {
  id: string;
  taskFamily: string;
  description: string;
  steps: string[];
  successCount: number;
  failureCount: number;
  uses: number;
  confidence: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

const STORE_PATH = resolve('skillforge/data/strategies.json');

async function ensureStore(): Promise<void> {
  try {
    await readFile(STORE_PATH, 'utf8');
  } catch {
    await mkdir(dirname(STORE_PATH), { recursive: true });
    await writeFile(STORE_PATH, '[]\n', 'utf8');
  }
}

export async function loadStrategies(): Promise<Strategy[]> {
  await ensureStore();

  const raw = await readFile(STORE_PATH, 'utf8');
  if (!raw.trim()) return [];

  const parsed: unknown = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error('Strategy store is invalid');
  }

  return parsed as Strategy[];
}

export async function saveStrategy(strategy: Strategy): Promise<void> {
  const strategies = await loadStrategies();

  const index = strategies.findIndex(item => item.id === strategy.id);

  if (index >= 0) {
    strategies[index] = strategy;
  } else {
    strategies.push(strategy);
  }

  await writeFile(
    STORE_PATH,
    JSON.stringify(strategies, null, 2) + '\n',
    'utf8',
  );
}

export function calculateConfidence(
  successCount: number,
  failureCount: number,
): number {
  const total = successCount + failureCount;

  if (total === 0) return 0;

  return Number((successCount / total).toFixed(3));
}

export async function recordOutcome(
  strategyId: string,
  success: boolean,
): Promise<Strategy> {
  const strategies = await loadStrategies();

  const strategy = strategies.find(item => item.id === strategyId);

  if (!strategy) {
    throw new Error(`Strategy not found: ${strategyId}`);
  }

  strategy.uses += 1;

  if (success) {
    strategy.successCount += 1;
  } else {
    strategy.failureCount += 1;
  }

  strategy.confidence = calculateConfidence(
    strategy.successCount,
    strategy.failureCount,
  );

  strategy.updatedAt = new Date().toISOString();

  await saveStrategy(strategy);

  return strategy;
}