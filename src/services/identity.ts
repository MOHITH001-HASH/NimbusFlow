import { Customer } from '../types';

export interface IdentityVerificationState {
  customerId: string;
  nameConfirmed: boolean;
  factorChecked: 'last4' | 'zip' | null;
  factorVerified: boolean;
  failedAttempts: number;
  isFullyVerified: boolean;
  isLockedOut: boolean;
}

export class IdentityService {
  private static sessions = new Map<string, IdentityVerificationState>();

  public static initializeSession(callId: string, customerId: string): IdentityVerificationState {
    const state: IdentityVerificationState = {
      customerId,
      nameConfirmed: false,
      factorChecked: null,
      factorVerified: false,
      failedAttempts: 0,
      isFullyVerified: false,
      isLockedOut: false
    };
    this.sessions.set(callId, state);
    return state;
  }

  public static getSession(callId: string): IdentityVerificationState | undefined {
    return this.sessions.get(callId);
  }

  public static confirmName(callId: string, confirmed: boolean): { success: boolean; state: IdentityVerificationState } {
    const session = this.sessions.get(callId);
    if (!session) {
      throw new Error(`Call session ${callId} not found`);
    }

    session.nameConfirmed = confirmed;
    session.isFullyVerified = session.nameConfirmed && session.factorVerified;
    return { success: confirmed, state: session };
  }

  public static verifyFactor(
    callId: string,
    customer: Customer,
    factorType: 'last4' | 'zip',
    providedValue: string
  ): { verified: boolean; attemptsRemaining: number; isLockedOut: boolean; message: string } {
    let session = this.sessions.get(callId);
    if (!session) {
      session = this.initializeSession(callId, customer.id);
    }

    if (session.isLockedOut) {
      return {
        verified: false,
        attemptsRemaining: 0,
        isLockedOut: true,
        message: 'Verification locked out due to multiple failed attempts.'
      };
    }

    session.factorChecked = factorType;
    const cleanProvided = providedValue.replace(/\D/g, '').trim();

    let matched = false;
    if (factorType === 'last4') {
      matched = cleanProvided.endsWith(customer.last4) || cleanProvided === customer.last4;
    } else if (factorType === 'zip') {
      matched = cleanProvided === customer.zip_code || providedValue.toLowerCase().includes(customer.zip_code.toLowerCase());
    }

    if (matched) {
      session.factorVerified = true;
      session.isFullyVerified = session.nameConfirmed && session.factorVerified;
      return {
        verified: true,
        attemptsRemaining: 2 - session.failedAttempts,
        isLockedOut: false,
        message: 'Secondary factor verified successfully.'
      };
    } else {
      session.failedAttempts += 1;
      const isLockedOut = session.failedAttempts >= 2;
      session.isLockedOut = isLockedOut;

      return {
        verified: false,
        attemptsRemaining: Math.max(0, 2 - session.failedAttempts),
        isLockedOut,
        message: isLockedOut
          ? 'Verification failed twice. Terminating call for security. Neutral follow-up will be sent.'
          : 'Verification factor mismatch. 1 attempt remaining.'
      };
    }
  }
}
