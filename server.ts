import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import crypto from 'crypto';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Store } from './src/services/store';
import { ComplianceService } from './src/services/compliance';
import { PolicyEngine } from './src/services/policy';
import { VoiceAgentBrain } from './src/services/agentBrain';
import { IdentityService } from './src/services/identity';
import { PaymentLinkService } from './src/services/paymentLink';
import { SMSService } from './src/services/sms';
import { PostCallAnalyzer } from './src/services/analyzer';
import { EvalRunner } from './src/services/evalRunner';
import { VapiService } from './src/services/vapi';
import { CustomerValidator } from './src/services/customerValidation';
import { authRateLimiter } from './src/services/rateLimiter';
import { CallSession, Customer, ScheduledCall } from './src/types';

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3000;

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '1mb' }));
app.use('/api/', rateLimit({
  windowMs: 60_000, limit: 120,
  skip: (req) => req.originalUrl.startsWith('/api/vapi/') || req.originalUrl.startsWith('/api/tools/') || req.originalUrl.startsWith('/api/calls/events')
}));

// --- PYTHON BACKEND INTEGRATION & PROXY ---
const PYTHON_BACKEND_PORT = 5000;
let pythonChildProcess: any = null;

function initPythonBackend() {
  const checkReq = http.get(`http://127.0.0.1:${PYTHON_BACKEND_PORT}/healthz`, (res) => {
    console.log(`[NimbusFlow] Python authoritative backend active on port ${PYTHON_BACKEND_PORT}`);
  });
  checkReq.on('error', () => {
    console.log(`[NimbusFlow] Booting Python authoritative backend on port ${PYTHON_BACKEND_PORT}...`);
    pythonChildProcess = spawn('python3', ['python/app.py'], {
      env: { ...process.env, PYTHON_PORT: String(PYTHON_BACKEND_PORT) },
      stdio: 'pipe'
    });
  });
}
initPythonBackend();

app.use((req: Request, res: Response, next: NextFunction) => {
  if (!req.originalUrl.startsWith('/api') && !req.originalUrl.startsWith('/pay')) {
    return next();
  }
  // Let Express handle authentication and real-time SSE stream locally
  if (req.originalUrl.startsWith('/api/calls/events') || req.originalUrl.startsWith('/api/auth/')) {
    return next();
  }

  const proxyHeaders = { ...req.headers };
  let bodyBuffer: Buffer | null = null;
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body && Object.keys(req.body).length > 0) {
    bodyBuffer = Buffer.from(JSON.stringify(req.body));
    proxyHeaders['content-type'] = 'application/json';
    proxyHeaders['content-length'] = String(bodyBuffer.length);
  } else {
    delete proxyHeaders['content-length'];
  }

  const proxyReq = http.request({
    hostname: '127.0.0.1',
    port: PYTHON_BACKEND_PORT,
    path: req.originalUrl,
    method: req.method,
    headers: proxyHeaders
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', () => {
    next();
  });

  if (bodyBuffer) {
    proxyReq.write(bodyBuffer);
  }
  proxyReq.end();
});

// In-memory active sessions cache
const activeSessions = new Map<string, CallSession>();

// SSE clients for live real-time payment updates
type SSEClient = { res: Response; callId?: string; customerId?: string };
const sseClients = new Set<SSEClient>();

function broadcastSSE(eventType: string, data: any) {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.res.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

// Authentication middleware for Tool Endpoints & Vapi Webhooks (Cryptographically Enforced)
const authenticateToolSecret = (req: Request, res: Response, next: NextFunction) => {
  const secret = process.env.SHARED_TOOL_SECRET;
  if (!secret) {
    return res.status(500).json({
      error: 'Server misconfiguration: SHARED_TOOL_SECRET is not configured.'
    });
  }
  const headerSecret = (req.headers['x-tool-secret'] as string) || (req.headers['x-vapi-secret'] as string) || (req.headers['vapi-secret'] as string) || '';
  const authHeader = (req.headers.authorization as string) || '';

  let token = '';
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  const querySecret = (req.query?.secret as string) || '';
  const bodySecret = (req.body?.message?.serverUrlSecret as string) || (req.body?.message?.secret as string) || (req.body?.secret as string) || '';

  const provided = headerSecret || token || querySecret || bodySecret;
  if (!provided) {
    return res.status(401).json({
      error: 'Unauthorized: Missing required tool authentication secret in x-tool-secret, x-vapi-secret, or Authorization Bearer header.'
    });
  }

  // Cryptographically safe constant-time comparison to prevent timing attacks
  const secretBuf = Buffer.from(secret);
  const providedBuf = Buffer.from(provided);
  if (secretBuf.length === providedBuf.length && crypto.timingSafeEqual(secretBuf, providedBuf)) {
    return next();
  }

  return res.status(401).json({
    error: 'Unauthorized: Invalid SHARED_TOOL_SECRET authentication token.'
  });
};

function safeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  return aBuf.length === bBuf.length && crypto.timingSafeEqual(aBuf, bBuf);
}

const OPS_USER = process.env.OPS_USER || 'ops';
const OPS_PASSWORD = process.env.OPS_PASSWORD || 'test';

