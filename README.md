# NimbusFlow: Autonomous AutoPay Voice Recovery Agent

Repository: https://github.com/MOHITH001-HASH/NimbusFlow

## Overview

NimbusFlow is an autonomous, policy-governed outbound voice agent (Ava) engineered to recover delinquent recurring subscription payments for cloud and SaaS infrastructure platforms. The system replaces aggressive debt-collection tactics with compliant, conversational dunning: resolving payment failures through empathetic negotiation, two-factor identity verification, and out-of-band payment link generation.

The codebase provides both a standalone, dependency-free Python 3.10+ implementation and a full-stack Node.js/TypeScript console with real-time Server-Sent Events (SSE).

---

## Key Capabilities

- **Automated Voice Dunning**: Engages subscribers experiencing recurring billing failures (expired cards, insufficient funds, automated bank security holds, or invoice inquiries).
- **Mandatory AI Identification**: Opens every call with an unambiguous disclosure that the caller is an automated artificial intelligence assistant communicating over a recorded line.
- **Two-Factor Identity Gating**: Challenges the subscriber for secondary verification (card last 4 digits or billing postal code) before disclosing account balances or subscription details.
- **Out-of-Band Payment Processing**: Prohibits the collection of credit card numbers, CVVs, or OTPs over voice channels. Payment is completed securely via cryptographically signed SMS checkout links.
- **Real-Time Payment Synchronization**: Monitors payment completion on the hosted portal and immediately alerts the ongoing voice call via Server-Sent Events.
- **Code-Enforced Recovery Ladders**: Applies deterministic negotiation policies (immediate checkout link, scheduled promise-to-pay commitment, or 3-month split installment plan) without hallucinating unauthorized discounts.
- **Autonomous Call Deflection & Escalation**: Instantly processes Do-Not-Call (DNC) requests, detects third-party answers to prevent debt exposure, and routes complex disputes directly to human billing supervisors.

---

## Installation & Quick Start

### Python Backend Implementations (FastAPI / Flask / Native)

The Python backend is available in three production-grade variants with complete functional parity:
1. **Native Python Server (`python/app.py` & `python/main.py`)**: Zero external dependencies (uses Python 3.10 standard library `http.server`, `dataclasses`, `hmac`).
2. **FastAPI Engine (`python/app_fastapi.py`)**: Built with Pydantic v2 schemas, asynchronous streaming for SSE, dependency-injected auth, and OpenAPI `/docs`.
3. **Flask Engine (`python/app_flask.py`)**: Built with standard WSGI routes, request hooks, and cookie-based session management.

```bash
# Option A: Launch the zero-dependency Python Web Console & API server
python3 python/main.py

# Option B: Run with FastAPI (requires fastapi, uvicorn)
uvicorn python.app_fastapi:app --host 0.0.0.0 --port 5000

# Option C: Run with Flask (requires flask)
python3 python/app_flask.py

# Run the 10-persona compliance and policy benchmark
python3 python/evals/run_evals.py

# Execute the interactive terminal-based call simulation
python3 python/evals/run_demo.py

# Run automated unit tests
python3 python/tests/test_autopay.py
```

### Full-Stack Node.js & TypeScript Console

```bash
# 1. Install dependencies
npm ci

# 2. Launch the integrated development server (Express backend + Vite frontend on port 3000)
npm run dev

# 3. Run unit test suite
npm test

# 4. Run TypeScript automated benchmark
npm run eval
```

Operator Console default credentials:
- **Username**: `ops`
- **Password**: `test` (overridable via `OPS_PASSWORD` in `.env`)

---

## Compliance Design

The platform enforces statutory debt-collection regulations (TCPA, FDCPA, and TRAI):

1. **Permissible Calling Hours**: Outbound calls are programmatically restricted to 09:00 to 20:00 in the subscriber's local timezone.
2. **Affirmative Dialing Consent**: Numbers without explicit opt-in consent are blocked from automated outbound dialing queues.
3. **Outreach Frequency Capping**: Subscribed accounts are capped at a maximum of three contact attempts per seven-day period.
4. **Immediate DNC Execution**: When a customer requests removal, the system marks the account with an immutable Do-Not-Call flag, ceases communication immediately, and cancels subsequent scheduled attempts.
5. **Third-Party Data Shielding**: If an unverified third party answers, the agent concludes the call without mentioning debt delinquency, account balances, or service names.

---

## Security & Safety

- **Voice Channel Isolation (PCI-DSS)**: Voice agents never accept or process payment instruments over the telephone. All financial transactions take place on isolated, SSL-encrypted checkout sessions.
- **Authentication Lockout**: Two consecutive failed verification attempts immediately terminate the session and place an administrative lock on automated telephone servicing for that account.
- **Caller ID Spoofing Defense**: Account context resolution is strictly bound to the telephone number initiated by the dialer, preventing attackers from querying unrelated customer records by supplying spoofed IDs.
- **Session Protection**: Operator console endpoints require 32-byte cryptographically random session tokens stored in secure, `HttpOnly`, `SameSite=Strict` cookies. Authentication routes include IP-based rate limiting to prevent brute-force attacks.
- **Immutable Audit Logging**: Every outbound dial, identity verification attempt, SMS dispatch, and call outcome is written with UTC timestamps to an audit ledger.

---

## Limitations

- **Carrier Regulatory Registration (DLT)**: Real-world SMS delivery to Indian mobile numbers (+91) requires pre-registered sender headers and message templates approved on a TRAI-compliant Distributed Ledger Technology portal. In development environments, dispatch links are mirrored directly in the operator console.
- **Payment Processing**: The integrated checkout portal emulates real gateway behavior (UPI, Card, NetBanking) for testing and demonstration purposes. Production deployments require connecting Stripe, Razorpay, or Adyen merchant credentials.
- **Persistence Layer**: Default state is maintained in an atomic, serialized JSON store (`autopay_db.json`). Production configurations should bind the provided models to a managed PostgreSQL or Cloud SQL database.
