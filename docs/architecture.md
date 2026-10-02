# NimbusFlow AutoPay Recovery Voice Agent - Architecture

## 1. System Overview

```
                      ┌──────────────────────────────────────────────┐
                      │    NimbusFlow Recovery Control Dashboard     │
                      │   (Console / Customers / Call Simulator)     │
                      └──────────────────────┬───────────────────────┘
                                             │
      ┌──────────────────────────────┐       │ REST / SSE
      │ Pre-Call Compliance Engine   │       │
      │ • Consent Check (TCPA/TRAI)  │◀──────┤
      │ • DNC Registry Check         │       │
      │ • 09:00 - 20:00 Calling Gate │       ▼
      │ • 3-Attempt Weekly Cap       │   ┌─────────────────────────────┐
      └──────────────────────────────┘   │  Node.js / Express Engine   │
                                         │  • State Machine            │
                                         │  • Vapi Webhooks & Tools    │
                                         └───────────┬─────────────────┘
                                                     │
               ┌─────────────────────────────────────┴─────────────────────────────────────┐
               ▼                                                                           ▼
   ┌───────────────────────┐                                                   ┌─────────────────────────┐
   │ Voice Engine (Ava)    │                                                   │ Mock Payment Gateway    │
   │ • Vapi / Browser STT  │                                                   │ • Hosted Payment Portal │
   │ • Configurable LLM    │                                                   │ • UPI / Card / NetBank  │
   │ • 2-Factor Identity   │                                                   │ • Instant "Paid" Webhook│
   │ • Guardrails Filter   │                                                   └────────────┬────────────┘
   └───────────┬───────────┘                                                                │
               │                                                                            │
               │  SMS Payment Link Sent                                                     │
               ├────────────────────────────────────────────────────────────────────────────┘
               │  Webhook triggers real-time in-call notification:
               │  "I can see that payment of ₹2,499 just went through! Thank you..."
               ▼
   ┌─────────────────────────────────────────────────────────┐
   │ Post-Call Analyzer & Structured Audit Trail             │
   │ • Schema-Validated Outcome JSON (Pydantic / Zod / TS)   │
   │ • Sentiment, Objections, Compliance Flags               │
   │ • Persistent Audit Log Database                         │
   └─────────────────────────────────────────────────────────┘
```

## 2. Core Components

- **Compliance Pre-Call Gate (`src/services/compliance.ts`)**:
  Enforces 09:00–20:00 customer timezone windows, checks DNC status, and validates calling caps before placing a call.

- **Two-Factor Identity Verification (`src/services/identity.ts`)**:
  Ensures customer confirmation + secondary factor (card last-4 or postal code) matches before balance details are disclosed. Locks session after 2 consecutive wrong attempts.

- **Policy Engine (`src/services/policy.ts`)**:
  Generates allowed resolution ladders tailored to specific card failure reasons (expired card, insufficient funds, dispute, hardship). Prevents unapproved balance discounts.

- **Out-of-Band Payment Resolution (`src/services/paymentLink.ts` & `src/services/sms.ts`)**:
  Generates cryptographically signed, short-lived payment links sent via SMS, eliminating card number collection over voice.

- **Real-Time Gateway Synchronization (`server.ts`)**:
  Payment portal triggers instant server events over Server-Sent Events (SSE), enabling the voice agent to react immediately on an active call.

- **Post-Call Analyzer (`src/services/analyzer.ts`)**:
  Evaluates transcripts for compliance flags, customer sentiment, commitments made, and logs records to an immutable audit store.