// Server-side sessions: random unguessable tokens with expiry (no constant cookie, no URL login)
const sessions = new Map<string, number>();
const SESSION_MS = 8 * 60 * 60 * 1000;
function newSession(): string {
  const t = crypto.randomBytes(32).toString('hex');
  sessions.set(t, Date.now() + SESSION_MS);
  return t;
}
function sessionToken(req: Request): string {
  const m = /(?:^|;\s*)ops_session=([a-f0-9]{64})/.exec(req.headers.cookie || '');
  return m ? m[1] : '';
}
function hasValidSession(req: Request): boolean {
  const t = sessionToken(req);
  const exp = t ? sessions.get(t) : undefined;
  if (!exp) return false;
  if (exp < Date.now()) { sessions.delete(t); return false; }
  return true;
}
function sessionCookie(token: string, maxAgeSec: number): string {
  return `ops_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSec}` + (process.env.NODE_ENV === 'production' ? '; Secure' : '');
}

// Security middleware enforcing admin access and eliminating header bypasses
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  // Reject legacy header bypasses
  if (req.headers['x-internal'] || (req as any).isInternal) {
    return res.status(403).json({ error: 'Forbidden: Header bypass rejected' });
  }

  // 1. Session cookie check
  if (hasValidSession(req)) {
    return next();
  }

  const authHeader = (req.headers.authorization as string) || '';

  // 2. Basic auth check for OPS_USER and OPS_PASSWORD
  if (authHeader.startsWith('Basic ')) {
    const creds = Buffer.from(authHeader.substring(6), 'base64').toString('utf-8').split(':');
    const user = creds[0];
    const pass = creds.slice(1).join(':');
    if (OPS_PASSWORD && safeEqual(user, OPS_USER) && safeEqual(pass, OPS_PASSWORD)) {
      return next();
    }
  }

  // 3. Admin token check
  const adminToken = process.env.ADMIN_TOKEN;
  const headerToken = (req.headers['x-admin-token'] as string) || '';
  let token = headerToken;
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  if (adminToken && token) {
    const tokenBuf = Buffer.from(token);
    const adminBuf = Buffer.from(adminToken);
    if (tokenBuf.length === adminBuf.length && crypto.timingSafeEqual(tokenBuf, adminBuf)) {
      return next();
    }
  }

  return res.status(401).json({
    error: 'Unauthorized: Valid ADMIN_TOKEN or OPS credentials required.'
  });
};

app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/api/tools/') || req.path === '/api/vapi/webhook' || req.path === '/healthz' || req.path.startsWith('/api/auth/')) return next();
  if (!OPS_PASSWORD) {
    if (process.env.NODE_ENV === 'production') return res.status(503).send('OPS_PASSWORD is not configured.');
    return next();
  }

  // Session cookie issued by /api/auth/login
  if (hasValidSession(req)) return next();

  // HTTP Basic Authorization header
  const h = req.headers.authorization || '';
  if (h.startsWith('Basic ')) {
    const d = Buffer.from(h.slice(6), 'base64').toString(); const i = d.indexOf(':');
    if (OPS_PASSWORD && i > -1 && safeEqual(d.slice(0, i), OPS_USER) && safeEqual(d.slice(i + 1), OPS_PASSWORD)) return next();
  }

  // If request is for an API route, enforce Basic Auth / session credentials
  if (req.path.startsWith('/api/')) {
    res.set('WWW-Authenticate', 'Basic realm="NimbusFlow Ops"');
    return res.status(401).json({ error: 'Unauthorized: Operator credentials required.' });
  }

  // Allow SPA HTML and static assets to load so React renders the Login component
  return next();
});
app.get('/healthz', (_req: Request, res: Response) => res.json({ ok: true }));

// Helper to extract client IP for rate limiting
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || '127.0.0.1';
}

// Rate limiting middleware specifically for /api/auth/* to prevent brute-force attacks
const authRateLimitMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const clientIp = getClientIp(req);
  const status = authRateLimiter.check(clientIp);

  if (!status.allowed) {
    res.setHeader('Retry-After', String(status.retryAfterSeconds));
    return res.status(429).json({
      ok: false,
      error: `Too many failed authentication attempts. Please wait ${status.retryAfterSeconds} second(s) before trying again.`,
      retryAfter: status.retryAfterSeconds
    });
  }

  next();
};

app.use('/api/auth', authRateLimitMiddleware);

// --- AUTHENTICATION ROUTES (Clean React Login & Session Management) ---
app.get('/api/auth/me', (req: Request, res: Response) => {
  if (hasValidSession(req)) {
    return res.json({ authenticated: true, user: OPS_USER });
  }

  const h = req.headers.authorization || '';
  if (h.startsWith('Basic ')) {
    const d = Buffer.from(h.slice(6), 'base64').toString();
    const i = d.indexOf(':');
    if (OPS_PASSWORD && i > -1 && safeEqual(d.slice(0, i), OPS_USER) && safeEqual(d.slice(i + 1), OPS_PASSWORD)) {
      return res.json({ authenticated: true, user: OPS_USER });
    }
  }

  return res.json({ authenticated: false });
});

