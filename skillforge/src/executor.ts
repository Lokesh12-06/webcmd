import { runWebCmdScript } from './webcmd-runner.js';
import type { Strategy, TaskAttempt } from './types.js';

export interface ExecuteOptions {
  taskFamily: string;
  variant: string;
  url: string;
  strategy?: Strategy | null;
  isTransferTest?: boolean;
}

export async function executeTaskOnVariant(options: ExecuteOptions): Promise<TaskAttempt> {
  const startTime = Date.now();
  const attemptId = `att-${options.variant.toLowerCase()}-${Date.now()}`;
  const strategyVersion = options.strategy ? options.strategy.version : 0;

  let scriptJS = '';

  if (!options.strategy) {
    // Unlearned Exploration Mode (Attempt 1)
    scriptJS = `
      await page.goto('${options.url}');
      const steps = [];
      
      // Step 1: Fill Name
      const nameInput = page.locator('#fullName, #applicant_name, #yourName, #candidate_name, input[name*="name"]').first();
      if (await nameInput.isVisible()) {
        await nameInput.fill('Alex Morgan');
        steps.push('Filled Candidate Name');
      }

      // Step 2: Fill Email
      const emailInput = page.locator('#email, #contact_email, #emailAddr, #email_address, input[type="email"]').first();
      if (await emailInput.isVisible()) {
        await emailInput.fill('alex.morgan@example.com');
        steps.push('Filled Contact Email');
      }

      // Step 3: Upload Resume
      const fileInput = page.locator('#resume, #cv_file, #resumeDoc, #attachment, input[type="file"]').first();
      if (await fileInput.isVisible()) {
        await fileInput.setInputFiles({
          name: 'resume.pdf',
          mimeType: 'application/pdf',
          buffer: new TextEncoder().encode('Candidate Resume Content')
        });
        steps.push('Uploaded Resume Document');
      }

      // Step 4: Fill Experience
      const expInput = page.locator('#yearsExperience, #experience_years, #exp, #exp_years, input[name*="exp"]').first();
      if (await expInput.isVisible()) {
        await expInput.fill('5');
        steps.push('Filled Years of Experience');
      }

      // Step 5: Submit Form
      const submitBtn = page.locator('#btn-submit, #btn-apply-now, #btn-send-app, #submit-application, button[type="submit"]').first();
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
        steps.push('Clicked Submit Action');
      }

      await page.waitForTimeout(300);
      const isSuccess = await page.locator('#success-banner').isVisible();
      const successText = isSuccess ? await page.locator('#success-banner').innerText() : '';

      return {
        success: isSuccess,
        steps: steps,
        banner: successText
      };
    `;
  } else {
    // Strategy-Driven Execution Mode
    const includesModalRule = options.strategy.rules.some(r => r.category === 'modal' && !r.optional);

    scriptJS = `
      await page.goto('${options.url}');
      const steps = [];
      const failures = [];

      // Check for Modal Dismissal Rule
      const modalBtn = page.locator('#dismiss-modal-btn, .close-btn, button:has-text("Dismiss")').first();
      if (await modalBtn.isVisible().catch(() => false)) {
        ${includesModalRule ? `
          await modalBtn.click();
          steps.push('Executed Rule: Dismissed Modal Overlay');
        ` : `
          failures.push('Modal overlay blocking input - active strategy lacks required modal handling rule');
        `}
      }

      // Execute Field Rules from Strategy
      // 1. Name Field
      const nameEl = page.locator('${options.strategy.rules.find(r => r.id === 'rule-fill-name')?.selectorPatterns.join(', ') || 'input[name*="name"]'}').first();
      if (await nameEl.isVisible().catch(() => false)) {
        await nameEl.fill('Alex Morgan');
        steps.push('Executed Rule: Populate Name');
      }

      // 2. Email Field
      const emailEl = page.locator('${options.strategy.rules.find(r => r.id === 'rule-fill-email')?.selectorPatterns.join(', ') || 'input[type="email"]'}').first();
      if (await emailEl.isVisible().catch(() => false)) {
        await emailEl.fill('alex.morgan@example.com');
        steps.push('Executed Rule: Populate Email');
      }

      // 3. Document Upload
      const fileEl = page.locator('${options.strategy.rules.find(r => r.id === 'rule-upload-resume')?.selectorPatterns.join(', ') || 'input[type="file"]'}').first();
      if (await fileEl.isVisible().catch(() => false)) {
        await fileEl.setInputFiles({
          name: 'alex_morgan_cv.pdf',
          mimeType: 'application/pdf',
          buffer: new TextEncoder().encode('Professional Resume PDF')
        });
        steps.push('Executed Rule: Upload Resume Document');
      }

      // 4. Experience Input
      const expEl = page.locator('${options.strategy.rules.find(r => r.id === 'rule-fill-experience')?.selectorPatterns.join(', ') || 'input[type="number"]'}').first();
      if (await expEl.isVisible().catch(() => false)) {
        await expEl.fill('5');
        steps.push('Executed Rule: Set Experience');
      }

      // 5. Terms Checkbox (if present)
      const termsEl = page.locator('#terms_agree, input[type="checkbox"]').first();
      if (await termsEl.isVisible().catch(() => false)) {
        if (!(await termsEl.isChecked())) {
          await termsEl.check();
          steps.push('Executed Rule: Accept Policy Checkbox');
        }
      }

      // 6. Submit Application
      const submitEl = page.locator('${options.strategy.rules.find(r => r.id === 'rule-submit-application')?.selectorPatterns.join(', ') || 'button[type="submit"]'}').first();
      if (await submitEl.isVisible().catch(() => false)) {
        await submitEl.click();
        steps.push('Executed Rule: Execute Submit Action');
      }

      await page.waitForTimeout(300);
      const successBannerVisible = await page.locator('#success-banner').isVisible().catch(() => false);

      return {
        success: successBannerVisible && failures.length === 0,
        steps: steps,
        failures: failures
      };
    `;
  }

  const result = await runWebCmdScript(scriptJS, { timeoutMs: 15000 });
  const durationMs = Date.now() - startTime;

  if (!result.ok || !result.result) {
    return {
      id: attemptId,
      taskFamily: options.taskFamily,
      variant: options.variant,
      strategyVersion,
      success: false,
      steps: ['Execution interrupted by WebCMD error'],
      stepCount: 1,
      durationMs,
      failures: [result.error?.message || 'WebCMD browser run error'],
      lesson: 'WebCMD execution failed',
      timestamp: new Date().toISOString(),
      isTransferTest: options.isTransferTest,
    };
  }

  const res = result.result;
  const isSuccess = Boolean(res.success);
  const stepsTaken = Array.isArray(res.steps) ? res.steps : [];
  const failuresEncountered = Array.isArray(res.failures) ? res.failures : (isSuccess ? [] : ['Form submission unverified or blocked']);

  return {
    id: attemptId,
    taskFamily: options.taskFamily,
    variant: options.variant,
    strategyVersion,
    success: isSuccess,
    steps: stepsTaken,
    stepCount: stepsTaken.length,
    durationMs,
    failures: failuresEncountered,
    lesson: isSuccess ? `Successfully completed variant ${options.variant}` : `Failed on variant ${options.variant}`,
    timestamp: new Date().toISOString(),
    isTransferTest: options.isTransferTest,
  };
}
