import { Customer, PromiseToPay, PaymentPlan, EscalationRecord, CallSession, AuditLogEntry, ScheduledCall } from '../types';
import customerData from '../../data/customers.json';

function getFs() {
  if (typeof window === 'undefined') {
    try {
      return (globalThis as any).process ? eval('require("fs")') : null;
    } catch {
      return null;
    }
  }
  return null;
}

function getDbPath(): string {
  const dbFileName = (typeof process !== 'undefined' && process.env?.DB_FILE) ? process.env.DB_FILE : 'autopay_db.json';
  if (typeof window === 'undefined') {
    try {
      const p = (globalThis as any).process ? eval('require("path")') : null;
      if (p) return p.resolve(process.cwd(), dbFileName);
    } catch {
      return './' + dbFileName;
    }
  }
  return './' + dbFileName;
}

export class Store {
  private static customers: Customer[] = [];
  private static promises: PromiseToPay[] = [];
  private static plans: PaymentPlan[] = [];
  private static escalations: EscalationRecord[] = [];
  private static auditLogs: AuditLogEntry[] = [];
  private static callHistory: CallSession[] = [];
  private static scheduledCalls: ScheduledCall[] = [];
  private static isInitialized = false;

  private static init() {
    if (this.isInitialized) return;

    const fs = getFs();
    const dbPath = getDbPath();

    if (fs && fs.existsSync(dbPath)) {
      try {
        const raw = fs.readFileSync(dbPath, 'utf-8');
        const parsed = JSON.parse(raw);
        this.customers = parsed.customers || JSON.parse(JSON.stringify(customerData));
        this.promises = parsed.promises || [];
        this.plans = parsed.plans || [];
        this.escalations = parsed.escalations || [];
        this.auditLogs = parsed.auditLogs || [];
        this.callHistory = parsed.callHistory && parsed.callHistory.length > 0 ? parsed.callHistory : this.getInitialCallHistory();
        this.scheduledCalls = parsed.scheduledCalls || this.getInitialScheduledCalls();
        this.isInitialized = true;
        return;
      } catch (e) {
        console.warn('Failed to load persisted db file, loading seed:', e);
      }
    }

    this.customers = JSON.parse(JSON.stringify(customerData));
    this.callHistory = this.getInitialCallHistory();
    this.scheduledCalls = this.getInitialScheduledCalls();
    this.isInitialized = true;
    this.persist();
  }

