# NimbusFlow - Autonomous AutoPay Voice Recovery Agent

An autonomous, empathetic, and regulatory-compliant outbound AI voice agent designed to recover failed recurring SaaS subscription payments. Built for the cloud infrastructure platform **NimbusFlow**.

Repository: https://github.com/MOHITH001-HASH/NimbusFlow

---

## 1. System Overview

NimbusFlow's recovery agent (Ava) dials subscription customers whose recurring payments have failed due to expired cards, temporary insufficient funds, automated bank security flags, or billing discrepancies.

Key architectural properties:
- **First-Sentence AI Disclosure**: Mandatory greeting informing the customer that the call is from an automated assistant on a recorded line.
- **Two-Factor Identity Verification**: Confirms account holder name and requires a secondary factor (last 4 card digits or billing postal code) before disclosing any account balance, plan name, or delinquency details.
- **Code-Enforced Policy Engine**: Recommends appropriate recovery actions (immediate encrypted SMS checkout link, promise-to-pay commitment, or 3-month split relief plan) based strictly on failure reasons, eliminating hallucinated discounts.
- **Out-of-Band Voice Isolation**: The agent never collects credit card numbers, CVVs, or OTPs over voice. Payment is completed securely via cryptographically signed SMS checkout links.
- **Live In-Call Payment Sync**: When a customer completes checkout on the hosted portal, real-time Server-Sent Events (SSE) notify the ongoing call to confirm payment immediately.
- **Regulatory Guardrails**: Strictly honors Do-Not-Call (DNC) requests, respects 09:00–20:00 local customer timezone calling windows, caps attempts at 3 calls per week, and escalates billing disputes to human supervisors.

---

## 2. Architecture and Runtime Options

The codebase is engineered with dual-runtime parity:
1. **Full-Stack Application**: Node.js / Express backend with Vite / React 19 frontend and Server-Sent Events.
2. **Native Python Implementation**: Zero-dependency Python 3.10+ engine located in the `python/` directory with standalone REST/Webhook server, policy engine, CLI eval runner, and test suite.

```
nimbusflow/
├── python/                     # Complete Python 3 standard library implementation
│   ├── app.py                  # Standalone HTTP REST & Vapi Webhook API server
│   ├── models.py               # Dataclass definitions for Customer, Sessions, Policies
│   ├── requirements.txt        # Optional production dependencies
│   ├── services/
│   │   ├── agent_brain.py      # Conversational dialogue state machine & turn processor
│   │   ├── compliance.py       # TCPA/TRAI 09:00-20:00 window, DNC, attempt cap engine
│   │   ├── eval_runner.py      # 10-persona evaluation benchmark harness
│   │   ├── identity.py         # Two-factor identity challenge with 2-attempt lockout
│   │   ├── policy.py           # Deterministic failure reason recovery ladder
│   │   ├── sms.py              # Out-of-band payment link generation & SMS dispatcher
│   │   └── store.py            # Customer ledger and audit trail with 10 initial seeds
│   ├── evals/
│   │   ├── run_demo.py         # Interactive CLI outbound call simulation walkthrough
│   │   └── run_evals.py        # Automated 10-persona evaluation runner
│   └── tests/
│       └── test_autopay.py     # Native Python unittest test suite
├── server.ts                   # Full-Stack Express server with SSE & Vapi webhooks
├── src/                        # React 19 Operator Console & Call Simulator
├── tests/                      # TypeScript Node test suite (24 tests)
└── evals/                      # TypeScript evaluation benchmark runner
```

---

## 3. Quick Start: Python Runtime

The Python implementation runs natively on Python 3.10 or higher with zero third-party package dependencies.

### Run Automated 10-Persona Evals
```bash
python3 python/evals/run_evals.py
```
Validates 100% compliance across all 10 customer scenarios: sentence-1 disclosure, pre-verification data protection, DNC enforcement, and offer ladder matching.

### Run Interactive Outbound Call Simulation
```bash
python3 python/evals/run_demo.py
```
Simulates an outbound call to Rajesh Sharma (`cust_001`), demonstrating mandatory AI disclosure, two-factor identity challenge, out-of-band SMS payment link dispatch, and live payment confirmation.

### Run Python Unit Tests
```bash
python3 python/tests/test_autopay.py
```

### Start Standalone Python API Server
```bash
python3 python/app.py
```
Starts the REST and Vapi Webhook server on port 8000 (or the port specified by the `PORT` environment variable).

---

## 4. Quick Start: Full-Stack React Console

### Prerequisites
- Node.js 18+ or 20+
- npm 9+

### Installation and Launch
```bash
# 1. Install dependencies
npm ci

# 2. Start unified full-stack server (Node/Express backend + Vite React frontend on Port 3000)
npm run dev
```

