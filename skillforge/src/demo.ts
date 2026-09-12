import { runFullSkillForgeBenchmark } from './orchestrator.js';
import { startServer } from './server.js';

async function main() {
  console.log(`
================================================================================
  SKILLFORGE -- Self-Learning Browser Agent
  "Teach Once. Evolve Forever."
  Track 05: Self-Learning Loops | WebCMD Hackathon Build
================================================================================
  Profile: skillforge
  Session: skillforge-hackathon-xe
================================================================================
`);

  console.log('[1/3] Starting Local Benchmark & Dashboard Server...');
  const server = await startServer(8080);

  console.log('\n[2/3] Initiating 5-Stage Self-Learning Benchmark Suite...\n');

  const startTime = Date.now();
  const benchmark = await runFullSkillForgeBenchmark('http://localhost:8080', (step) => {
    console.log(`\n>>> [${step.variant}] - ${step.stage}`);
    console.log(`    Strategy Version: v${step.strategyVersion}`);
    console.log(`    Outcome         : ${step.attempt.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`    Steps Executed  : ${step.attempt.stepCount} (${step.attempt.steps.join(' -> ')})`);
    console.log(`    Duration        : ${step.attempt.durationMs}ms`);
    console.log(`    Lesson Learned  : ${step.lesson}`);
  });

  const totalTime = Date.now() - startTime;

  console.log(`
================================================================================
  BENCHMARK SUMMARY & LEARNING CURVE
================================================================================
`);

  console.table(
    benchmark.learningCurve.map(item => ({
      Attempt: `Attempt ${item.attemptNumber}`,
      Variant: item.variant,
      Version: `v${item.version}`,
      'Steps Taken': item.steps,
      'Time (ms)': item.durationMs,
      Success: item.success ? 'PASS' : 'FAIL',
    }))
  );

  console.log(`
--------------------------------------------------------------------------------
  TRANSFER TEST RESULT (UNSEEN VARIANT E): ${benchmark.transferSuccess ? '[ PASS SUCCESSFUL ]' : '[ FAIL ]'}
--------------------------------------------------------------------------------
  Total Benchmark Time: ${totalTime}ms
  Active Strategy Version: v${benchmark.stages[benchmark.stages.length - 1].strategyVersion}
  Dashboard Available At: http://localhost:8080/dashboard
--------------------------------------------------------------------------------

  "Other agents execute the web.
   SkillForge learns how to use it."
================================================================================
`);

  // Allow CLI to exit cleanly or remain open for dashboard viewing
  if (process.env.DEMO_ONESHOT === 'true') {
    server.close();
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal Demo Error:', err);
  process.exit(1);
});