  private static getInitialCallHistory(): CallSession[] {
    return [
      {
        id: 'call_hist_001',
        customerId: 'cust_001',
        customerName: 'Rajesh Sharma',
        state: 'COMPLETED',
        startedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        endedAt: new Date(Date.now() - 86400000 * 2 + 75000).toISOString(),
        durationSeconds: 75,
        identityVerification: {
          nameConfirmed: true,
          factorChecked: 'last4',
          factorVerified: true,
          failedAttempts: 0
        },
        guardrailHits: [],
        toolLogs: [
          {
            id: 'tl_001',
            timestamp: new Date(Date.now() - 86400000 * 2 + 35000).toISOString(),
            tool: 'verify_secondary_factor',
            args: { factorType: 'last4', factorValue: '4242' },
            result: { verified: true },
            status: 'success'
          },
          {
            id: 'tl_002',
            timestamp: new Date(Date.now() - 86400000 * 2 + 50000).toISOString(),
            tool: 'record_promise_to_pay',
            args: { promisedDate: '2026-10-02', amount: 2499 },
            result: { status: 'recorded' },
            status: 'success'
          }
        ],
        messages: [
          {
            id: 'm1',
            sender: 'ava',
            text: 'Hello Rajesh, this is Ava, an automated assistant calling on behalf of NimbusFlow on a recorded line. Am I speaking with Rajesh Sharma?',
            timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
            state: 'OPEN'
          },
          {
            id: 'm2',
            sender: 'customer',
            text: 'Yes, this is Rajesh speaking. What is this regarding?',
            timestamp: new Date(Date.now() - 86400000 * 2 + 10000).toISOString(),
            state: 'VERIFY_IDENTITY'
          },
          {
            id: 'm3',
            sender: 'ava',
            text: 'For your security, could you please verify the last 4 digits of your payment card on file?',
            timestamp: new Date(Date.now() - 86400000 * 2 + 18000).toISOString(),
            state: 'VERIFY_IDENTITY'
          },
          {
            id: 'm4',
            sender: 'customer',
            text: 'My card ends in 4242.',
            timestamp: new Date(Date.now() - 86400000 * 2 + 30000).toISOString(),
            state: 'DIAGNOSE'
          },
          {
            id: 'm5',
            sender: 'ava',
            text: 'Thank you Rajesh! Your card ending in 4242 expired, causing the INR 2499 payment to fail. Can we schedule a retry date for you?',
            timestamp: new Date(Date.now() - 86400000 * 2 + 40000).toISOString(),
            state: 'OFFER'
          },
          {
            id: 'm6',
            sender: 'customer',
            text: 'I will renew it tomorrow and pay then.',
            timestamp: new Date(Date.now() - 86400000 * 2 + 52000).toISOString(),
            state: 'CONFIRM'
          },
          {
            id: 'm7',
            sender: 'ava',
            text: 'Understood! I have noted your promise to pay on October 2nd. Thank you for your continued partnership with NimbusFlow!',
            timestamp: new Date(Date.now() - 86400000 * 2 + 65000).toISOString(),
            state: 'CLOSE'
          }
        ],
        outcome: {
          callId: 'call_hist_001',
          customerId: 'cust_001',
          outcome: 'promise_to_pay',
          paidAmount: 0,
          currency: 'INR',
          promisedDate: '2026-10-02',
          sentiment: 'positive',
          objections: ['expired card renewal in progress'],
          complianceFlags: {
            aiDisclosureMade: true,
            piiProtectedPreVerification: true,
            noCardNumbersCollectedByVoice: true,
            dncHonored: true,
            properHangupOnWrongPerson: true
          },
          nextAction: 'Follow up on promised date Oct 2nd',
          executiveSummary: 'Customer verified identity via last4 4242. Confirmed card expired and promised payment on renewal.'
        }
      },
      {
        id: 'call_hist_002',
        customerId: 'cust_002',
        customerName: 'Priya Patel',
        state: 'COMPLETED',
        startedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
        endedAt: new Date(Date.now() - 86400000 * 3 + 110000).toISOString(),
        durationSeconds: 110,
        identityVerification: {
          nameConfirmed: true,
          factorChecked: 'zip',
          factorVerified: true,
          failedAttempts: 0
        },
        guardrailHits: [],
        toolLogs: [],
        messages: [
          {
            id: 'm2_1',
            sender: 'ava',
            text: 'Hello Priya, this is Ava from NimbusFlow calling on a recorded line. Am I speaking with Priya Patel?',
            timestamp: new Date(Date.now() - 86400000 * 3).toISOString(),
            state: 'OPEN'
          },
          {
            id: 'm2_2',
            sender: 'customer',
            text: 'Yes speaking.',
            timestamp: new Date(Date.now() - 86400000 * 3 + 10000).toISOString(),
            state: 'VERIFY_IDENTITY'
          }
        ],
        outcome: {
          callId: 'call_hist_002',
          customerId: 'cust_002',
          outcome: 'promise_to_pay',
          paidAmount: 0,
          currency: 'INR',
          promisedDate: '2026-10-03',
          sentiment: 'neutral',
          objections: ['waiting for salary clearance'],
          complianceFlags: {
            aiDisclosureMade: true,
            piiProtectedPreVerification: true,
            noCardNumbersCollectedByVoice: true,
            dncHonored: true,
            properHangupOnWrongPerson: true
          },
          nextAction: 'Automated retry after salary date',
          executiveSummary: 'Customer requested 3-day buffer for payroll deposit before re-attempting INR 4999 payment.'
        }
      },
      {
        id: 'call_hist_003',
        customerId: 'cust_007',
        customerName: 'Karan Mehra',
        state: 'WRONG_PERSON_TERMINATED',
        startedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
        endedAt: new Date(Date.now() - 86400000 * 1 + 25000).toISOString(),
        durationSeconds: 25,
        identityVerification: {
          nameConfirmed: false,
          factorChecked: null,
          factorVerified: false,
          failedAttempts: 0
        },
        guardrailHits: [],
        toolLogs: [],
        messages: [
          {
            id: 'm3_1',
            sender: 'ava',
            text: 'Hello, this is Ava with NimbusFlow calling on a recorded line. May I speak with Karan Mehra?',
            timestamp: new Date(Date.now() - 86400000 * 1).toISOString(),
            state: 'OPEN'
          },
          {
            id: 'm3_2',
            sender: 'customer',
            text: 'No, Karan does not live here anymore. You have the wrong number.',
            timestamp: new Date(Date.now() - 86400000 * 1 + 10000).toISOString(),
            state: 'WRONG_PERSON_TERMINATED'
          },
          {
            id: 'm3_3',
            sender: 'ava',
            text: 'I apologize for the misunderstanding. I will remove this phone number immediately. Have a wonderful day.',
            timestamp: new Date(Date.now() - 86400000 * 1 + 20000).toISOString(),
            state: 'CLOSE'
          }
        ],
        outcome: {
          callId: 'call_hist_003',
          customerId: 'cust_007',
          outcome: 'wrong_person',
          paidAmount: 0,
          currency: 'INR',
          promisedDate: null,
          sentiment: 'neutral',
          objections: ['wrong phone contact'],
          complianceFlags: {
            aiDisclosureMade: true,
            piiProtectedPreVerification: true,
            noCardNumbersCollectedByVoice: true,
            dncHonored: true,
            properHangupOnWrongPerson: true
          },
          nextAction: 'Flag contact phone for manual skip-trace',
          executiveSummary: 'Answered by third party. Ava immediately terminated call with zero PII disclosure.'
        }
      }
    ];
  }