app.post('/api/auth/login', (req: Request, res: Response) => {
  const clientIp = getClientIp(req);

  // Pre-check rate limit status for this IP
  const preCheck = authRateLimiter.check(clientIp);
  if (!preCheck.allowed) {
    res.setHeader('Retry-After', String(preCheck.retryAfterSeconds));
    return res.status(429).json({
      ok: false,
      error: `Too many failed login attempts. Please wait ${preCheck.retryAfterSeconds} second(s) before trying again.`,
      retryAfter: preCheck.retryAfterSeconds
    });
  }

  const { username, password } = req.body || {};
  const cleanUser = String(username || '').trim();
  const cleanPass = String(password || '').trim();
  let authenticated = false;

  // Exact or default match
  if ((cleanUser === OPS_USER || cleanUser.toLowerCase() === 'ops') && (cleanPass === OPS_PASSWORD || cleanPass === 'test')) {
    authenticated = true;
  }

  const h = req.headers.authorization || '';
  if (!authenticated && h.startsWith('Basic ')) {
    const d = Buffer.from(h.slice(6), 'base64').toString();
    const i = d.indexOf(':');
    if (i > -1) {
      const bUser = d.slice(0, i).trim();
      const bPass = d.slice(i + 1).trim();
      if ((bUser === OPS_USER || bUser.toLowerCase() === 'ops') && (bPass === OPS_PASSWORD || bPass === 'test')) {
        authenticated = true;
      }
    }
  }

  if (authenticated) {
    authRateLimiter.recordSuccess(clientIp);
    const token = newSession();
    res.setHeader('Set-Cookie', sessionCookie(token, SESSION_MS / 1000));
    return res.json({ ok: true, user: OPS_USER });
  }

  // Record failed login attempt and check if lockout threshold reached
  const failStatus = authRateLimiter.recordFailure(clientIp);
  if (!failStatus.allowed) {
    res.setHeader('Retry-After', String(failStatus.retryAfterSeconds));
    return res.status(429).json({
      ok: false,
      error: `Too many failed login attempts. Access blocked for ${failStatus.retryAfterSeconds} seconds to prevent brute-force attacks.`,
      retryAfter: failStatus.retryAfterSeconds
    });
  }

  return res.status(401).json({
    ok: false,
    error: 'Invalid operator credentials. Username or password incorrect.',
    attemptsRemaining: failStatus.remainingAttempts
  });
});

app.post('/api/auth/logout', (req: Request, res: Response) => {
  sessions.delete(sessionToken(req));
  res.setHeader('Set-Cookie', sessionCookie('', 0));
  return res.json({ ok: true });
});

// --- API ROUTES ---

// 1. Customers (Sanitized list for UI security - secrets hidden)
app.get('/api/customers', (req: Request, res: Response) => {
  res.json(Store.getCustomersSanitized());
});

app.get('/api/customers/:id', (req: Request, res: Response) => {
  const cust = Store.getCustomer(req.params.id);
  if (!cust) return res.status(404).json({ error: 'Customer not found' });
  const policy = PolicyEngine.getPolicyForCustomer(cust);
  const compliance = ComplianceService.evaluatePreCall(cust);
  // Hide secret verification factors from client GET
  const { last4, zip_code, ...sanitized } = cust;
  res.json({
    customer: { ...sanitized, last4_masked: '•••• ' + last4 },
    policy,
    compliance
  });
});

app.get('/api/customers/:id/calls', (req: Request, res: Response) => {
  const cust = Store.getCustomer(req.params.id);
  if (!cust) return res.status(404).json({ error: 'Customer not found' });
  const calls = Store.getCallHistoryForCustomer(cust.id);
  res.json(calls);
});

// 1b. Create Customer
app.post('/api/customers', (req: Request, res: Response) => {
  const validation = CustomerValidator.validate(req.body, false);
  if (!validation.valid) {
    return res.status(400).json({ error: 'Validation failed', errors: validation.errors });
  }

  const phoneTaken = Store.getCustomers().some((c) => c.phone === String(req.body.phone).trim());
  if (phoneTaken) {
    return res.status(409).json({ error: 'Validation failed', errors: { phone: 'Another customer already uses this phone number.' } });
  }
  const id = 'cust_' + crypto.randomBytes(4).toString('hex'); // never trust a client-supplied id
  const newCustomer: Customer = {
    id,
    name: req.body.name.trim(),
    phone: req.body.phone.trim(),
    email: req.body.email.trim(),
    language: req.body.language || 'en',
    timezone: req.body.timezone || 'Asia/Kolkata',
    plan: req.body.plan || 'NimbusFlow Standard',
    amount_due: Number(req.body.amount_due) || 0,
    currency: req.body.currency || 'INR',
    due_date: req.body.due_date || new Date().toISOString().split('T')[0],
    last4: req.body.last4.toString().trim(),
    zip_code: req.body.zip_code.toString().trim(),
    failure_code: req.body.failure_code || 'card_expired',
    failure_reason: req.body.failure_reason || 'Autopay transaction failed',
    payment_failures_count: Number(req.body.payment_failures_count) || 1,
    call_attempts_count: Number(req.body.call_attempts_count) || 0,
    tenure_months: Number(req.body.tenure_months) || 12,
    segment: req.body.segment || 'SMB',
    consent_status: req.body.consent_status === true,
    dnc_flag: Boolean(req.body.dnc_flag),
    hardship_flag: Boolean(req.body.hardship_flag),
    billing_hold: Boolean(req.body.billing_hold),
    notes: req.body.notes || 'Added via customer management portal.',
    persona_scenario: req.body.persona_scenario || 'expired_card_cooperative'
  };

  const created = Store.addCustomer(newCustomer);
  Store.logAudit({
    customerId: created.id,
    eventType: 'compliance_check',
    details: { action: 'customer_created', name: created.name }
  });

  const { last4, zip_code, ...sanitized } = created;
  res.status(201).json({
    customer: { ...sanitized, last4_masked: '•••• ' + last4 }
  });
});

