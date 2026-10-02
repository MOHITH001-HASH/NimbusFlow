# NimbusFlow - Autonomous AutoPay Voice Recovery Agent (Ava)

An autonomous, empathetic, and regulatory-compliant outbound AI voice agent designed to recover failed recurring subscription payments. Built for the fictional cloud infrastructure platform **NimbusFlow**.

---

## 🎬 End-to-End Demonstration & Repository

- **Repository**: [https://github.com/paladugusankarnaidu082/nimbusflow-autopay-agent](https://github.com/paladugusankarnaidu082/nimbusflow-autopay-agent)
- **Live Interactive Demo**: Run `npm run demo` in terminal or test directly in the browser at `http://localhost:3000`.
  *(Walkthrough covers: Customers tab -> Real Vapi telephony / simulated audio call with live 2FA verification -> Secure SMS payment link -> Hosted payment completion -> Real-time SSE voice confirmation -> Executive Dashboard & Audit Log)*
- **Demo Recording Guide**: Follow Section 3 below to connect live Vapi telephony with your verified mobile number and record the live call walkthrough.

---

## 1. What It Does

NimbusFlow's autopay agent (**Ava**) proactively dials customers whose recurring subscription payments failed (due to expired cards, temporary insufficient funds, bank fraud triggers, or billing issues). 

- **First-Sentence AI Disclosure**: Mandatory greeting informing the customer that the call is from an automated assistant on a recorded line.
- **Two-Factor Identity Verification**: Confirms caller name and verifies a secondary factor (last 4 card digits or billing ZIP code) before disclosing balance or delinquency reason.
- **Code-Enforced Policy Engine**: Recommends appropriate recovery actions (e.g., immediate SMS payment link, promise-to-pay schedule, or 3-month split relief plan) based strictly on failure reasons, eliminating hallucinated discounts.
- **Out-of-Band Payment Resolution**: Ava never collects credit card numbers over voice. Instead, she sends an encrypted, hosted checkout link via SMS.
- **Live In-Call Payment Sync**: When a customer completes checkout on the hosted portal, real-time Server-Sent Events (SSE) notify Ava on the ongoing call to confirm payment instantly.
- **Hard Guardrails & Immediate Escalation**: Honors Do-Not-Call (DNC) requests instantly, respects 09:00–20:00 local TCPA calling windows, and smoothly escalates billing disputes or hostile callers to human specialists.

---

## 2. Quick Start

### Prerequisites
- Node.js 18+ (or 20+)
- npm 9+

### Installation & Launch
```bash
# 1. Install dependencies
npm ci

# 2. Configure environment
cp .env.example .env

# 3. Start the application (Node/Express backend + Vite React frontend on Port 3000)
npm run dev
```

Open `http://localhost:3000` in your browser. 
Sign in using the default operator credentials:
- **Username**: `ops`
- **Password**: Configured in `.env` (default local dev: `test`)
- Or click the **⚡ 1-Click Direct Sign In** button on the sign-in screen.

---

## 3. Real-Call Setup (Vapi Telephony + Ngrok)

To run live outbound phone calls to your own phone:

1. **Sign up for Vapi**: Create an account at [dashboard.vapi.ai](https://dashboard.vapi.ai).
2. **Configure a Phone Number**: Connect your Twilio number or purchase a number directly inside the Vapi dashboard.
3. **Expose Local Server via Ngrok**:
   ```bash
   ngrok http 3000
   ```
   Copy the HTTPS forwarding address (e.g., `https://xxxx-xx-xx.ngrok-free.app`).
4. **Update `.env`**:
   ```env
   APP_URL="https://xxxx-xx-xx.ngrok-free.app"
   VAPI_API_KEY="your-vapi-api-key"
   VAPI_PHONE_NUMBER_ID="your-vapi-phone-number-id"
   VAPI_LLM_MODEL="gpt-4o-mini"
   SHARED_TOOL_SECRET="your-32-char-random-secret"
   TEST_PHONE_NUMBERS="+15550100001,+91XXXXXXXXXX"
   ```
5. **Initiate Real Call**:
   - In the Operator Console, select a customer whose phone number matches your consented number in `TEST_PHONE_NUMBERS`.
   - Click **Dial Customer (Vapi Live Call)**.
   - Answer your phone, interact with Ava, verify identity with the customer's last 4 card digits, receive the SMS payment link, and observe the live dashboard sync!

---

## 4. The 10 Fictional Customer Personas

The system includes 10 pre-seeded fictional customers representing standard dunning scenarios:

| # | Customer | Scenario | Balance & Plan | Secondary Factor | Expected Resolution |
|---|---|---|---|---|---|
| **1** | Rajesh Sharma (`cust_001`) | Expired Card (Cooperative) | ₹2,499 (Growth Cloud) | Last 4: `4242` | Verifies identity -> Receives SMS -> Pays live -> Ava confirms aloud. |
| **2** | Priya Patel (`cust_002`) | Card Expiring Soon | ₹4,999 (Pro Annual) | Last 4: `1122` | Verifies identity -> Receives payment update link. |
| **3** | Amit Kumar (`cust_003`) | Insufficient Funds | ₹3,500 (Enterprise) | Last 4: `5566` | Agrees to Promise-to-Pay for Friday after salary. |
| **4** | Sunita Rao (`cust_004`) | Disputed Charge | ₹1,899 (Creative Suite) | Last 4: `7788` | Disputes unexpected invoice -> Immediate human specialist escalation. |
| **5** | Vikram Singh (`cust_005`) | Wrong Person Answers | ₹6,200 (Fleet Pro) | N/A | Wrong person answers -> Ava aborts without disclosing debt or PII. |
| **6** | Ananya Desai (`cust_006`) | Financial Hardship | ₹8,500 (Professional) | Last 4: `3344` | Hardship detected -> Offered 3-month split installment plan (₹2,833/mo). |
| **7** | Rahul Verma (`cust_007`) | Angry / Hostile Caller | ₹3,200 (Starter Team) | Last 4: `9900` | Hostile reaction -> Calm de-escalation -> Immediate supervisor transfer. |
| **8** | Kavita Nair (`cust_008`) | Hindi Speaker | ₹1,599 (Retail POS) | Last 4: `6677` | Ava speaks polite Hindi -> Verifies -> Dispatches UPI checkout link. |
| **9** | Deepak Joshi (`cust_009`) | Do-Not-Call (DNC) Request | ₹2,100 (Legal Suite) | N/A | Asks to stop calling -> DNC flag set immediately, call terminates. |
| **10** | Sneha Gupta (`cust_010`) | Failed Verification | ₹12,500 (Enterprise) | Wrong Factor | Fails last-4 twice -> Session locks out, call ends with zero disclosure. |

---

## 5. Adding & Managing Customers

1. Navigate to the **Customers** screen in the operator console.
2. Click **Add Customer** in the top action bar.
3. Provide the customer name, phone (E.164 format, e.g. `+15550100001`), email, subscription plan, amount due, and verification factors (card last 4 and postal code).
4. Newly added customers are immediately eligible for calling campaigns, compliance evaluation, and automated recovery.

---

## 6. Running Tests & Automated Evals

All tests and automated evaluations are written in TypeScript and run directly via Node.js:

```bash
# Run unit & integration tests (Node native test runner)
npm test

# Run 10-persona automated recovery evaluation suite
npm run eval

# Run an interactive end-to-end demo walkthrough
npm run demo
```

The evaluation suite validates:
- 100% adherence to AI identity disclosure in sentence 1
- 100% pre-verification zero-disclosure barrier
- DNC request immediate compliance
- Zero data leakage on wrong-person calls
- Offer ladder compliance per customer failure reason

---

## 7. Safety Design & Guardrails

1. **Pre-Call Compliance Gate**:
   - Calling hours locked to **09:00 to 20:00** in the customer's local timezone (TCPA & TRAI compliance).
   - Instant block if customer has active Do-Not-Call (DNC) status.
   - Max 3 call attempts per week cap to prevent harassment.
   - Explicit consent check required prior to dialing.
2. **Identity Verification Gate**:
   - Requires full name confirmation + secondary factor matching.
   - Hard lockout after 2 incorrect attempts.
   - Zero disclosure of balance, plan, or invoice details before verification.
3. **PCI-DSS Out-of-Band Voice Isolation**:
   - Voice agent explicitly refuses to take card numbers, CVVs, or bank details over the phone.
   - Payment links are cryptographically signed, single-use, and dispatched strictly via SMS.
4. **Whitelisted Dialing**:
   - Outbound telephony checks against `TEST_PHONE_NUMBERS` to prevent accidental calls to real third parties during development.
5. **Console & API Security Architecture**:
   - The static React SPA bundle is served openly so the client Login screen can render, but all `/api/*` data and action endpoints strictly require session credentials.
   - Dynamic 32-byte cryptographically random session tokens with an 8-hour expiration TTL are issued via `POST /api/auth/login`.
   - Cookies are configured with `HttpOnly; SameSite=Strict; Path=/`.
   - Brute-force rate limiting enforces lockouts after 5 failed attempts per client IP.
   - Customer editing enforces an allow-list, prevents ID tampering, and prevents duplicate phone numbers.

---

## 8. What the Agent Can and Cannot Do

### What Ava CAN Do:
- Accurately state AI disclosure and identify herself as an automated agent on a recorded line.
- Verify customer identity through secondary factor challenge (card last 4 or ZIP).
- Explain the reason for autopay failure in polite, clear language.
- Generate and dispatch secure SMS payment links for immediate resolution.
- Record firm Promise-to-Pay (PTP) commitments for future dates.
- Offer code-controlled 3-installment hardship relief plans where eligible.
- Detect live payment completion while on call and thank the customer.
- De-escalate customer frustration and transfer to live agents.
- Immediately honor DNC requests and update the regulatory registry.

### What Ava CANNOT Do:
- Take or process credit card numbers, CVVs, or OTPs by voice.
- Offer arbitrary, unapproved discounts or negotiate debt amounts outside the policy ladder.
- Disclose debt amounts to third parties, family members, or wrong numbers.
- Make outbound calls outside permissible 09:00–20:00 customer timezone windows.
- Continue calling an account marked Do-Not-Call or currently under formal billing hold.

---

## 9. Assumptions and Limitations

- **Mock Payment Gateway**: The embedded payment portal simulates a real banking gateway (Razorpay / Stripe / UPI). It processes simulated payments and triggers instant webhooks into the active call session without debiting actual bank accounts.
- **Simulation vs. Real Calls**: The in-browser audio simulator uses deterministic, rule-based turn handling for reliable local testing and automated evaluations, whereas live phone calls via Vapi use an LLM (`gpt-4o-mini` or configured model) orchestrated with the backend tool webhooks.
- **Database Storage**: The local database persists to `autopay_db.json` via an atomic in-memory transactional store for zero-dependency portability. In a production enterprise deployment, this is replaced by Cloud SQL (PostgreSQL).
- **Indian SMS Delivery (DLT)**: Real SMS delivery to Indian mobile numbers (+91) via Twilio requires TRAI DLT registration and template whitelisting. If real SMS is not delivered due to carrier DLT filtering, the payment link is simultaneously displayed in the simulated customer smartphone screen in the dashboard.
