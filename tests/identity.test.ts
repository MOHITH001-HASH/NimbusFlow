import { test } from 'node:test';
import assert from 'node:assert';
import { IdentityService } from '../src/services/identity';
import { Customer } from '../src/types';

const mockCustomer: Customer = {
  id: 'test_c1',
  name: 'Rajesh Sharma',
  phone: '+15550100001',
  email: 'rajesh@example.com',
  language: 'en',
  timezone: 'Asia/Kolkata',
  plan: 'Growth Cloud',
  amount_due: 2499,
  currency: 'INR',
  due_date: '2026-09-28',
  last4: '4242',
  zip_code: '560001',
  failure_code: 'card_expired',
  failure_reason: 'Card expired',
  payment_failures_count: 1,
  call_attempts_count: 0,
  tenure_months: 18,
  segment: 'SMB',
  consent_status: true,
  dnc_flag: false,
  hardship_flag: false,
  billing_hold: false,
  notes: 'Test customer',
  persona_scenario: 'expired_card_cooperative'
};

test('identity session initializes with unverified state', () => {
  const callId = 'test_call_init';
  const state = IdentityService.initializeSession(callId, mockCustomer.id);
  assert.strictEqual(state.isFullyVerified, false);
  assert.strictEqual(state.failedAttempts, 0);
  assert.strictEqual(state.isLockedOut, false);
});

test('secondary factor verifies successfully with matching last4', () => {
  const callId = 'test_call_verify';
  IdentityService.initializeSession(callId, mockCustomer.id);
  IdentityService.confirmName(callId, true);
  const result = IdentityService.verifyFactor(callId, mockCustomer, 'last4', '4242');
  assert.strictEqual(result.verified, true);
  assert.strictEqual(result.isLockedOut, false);
});

test('failed verification decrements remaining attempts', () => {
  const callId = 'test_call_fail1';
  IdentityService.initializeSession(callId, mockCustomer.id);
  const result = IdentityService.verifyFactor(callId, mockCustomer, 'last4', '0000');
  assert.strictEqual(result.verified, false);
  assert.strictEqual(result.attemptsRemaining, 1);
  assert.strictEqual(result.isLockedOut, false);
});

test('two consecutive failed verifications lock out the session', () => {
  const callId = 'test_call_lockout';
  IdentityService.initializeSession(callId, mockCustomer.id);
  IdentityService.verifyFactor(callId, mockCustomer, 'last4', '0000');
  const result2 = IdentityService.verifyFactor(callId, mockCustomer, 'last4', '9999');
  assert.strictEqual(result2.verified, false);
  assert.strictEqual(result2.attemptsRemaining, 0);
  assert.strictEqual(result2.isLockedOut, true);
});
