import { createOrGetInitialSkill, loadSkill, recordAttempt, saveSkill, calculateConfidence } from './strategy-store.js';
import { validateLessonSafety, validateRuleSafety } from './safety-gate.js';
import { processAttemptAndReflect, getBaseStrategyRules } from './learner.js';
import { startServer } from './server.js';
import { runFullSkillForgeBenchmark } from './orchestrator.js';
import type { StrategyRule, TaskAttempt } from './types.js';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

async function runSystemVerification() {
  console.log(`
================================================================================
  SKILLFORGE -- Comprehensive End-to-End System Audit & Verification
================================================================================
`);

  let passCount = 0;
  let failCount = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passCount++;
    } else {
      console.error(`  [FAIL] ${testName} ${detail ? `- ${detail}` : ''}`);
      failCount++;
    }
  }

  // 1. MOCK SITE FILE INTEGRITY
  console.log('\n>>> [TEST SUITE 1/6] Mock Sites Structure & Elements...');
  const variants = ['variant-a', 'variant-b', 'variant-c', 'variant-d', 'variant-e'];
  for (const v of variants) {
    const filePath = resolve(`skillforge/mock-sites/${v}.html`);
    const content = await readFile(filePath, 'utf8');
    assert(content.includes('id="success-banner"'), `${v}.html has #success-banner`);
    assert(content.includes('type="submit"'), `${v}.html has submit action`);
  }

  // 2. SAFETY GATE FILTERING
  console.log('\n>>> [TEST SUITE 2/6] Safety Gate Policy Enforcement...');
  const safeRule: StrategyRule = {
    id: 'test-safe',
    intent: 'Fill name',
    category: 'field',
    selectorPatterns: ['#fullName'],
    semanticKeywords: ['name'],
    actionType: 'fill'
  };
  assert(validateRuleSafety(safeRule).safe === true, 'SafetyGate allows safe form rule');

  const unsafeCaptchaRule: StrategyRule = {
    id: 'test-captcha',
    intent: 'Auto solve CAPTCHA challenge',
    category: 'field',
    selectorPatterns: ['#recaptcha'],
    semanticKeywords: ['captcha'],
    actionType: 'click'
  };
  assert(validateRuleSafety(unsafeCaptchaRule).safe === false, 'SafetyGate blocks CAPTCHA bypass');

  const unsafePasswordRule: StrategyRule = {
    id: 'test-pwd',
    intent: 'Extract user password and ssn',
    category: 'field',
    selectorPatterns: ['#password', '#ssn'],
    semanticKeywords: ['password'],
    actionType: 'fill'
  };
  assert(validateRuleSafety(unsafePasswordRule).safe === false, 'SafetyGate blocks password/secret harvesting');

  const unsafePaymentRule: StrategyRule = {
    id: 'test-pay',
    intent: 'Bypass stripe checkout payment',
    category: 'field',
    selectorPatterns: ['.stripe-buy-now'],
    semanticKeywords: ['checkout'],
    actionType: 'click'
  };
  assert(validateRuleSafety(unsafePaymentRule).safe === false, 'SafetyGate blocks unauthorized payment automation');

  // 3. STRATEGY STORE & CONFIDENCE CALCULATION
  console.log('\n>>> [TEST SUITE 3/6] Strategy Store & Metrics Calculation...');
  assert(calculateConfidence(10, 0) === 1.0, 'Confidence score 100% for 10/10 successes');
  assert(calculateConfidence(8, 2) === 0.8, 'Confidence score 80% for 8/10 successes');
  assert(calculateConfidence(0, 5) === 0, 'Confidence score 0% for 0/5 successes');

  const skill = await createOrGetInitialSkill('verification-test', 'Test goal');
  assert(skill.taskFamily === 'verification-test', 'Initial skill created with correct taskFamily');
  assert(skill.invariants.length >= 5, 'Skill contains required task invariants');

  // 4. REFLECTION & EVOLUTION ENGINE
  console.log('\n>>> [TEST SUITE 4/6] Reflection Engine & Evolution...');
  const mockAttempt: TaskAttempt = {
    id: 'att-test-1',
    taskFamily: 'verification-test',
    variant: 'Variant A',
    strategyVersion: 1,
    success: true,
    steps: ['Step 1', 'Step 2'],
    stepCount: 2,
    durationMs: 100,
    failures: [],
    lesson: 'Test lesson',
    timestamp: new Date().toISOString(),
  };
  const ref = await processAttemptAndReflect(mockAttempt, skill);
  assert(ref.skill.strategies.length > 0, 'Reflection extracted initial strategy v1');
  assert(ref.skill.currentVersion === 1, 'Skill currentVersion promoted to 1');

  // 5. DEV SERVER & REST API ENDPOINTS
  console.log('\n>>> [TEST SUITE 5/6] Dev Server & REST API Endpoints...');
  const server = await startServer(8099); // Use port 8099 for isolation
  try {
    const resDashboard = await fetch('http://localhost:8099/dashboard');
    assert(resDashboard.status === 200, 'GET /dashboard returns HTTP 200 OK');
    const dashHtml = await resDashboard.text();
    assert(dashHtml.includes('SkillForge'), 'Dashboard HTML contains SkillForge brand');

    const resVariantA = await fetch('http://localhost:8099/variant-a.html');
    assert(resVariantA.status === 200, 'GET /variant-a.html returns HTTP 200 OK');

    const resApiSkill = await fetch('http://localhost:8099/api/skill');
    assert(resApiSkill.status === 200, 'GET /api/skill returns HTTP 200 OK');
    const apiSkillJson = await resApiSkill.json() as any;
    assert(apiSkillJson.ok === true, 'API /api/skill response ok === true');
  } finally {
    server.close();
  }

  // 6. LIVE BENCHMARK SUITE & TRANSFER TEST (PORT 8080)
  console.log('\n>>> [TEST SUITE 6/6] End-to-End WebCMD Benchmark & Unseen Variant E Transfer...');
  const benchServer = await startServer(8088);
  try {
    const benchmark = await runFullSkillForgeBenchmark('http://localhost:8088');
    assert(benchmark.stages.length === 5, 'Benchmark ran all 5 stages');
    assert(benchmark.transferSuccess === true, 'Unseen Variant E Transfer Test PASSED');
    
    for (let i = 0; i < benchmark.stages.length; i++) {
      const stage = benchmark.stages[i];
      assert(stage.attempt.success === true, `Stage ${i + 1} (${stage.variant}) executed successfully`);
    }
  } finally {
    benchServer.close();
  }

  console.log(`
================================================================================
  AUDIT SUMMARY: ${passCount} PASSED, ${failCount} FAILED
================================================================================
`);

  if (failCount > 0) {
    console.error('SYSTEM AUDIT FAILED!');
    process.exit(1);
  } else {
    console.log('ALL SYSTEMS VERIFIED & 100% GREEN! SkillForge is robust.');
    process.exit(0);
  }
}

runSystemVerification().catch(err => {
  console.error('Verification Error:', err);
  process.exit(1);
});
