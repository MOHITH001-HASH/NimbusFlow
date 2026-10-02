import { Customer, ComplianceCheckResult } from '../types';

export class ComplianceService {
  private static activeCallLocks = new Set<string>();

  /**
   * Pre-call gate: evaluates whether a call is legally and policy compliant to dial.
   */
  public static evaluatePreCall(customer: Customer, forcedOverride = false): ComplianceCheckResult {
    const reasons: string[] = [];

    // 1. Consent Check (TCPA & TRAI)
    if (!customer.consent_status) {
      reasons.push('REJECT: Customer has not provided verifiable communications consent.');
    }

    // 2. Do Not Call (DNC) Check
    if (customer.dnc_flag) {
      reasons.push('REJECT: Number is actively flagged on NimbusFlow Do-Not-Call (DNC) registry.');
    }

    // 3. Billing Hold Check (from disputes or grace pauses)
    if (customer.billing_hold) {
      reasons.push(`REJECT: Active billing hold in place until ${customer.billing_hold_until || 'review completion'}. Automated dunning paused.`);
    }

    // 4. Weekly Call Attempt Cap (max 3 call attempts - CFPB Reg F)
    const callAttempts = customer.call_attempts_count ?? 0;
    if (callAttempts >= 3 && !forcedOverride) {
      reasons.push(`REJECT: Weekly call attempt cap reached (${callAttempts} call attempts on record). Escalated to manual supervisor review.`);
    }

    // 5. Duplicate Call Lock Check
    if (this.activeCallLocks.has(customer.id)) {
      reasons.push('REJECT: Active call lock in place for this customer ID. Duplicate call prevented.');
    }

    // 6. Calling Window Check (09:00 - 20:00 customer-local time)
    const localHour = this.getCustomerLocalHour(customer.timezone);
    const localTimeStr = this.getCustomerLocalTimeString(customer.timezone);

    if ((localHour < 9 || localHour >= 20) && !forcedOverride) {
      reasons.push(`REJECT: Current customer local time (${localTimeStr}) is outside permissible calling window (09:00 - 20:00).`);
    }

    return {
      canDial: reasons.length === 0,
      reasons,
      customerLocalTime: localTimeStr,
      weeklyAttempts: callAttempts,
      dncStatus: customer.dnc_flag,
      consentStatus: customer.consent_status
    };
  }

  public static acquireCallLock(customerId: string): boolean {
    if (this.activeCallLocks.has(customerId)) return false;
    this.activeCallLocks.add(customerId);
    return true;
  }

  public static releaseCallLock(customerId: string): void {
    this.activeCallLocks.delete(customerId);
  }

  public static getCustomerLocalHour(timezone: string = 'Asia/Kolkata'): number {
    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        hour12: false
      });
      return parseInt(formatter.format(now), 10);
    } catch {
      return 14; // Default safe afternoon hour
    }
  }

  public static getCustomerLocalTimeString(timezone: string = 'Asia/Kolkata'): string {
    try {
      const now = new Date();
      return new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        timeZoneName: 'short'
      }).format(now);
    } catch {
      return '02:30 PM';
    }
  }
}
