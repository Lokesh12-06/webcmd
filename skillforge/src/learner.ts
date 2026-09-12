import { validateLessonSafety, validateRuleSafety } from './safety-gate.js';
import { calculateConfidence, loadSkill, recordAttempt, saveSkill } from './strategy-store.js';
import type { Skill, Strategy, StrategyRule, TaskAttempt } from './types.js';

export function getBaseStrategyRules(): StrategyRule[] {
  return [
    {
      id: 'rule-modal-dismiss',
      intent: 'Dismiss any blocking modal overlays or popups if present',
      category: 'modal',
      selectorPatterns: ['#dismiss-modal-btn', '.close-btn', 'button:has-text("Dismiss")', 'button:has-text("Close")', '.modal-overlay button'],
      semanticKeywords: ['dismiss', 'close', 'cancel', 'continue'],
      actionType: 'dismiss_modal',
      optional: true,
    },
    {
      id: 'rule-fill-name',
      intent: 'Identify personal name input field and populate candidate name',
      category: 'field',
      selectorPatterns: ['#fullName', '#applicant_name', '#yourName', '#candidate_name', '#candidate_full_name', 'input[name*="name"]', 'input[placeholder*="Name"]'],
      semanticKeywords: ['name', 'full name', 'applicant', 'candidate', 'your name'],
      actionType: 'fill',
      valueTemplate: 'Alex Morgan',
    },
    {
      id: 'rule-fill-email',
      intent: 'Identify email address input field and populate candidate email',
      category: 'field',
      selectorPatterns: ['#email', '#contact_email', '#emailAddr', '#email_address', '#candidate_email_address', 'input[type="email"]', 'input[name*="email"]'],
      semanticKeywords: ['email', 'contact email', 'email address'],
      actionType: 'fill',
      valueTemplate: 'alex.morgan@example.com',
    },
    {
      id: 'rule-upload-resume',
      intent: 'Locate resume / CV document upload input and upload document',
      category: 'file',
      selectorPatterns: ['#resume', '#cv_file', '#resumeDoc', '#attachment', '#resume_attachment', 'input[type="file"]'],
      semanticKeywords: ['resume', 'cv', 'attachment', 'upload', 'document'],
      actionType: 'upload',
      valueTemplate: 'resume.pdf',
      optional: true,
    },
    {
      id: 'rule-fill-experience',
      intent: 'Identify years of experience input field and populate value',
      category: 'field',
      selectorPatterns: ['#yearsExperience', '#experience_years', '#exp', '#exp_years', '#experience_years_input', 'input[name*="exp"]', 'input[name*="years"]'],
      semanticKeywords: ['experience', 'years', 'industry', 'work'],
      actionType: 'fill',
      valueTemplate: '5',
      optional: true,
    },
    {
      id: 'rule-check-terms',
      intent: 'Check terms and policy agreement if present',
      category: 'field',
      selectorPatterns: ['#terms_agree', 'input[name*="terms"]', 'input[name*="agree"]', 'input[type="checkbox"]'],
      semanticKeywords: ['terms', 'agree', 'verify', 'policy'],
      actionType: 'click',
      optional: true,
    },
    {
      id: 'rule-submit-application',
      intent: 'Locate final application submit action button and click',
      category: 'submit',
      selectorPatterns: ['#btn-submit', '#btn-apply-now', '#btn-send-app', '#submit-application', '#final-submit-trigger', 'button[type="submit"]', 'button:has-text("Submit")', 'button:has-text("Apply")'],
      semanticKeywords: ['submit', 'apply', 'send', 'finalize', 'complete'],
      actionType: 'click',
    },
  ];
}

