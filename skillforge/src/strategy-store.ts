import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { Skill, Strategy, TaskAttempt } from './types.js';

const SKILLS_FILE = resolve('skillforge/data/skills.json');
const ATTEMPTS_FILE = resolve('skillforge/data/attempts.json');

async function ensureFile(filepath: string, defaultContent: string = '[]\n'): Promise<void> {
  try {
    await readFile(filepath, 'utf8');
  } catch {
    await mkdir(dirname(filepath), { recursive: true });
    await writeFile(filepath, defaultContent, 'utf8');
  }
}

export function calculateConfidence(successCount: number, failureCount: number): number {
  const total = successCount + failureCount;
  if (total === 0) return 0;
  return Number((successCount / total).toFixed(2));
}

export async function loadSkills(): Promise<Skill[]> {
  await ensureFile(SKILLS_FILE);
  const raw = await readFile(SKILLS_FILE, 'utf8');
  if (!raw.trim()) return [];
  try {
    return JSON.parse(raw) as Skill[];
  } catch {
    return [];
  }
}

export async function loadSkill(taskFamily: string): Promise<Skill | null> {
  const skills = await loadSkills();
  return skills.find(s => s.taskFamily === taskFamily) || null;
}

export async function saveSkill(skill: Skill): Promise<void> {
  const skills = await loadSkills();
  const index = skills.findIndex(s => s.id === skill.id || s.taskFamily === skill.taskFamily);
  
  if (index >= 0) {
    skills[index] = skill;
  } else {
    skills.push(skill);
  }

  await writeFile(SKILLS_FILE, JSON.stringify(skills, null, 2) + '\n', 'utf8');
}

export async function loadAttempts(): Promise<TaskAttempt[]> {
  await ensureFile(ATTEMPTS_FILE);
  const raw = await readFile(ATTEMPTS_FILE, 'utf8');
  if (!raw.trim()) return [];
  try {
    return JSON.parse(raw) as TaskAttempt[];
  } catch {
    return [];
  }
}

export async function recordAttempt(attempt: TaskAttempt): Promise<void> {
  const attempts = await loadAttempts();
  attempts.push(attempt);
  await writeFile(ATTEMPTS_FILE, JSON.stringify(attempts, null, 2) + '\n', 'utf8');
}

export async function createOrGetInitialSkill(taskFamily: string, goal: string): Promise<Skill> {
  const existing = await loadSkill(taskFamily);
  if (existing) return existing;

  const now = new Date().toISOString();
  const initialSkill: Skill = {
    id: `skill-${taskFamily}`,
    taskFamily,
    goal,
    invariants: [
      { id: 'inv-1', description: 'Identify candidate name field', category: 'personal_info', required: true },
      { id: 'inv-2', description: 'Identify candidate email field', category: 'contact_info', required: true },
      { id: 'inv-3', description: 'Locate resume/CV file upload control', category: 'document_upload', required: false },
      { id: 'inv-4', description: 'Identify years of experience field', category: 'experience', required: false },
      { id: 'inv-5', description: 'Locate and execute job submission action', category: 'submit_action', required: true },
      { id: 'inv-6', description: 'Detect & dismiss blocking modal overlays if present', category: 'modal_handling', required: false },
    ],
    strategies: [],
    currentVersion: 0,
    confidence: 0,
    transferScore: 0,
    knownFailures: [],
    createdAt: now,
    updatedAt: now,
  };

  await saveSkill(initialSkill);
  return initialSkill;
}

export async function getActiveStrategy(taskFamily: string): Promise<Strategy | null> {
  const skill = await loadSkill(taskFamily);
  if (!skill || skill.strategies.length === 0) return null;
  return skill.strategies.find(s => s.version === skill.currentVersion && s.status === 'active') || null;
}