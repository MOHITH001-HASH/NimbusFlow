# NimbusFlow

Autonomous Outbound Voice Payment Recovery System

Repository: https://github.com/MOHITH001-HASH/NimbusFlow

## Overview

NimbusFlow is an autonomous, policy-governed outbound voice engine designed for recurring subscription payment recovery in enterprise SaaS and cloud infrastructure environments. The system executes automated customer outreach for delinquent accounts, resolving involuntary billing failures—including expired payment instruments, temporary bank holds, and insufficient balances—via structured voice negotiation, cryptographic two-factor identity verification, and out-of-band transaction processing.

The platform provides dual-runtime backend implementations in Python (FastAPI, Flask, and native standard library) and Node.js/TypeScript, alongside multiple frontend delivery targets including pure HTML5/JavaScript, React (JSX), Next.js, and an integrated real-time operator workstation.

## Key Capabilities

- **Deterministic Dialogue & Policy Ladder**: Replaces unconstrained model outputs with code-enforced recovery stages (immediate checkout link, scheduled promise-to-pay, or 3-month split installment plans) preventing unauthorized concessions.
- **Mandatory First-Sentence AI Disclosure**: Complies with statutory telecommunications regulations by delivering an explicit automated assistant disclosure on a recorded line before requesting subscriber confirmation.
- **Pre-Disclosure Identity Verification**: Enforces a strict two-factor authentication gate (requiring payment instrument last 4 digits or billing postal code) prior to releasing sensitive billing information or account balances.
- **Out-of-Band Payment Processing (PCI-DSS Scope Exclusion)**: Prohibits the collection, transmission, or ingestion of cardholder data over voice channels. Transactions execute via cryptographically signed checkout sessions dispatched by SMS.
- **Real-Time Payment Synchronization**: Monitors payment completion on the external checkout portal and signals active call sessions via Server-Sent Events (SSE) to acknowledge settlement without disconnecting.
- **Regulatory Call Filtering**: Restricts outbound dialing to permissible windows (09:00–20:00 subscriber local time), suppresses numbers lacking affirmative consent, enforces weekly contact limits, and executes immediate Do-Not-Call (DNC) removals.
- **Automated Escalation & Third-Party Protection**: Detects wrong numbers and unverified third parties, concluding calls without disclosing account status. Automatically escalates billing disputes to human supervisors.

## Installation & Quick Start

### Python Backends

The Python service layer operates under Python 3.10+ and is available in three architectures:

```bash
# 1. Native Standard Library (Zero External Dependencies)
python3 python/main.py

# 2. FastAPI Engine (Asynchronous SSE, Pydantic v2 Validation, OpenAPI Docs at /docs)
uvicorn python.app_fastapi:app --host 0.0.0.0 --port 5000

# 3. Flask Engine (WSGI Architecture with Blueprint Routing)
python3 python/app_flask.py

# 4. Compliance & Policy Benchmark Suite (10 Personas)
python3 python/evals/run_evals.py

# 5. Unit Test Suite
python3 python/tests/test_autopay.py
```

### Full-Stack Node.js & Multi-Frontend Environments

```bash
# Install dependencies
npm ci

# Launch integrated development server (Express reverse proxy + Vite frontend on port 3000)
npm run dev

# Run integration test suite
npm test

# Launch standalone Node.js Express server
node server.js

# Launch Next.js application
cd nextjs && npm install && npm run dev
```

### Operator Authentication

The administrative operator console is protected by session-based authentication:
- **Default Username**: `ops`
- **Default Password**: `test` (configurable via `OPS_PASSWORD` environment variable)
- **Session Mechanism**: Cryptographically random 32-byte session tokens delivered via `HttpOnly; SameSite=Strict` cookies with IP brute-force rate limiting.

### Frontend Delivery Channels

- **Standalone HTML5/JavaScript Console**: `/console` or `public/standalone_console.html` (zero build step required).
- **Pure React / JavaScript**: `src/frontend_js/` (modular ES6+ JSX components).
- **Next.js Engine**: `nextjs/` (server-side and client-side rendering with API route integration).
- **Integrated Development Console**: Standard React/Vite interface on port 3000.

## Compliance Design

The outbound telephony subsystem programmatically complies with TCPA, FDCPA, and TRAI regulatory mandates:

1. **Permissible Calling Hours**: Dispatches are validated against recipient timezones, restricting calls strictly to 09:00 through 20:00 local time.
2. **Affirmative Dialing Consent**: Telephony queues filter against verifiable consent records; accounts lacking affirmative consent cannot be queued for automated dialing.
3. **Outreach Frequency Caps**: Contact attempts are bounded by a mandatory limit of no more than three attempts within a rolling 7-day window.
4. **Immediate DNC Execution**: Verbal or electronic opt-out triggers immediate registration in the internal Do-Not-Call registry, terminating active outreach and canceling pending scheduled calls.
5. **Third-Party Data Shielding**: Calls answered by non-account holders terminate immediately following negative identity confirmation, prohibiting disclosure of debt existence or subscription details.

## Security & Safety

- **PCI-DSS Voice Channel Isolation**: Voice models and speech-to-text pipelines are isolated from payment card data. All card collection is handled through hosted checkout links.
- **Authentication Lockout Defense**: Two consecutive failed verification attempts immediately terminate the session and place an administrative lock on automated voice interactions for that account.
- **Anti-Spoofing Context Binding**: Caller account context is derived strictly from verified carrier metadata or dialed destination numbers, rejecting arbitrary customer ID parameters.
- **Timing-Safe Authentication**: Administrative password verification and webhook signature validation employ constant-time cryptographic comparisons (`crypto.timingSafeEqual` / `hmac.compare_digest`).
- **Immutable Regulatory Audit Ledger**: Every call turn, identity verification attempt, SMS dispatch event, and payment transaction is committed to an append-only audit trail with ISO 8601 UTC timestamps.

## Limitations

- **Carrier Regulatory Registration (DLT)**: SMS dispatch to mobile numbers in jurisdictions such as India (+91) requires pre-registered sender headers and message templates approved on a TRAI-compliant Distributed Ledger Technology portal. In development environments, dispatch links are mirrored in the operator console.
- **Payment Gateway Integration**: The built-in payment link system includes a simulated gateway supporting card, UPI, and net banking flows. Production deployments require connecting merchant API credentials (e.g., Stripe, Razorpay, or Adyen).
- **State Persistence**: The local environment utilizes an atomic, serialized JSON data store (`autopay_db.json`). Production multi-region deployments should bind the data access layer to PostgreSQL or Google Cloud SQL.
