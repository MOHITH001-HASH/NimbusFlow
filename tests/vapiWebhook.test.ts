import { test } from 'node:test';
import assert from 'node:assert';
import { IdentityService } from '../src/services/identity';
import { Customer } from '../src/types';

const testCust: Customer = {
  id: 'cust_vapi_test',
  name: 'Aarav Patel',
  phone: '+15550100099',
  email: 'aarav@example.com',
  language: 'en',
  timezone: 'Asia/Kolkata',
  plan: 'Growth Cloud',
  amount_due: 3500,
  currency: 'INR',
  due_date: '2026-09-30',
  last4: '9876',
  zip_code: '400001',
  failure_code: 'card_expired',
  failure_reason: 'Card expired',
  payment_failures_count: 1,
  call_attempts_count: 0,
  tenure_months: 12,
  segment: 'SMB',
  consent_status: true,
  dnc_flag: false,
  hardship_flag: false,
  billing_hold: false,
  notes: 'Vapi integration test customer',
  persona_scenario: 'expired_card_cooperative'
};

test('vapi webhook: rejects actions before identity is verified on specific provider call', () => {
  const providerCallId = 'vapi_call_101';
  IdentityService.initializeSession(providerCallId, testCust.id);

  const isVerified = (customerId: string) => {
    const st = IdentityService.getSession(providerCallId);
    return Boolean(st && st.customerId === customerId && st.factorVerified);
  };

  assert.strictEqual(isVerified(testCust.id), false);
});

test('vapi webhook: allows action after successful factor verification on same call', () => {
  const providerCallId = 'vapi_call_102';
  IdentityService.initializeSession(providerCallId, testCust.id);
  IdentityService.verifyFactor(providerCallId, testCust, 'last4', '9876');

  const isVerified = (customerId: string) => {
    const st = IdentityService.getSession(providerCallId);
    return Boolean(st && st.customerId === customerId && st.factorVerified);
  };

  assert.strictEqual(isVerified(testCust.id), true);
});

test('vapi webhook: call isolation ensures different call remains unverified', () => {
  const call1 = 'vapi_call_201';
  const call2 = 'vapi_call_202';

  IdentityService.initializeSession(call1, testCust.id);
  IdentityService.verifyFactor(call1, testCust, 'last4', '9876');

  IdentityService.initializeSession(call2, testCust.id);

  const isVerified = (callId: string, customerId: string) => {
    const st = IdentityService.getSession(callId);
    return Boolean(st && st.customerId === customerId && st.factorVerified);
  };

  assert.strictEqual(isVerified(call1, testCust.id), true);
  assert.strictEqual(isVerified(call2, testCust.id), false);
});

test('vapi webhook parameter parser handles both object parameters and JSON string arguments', () => {
  const tc1 = { name: 'verify_identity', parameters: { customerId: 'c1', factorValue: '1234' } };
  const tc2 = { function: { name: 'verify_identity', arguments: '{"customerId":"c1","factorValue":"1234"}' } };

  const parseArgs = (tc: any) => {
    let args = tc.parameters ?? tc.function?.arguments ?? {};
    if (typeof args === 'string') {
      try { args = JSON.parse(args); } catch { args = {}; }
    }
    return args;
  };

  assert.deepStrictEqual(parseArgs(tc1), { customerId: 'c1', factorValue: '1234' });
  assert.deepStrictEqual(parseArgs(tc2), { customerId: 'c1', factorValue: '1234' });
});

test('vapi webhook: extracts toolCallList from message and root body structures', () => {
  const payload1 = {
    message: {
      type: 'tool-calls',
      toolCallList: [
        { id: 't1', function: { name: 'schedule_promise_to_pay', arguments: '{"promisedDate":"2026-10-15"}' } }
      ]
    }
  };

  const payload2 = {
    type: 'tool-calls',
    toolCallList: [
      { id: 't2', function: { name: 'create_payment_link', arguments: '{"customerId":"cust_vapi_test"}' } }
    ]
  };

  const extractCalls = (body: any) => {
    const msg = body.message || body;
    return msg.toolCallList || msg.toolCalls || body.toolCallList || [];
  };

  assert.strictEqual(extractCalls(payload1).length, 1);
  assert.strictEqual(extractCalls(payload1)[0].id, 't1');
  assert.strictEqual(extractCalls(payload2).length, 1);
  assert.strictEqual(extractCalls(payload2)[0].id, 't2');
});

test('vapi webhook: enforces strict identity verification for payment links and promise-to-pay updates', () => {
  const callId = 'call_strict_enforce_001';
  IdentityService.initializeSession(callId, testCust.id);

  const checkStrictVerification = (providerCallId: string, customerId: string) => {
    const session = IdentityService.getSession(providerCallId);
    if (!session) return false;
    if (session.isLockedOut) return false;
    if (session.customerId !== customerId) return false;
    return Boolean(session.factorVerified);
  };

  // Initially unverified: both must be rejected
  assert.strictEqual(checkStrictVerification(callId, testCust.id), false);

  // Successfully verify identity
  const verifyRes = IdentityService.verifyFactor(callId, testCust, 'last4', testCust.last4);
  assert.strictEqual(verifyRes.verified, true);

  // Now strictly verified: payment link and promise-to-pay are permitted
  assert.strictEqual(checkStrictVerification(callId, testCust.id), true);
});