  private static getInitialScheduledCalls(): ScheduledCall[] {
    const tomorrow = new Date(Date.now() + 86400000);
    const in2Days = new Date(Date.now() + 2 * 86400000);
    const in4Days = new Date(Date.now() + 4 * 86400000);

    return [
      {
        id: 'sched_001',
        customerId: 'cust_001',
        customerName: 'Rajesh Sharma',
        customerPhone: '+15550100001',
        customerPlan: 'NimbusFlow Growth Cloud',
        amountDue: 2499,
        currency: 'INR',
        scheduledDateTime: new Date(tomorrow.setHours(10, 30, 0, 0)).toISOString(),
        customerTimezone: 'Asia/Kolkata',
        customerLocalTimeFormatted: '10:30 AM IST',
        isCompliantWindow: true,
        campaignType: 'staged_dunning',
        priority: 'high',
        reason: 'Automated 24h follow-up on expired card renewal',
        status: 'scheduled',
        createdAt: new Date().toISOString()
      },
      {
        id: 'sched_002',
        customerId: 'cust_002',
        customerName: 'Priya Patel',
        customerPhone: '+15550100002',
        customerPlan: 'NimbusFlow Pro Annual',
        amountDue: 4999,
        currency: 'INR',
        scheduledDateTime: new Date(in2Days.setHours(14, 0, 0, 0)).toISOString(),
        customerTimezone: 'America/New_York',
        customerLocalTimeFormatted: '02:00 PM EDT',
        isCompliantWindow: true,
        campaignType: 'promise_followup',
        priority: 'normal',
        reason: 'Promise-to-Pay check following salary deposit',
        status: 'scheduled',
        createdAt: new Date().toISOString()
      },
      {
        id: 'sched_003',
        customerId: 'cust_003',
        customerName: 'Vikram Malhotra',
        customerPhone: '+15550100003',
        customerPlan: 'NimbusFlow Enterprise Core',
        amountDue: 12500,
        currency: 'INR',
        scheduledDateTime: new Date(in4Days.setHours(11, 0, 0, 0)).toISOString(),
        customerTimezone: 'Europe/London',
        customerLocalTimeFormatted: '11:00 AM BST',
        isCompliantWindow: true,
        campaignType: 'custom_outreach',
        priority: 'urgent',
        reason: 'Verify bank automated fraud filter resolution with customer',
        status: 'scheduled',
        createdAt: new Date().toISOString()
      }
    ];
  }

