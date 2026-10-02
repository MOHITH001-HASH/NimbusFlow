# Compliance & Regulatory Standards

NimbusFlow Autopay Voice Recovery Agent complies with debt recovery regulations including:
- **US FCC & FTC Telephone Consumer Protection Act (TCPA)**
- **CFPB Regulation F (12 CFR Part 1006 - Debt Collection Rule)**
- **Telecom Regulatory Authority of India (TRAI UCC Regulations)**

## Non-Negotiable Compliance Gates

1. **Mandatory AI Disclosure**:
   In the very first sentence, Ava announces:
   *"Hello [Name], this is Ava, an automated assistant calling on behalf of NimbusFlow on a recorded line."*
   Failing to disclose AI identity is blocked at the prompt and guardrail level.

2. **Strict Pre-Verification Privacy**:
   No details regarding overdue amount, invoice ID, or autopay failure may be spoken until two identity factors are confirmed (Full Name + Card Last 4 or ZIP).
   Third-party answerers (spouses, colleagues, wrong numbers) receive 0 disclosures.

3. **No Voice Card Number Collection (PCI-DSS)**:
   Ava will NEVER ask for or record 16-digit PANs, CVVs, or OTPs. All payment collections are routed through SMS links to an encrypted hosted payment page.

4. **Timezone Calling Windows**:
   Dialing restricted to 09:00 - 20:00 in customer's local timezone.

5. **Immediate Do-Not-Call (DNC) Honoring**:
   Any opt-out phrasing ("stop calling", "remove my number", "don't call again") immediately flags the record as DNC in the master database and terminates the call gracefully.

6. **Harassment & False Urgency Prevention**:
   Strict prohibition against legal threats, arrest claims, or false repossession timelines.
