export type TaskFamily = 'job-application' | string;

export interface Invariant {
  id: string;
  description: string;
  category: 'personal_info' | 'contact_info' | 'document_upload' | 'experience' | 'submit_action' | 'modal_handling';
  required: boolean;
}

export interface StrategyRule {
  id: string;
  intent: string;
  category: 'modal' | 'field' | 'file' | 'submit';
  selectorPatterns: string[];
  semanticKeywords: string[];
  actionType: 'click' | 'fill' | 'upload' | 'dismiss_modal';
  valueTemplate?: string;
  optional?: boolean;
}

export interface Strategy {
  id: string;
  version: number;
  intent: string;
  rules: StrategyRule[];
  invariants: string[];
  successCount: number;
  failureCount: number;
  averageSteps: number;
  averageDurationMs: number;
  confidence: number;
  status: 'active' | 'candidate' | 'rejected';
  evidence: string[];
  failureModes: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Skill {
  id: string;
  taskFamily: TaskFamily;
  goal: string;
  invariants: Invariant[];
  strategies: Strategy[];
  currentVersion: number;
  confidence: number;
  transferScore: number;
  knownFailures: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TaskAttempt {
  id: string;
  taskFamily: string;
  variant: string;
  strategyVersion: number;
  success: boolean;
  steps: string[];
  stepCount: number;
  durationMs: number;
  failures: string[];
  lesson: string;
  timestamp: string;
  isTransferTest?: boolean;
}

export interface SafetyCheckResult {
  safe: boolean;
  reason?: string;
  violationType?: 'captcha' | 'credentials' | 'payment' | 'destructive' | 'tos' | 'unknown';
}
