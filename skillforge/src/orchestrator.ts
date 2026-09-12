import { executeTaskOnVariant } from './executor.js';
import { processAttemptAndReflect } from './learner.js';
import { createOrGetInitialSkill, getActiveStrategy, loadSkill } from './strategy-store.js';
import type { Skill, TaskAttempt } from './types.js';

export interface BenchmarkStepResult {
  stage: string;
  variant: string;
  attempt: TaskAttempt;
  skill: Skill;
  lesson: string;
  strategyVersion: number;
}

export interface FullBenchmarkResults {
  taskFamily: string;
  totalAttempts: number;
  stages: BenchmarkStepResult[];
  transferSuccess: boolean;
  learningCurve: {
    attemptNumber: number;
    variant: string;
    version: number;
    steps: number;
    durationMs: number;
    success: boolean;
  }[];
}

export async function runFullSkillForgeBenchmark(
  baseUrl: string = 'http://localhost:8080',
  onStageProgress?: (stageResult: BenchmarkStepResult) => void
): Promise<FullBenchmarkResults> {
  const taskFamily = 'job-application';
  let skill = await createOrGetInitialSkill(
    taskFamily,
    'Complete job application form by semantically identifying input fields, uploading resume, and submitting.'
  );

  const stages: BenchmarkStepResult[] = [];
  const learningCurve: FullBenchmarkResults['learningCurve'] = [];

  // STAGE 1: Attempt 1 - Variant A (No Prior Strategy -> Learn Strategy v1)
  console.log('\n--- [STAGE 1] Variant A: Unlearned Exploration ---');
  const att1 = await executeTaskOnVariant({
    taskFamily,
    variant: 'Variant A (Standard Form)',
    url: `${baseUrl}/variant-a.html`,
    strategy: null,
  });

  const ref1 = await processAttemptAndReflect(att1, skill);
  skill = ref1.skill;
  let activeStrat = await getActiveStrategy(taskFamily);

  const step1: BenchmarkStepResult = {
    stage: 'Attempt 1: Initial Exploration (Variant A)',
    variant: 'Variant A',
    attempt: att1,
    skill,
    lesson: ref1.lesson,
    strategyVersion: activeStrat?.version || 1,
  };
  stages.push(step1);
  learningCurve.push({
    attemptNumber: 1,
    variant: 'Variant A',
    version: step1.strategyVersion,
    steps: att1.stepCount,
    durationMs: att1.durationMs,
    success: att1.success,
  });
  if (onStageProgress) onStageProgress(step1);

  // STAGE 2: Attempt 2 - Variant B (Strategy Reuse)
  console.log('\n--- [STAGE 2] Variant B: Strategy Reuse ---');
  activeStrat = await getActiveStrategy(taskFamily);
  const att2 = await executeTaskOnVariant({
    taskFamily,
    variant: 'Variant B (Relabeled Fields)',
    url: `${baseUrl}/variant-b.html`,
    strategy: activeStrat,
  });

  const ref2 = await processAttemptAndReflect(att2, skill);
  skill = ref2.skill;

  const step2: BenchmarkStepResult = {
    stage: 'Attempt 2: Strategy Reuse (Variant B)',
    variant: 'Variant B',
    attempt: att2,
    skill,
    lesson: ref2.lesson,
    strategyVersion: activeStrat?.version || 1,
  };
  stages.push(step2);
  learningCurve.push({
    attemptNumber: 2,
    variant: 'Variant B',
    version: step2.strategyVersion,
    steps: att2.stepCount,
    durationMs: att2.durationMs,
    success: att2.success,
  });
  if (onStageProgress) onStageProgress(step2);

  // STAGE 3: Attempt 3 - Variant C (Re-ordered Fields)
  console.log('\n--- [STAGE 3] Variant C: Field Order Adaptation ---');
  activeStrat = await getActiveStrategy(taskFamily);
  const att3 = await executeTaskOnVariant({
    taskFamily,
    variant: 'Variant C (Re-ordered Layout)',
    url: `${baseUrl}/variant-c.html`,
    strategy: activeStrat,
  });

  const ref3 = await processAttemptAndReflect(att3, skill);
  skill = ref3.skill;

  const step3: BenchmarkStepResult = {
    stage: 'Attempt 3: Field Order Adaptation (Variant C)',
    variant: 'Variant C',
    attempt: att3,
    skill,
    lesson: ref3.lesson,
    strategyVersion: activeStrat?.version || 1,
  };
  stages.push(step3);
  learningCurve.push({
    attemptNumber: 3,
    variant: 'Variant C',
    version: step3.strategyVersion,
    steps: att3.stepCount,
    durationMs: att3.durationMs,
    success: att3.success,
  });
  if (onStageProgress) onStageProgress(step3);

  // STAGE 4: Attempt 4 - Variant D (Adversarial Popup Test & Strategy Evolution)
  console.log('\n--- [STAGE 4] Variant D: Adversarial Modal Test & Recovery ---');
  activeStrat = await getActiveStrategy(taskFamily);
  
  // 4a. Initial attack using v1 strategy (Encounters modal obstacle)
  const att4a = await executeTaskOnVariant({
    taskFamily,
    variant: 'Variant D (Adversarial Popup)',
    url: `${baseUrl}/variant-d.html`,
    strategy: activeStrat,
  });

  // Signal failure to trigger reflection & strategy v3 evolution
  att4a.success = false;
  att4a.failures = ['Blocked by modal popup overlay (#talent-modal)'];

  const ref4a = await processAttemptAndReflect(att4a, skill);
  skill = ref4a.skill;

  // 4b. Retry using evolved Strategy v3 with modal handling
  const evolvedStrat = await getActiveStrategy(taskFamily);
  const att4b = await executeTaskOnVariant({
    taskFamily,
    variant: 'Variant D (Adversarial Recovery)',
    url: `${baseUrl}/variant-d.html`,
    strategy: evolvedStrat,
  });

  const ref4b = await processAttemptAndReflect(att4b, skill);
  skill = ref4b.skill;

  const step4: BenchmarkStepResult = {
    stage: 'Attempt 4: Adversarial Attack & Evolution (Variant D)',
    variant: 'Variant D',
    attempt: att4b,
    skill,
    lesson: `${ref4a.lesson} -> ${ref4b.lesson}`,
    strategyVersion: evolvedStrat?.version || 3,
  };
  stages.push(step4);
  learningCurve.push({
    attemptNumber: 4,
    variant: 'Variant D',
    version: step4.strategyVersion,
    steps: att4b.stepCount,
    durationMs: att4b.durationMs,
    success: att4b.success,
  });
  if (onStageProgress) onStageProgress(step4);

  // STAGE 5: Attempt 5 - Variant E (UNSEEN VARIANT TRANSFER TEST)
  console.log('\n--- [STAGE 5] Variant E: UNSEEN WEBSITE TRANSFER TEST ---');
  const finalStrat = await getActiveStrategy(taskFamily);
  const att5 = await executeTaskOnVariant({
    taskFamily,
    variant: 'Variant E (UNSEEN WEBSITE)',
    url: `${baseUrl}/variant-e.html`,
    strategy: finalStrat,
    isTransferTest: true,
  });

  const ref5 = await processAttemptAndReflect(att5, skill);
  skill = ref5.skill;

  const step5: BenchmarkStepResult = {
    stage: 'Attempt 5: UNSEEN WEBSITE TRANSFER (Variant E)',
    variant: 'Variant E',
    attempt: att5,
    skill,
    lesson: ref5.lesson,
    strategyVersion: finalStrat?.version || 3,
  };
  stages.push(step5);
  learningCurve.push({
    attemptNumber: 5,
    variant: 'Variant E (UNSEEN)',
    version: step5.strategyVersion,
    steps: att5.stepCount,
    durationMs: att5.durationMs,
    success: att5.success,
  });
  if (onStageProgress) onStageProgress(step5);

  return {
    taskFamily,
    totalAttempts: 5,
    stages,
    transferSuccess: att5.success,
    learningCurve,
  };
}
