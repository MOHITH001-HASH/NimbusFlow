# NimbusFlow Voice Agent Runbook & Incident Operations

## 1. Quick Start & Service Execution

1. **Install dependencies**:
   ```bash
   npm ci
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your specific VAPI, Twilio, and Secret credentials
   ```

3. **Start Development Server**:
   ```bash
   npm run dev
   ```

4. **Execute Tests & Automated Evaluation**:
   ```bash
   npm test
   npm run eval
   ```

---

## 2. Telephony & Webhook Health Checks

- **Health Endpoint**: `GET /healthz` returns `{"ok":true}`.
- **Vapi Assistant Configuration**: `GET /api/vapi/assistant-config?customerId=cust_001`.
- **Tool Authentication**: All tool endpoints require `x-tool-secret`, `x-vapi-secret`, or `Authorization: Bearer <SHARED_TOOL_SECRET>`.

---

## 3. Incident Scenarios & Standard Operating Procedures

| Incident | Automated Mitigation | Operator Action |
|---|---|---|
| **Customer reports Wrong Number** | Ava immediately apologizes, stops outreach, discloses zero PII, and flags record as `wrong_person`. | Update CRM contact information. |
| **Verification Fails Twice** | Session locks out. Call terminates immediately without disclosing debt or invoice details. | Trigger secure email notification to registered address. |
| **Disputed Charge Raised** | Ava stops payment collection and initiates warm transfer to human billing specialist. | Billing team reviews invoice breakdown and dispute notes. |
| **Customer Requests Do-Not-Call (DNC)** | Ava honors request immediately, registers customer in regulatory DNC list, and ends call. | Ensure no further automated campaigns dial this customer. |
| **Customer Expresses Hardship** | Policy engine generates 3-installment split payment schedule (e.g. ₹2,833/mo for ₹8,500). | Finance team confirms installment schedule in accounting system. |
| **Payment Gateway Slow / Webhook Delayed** | Ava offers to record a Promise-to-Pay for today and monitors SSE link. | Run reconciliation check against payment provider webhook logs. |
