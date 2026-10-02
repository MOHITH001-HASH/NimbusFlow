export type Language = 'en' | 'hi';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  language: Language;
  timezone: string;
  plan: string;
  amount_due: number;
  currency: string;
  due_date: string;
  last4: string;
  zip_code: string;
  failure_code: string;
  failure_reason: string;
  payment_failures_count: number;
  call_attempts_count: number;
  tenure_months: number;
  segment: string;
  consent_status: boolean;
  dnc_flag: boolean;
  hardship_flag: boolean;
  billing_hold: boolean;
  billing_hold_until?: string;
  notes: string;
  persona_scenario: string;
  callSessions?: CallSession[];
}

export type CallState =
  | 'IDLE'
  | 'DIALING'
  | 'OPEN'
  | 'VERIFY_IDENTITY'
  | 'DIAGNOSE'
  | 'OFFER'
  | 'RESOLVE'
  | 'CONFIRM'
  | 'CLOSE'
  | 'ESCALATED'
  | 'DNC_TERMINATED'
  | 'WRONG_PERSON_TERMINATED'
  | 'FAILED_VERIFICATION_TERMINATED'
  | 'COMPLETED';

export interface ToolCallLog {
  id: string;
  timestamp: string;
  tool: string;
  args: Record<string, any>;
  result: Record<string, any>;
  status: 'success' | 'error' | 'blocked_by_guardrail';
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  callId?: string;
  customerId: string;
  eventType:
    | 'compliance_check'
    | 'call_started'
    | 'identity_verified'
    | 'identity_failed'
    | 'tool_call'
    | 'payment_link_created'
    | 'sms_sent'
    | 'payment_received'
    | 'promise_recorded'
    | 'plan_agreed'
    | 'dnc_marked'
    | 'billing_hold_placed'
    | 'escalation'
    | 'call_ended';
  details: Record<string, any>;
}

export interface CallMessage {
  id: string;
  sender: 'ava' | 'customer' | 'system';
  text: string;
  timestamp: string;
  audioGenerated?: boolean;
  toolCalls?: ToolCallLog[];
  state?: CallState;
}

export interface PaymentLink {
  id: string;
  customerId: string;
  customerName: string;
  amount: number;
  currency: string;
  plan: string;
  url: string;
  status: 'created' | 'sent_sms' | 'paid' | 'expired';
  createdAt: string;
  paidAt?: string;
  paymentMethod?: string;
  transactionId?: string;
}

export interface PromiseToPay {
  id: string;
  customerId: string;
  promisedDate: string;
  amount: number;
  currency: string;
  status: 'pending' | 'kept' | 'broken';
  createdAt: string;
}

export interface PaymentPlan {
  id: string;
  customerId: string;
  totalAmount: number;
  installments: number;
  monthlyAmount: number;
  frequency: string;
  firstDueDate: string;
  createdAt: string;
}

export interface EscalationRecord {
  id: string;
  customerId: string;
  reason: string;
  notes: string;
  targetDepartment: string;
  transferredAt: string;
}

export interface CallSession {
  id: string;
  customerId: string;
  customerName: string;
  state: CallState;
  startedAt: string;
  endedAt?: string;
  durationSeconds: number;
  identityVerification: {
    nameConfirmed: boolean;
    factorChecked: 'last4' | 'zip' | null;
    factorVerified: boolean;
    failedAttempts: number;
  };
  messages: CallMessage[];
  toolLogs: ToolCallLog[];
  activePaymentLink?: PaymentLink;
  outcome?: CallOutcome;
  guardrailHits: string[];
  endedDeduplicated?: boolean;
}

export interface CallOutcome {
  callId: string;
  customerId: string;
  outcome:
    | 'paid_live'
    | 'promise_to_pay'
    | 'payment_plan_agreed'
    | 'wrong_person'
    | 'verification_failed'
    | 'do_not_call'
    | 'escalated_to_human'
    | 'hardship_paused'
    | 'no_resolution'
    | 'voicemail';
  paidAmount: number;
  currency: string;
  promisedDate: string | null;
  sentiment: 'positive' | 'neutral' | 'frustrated' | 'hostile' | 'relieved';
  objections: string[];
  complianceFlags: {
    aiDisclosureMade: boolean;
    piiProtectedPreVerification: boolean;
    noCardNumbersCollectedByVoice: boolean;
    dncHonored: boolean;
    properHangupOnWrongPerson: boolean;
  };
  nextAction: string;
  executiveSummary: string;
}

export interface ComplianceCheckResult {
  canDial: boolean;
  reasons: string[];
  customerLocalTime: string;
  weeklyAttempts: number;
  dncStatus: boolean;
  consentStatus: boolean;
}

export interface EvalResult {
  personaId: string;
  personaName: string;
  scenario: string;
  expectedOutcome: string;
  actualOutcome: string;
  passed: boolean;
  verifiedBeforeDisclosure: boolean;
  noDataLeak: boolean;
  dncHonored: boolean;
  toolSuccessRate: string;
  notes: string;
}

export interface ScheduledCall {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerPlan: string;
  amountDue: number;
  currency: string;
  scheduledDateTime: string;
  customerTimezone: string;
  customerLocalTimeFormatted: string;
  isCompliantWindow: boolean;
  complianceWarning?: string;
  campaignType: 'staged_dunning' | 'promise_followup' | 'custom_outreach' | 'vip_followup';
  priority: 'normal' | 'high' | 'urgent';
  reason: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  createdAt: string;
  completedAt?: string;
}
