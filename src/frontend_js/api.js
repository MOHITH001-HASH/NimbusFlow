/**
 * NimbusFlow API Client - Pure JavaScript
 */
export async function login(username, password) {
  const cleanU = (username || '').trim();
  const cleanP = (password || '').trim();
  const basicToken = btoa(`${cleanU}:${cleanP}`);

  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${basicToken}`
    },
    body: JSON.stringify({ username: cleanU, password: cleanP })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Authentication failed');
  }
  return data;
}

export async function checkSession() {
  const res = await fetch('/api/auth/me');
  return res.json();
}

export async function logout() {
  const res = await fetch('/api/auth/logout', { method: 'POST' });
  return res.json();
}

export async function getCustomers() {
  const res = await fetch('/api/customers');
  return res.json();
}

export async function dialCall(customerId) {
  const res = await fetch('/api/calls/dial', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customerId })
  });
  return res.json();
}

export async function sendChatTurn(callId, customerId, message) {
  const res = await fetch('/api/calls/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callId, customerId, message })
  });
  return res.json();
}

export async function runEvals() {
  const res = await fetch('/api/evals/run', { method: 'POST' });
  return res.json();
}

export async function getAuditLogs() {
  const res = await fetch('/api/audit-log');
  return res.json();
}
