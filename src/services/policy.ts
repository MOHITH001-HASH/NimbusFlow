import { Customer } from '../types';

export interface PolicyRule {
  strategy: string;
  tone: string;
  offerLadder: string[];
  maxDiscountsAllowed: number; // 0 for strict prevention of hallucinated discounts
  requiresHumanHandoff: boolean;
  canOfferPromiseToPay: boolean;
  canOfferPaymentPlan: boolean;
  initialExplanation: string;
  hindiExplanation: string;
}

export class PolicyEngine {
  public static getPolicyForCustomer(customer: Customer): PolicyRule {
    // Repeated failures (3+) or Hardship flagged trigger special careful human-first handling
    if (customer.hardship_flag) {
      return {
        strategy: 'Empathy-first Financial Relief',
        tone: 'Deeply empathetic, supportive, zero pressure',
        offerLadder: ['14-day payment grace pause', '3-month split installment plan', 'Warm transfer to Financial Care specialist'],
        maxDiscountsAllowed: 0,
        requiresHumanHandoff: false, // can offer plan first, then human if customer wants
        canOfferPromiseToPay: true,
        canOfferPaymentPlan: true,
        initialExplanation: "I understand things can be challenging. We want to support you with flexible options like splitting your balance or pausing for 14 days without any interruption to your service.",
        hindiExplanation: "हम आपकी परिस्थिति को पूरी तरह समझते हैं। हम आपके बिल को 3 आसान किस्तों में बांट सकते हैं या आपको 14 दिनों की राहत दे सकते हैं।"
      };
    }

    if ((customer.payment_failures_count ?? 0) >= 3) {
      return {
        strategy: 'Careful Escalation & Review',
        tone: 'Respectful, no pressure, supportive',
        offerLadder: ['Warm transfer to Senior Account Manager', 'Self-service direct portal link', 'Dedicated corporate invoice review'],
        maxDiscountsAllowed: 0,
        requiresHumanHandoff: true,
        canOfferPromiseToPay: false,
        canOfferPaymentPlan: true,
        initialExplanation: "Because your account has encountered a few consecutive payment attempts, I want to ensure you get dedicated support without any further automated notices.",
        hindiExplanation: "क्योंकि आपके खाते में कुछ प्रयास विफल रहे हैं, मैं आपको हमारे वरिष्ठ प्रतिनिधि से जोड़ देती हूँ ताकि इसका तुरंत समाधान हो सके।"
      };
    }

    switch (customer.failure_code) {
      case 'card_expired':
        return {
          strategy: 'Fast Frictionless Fix',
          tone: 'Friendly, swift, efficient',
          offerLadder: ['SMS payment link to update card & pay', 'Self-service billing portal link', 'Human billing agent'],
          maxDiscountsAllowed: 0,
          requiresHumanHandoff: false,
          canOfferPromiseToPay: false,
          canOfferPaymentPlan: false,
          initialExplanation: "It looks like the payment card ending in " + customer.last4 + " expired at the end of last month, which stopped the automatic renewal.",
          hindiExplanation: "ऐसा लगता है कि आपके खाते से जुड़ा कार्ड हाल ही में समाप्त (expire) हो गया है, जिस कारण ऑटोपे पूरा नहीं हो सका।"
        };

      case 'insufficient_funds':
        return {
          strategy: 'Soft & Flexible Scheduling',
          tone: 'Understanding, collaborative, courteous',
          offerLadder: ['Scheduled Promise-to-Pay date (within 7 days)', 'Split payment into 2 parts', 'Custom payment plan'],
          maxDiscountsAllowed: 0,
          requiresHumanHandoff: false,
          canOfferPromiseToPay: true,
          canOfferPaymentPlan: true,
          initialExplanation: "Your recent autopay was declined due to temporary fund availability. We can easily schedule an automated retry on a day that works best for you.",
          hindiExplanation: "अकाउंट में पर्याप्त राशि न होने के कारण यह ट्रांजेक्शन पूरा नहीं हुआ। हम आपकी पसंद की तारीख पर दोबारा प्रयास शेड्यूल कर सकते हैं।"
        };

      case 'fraud_security_block':
        return {
          strategy: 'Bank Security Guidance & Reassurance',
          tone: 'Reassuring, clear, reassuring security',
          offerLadder: ['Guide customer to approve bank SMS/notification', 'Schedule 24-hour retry', 'SMS instant payment link'],
          maxDiscountsAllowed: 0,
          requiresHumanHandoff: false,
          canOfferPromiseToPay: true,
          canOfferPaymentPlan: false,
          initialExplanation: "Your bank's automated fraud safety filter flagged this recurring charge. There is no issue on your account—banks frequently require quick customer confirmation via their mobile app or SMS.",
          hindiExplanation: "यह आपके बैंक के सुरक्षा फ़िल्टर के कारण रोका गया था। आप बैंक के SMS या ऐप से अनुमति दे सकते हैं, और हम 24 घंटे में दोबारा पेमेंट प्रोसेस कर लेंगे।"
        };

      case 'account_closed':
        return {
          strategy: 'Replace Payment Method',
          tone: 'Professional, structured, VIP assistance',
          offerLadder: ['Encrypted link to add new bank/corporate card', 'Corporate invoicing / Net-30 request', 'Senior account manager handoff'],
          maxDiscountsAllowed: 0,
          requiresHumanHandoff: false,
          canOfferPromiseToPay: true,
          canOfferPaymentPlan: true,
          initialExplanation: "The banking institution notified us that the previous account was closed. We just need to register your updated business or personal payment method.",
          hindiExplanation: "बैंक से सूचना मिली है कि पुराना खाता बंद हो चुका है। हम बस एक नए तरीके से पेमेंट सेटअप कर सकते हैं।"
        };

      case 'mandate_expired':
        return {
          strategy: 'UPI / e-Mandate Re-authorization',
          tone: 'Helpful, concise, guided',
          offerLadder: ['Instant UPI e-mandate renewal link via SMS', 'Alternative debit card setup', 'Live specialist guidance'],
          maxDiscountsAllowed: 0,
          requiresHumanHandoff: false,
          canOfferPromiseToPay: false,
          canOfferPaymentPlan: false,
          initialExplanation: "Your recurring UPI e-mandate reached its periodic renewal date under central banking guidelines. A simple one-tap authorization will renew it.",
          hindiExplanation: "आपका UPI ई-मैनडेट रिन्यूअल के लिए लंबित है। मैंने एक लिंक भेजा है जिससे आप 1 मिनट में इसे री-ऑथराइज कर सकते हैं।"
        };

      case 'customer_dispute':
        return {
          strategy: 'No-Pressure Dispute Escalation',
          tone: 'Objective, calm, strictly non-confrontational',
          offerLadder: ['Place automated dunning on immediate 7-day hold', 'Warm handoff to Billing Resolution Specialist', 'Ticket confirmation via email'],
          maxDiscountsAllowed: 0,
          requiresHumanHandoff: true,
          canOfferPromiseToPay: false,
          canOfferPaymentPlan: false,
          initialExplanation: "I understand you have questions or dispute regarding the charges. I will immediately pause any collections retries and connect you to our billing team to review your account history.",
          hindiExplanation: "मैं समझ सकती हूँ कि आपको इस बिल पर आपत्ति है। हम तुरंत किसी भी ऑटोपे को रोक रहे हैं और आपके बिल की जांच के लिए टीम को ट्रांसफर कर रहे हैं।"
        };

      default:
        return {
          strategy: 'Standard Polite Recovery',
          tone: 'Courteous, helpful, professional',
          offerLadder: ['Instant SMS payment link', 'Schedule retry date', 'Human agent transfer'],
          maxDiscountsAllowed: 0,
          requiresHumanHandoff: false,
          canOfferPromiseToPay: true,
          canOfferPaymentPlan: false,
          initialExplanation: "We encountered a temporary processing issue on your latest renewal.",
          hindiExplanation: "आपके हालिया बिल के प्रोसेसिंग में एक समस्या आई थी जिसे हम अभी ठीक कर सकते हैं।"
        };
    }
  }

  /**
   * Validate that an offer proposed by Ava is permitted under the policy table.
   * Prohibits hallucinated discounts (e.g. "I can give you 50% off").
   */
  public static validateProposedOffer(customer: Customer, offerType: string): { allowed: boolean; reason: string } {
    if (offerType === 'discount' || offerType === 'waiver') {
      return { allowed: false, reason: 'POLICY VIOLATION: AI Voice Agent is strictly prohibited from granting balance discounts.' };
    }

    const policy = this.getPolicyForCustomer(customer);

    if (offerType === 'payment_plan' && !policy.canOfferPaymentPlan) {
      return { allowed: false, reason: 'POLICY VIOLATION: Payment plan not authorized for this failure code without supervisor review.' };
    }

    if (offerType === 'promise_to_pay' && !policy.canOfferPromiseToPay && (customer.payment_failures_count ?? 0) >= 3) {
      return { allowed: false, reason: 'POLICY VIOLATION: Accounts with 3+ failures require direct human review or immediate payment.' };
    }

    return { allowed: true, reason: 'Offer authorized by policy ladder.' };
  }
}