  private static persist() {
    try {
      const fs = getFs();
      const dbPath = getDbPath();
      if (!fs) return;

      const data = {
        customers: this.customers,
        promises: this.promises,
        plans: this.plans,
        escalations: this.escalations,
        auditLogs: this.auditLogs,
        callHistory: this.callHistory,
        scheduledCalls: this.scheduledCalls
      };
      fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.warn('Persistence error:', e);
    }
  }

  public static getCustomers(): Customer[] {
    this.init();
    return this.customers;
  }

  /**
   * Sanitized version for client UI - does not expose secret last4 and zip_code!
   */
  public static getCustomersSanitized(): (Omit<Customer, 'last4' | 'zip_code'> & { last4_masked: string; zip_code_masked: string })[] {
    this.init();
    return this.customers.map(({ last4, zip_code, ...rest }) => ({
      ...rest,
      callSessions: this.getCallHistoryForCustomer(rest.id),
      last4_masked: '•••• ' + last4,
      zip_code_masked: '••••'
    })) as any;
  }

  public static getCustomer(id: string): Customer | undefined {
    this.init();
    const cust = this.customers.find((c) => c.id === id);
    if (!cust) return undefined;
    return {
      ...cust,
      callSessions: this.getCallHistoryForCustomer(cust.id)
    };
  }

  public static addCustomer(customer: Customer): Customer {
    this.init();
    const existingIndex = this.customers.findIndex((c) => c.id === customer.id);
    if (existingIndex >= 0) {
      this.customers[existingIndex] = customer;
    } else {
      this.customers.push(customer);
    }
    this.persist();
    return customer;
  }

  public static deleteCustomer(id: string): boolean {
    this.init();
    const lenBefore = this.customers.length;
    this.customers = this.customers.filter((c) => c.id !== id);
    if (this.customers.length < lenBefore) {
      this.persist();
      return true;
    }
    return false;
  }

  public static updateCustomer(id: string, updates: Partial<Customer>): Customer | undefined {
    this.init();
    const cust = this.customers.find((c) => c.id === id);
    if (cust) {
      Object.assign(cust, updates);
      this.persist();
    }
    return cust;
  }

  public static markCustomerDNC(customerId: string): boolean {
    this.init();
    const cust = this.customers.find((c) => c.id === customerId);
    if (cust) {
      cust.dnc_flag = true;
      this.logAudit({
        customerId,
        eventType: 'dnc_marked',
        details: { reason: 'Customer requested Do Not Call during voice recovery call' }
      });
      this.persist();
      return true;
    }
    return false;
  }

  public static setBillingHold(customerId: string, holdDays: number = 7): boolean {
    this.init();
    const cust = this.customers.find((c) => c.id === customerId);
    if (cust) {
      const holdUntil = new Date(Date.now() + holdDays * 86400000).toISOString().split('T')[0];
      cust.billing_hold = true;
      cust.billing_hold_until = holdUntil;
      this.logAudit({
        customerId,
        eventType: 'billing_hold_placed',
        details: { holdDays, holdUntil, reason: 'Customer dispute or grace pause' }
      });
      this.persist();
      return true;
    }
    return false;
  }

