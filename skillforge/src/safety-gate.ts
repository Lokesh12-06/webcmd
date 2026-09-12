import type { SafetyCheckResult, StrategyRule } from './types.js';

const FORBIDDEN_PATTERNS = [
  { pattern: /captcha/i, violationType: 'captcha' as const, reason: 'CAPTCHA bypass or automated solving is unsafe' },
  { pattern: /password|secret|api_key|token|auth_token|otp|2fa|ssn|credit_card|cvv|pin/i, violationType: 'credentials' as const, reason: 'Extracting or handling private credentials/secrets is unsafe' },
  { pattern: /checkout|stripe|paypal|purchase|pay_button|buy_now/i, violationType: 'payment' as const, reason: 'Automating payment execution without human confirmation is unsafe' },
  { pattern: /delete_account|drop_database|rm_-rf|wipe_data|reset_system/i, violationType: 'destructive' as const, reason: 'Destructive system or data operations are unsafe' },
  { pattern: /scrape_all_users|spam|mass_register|bot_flood/i, violationType: 'tos' as const, reason: 'ToS-violating high-frequency or abusive operations are unsafe' },
];

export function validateRuleSafety(rule: StrategyRule): SafetyCheckResult {
  const serialized = `${rule.intent} ${rule.selectorPatterns.join(' ')} ${rule.semanticKeywords.join(' ')} ${rule.valueTemplate ?? ''}`;

  for (const forbidden of FORBIDDEN_PATTERNS) {
    if (forbidden.pattern.test(serialized)) {
      return {
        safe: false,
        reason: forbidden.reason,
        violationType: forbidden.violationType,
      };
    }
  }

  return { safe: true };
}

export function validateLessonSafety(lesson: string): SafetyCheckResult {
  for (const forbidden of FORBIDDEN_PATTERNS) {
    if (forbidden.pattern.test(lesson)) {
      return {
        safe: false,
        reason: forbidden.reason,
        violationType: forbidden.violationType,
      };
    }
  }
  return { safe: true };
}