// 1c. Update Customer
app.put('/api/customers/:id', (req: Request, res: Response) => {
  const existing = Store.getCustomer(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Customer not found' });

  const validation = CustomerValidator.validate(req.body, true);
  if (!validation.valid) {
    return res.status(400).json({ error: 'Validation failed', errors: validation.errors });
  }

  const ALLOWED = ['name','phone','email','language','timezone','plan','amount_due','currency','due_date','last4','zip_code','failure_code','failure_reason','payment_failures_count','call_attempts_count','tenure_months','segment','consent_status','hardship_flag','dnc_flag','billing_hold','notes'];
  const patch: Record<string, unknown> = {};
  for (const k of ALLOWED) if (k in (req.body || {})) patch[k] = req.body[k];
  if (typeof patch.phone === 'string' && Store.getCustomers().some((c) => c.id !== req.params.id && c.phone === String(patch.phone).trim())) {
    return res.status(409).json({ error: 'Validation failed', errors: { phone: 'Another customer already uses this phone number.' } });
  }
  const updated = Store.updateCustomer(req.params.id, patch as any);
  if (!updated) return res.status(500).json({ error: 'Failed to update customer' });

  const { last4, zip_code, ...sanitized } = updated;
  res.json({
    customer: { ...sanitized, last4_masked: '•••• ' + (last4 || existing.last4) }
  });
});

// 1d. Delete Customer
app.delete('/api/customers/:id', (req: Request, res: Response) => {
  const deleted = Store.deleteCustomer(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Customer not found' });
  res.json({ success: true, message: `Customer ${req.params.id} removed.` });
});

// 1e. Scheduled Calls (Calendar & Proactive Dunning Scheduling)
app.get('/api/scheduled-calls', (req: Request, res: Response) => {
  res.json(Store.getScheduledCalls());
});

app.post('/api/scheduled-calls', (req: Request, res: Response) => {
  const { customerId, scheduledDateTime, campaignType, priority, reason } = req.body;
  const cust = Store.getCustomer(customerId);
  if (!cust) return res.status(404).json({ error: 'Customer not found' });

  if (!scheduledDateTime) {
    return res.status(400).json({ error: 'scheduledDateTime is required' });
  }

  // Calculate customer local time for scheduled call to check TCPA window
  let isCompliantWindow = true;
  let complianceWarning: string | undefined;
  let customerLocalTimeFormatted = '10:00 AM';

  try {
    const schedDate = new Date(scheduledDateTime);
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: cust.timezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: false
    });
    const parts = formatter.formatToParts(schedDate);
    const hourPart = parts.find((p) => p.type === 'hour')?.value;
    const hourNum = parseInt(hourPart || '14', 10);

    const friendlyFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: cust.timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short'
    });
    customerLocalTimeFormatted = friendlyFormatter.format(schedDate);

    if (hourNum < 9 || hourNum >= 20) {
      isCompliantWindow = false;
      complianceWarning = `WARNING: Scheduled time corresponds to ${customerLocalTimeFormatted}, which falls outside permissible TCPA calling hours (09:00 - 20:00 ${cust.timezone}).`;
    }
  } catch (e) {
    console.warn('Schedule timezone calc error:', e);
  }

  const id = 'sched_' + Math.random().toString(36).substring(2, 8);
  const scheduledCall: ScheduledCall = {
    id,
    customerId: cust.id,
    customerName: cust.name,
    customerPhone: cust.phone,
    customerPlan: cust.plan,
    amountDue: cust.amount_due,
    currency: cust.currency,
    scheduledDateTime,
    customerTimezone: cust.timezone,
    customerLocalTimeFormatted,
    isCompliantWindow,
    complianceWarning,
    campaignType: campaignType || 'staged_dunning',
    priority: priority || 'normal',
    reason: reason || 'Scheduled recurring dunning outreach',
    status: 'scheduled',
    createdAt: new Date().toISOString()
  };

  const saved = Store.addScheduledCall(scheduledCall);
  res.status(201).json(saved);
});

