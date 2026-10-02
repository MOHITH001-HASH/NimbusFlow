export interface GuardrailCheckResult {
  passed: boolean;
  violations: string[];
  sanitizedText?: string;
}

export class GuardrailsService {
  // Prohibited harassment, threat, or legal coercion phrases
  private static prohibitedPhrases = [
    /\b(arrest|jail|police|warrant|lawsuit|legal action|court date|ruin your credit|garnish)\b/i,
    /\b(pay right now or else|immediate repossession|criminal charges)\b/i
  ];

  // Regex detecting attempts to read credit card numbers aloud over voice
  private static cardDigitsRegex = /\b(?:\d[ -]*?){13,16}\b/;

  // Regex detecting CVV / CVC requests
  private static cvvRegex = /\b(cvv|cvc|security code|3 digits on the back)\b/i;

  /**
   * Evaluates outgoing or proposed assistant text against regulatory guardrails
   */
  public static checkAssistantOutput(text: string, isIdentityVerified: boolean, customerAmount?: number): GuardrailCheckResult {
    const violations: string[] = [];

    // 1. Check for harassment/threats
    for (const pattern of this.prohibitedPhrases) {
      if (pattern.test(text)) {
        violations.push(`VIOLATION: Coercive/legal threat language detected: "${text.match(pattern)?.[0]}"`);
      }
    }

    // 2. Check for voice card collection attempts
    if (this.cvvRegex.test(text) || /\b(read me your card|give me the 16 digits)\b/i.test(text)) {
      violations.push('VIOLATION: Attempted to collect credit card / CVV details by voice. All payments must occur via secure SMS payment link.');
    }

    // 3. Pre-verification disclosure guardrail
    if (!isIdentityVerified) {
      if (customerAmount && text.includes(customerAmount.toString())) {
        violations.push('VIOLATION: Sensitive balance disclosed prior to identity verification.');
      }
      if (/\b(failed autopay|delinquent|overdue|collections|decline code|past due)\b/i.test(text)) {
        violations.push('VIOLATION: Account delinquency reason disclosed prior to identity verification.');
      }
    }

    return {
      passed: violations.length === 0,
      violations
    };
  }

  /**
   * Evaluates incoming customer input (e.g. if the customer tries reading a card aloud)
   */
  public static checkCustomerInput(text: string): { containsSensitiveCardData: boolean; sanitizedText: string } {
    const hasCardNumber = this.cardDigitsRegex.test(text);
    if (hasCardNumber) {
      return {
        containsSensitiveCardData: true,
        sanitizedText: text.replace(this.cardDigitsRegex, '[REDACTED_CARD_NUMBER]')
      };
    }
    return {
      containsSensitiveCardData: false,
      sanitizedText: text
    };
  }
}
