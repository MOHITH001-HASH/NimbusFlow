import { test } from 'node:test';
import assert from 'node:assert';
import { CustomerValidator } from '../src/services/customerValidation';

test('phone validation: accepts E.164, rejects invalid format', () => {
  const validResult = CustomerValidator.validate({ phone: '+15550100001' }, true);
  assert.strictEqual(validResult.valid, true);

  const invalidResult = CustomerValidator.validate({ phone: 'invalid-number' }, true);
  assert.strictEqual(invalidResult.valid, false);
});

test('email validation: accepts valid email, rejects invalid format', () => {
  const validResult = CustomerValidator.validate({ email: 'user@example.com' }, true);
  assert.strictEqual(validResult.valid, true);

  const invalidResult = CustomerValidator.validate({ email: 'user@' }, true);
  assert.strictEqual(invalidResult.valid, false);
});

test('last4 validation: requires exactly 4 numeric digits', () => {
  const validResult = CustomerValidator.validate({ last4: '4242' }, true);
  assert.strictEqual(validResult.valid, true);

  const invalidResult = CustomerValidator.validate({ last4: '12' }, true);
  assert.strictEqual(invalidResult.valid, false);
});

test('amount validation: requires non-negative balance', () => {
  const validResult = CustomerValidator.validate({ amount_due: 1999 }, true);
  assert.strictEqual(validResult.valid, true);

  const invalidResult = CustomerValidator.validate({ amount_due: -100 }, true);
  assert.strictEqual(invalidResult.valid, false);
});