  public static recordPromise(customerId: string, promisedDate: string, amount: number, currency: string = 'INR'): PromiseToPay {
    this.init();
    const promise: PromiseToPay = {
      id: 'prom_' + Math.random().toString(36).substring(2, 9),
      customerId,
      promisedDate,
      amount,
      currency,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    this.promises.unshift(promise);
    this.logAudit({
      customerId,
      eventType: 'promise_recorded',
      details: { promiseId: promise.id, promisedDate, amount }
    });
    this.persist();
    return promise;
  }

  public static recordPaymentPlan(customerId: string, totalAmount: number, installments: number = 3): PaymentPlan {
    this.init();
    const plan: PaymentPlan = {
      id: 'plan_' + Math.random().toString(36).substring(2, 9),
      customerId,
      totalAmount,
      installments,
      monthlyAmount: Math.round(totalAmount / installments),
      frequency: 'monthly',
      firstDueDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      createdAt: new Date().toISOString()
    };
    this.plans.unshift(plan);
    this.logAudit({
      customerId,
      eventType: 'plan_agreed',
      details: { planId: plan.id, installments, monthlyAmount: plan.monthlyAmount }
    });
    this.persist();
    return plan;
  }

  public static recordEscalation(
    customerId: string,
    reason: string,
    notes: string,
    targetDepartment: string = 'Billing Specialist'
  ): EscalationRecord {
    this.init();
    const record: EscalationRecord = {
      id: 'esc_' + Math.random().toString(36).substring(2, 9),
      customerId,
      reason,
      notes,
      targetDepartment,
      transferredAt: new Date().toISOString()
    };
    this.escalations.unshift(record);
    this.logAudit({
      customerId,
      eventType: 'escalation',
      details: { escalationId: record.id, reason, targetDepartment }
    });
    this.persist();
    return record;
  }

  public static recordCallSession(session: CallSession): void {
    this.init();
    const existing = this.callHistory.findIndex((c) => c.id === session.id);
    if (existing >= 0) {
      this.callHistory[existing] = session;
    } else {
      this.callHistory.unshift(session);
    }
    this.persist();
  }

  public static getCallHistory(): CallSession[] {
    this.init();
    return this.callHistory;
  }

  public static getCallHistoryForCustomer(customerId: string): CallSession[] {
    this.init();
    return this.callHistory
      .filter((c) => c.customerId === customerId)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  public static logAudit(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): AuditLogEntry {
    this.init();
    const fullEntry: AuditLogEntry = {
      id: 'aud_' + Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      ...entry
    };
    this.auditLogs.unshift(fullEntry);
    this.persist();
    return fullEntry;
  }

  public static getAuditLogs(): AuditLogEntry[] {
    this.init();
    return this.auditLogs;
  }

  public static getScheduledCalls(): ScheduledCall[] {
    this.init();
    return this.scheduledCalls;
  }

  public static addScheduledCall(call: ScheduledCall): ScheduledCall {
    this.init();
    const existingIndex = this.scheduledCalls.findIndex((c) => c.id === call.id);
    if (existingIndex >= 0) {
      this.scheduledCalls[existingIndex] = call;
    } else {
      this.scheduledCalls.unshift(call);
    }
    this.logAudit({
      customerId: call.customerId,
      eventType: 'compliance_check',
      details: {
        action: 'call_scheduled',
        scheduledDateTime: call.scheduledDateTime,
        isCompliantWindow: call.isCompliantWindow,
        campaignType: call.campaignType
      }
    });
    this.persist();
    return call;
  }

  public static updateScheduledCall(id: string, updates: Partial<ScheduledCall>): ScheduledCall | undefined {
    this.init();
    const call = this.scheduledCalls.find((c) => c.id === id);
    if (call) {
      Object.assign(call, updates);
      this.persist();
    }
    return call;
  }

  public static deleteScheduledCall(id: string): boolean {
    this.init();
    const initialLen = this.scheduledCalls.length;
    this.scheduledCalls = this.scheduledCalls.filter((c) => c.id !== id);
    if (this.scheduledCalls.length < initialLen) {
      this.persist();
      return true;
    }
    return false;
  }

  public static getStats() {
    this.init();
    const totalCustomers = this.customers.length;
    const dncCount = this.customers.filter((c) => c.dnc_flag).length;
    const paidCount = this.customers.filter((c) => c.amount_due === 0).length;
    const initialData: Customer[] = JSON.parse(JSON.stringify(customerData));
    const totalAmount = initialData.reduce((acc, c) => acc + c.amount_due, 0);
    const recoveredAmount = this.customers.reduce((acc, c) => {
      const orig = initialData.find((origC) => origC.id === c.id);
      return acc + ((orig?.amount_due || 0) - c.amount_due);
    }, 0);

    return {
      totalCustomers,
      dncCount,
      paidCount,
      totalAmount,
      recoveredAmount,
      recoveryRate: Math.round((recoveredAmount / (totalAmount || 1)) * 100),
      callsHandled: this.callHistory.length,
      promisesCount: this.promises.length,
      plansCount: this.plans.length,
      escalationsCount: this.escalations.length
    };
  }

  public static resetData(): void {
    this.customers = JSON.parse(JSON.stringify(customerData));
    this.promises = [];
    this.plans = [];
    this.escalations = [];
    this.callHistory = [];
    this.auditLogs = [];
    this.scheduledCalls = this.getInitialScheduledCalls();
    this.persist();
  }
}
