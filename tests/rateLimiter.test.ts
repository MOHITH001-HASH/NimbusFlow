import { test } from 'node:test';
import assert from 'node:assert';
import { AuthRateLimiter } from '../src/services/rateLimiter';

test('rateLimiter: permits requests within rate limit threshold', () => {
  const limiter = new AuthRateLimiter(60000, 5);
  const ip = '192.168.1.100';

  const status0 = limiter.check(ip);
  assert.strictEqual(status0.allowed, true);
  assert.strictEqual(status0.remainingAttempts, 5);

  const fail1 = limiter.recordFailure(ip);
  assert.strictEqual(fail1.allowed, true);
  assert.strictEqual(fail1.remainingAttempts, 4);

  const fail2 = limiter.recordFailure(ip);
  assert.strictEqual(fail2.allowed, true);
  assert.strictEqual(fail2.remainingAttempts, 3);
});

test('rateLimiter: blocks IP after maximum failed attempts reached', () => {
  const limiter = new AuthRateLimiter(60000, 3);
  const ip = '10.0.0.5';

  limiter.recordFailure(ip); // Attempt 1 (2 remaining)
  limiter.recordFailure(ip); // Attempt 2 (1 remaining)
  const fail3 = limiter.recordFailure(ip); // Attempt 3 (0 remaining, blocked)

  assert.strictEqual(fail3.allowed, false);
  assert.strictEqual(fail3.remainingAttempts, 0);
  assert.ok(fail3.retryAfterSeconds > 0 && fail3.retryAfterSeconds <= 60);

  // Subsequent check is also blocked
  const checkStatus = limiter.check(ip);
  assert.strictEqual(checkStatus.allowed, false);
  assert.strictEqual(checkStatus.remainingAttempts, 0);
  assert.ok(checkStatus.retryAfterSeconds > 0);
});

test('rateLimiter: resets failed attempts on successful login', () => {
  const limiter = new AuthRateLimiter(60000, 5);
  const ip = '172.16.0.1';

  limiter.recordFailure(ip);
  limiter.recordFailure(ip);
  assert.strictEqual(limiter.check(ip).remainingAttempts, 3);

  // Operator enters correct password
  limiter.recordSuccess(ip);

  assert.strictEqual(limiter.check(ip).allowed, true);
  assert.strictEqual(limiter.check(ip).remainingAttempts, 5);
});

test('rateLimiter: isolates limits across distinct IP addresses', () => {
  const limiter = new AuthRateLimiter(60000, 2);
  const ipAttacker = '198.51.100.1';
  const ipLegitimate = '203.0.113.1';

  limiter.recordFailure(ipAttacker);
  limiter.recordFailure(ipAttacker);

  assert.strictEqual(limiter.check(ipAttacker).allowed, false);
  assert.strictEqual(limiter.check(ipLegitimate).allowed, true);
  assert.strictEqual(limiter.check(ipLegitimate).remainingAttempts, 2);
});