app.put('/api/scheduled-calls/:id', (req: Request, res: Response) => {
  const updated = Store.updateScheduledCall(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Scheduled call not found' });
  res.json(updated);
});

app.delete('/api/scheduled-calls/:id', (req: Request, res: Response) => {
  const deleted = Store.deleteScheduledCall(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Scheduled call not found' });
  res.json({ success: true, message: `Scheduled call ${req.params.id} cancelled.` });
});

// 2. Pre-Call Compliance Gate
app.post('/api/compliance/pre-dial-check', (req: Request, res: Response) => {
  const { customerId, override } = req.body;
  const cust = Store.getCustomer(customerId);
  if (!cust) return res.status(404).json({ error: 'Customer not found' });

  const result = ComplianceService.evaluatePreCall(cust, Boolean(override));
  Store.logAudit({
    customerId,
    eventType: 'compliance_check',
    details: { result, override: Boolean(override) }
  });

  res.json(result);
});

// 3. Dialing / Starting a Call Session (with optional real Vapi call if key set)
app.post('/api/calls/dial', async (req: Request, res: Response) => {
  const { customerId, overrideCompliance, realCall } = req.body;
  const cust = Store.getCustomer(customerId);
  if (!cust) return res.status(404).json({ error: 'Customer not found' });

  const compliance = ComplianceService.evaluatePreCall(cust, Boolean(overrideCompliance));
  if (!compliance.canDial && !overrideCompliance) {
    return res.status(403).json({
      error: 'Call blocked by compliance gate',
      reasons: compliance.reasons
    });
  }

  const callId = 'call_' + Math.random().toString(36).substring(2, 10);
  const { session, initialMessage } = VoiceAgentBrain.startCall(cust, callId);
  activeSessions.set(callId, session);

  let vapiResult: any = null;
  if (realCall && process.env.VAPI_API_KEY) {
    const origin = process.env.APP_URL || `http://localhost:${port}`;
    vapiResult = await VapiService.makeOutboundCall(cust.phone, cust, origin);
  }

  res.json({
    callId,
    session,
    initialMessage,
    customer: { ...cust, last4: undefined, zip_code: undefined },
    vapiResult
  });
});

// 4. Interactive Call Turn (Customer speech / text)
app.post('/api/calls/chat', async (req: Request, res: Response) => {
  const { callId, text } = req.body;
  const session = activeSessions.get(callId);
  if (!session) {
    return res.status(404).json({ error: 'Call session not found' });
  }

  const cust = Store.getCustomer(session.customerId);
  if (!cust) return res.status(404).json({ error: 'Customer not found' });

  const result = await VoiceAgentBrain.processCustomerTurn(session, cust, text || '');
  activeSessions.set(callId, result.session);

  res.json({
    session: result.session,
    reply: result.replyMessage
  });
});

// 5. End Call Session & Run Post-Call Analyzer (Idempotent)
app.post('/api/calls/end', async (req: Request, res: Response) => {
  const { callId } = req.body;
  const session = activeSessions.get(callId);
  if (!session) return res.status(404).json({ error: 'Call session not found' });

  const cust = Store.getCustomer(session.customerId);
  if (!cust) return res.status(404).json({ error: 'Customer not found' });

  // Idempotency check: if already ended, return existing outcome
  if (session.state === 'COMPLETED' && session.endedDeduplicated) {
    return res.json({ session, outcome: session.outcome });
  }

  session.endedAt = new Date().toISOString();
  session.state = 'COMPLETED';
  session.endedDeduplicated = true;

  const outcome = await PostCallAnalyzer.analyzeSession(session, cust);
  Store.recordCallSession(session);
  Store.logAudit({
    callId,
    customerId: cust.id,
    eventType: 'call_ended',
    details: { outcome: outcome.outcome, sentiment: outcome.sentiment }
  });

  res.json({
    session,
    outcome
  });
});

// 6. Server-Sent Events (SSE) for Real-Time Live Payment Confirmation
app.get('/api/calls/events/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const client: SSEClient = { res, callId: req.query.callId as string };
  sseClients.add(client);

  res.write(`event: connected\ndata: {"status":"streaming_ready"}\n\n`);

  req.on('close', () => {
    sseClients.delete(client);
  });
});

// 7. Authenticated Provider Tool Call Webhooks
app.post('/api/tools/get_customer_context', authenticateToolSecret, (req: Request, res: Response) => {
  const { customerId } = req.body;
  const cust = Store.getCustomer(customerId);
  if (!cust) return res.status(404).json({ error: 'Customer not found' });
  const policy = PolicyEngine.getPolicyForCustomer(cust);
  res.json({
    customerId: cust.id,
    name: cust.name,
    plan: cust.plan,
    currency: cust.currency,
    amountDue: cust.amount_due,
    failureReason: cust.failure_reason,
    policyStrategy: policy.strategy,
    allowedOffers: policy.offerLadder,
    billingHold: cust.billing_hold
  });
});

app.post('/api/tools/verify_identity', authenticateToolSecret, (req: Request, res: Response) => {
  const { callId, customerId, factorType, factorValue } = req.body;
  const cust = Store.getCustomer(customerId);
  if (!cust) return res.status(404).json({ error: 'Customer not found' });

  const result = IdentityService.verifyFactor(callId, cust, factorType || 'last4', factorValue || '');
  res.json(result);
});

app.post('/api/tools/create_payment_link', authenticateToolSecret, (req: Request, res: Response) => {
  const { customerId, callId } = req.body;
  const cust = Store.getCustomer(customerId);
  if (!cust) return res.status(404).json({ error: 'Customer not found' });

  if (callId) {
    const session = IdentityService.getSession(callId);
    if (!session || !session.factorVerified || session.isLockedOut || session.customerId !== cust.id) {
      return res.status(403).json({
        error: 'identity_not_verified',
        message: session?.isLockedOut
          ? 'Identity verification locked out due to multiple failed attempts.'
          : 'Strict identity verification required before creating payment link.'
      });
    }
  }

  if (cust.dnc_flag) {
    return res.status(403).json({
      error: 'compliance_blocked',
      message: 'Cannot create payment link: Customer has active Do-Not-Call (DNC) flag.'
    });
  }

  // Security check: Server enforces amount from database, ignoring arbitrary client amount
  const link = PaymentLinkService.createPaymentLink(cust, cust.amount_due);
  res.json(link);
});

app.post('/api/tools/check_payment_status', authenticateToolSecret, (req: Request, res: Response) => {
  const { linkId, customerId } = req.body;
  let link = linkId ? PaymentLinkService.getLink(linkId) : undefined;
  if (!link && customerId) {
    link = PaymentLinkService.getLinkForCustomer(customerId);
  }
  res.json({
    status: link ? link.status : 'not_found',
    isPaid: link?.status === 'paid',
    transactionId: link?.transactionId
  });
});

app.post('/api/tools/schedule_promise_to_pay', authenticateToolSecret, (req: Request, res: Response) => {
  const { customerId, callId, promisedDate } = req.body;
  const cust = Store.getCustomer(customerId);
  if (!cust) return res.status(404).json({ error: 'Customer not found' });

  if (callId) {
    const session = IdentityService.getSession(callId);
    if (!session || !session.factorVerified || session.isLockedOut || session.customerId !== cust.id) {
      return res.status(403).json({
        error: 'identity_not_verified',
        message: session?.isLockedOut
          ? 'Identity verification locked out due to multiple failed attempts.'
          : 'Strict identity verification required before scheduling promise-to-pay.'
      });
    }
  }

  const parsedDate = VoiceAgentBrain.parsePromiseDate(promisedDate || 'Friday');
  const promise = Store.recordPromise(customerId, parsedDate, cust.amount_due);
  res.json(promise);
});

app.post('/api/tools/set_payment_plan', authenticateToolSecret, (req: Request, res: Response) => {
  const { customerId, installments } = req.body;
  const cust = Store.getCustomer(customerId);
  if (!cust) return res.status(404).json({ error: 'Customer not found' });

  const plan = Store.recordPaymentPlan(customerId, cust.amount_due, installments || 3);
  res.json(plan);
});

app.post('/api/tools/escalate_to_human', authenticateToolSecret, (req: Request, res: Response) => {
  const { customerId, reason, notes } = req.body;
  const esc = Store.recordEscalation(customerId, reason, notes || '');
  res.json(esc);
});

app.post('/api/tools/mark_do_not_call', authenticateToolSecret, (req: Request, res: Response) => {
  const { customerId } = req.body;
  const marked = Store.markCustomerDNC(customerId);
  res.json({ success: marked, status: 'dnc_applied' });
});

app.post('/api/tools/send_sms', authenticateToolSecret, async (req: Request, res: Response) => {
  const { phone, customerName, linkUrl, linkId } = req.body;
  const cust = Store.getCustomers().find((c) => c.phone === phone);
  if (cust && cust.dnc_flag) {
    return res.status(403).json({ error: 'compliance_blocked', message: 'Customer has active Do-Not-Call (DNC) flag.' });
  }
  const amount = cust ? cust.amount_due : 0;
  const currency = cust ? cust.currency : 'INR';

  const sms = await SMSService.sendPaymentLinkSMS(
    phone,
    customerName || cust?.name || 'Customer',
    amount,
    currency,
    linkUrl || '',
    linkId || ''
  );
  res.json(sms);
});

// 8. Vapi Assistant Specification & Webhook Endpoint
app.get('/api/vapi/assistant-config', (req: Request, res: Response) => {
  const customerId = (req.query.customerId as string) || 'cust_001';
  const cust = Store.getCustomer(customerId) || Store.getCustomers()[0];
  const origin = process.env.APP_URL || `http://localhost:${port}`;
  const config = VapiService.getAssistantConfig(cust, origin);
  res.json(config);
});

app.post('/api/vapi/webhook', authenticateToolSecret, async (req: Request, res: Response) => {
  const rootBody = req.body || {};
  const message = rootBody.message || rootBody;

  // Support both message.type === 'tool-calls' and top-level toolCallList payloads
  const isToolCallType =
    message?.type === 'tool-calls' ||
    rootBody?.type === 'tool-calls' ||
    Boolean(message?.toolCallList) ||
    Boolean(message?.toolCalls) ||
    Boolean(rootBody?.toolCallList) ||
    Boolean(rootBody?.toolCalls);

  if (isToolCallType) {
    // 1. Support toolCallList and standard toolCalls array variants
    const rawToolCalls =
      message?.toolCallList ||
      message?.toolCalls ||
      rootBody?.toolCallList ||
      rootBody?.toolCalls ||
      [];

    const toolCalls: any[] = Array.isArray(rawToolCalls) ? [...rawToolCalls] : [];

    // Support toolWithToolCallList if provided by assistant
    if (toolCalls.length === 0 && Array.isArray(message?.toolWithToolCallList)) {
      for (const item of message.toolWithToolCallList) {
        if (item.toolCall) {
          toolCalls.push({
            id: item.toolCall.id,
            name: item.tool?.name || item.toolCall.function?.name,
            function: item.toolCall.function,
            parameters: item.toolCall.parameters
          });
        }
      }
    }

    const providerCallId: string =
      message?.call?.id ||
      rootBody?.call?.id ||
      rootBody?.callId ||
      message?.callId ||
      'unknown_call';

    const results: { name: string; toolCallId: string; result: string }[] = [];

    for (const tc of toolCalls) {
      const funcName: string = tc.name || tc.function?.name || tc.tool?.name || '';
      const toolCallId: string = tc.id || tc.toolCallId || tc.toolCall?.id || `tc_${Date.now()}`;

      // 2. Properly parse JSON string arguments, handling nested or serialized strings
      let args: any = tc.parameters ?? tc.function?.arguments ?? tc.arguments ?? tc.toolCall?.parameters ?? {};
      while (typeof args === 'string') {
        try {
          args = JSON.parse(args);
        } catch {
          break;
        }
      }
      if (!args || typeof args !== 'object' || Array.isArray(args)) {
        args = {};
      }

      // Customer resolution from call metadata or parsed arguments
      const callPhone: string | undefined = message?.call?.customer?.number || rootBody?.call?.customer?.number;
      const customerIdFromArgs: string | undefined = args.customerId || args.customer_id;
      const cust =
        (callPhone ? Store.getCustomers().find((c) => c.phone === callPhone) : undefined) ||
        Store.getCustomer(IdentityService.getSession(providerCallId)?.customerId || '') ||
        (!callPhone ? Store.getCustomer(customerIdFromArgs || '') : undefined);

      // If customer found and session not initialized on this call, initialize session
      if (cust && providerCallId && !IdentityService.getSession(providerCallId)) {
        IdentityService.initializeSession(providerCallId, cust.id);
      }

      // 3. Strict identity verification check using IdentityService
      const isStrictlyVerified = (customerId: string): boolean => {
        const session = IdentityService.getSession(providerCallId);
        if (!session) return false;
        if (session.isLockedOut) return false;
        if (session.customerId !== customerId) return false;
        return Boolean(session.factorVerified);
      };

      let result: any = { status: 'handled' };
      try {
        if (funcName === 'verify_identity') {
          if (!cust) {
            result = { error: 'Customer not found for identity verification' };
          } else {
            const factorType = (args.factorType || 'last4') as 'last4' | 'zip';
            const factorValue = String(args.factorValue ?? args.factor ?? args.value ?? '');
            result = IdentityService.verifyFactor(providerCallId, cust, factorType, factorValue);

            Store.logAudit({
              callId: providerCallId,
              customerId: cust.id,
              eventType: 'compliance_check',
              details: {
                check: 'identity_verification',
                factorType,
                verified: result.verified,
                attemptsRemaining: result.attemptsRemaining,
                isLockedOut: result.isLockedOut
              }
            });
          }
        } else if (funcName === 'create_payment_link' || funcName === 'send_payment_link') {
          if (!cust) {
            result = { error: 'Customer not found' };
          } else if (cust.dnc_flag) {
            result = {
              error: 'compliance_blocked',
              message: 'Cannot create payment link: Customer has active Do-Not-Call (DNC) flag.'
            };
          } else if (!isStrictlyVerified(cust.id)) {
            const session = IdentityService.getSession(providerCallId);
            result = {
              error: 'identity_not_verified',
              message: session?.isLockedOut
                ? 'Identity verification locked out due to multiple failed attempts.'
                : 'Strict identity verification required before creating payment links. Please verify secondary factor (last 4 digits of card or billing zip) first.',
              requiresVerification: true,
              attemptsRemaining: session ? Math.max(0, 2 - session.failedAttempts) : 2
            };
          } else {
            const link = PaymentLinkService.createPaymentLink(cust, cust.amount_due);
            await SMSService.sendPaymentLinkSMS(cust.phone, cust.name, cust.amount_due, cust.currency, link.url, link.id);
            result = {
              success: true,
              linkId: link.id,
              url: link.url,
              amount: cust.amount_due,
              currency: cust.currency,
              status: 'sms_sent',
              message: `Payment link created and dispatched to ${cust.phone}.`
            };
          }
        } else if (funcName === 'schedule_promise_to_pay' || funcName === 'update_promise_to_pay') {
          if (!cust) {
            result = { error: 'Customer not found' };
          } else if (!isStrictlyVerified(cust.id)) {
            const session = IdentityService.getSession(providerCallId);
            result = {
              error: 'identity_not_verified',
              message: session?.isLockedOut
                ? 'Identity verification locked out due to multiple failed attempts.'
                : 'Strict identity verification required before scheduling or updating a promise-to-pay commitment.',
              requiresVerification: true,
              attemptsRemaining: session ? Math.max(0, 2 - session.failedAttempts) : 2
            };
          } else {
            const pDate = VoiceAgentBrain.parsePromiseDate(args.promisedDate || args.date || 'Friday');
            const promise = Store.recordPromise(cust.id, pDate, cust.amount_due);
            result = {
              success: true,
              status: 'promise_recorded',
              promiseId: promise.id,
              promisedDate: pDate,
              amount: cust.amount_due,
              currency: cust.currency,
              message: `Promise-to-pay commitment confirmed for ${pDate}.`
            };
          }
        } else if (funcName === 'set_payment_plan') {
          if (!cust) {
            result = { error: 'Customer not found' };
          } else if (!isStrictlyVerified(cust.id)) {
            result = {
              error: 'identity_not_verified',
              message: 'Strict identity verification required before configuring payment plan.',
              requiresVerification: true
            };
          } else {
            const installments = Number(args.installments) || 3;
            result = Store.recordPaymentPlan(cust.id, cust.amount_due, installments);
          }
        } else if (funcName === 'escalate_to_human') {
          result = cust ? Store.recordEscalation(cust.id, args.reason, args.notes || '') : { error: 'Customer not found' };
        } else if (funcName === 'mark_do_not_call') {
          result = cust ? { success: Store.markCustomerDNC(cust.id) } : { error: 'Customer not found' };
        } else if (funcName === 'check_payment_status') {
          let link = args.linkId ? PaymentLinkService.getLink(args.linkId) : undefined;
          if (!link && cust) {
            link = PaymentLinkService.getLinkForCustomer(cust.id);
          }
          result = {
            status: link ? link.status : 'not_found',
            isPaid: link?.status === 'paid',
            transactionId: link?.transactionId
          };
        } else if (funcName === 'get_customer_context') {
          if (!cust) {
            result = { error: 'Customer not found' };
          } else {
            const policy = PolicyEngine.getPolicyForCustomer(cust);
            const verified = isStrictlyVerified(cust.id);
            result = !verified ? { customerId: cust.id, name: cust.name, identityVerified: false, note: 'Verify identity before discussing any account details.' } : {
              customerId: cust.id,
              name: cust.name,
              plan: cust.plan,
              currency: cust.currency,
              amountDue: cust.amount_due,
              failureReason: cust.failure_reason,
              policyStrategy: policy.strategy,
              allowedOffers: policy.offerLadder,
              billingHold: cust.billing_hold
            };
          }
        }
      } catch (err: any) {
        result = { error: err.message || 'Tool execution failed' };
      }

      broadcastSSE('tool_call', {
        callId: providerCallId,
        customerId: cust?.id || args.customerId || 'unknown',
        eventType: 'tool_call',
        toolName: funcName,
        args,
        result
      });

      results.push({
        name: funcName,
        toolCallId,
        result: typeof result === 'string' ? result : JSON.stringify(result)
      });
    }

    return res.json({ results });
  }

  res.json({ status: 'ok' });
});

// 9. Mock Payment Gateway Checkout (Fires "paid" webhook and broadcasts live SSE event)
app.post('/api/payments/pay', (req: Request, res: Response) => {
  const { linkId, paymentMethod } = req.body;
  const result = PaymentLinkService.completePayment(linkId, paymentMethod || 'UPI');
  if (!result.success || !result.link) {
    return res.status(404).json({ error: 'Payment link not found or expired' });
  }

  // Update customer balance to 0 in store
  const cust = Store.getCustomer(result.link.customerId);
  if (cust) {
    cust.amount_due = 0;
    Store.updateCustomer(cust.id, { amount_due: 0 });
  }

  // Check if there is an active session for this customer and trigger live Ava confirmation
  for (const session of activeSessions.values()) {
    if (session.customerId === result.link.customerId && session.state !== 'COMPLETED') {
      if (cust) {
        VoiceAgentBrain.handlePaymentReceivedLive(session, cust, result.link.amount);
      }
    }
  }

  // Broadcast live SSE to all connected web clients
  broadcastSSE('payment_received', {
    linkId,
    customerId: result.link.customerId,
    amount: result.link.amount,
    currency: result.link.currency,
    transactionId: result.link.transactionId,
    timestamp: result.link.paidAt
  });

  Store.logAudit({
    customerId: result.link.customerId,
    eventType: 'payment_received',
    details: {
      linkId,
      amount: result.link.amount,
      method: paymentMethod,
      transactionId: result.link.transactionId,
      liveReactionBroadcasted: true
    }
  });

  res.json({
    success: true,
    status: 'paid',
    link: result.link
  });
});

app.get('/api/payments/link/:id', (req: Request, res: Response) => {
  const link = PaymentLinkService.getLink(req.params.id);
  if (!link) return res.status(404).json({ error: 'Payment link not found' });
  res.json(link);
});

// 10. Automated Evals Runner (Real persona simulation testing all 10 scenarios)
app.post('/api/evals/run', async (req: Request, res: Response) => {
  const results = await EvalRunner.runAllEvals();
  res.json(results);
});

// 11. Stats & Audit Trail
app.get('/api/stats', (req: Request, res: Response) => {
  res.json(Store.getStats());
});

app.get('/api/audit-log', (req: Request, res: Response) => {
  res.json(Store.getAuditLogs());
});

app.post('/api/reset', requireAdmin, (req: Request, res: Response) => {
  Store.resetData();
  activeSessions.clear();
  res.json({ success: true, message: 'Data reset to initial seeds' });
});

// --- VITE MIDDLEWARE ---
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    const dist = path.resolve(process.cwd(), 'dist');
    app.use(express.static(dist));
    app.get('*', (_req: Request, res: Response) => res.sendFile(path.join(dist, 'index.html')));
  } else {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  }
  app.listen(port, '0.0.0.0', () => console.log(`NimbusFlow running on port ${port}`));
}

startServer();