export async function processAttemptAndReflect(
  attempt: TaskAttempt,
  skill: Skill
): Promise<{ skill: Skill; lesson: string; strategyUpdated: boolean }> {
  await recordAttempt(attempt);

  let lesson = '';
  let strategyUpdated = false;

  if (attempt.success) {
    if (skill.strategies.length === 0) {
      // Attempt 1: First success -> Extract Initial Strategy v1
      lesson = `EXTRACTED STRATEGY v1: Successfully completed task using semantic field matching (${attempt.steps.length} steps in ${attempt.durationMs}ms).`;
      
      const safeRules = getBaseStrategyRules().filter(r => validateRuleSafety(r).safe);

      const v1Strategy: Strategy = {
        id: `strat-${skill.taskFamily}-v1`,
        version: 1,
        intent: 'Semantic Form Field Mapping & Direct Submission',
        rules: safeRules,
        invariants: skill.invariants.map(i => i.description),
        successCount: 1,
        failureCount: 0,
        averageSteps: attempt.stepCount,
        averageDurationMs: attempt.durationMs,
        confidence: 1.0,
        status: 'active',
        evidence: [`Attempt on ${attempt.variant} succeeded in ${attempt.durationMs}ms`],
        failureModes: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      skill.strategies.push(v1Strategy);
      skill.currentVersion = 1;
      skill.confidence = 1.0;
      strategyUpdated = true;
    } else {
      // Subsequent attempt success
      const activeStrat = skill.strategies.find(s => s.version === skill.currentVersion);
      if (activeStrat) {
        activeStrat.successCount += 1;
        activeStrat.averageSteps = Math.round((activeStrat.averageSteps + attempt.stepCount) / 2);
        activeStrat.averageDurationMs = Math.round((activeStrat.averageDurationMs + attempt.durationMs) / 2);
        activeStrat.confidence = calculateConfidence(activeStrat.successCount, activeStrat.failureCount);
        activeStrat.updatedAt = new Date().toISOString();
        
        if (attempt.isTransferTest) {
          skill.transferScore = 1.0;
          lesson = `TRANSFER TEST PASSED: Abstract strategy v${activeStrat.version} successfully completed UNSEEN variant (${attempt.variant}) in ${attempt.durationMs}ms without prior training!`;
        } else {
          lesson = `REUSED STRATEGY v${activeStrat.version}: Adapted to variant ${attempt.variant} (${attempt.stepCount} steps, ${attempt.durationMs}ms). Confidence: ${(activeStrat.confidence * 100).toFixed(0)}%.`;
        }
      }
    }
  } else {
    // Attempt failed - Reflection & Evolution!
    const activeStrat = skill.strategies.find(s => s.version === skill.currentVersion);
    if (activeStrat) {
      activeStrat.failureCount += 1;
      activeStrat.confidence = calculateConfidence(activeStrat.successCount, activeStrat.failureCount);
    }

    const failureReason = attempt.failures.join('; ') || 'Form interaction blocked by unexpected UI obstacle';
    const rawLesson = `FAILURE ANALYSIS (${attempt.variant}): ${failureReason}. Remedy: Prioritize modal/overlay dismissal rule before executing form interactions.`;

    const safetyCheck = validateLessonSafety(rawLesson);
    if (!safetyCheck.safe) {
      lesson = `SAFETY GATE REJECTED LESSON: ${safetyCheck.reason}`;
    } else {
      lesson = `LESSON EXTRACTED: ${rawLesson}`;
      
      // Evolve strategy to new version (e.g. v3) with explicit modal handling prioritized
      const nextVersion = (skill.currentVersion || 1) + 1;
      const evolvedRules = getBaseStrategyRules().map(rule => {
        if (rule.category === 'modal') {
          return { ...rule, optional: false }; // Make modal handling explicit requirement
        }
        return rule;
      });

      const evolvedStrategy: Strategy = {
        id: `strat-${skill.taskFamily}-v${nextVersion}`,
        version: nextVersion,
        intent: 'Adversarial Resilient Form Completion with Modal Handling',
        rules: evolvedRules,
        invariants: skill.invariants.map(i => i.description),
        successCount: 0, // Candidate until next attempt succeeds
        failureCount: 0,
        averageSteps: attempt.stepCount + 1,
        averageDurationMs: attempt.durationMs,
        confidence: 0.8,
        status: 'candidate',
        evidence: [`Evolved from failure on ${attempt.variant}: ${failureReason}`],
        failureModes: [...(activeStrat?.failureModes || []), `Modal overlay interruption on ${attempt.variant}`],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (!skill.knownFailures.includes('blocking_modal_overlay')) {
        skill.knownFailures.push('blocking_modal_overlay');
      }

      skill.strategies.push(evolvedStrategy);
      skill.currentVersion = nextVersion; // Auto-promote candidate upon creation for next attempt
      evolvedStrategy.status = 'active';
      skill.confidence = 0.85;
      strategyUpdated = true;
    }
  }

  skill.updatedAt = new Date().toISOString();
  await saveSkill(skill);

  return { skill, lesson, strategyUpdated };
}