Open `http://localhost:3000` in your browser.
Operator sign-in credentials:
- **Username**: `ops`
- **Password**: `test` (or configured via `OPS_PASSWORD` in `.env`)

### Running Full-Stack Test Suites
```bash
# Run unit & integration test suite (24 automated tests)
npm test

# Run TypeScript automated persona evaluations
npm run eval
```

---

## 5. Fictional Customer Persona Matrix

The system includes 10 pre-seeded accounts representing real-world recurring billing failure scenarios:

| ID | Customer | Scenario | Balance & Plan | Secondary Factor | Expected Resolution |
|---|---|---|---|---|---|
| `cust_001` | Rajesh Sharma | Expired Card (Cooperative) | INR 2,499 (Growth Cloud) | Last 4: `4242` | Verifies identity -> Receives SMS -> Pays live -> Ava confirms aloud. |
| `cust_002` | Priya Patel | Insufficient Funds | INR 4,999 (Pro Annual) | Last 4: `1122` | Verifies identity -> Agrees to Promise-to-Pay for Friday salary date. |
| `cust_003` | Amit Kumar | Bank Security Trigger | INR 12,500 (Enterprise) | Last 4: `5566` | Bank security hold -> Rescheduled for Friday reattempt. |
| `cust_004` | Sunita Rao | Disputed Charge | INR 1,899 (Creative Suite) | Last 4: `7788` | Disputed bandwidth fees -> Immediate transfer to human supervisor. |
| `cust_005` | Vikram Singh | Wrong Person Answers | INR 6,200 (Fleet Pro) | None | Wrong number answered -> Call concludes with zero balance disclosure. |
| `cust_006` | Ananya Desai | Financial Hardship | INR 8,500 (Professional) | Last 4: `3344` | Hardship detected -> 3-month split installment plan (INR 2,833/mo). |
| `cust_007` | Rahul Verma | Angry Customer | INR 3,200 (Starter Team) | Last 4: `2233` | Hostile reaction -> De-escalation -> Immediate supervisor transfer. |
| `cust_008` | Sunita Gupta | Hindi Speaker | INR 1,599 (Retail POS) | Last 4: `6677` | Conducted in polite Hindi -> Verifies -> Dispatches checkout link. |
| `cust_009` | Deepak Joshi | Do-Not-Call (DNC) Request | INR 2,100 (Legal Suite) | None | Asks to stop calling -> DNC flag set immediately, call terminates. |
| `cust_010` | Siddharth Rao | VIP Closed Account | INR 25,000 (Enterprise) | Last 4: `9988` | Contract renegotiation -> Escalated to senior account director. |

---

## 6. Safety, Compliance, and Security Architecture

1. **Pre-Dial Compliance Gate**:
   - Calling hours locked to 09:00 to 20:00 in the customer's local timezone (TCPA and TRAI regulations).
   - Immediate block if customer is marked Do-Not-Call (DNC) or if affirmative dialing consent is not present.
   - Frequency cap: Maximum 3 attempts per week.
2. **Identity Verification Gate**:
   - Mandatory two-factor identity challenge (last 4 card digits or billing postal code).
   - Hard lockout after 2 consecutive failed verification attempts.
   - Zero disclosure of balance, plan details, or delinquency reason prior to successful verification.
3. **PCI-DSS Voice Isolation**:
   - Voice agent explicitly refuses to accept card numbers, CVVs, or bank credentials over the telephone.
   - Single-use, cryptographically signed payment links are dispatched strictly out-of-band via SMS.
4. **Session Security & API Protection**:
   - Operator sessions are governed by 32-byte cryptographically random tokens stored in an in-memory map with an 8-hour expiration TTL.
   - Cookies are configured with `HttpOnly; SameSite=Strict; Path=/`.
   - Rate limiting protects authentication routes against brute-force attacks.
   - Customer editing enforces a strict field allow-list, ignores client-supplied IDs, and blocks duplicate phone numbers.

---

## 7. Operational Assumptions and Limitations

- **Simulated Payment Gateway**: The embedded checkout portal emulates real gateway behavior (UPI, Card, NetBanking). Completing checkout triggers live webhook events without processing actual financial transactions.
- **Indian SMS Delivery (DLT)**: Real SMS delivery to Indian mobile numbers (+91) via Twilio requires TRAI Distributed Ledger Technology (DLT) entity registration and template pre-approval. If real SMS is not delivered due to carrier DLT filtering, the checkout link is simultaneously mirrored in the operator console.
- **Storage**: State is maintained in memory and persisted atomically to JSON storage (`autopay_db.json`) for environment portability. In enterprise production, this maps directly to PostgreSQL / Cloud SQL.

---

## 8. License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