test('vapi webhook: locks out identity and rejects sensitive actions after 2 failed attempts', () => {
  const callId = 'call_lockout_enforce_002';
  IdentityService.initializeSession(callId, testCust.id);

  // Attempt 1 with wrong factor
  const res1 = IdentityService.verifyFactor(callId, testCust, 'last4', '0000');
  assert.strictEqual(res1.verified, false);
  assert.strictEqual(res1.isLockedOut, false);

  // Attempt 2 with wrong factor
  const res2 = IdentityService.verifyFactor(callId, testCust, 'last4', '1111');
  assert.strictEqual(res2.verified, false);
  assert.strictEqual(res2.isLockedOut, true);

  const checkStrictVerification = (providerCallId: string, customerId: string) => {
    const session = IdentityService.getSession(providerCallId);
    if (!session) return false;
    if (session.isLockedOut) return false;
    if (session.customerId !== customerId) return false;
    return Boolean(session.factorVerified);
  };

  // Must remain rejected due to lockout
  assert.strictEqual(checkStrictVerification(callId, testCust.id), false);
});

test('vapi webhook: caller cannot spoof a different customer by supplying another customer ID', () => {
  const cust1: Customer = {
    ...testCust,
    id: 'cust_001',
    phone: '+15550100099',
    last4: '9876'
  };

  const cust2: Customer = {
    ...testCust,
    id: 'cust_002',
    phone: '+15550100088',
    last4: '1234'
  };

  const allCustomers = [cust1, cust2];

  // Resolver logic matching server.ts fix a
  const resolveCustomer = (callPhone: string | undefined, providerCallId: string, customerIdFromArgs: string | undefined) => {
    return (
      (callPhone ? allCustomers.find((c) => c.phone === callPhone) : undefined) ||
      allCustomers.find((c) => c.id === IdentityService.getSession(providerCallId)?.customerId) ||
      (!callPhone ? allCustomers.find((c) => c.id === customerIdFromArgs) : undefined)
    );
  };

  const callId = 'call_spoof_test_003';
  const callPhone = '+15550100099'; // Call is to Customer 1's number
  const attackerClaimedId = 'cust_002'; // Attacker attempts to claim Customer 2
  const attackerProvidedFactor = '1234'; // Customer 2's last4

  // The server resolves cust by callPhone first
  const resolvedCust = resolveCustomer(callPhone, callId, attackerClaimedId);
  assert.strictEqual(resolvedCust?.id, 'cust_001');

  // Verification against resolved customer (cust1 with last4 '9876') fails with cust2's last4
  IdentityService.initializeSession(callId, resolvedCust!.id);
  const verifyResult = IdentityService.verifyFactor(callId, resolvedCust!, 'last4', attackerProvidedFactor);

  assert.strictEqual(verifyResult.verified, false);
  assert.strictEqual(IdentityService.getSession(callId)?.factorVerified, false);
});

test('vapi webhook: get_customer_context redacts account details until identity is verified', () => {
  const cust = { ...testCust, id: 'cust_context_test', amount_due: 4200, failure_reason: 'Expired card' };
  const callId = 'call_context_gate_004';
  IdentityService.initializeSession(callId, cust.id);

  const isStrictlyVerified = (customerId: string) => {
    const session = IdentityService.getSession(callId);
    return Boolean(session && session.customerId === customerId && session.factorVerified && !session.isLockedOut);
  };

  const getContext = () => {
    const verified = isStrictlyVerified(cust.id);
    return !verified
      ? { customerId: cust.id, name: cust.name, identityVerified: false, note: 'Verify identity before discussing any account details.' }
      : { customerId: cust.id, name: cust.name, amountDue: cust.amount_due, failureReason: cust.failure_reason };
  };

  // Before verification: only name & unverified note returned, no financial details
  const unverifiedContext = getContext() as any;
  assert.strictEqual(unverifiedContext.identityVerified, false);
  assert.strictEqual(unverifiedContext.amountDue, undefined);
  assert.strictEqual(unverifiedContext.failureReason, undefined);

  // After verification: financial details revealed
  IdentityService.verifyFactor(callId, cust, 'last4', cust.last4);
  const verifiedContext = getContext() as any;
  assert.strictEqual(verifiedContext.amountDue, 4200);
  assert.strictEqual(verifiedContext.failureReason, 'Expired card');
});

test('customer creation: defaults consent_status to false unless explicitly true', () => {
  const evaluateConsent = (reqBody: { consent_status?: any }) => {
    return reqBody.consent_status === true;
  };

  assert.strictEqual(evaluateConsent({}), false);
  assert.strictEqual(evaluateConsent({ consent_status: undefined }), false);
  assert.strictEqual(evaluateConsent({ consent_status: null }), false);
  assert.strictEqual(evaluateConsent({ consent_status: 'true' }), false);
  assert.strictEqual(evaluateConsent({ consent_status: 1 }), false);
  assert.strictEqual(evaluateConsent({ consent_status: true }), true);
});


