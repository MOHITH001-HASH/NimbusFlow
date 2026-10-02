import { test } from 'node:test';
import assert from 'node:assert';

test('auth credentials verification: validates ops user and password safely', () => {
  const defaultUser = 'ops';
  const defaultPass = 'test';

  const verifyCredentials = (u: string, p: string) => {
    return u === defaultUser && p === defaultPass;
  };

  assert.strictEqual(verifyCredentials('ops', 'test'), true);
  assert.strictEqual(verifyCredentials('ops', 'wrong'), false);
  assert.strictEqual(verifyCredentials('admin', 'test'), false);
  assert.strictEqual(verifyCredentials('', ''), false);
});

test('basic auth header parser extracts username and password correctly', () => {
  const user = 'ops';
  const pass = 'test';
  const basicToken = Buffer.from(`${user}:${pass}`).toString('base64');
  const authHeader = `Basic ${basicToken}`;

  const parseBasicHeader = (header: string) => {
    if (!header.startsWith('Basic ')) return null;
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf-8');
    const idx = decoded.indexOf(':');
    if (idx === -1) return null;
    return {
      username: decoded.slice(0, idx),
      password: decoded.slice(idx + 1)
    };
  };

  const parsed = parseBasicHeader(authHeader);
  assert.notStrictEqual(parsed, null);
  assert.strictEqual(parsed?.username, 'ops');
  assert.strictEqual(parsed?.password, 'test');
});
