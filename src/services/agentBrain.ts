import { Customer, CallSession, CallMessage, CallState, ToolCallLog } from '../types';
import { PolicyEngine } from './policy';
import { IdentityService } from './identity';
import { GuardrailsService } from './guardrails';
import { PaymentLinkService } from './paymentLink';
import { SMSService } from './sms';
import { Store } from './store';
import { GoogleGenAI } from '@google/genai';

export class VoiceAgentBrain {
  private static geminiClient: GoogleGenAI | null = null;

  private static getGemini(): GoogleGenAI | null {
    if (!this.geminiClient && process.env.GEMINI_API_KEY) {
      try {
        this.geminiClient = new GoogleGenAI({});
      } catch (e) {
        console.warn('Could not initialize GoogleGenAI client:', e);
      }
    }
    return this.geminiClient;
  }

  /**
   * Helper to parse natural language promise dates (e.g. "Friday", "tomorrow", "next week", "in 3 days")
   */
  public static parsePromiseDate(text: string): string {
    const lower = text.toLowerCase();
    const now = new Date();

    if (lower.includes('tomorrow') || lower.includes('kal') || lower.includes('कल')) {
      const d = new Date(now.getTime() + 86400000);
      return d.toISOString().split('T')[0];
    }

    const days = [
      { name: 'sunday', hi: 'रविवार', dayIndex: 0 },
      { name: 'monday', hi: 'सोमवार', dayIndex: 1 },
      { name: 'tuesday', hi: 'मंगलवार', dayIndex: 2 },
      { name: 'wednesday', hi: 'बुधवार', dayIndex: 3 },
      { name: 'thursday', hi: 'गुरुवार', dayIndex: 4 },
      { name: 'friday', hi: 'शुक्रवार', dayIndex: 5 },
      { name: 'saturday', hi: 'शनिवार', dayIndex: 6 }
    ];

    for (const d of days) {
      if (lower.includes(d.name) || lower.includes(d.hi)) {
        const currentDay = now.getDay();
        let diff = d.dayIndex - currentDay;
        if (diff <= 0) diff += 7; // Next occurrence
        const target = new Date(now.getTime() + diff * 86400000);
        return target.toISOString().split('T')[0];
      }
    }

    const daysMatch = lower.match(/(\d+)\s*(?:days|din|दिन)/);
    if (daysMatch) {
      const num = parseInt(daysMatch[1], 10);
      const d = new Date(now.getTime() + num * 86400000);
      return d.toISOString().split('T')[0];
    }

    // Default to +3 business days
    const d = new Date(now.getTime() + 3 * 86400000);
    return d.toISOString().split('T')[0];
  }

  /**
   * Generates opening line from Ava when call connects
   */
  public static startCall(customer: Customer, callId: string): { session: CallSession; initialMessage: CallMessage } {
    IdentityService.initializeSession(callId, customer.id);

    // Track call attempts count
    customer.call_attempts_count = (customer.call_attempts_count || 0) + 1;
    Store.updateCustomer(customer.id, { call_attempts_count: customer.call_attempts_count });

    const isHindi = customer.language === 'hi';
    const introText = isHindi
      ? `नमस्ते ${customer.name.split(' ')[0]} जी, मैं Ava बात कर रही हूँ, NimbusFlow की ऑटोमेटेड असिस्टेंट, एक रिकॉर्डेड लाइन पर। क्या मेरी बात ${customer.name} जी से हो रही है?`
      : `Hello ${customer.name.split(' ')[0]}, this is Ava, an automated assistant calling on behalf of NimbusFlow on a recorded line. Am I speaking with ${customer.name}?`;

    const initialMessage: CallMessage = {
      id: 'msg_' + Math.random().toString(36).substring(2, 9),
      sender: 'ava',
      text: introText,
      timestamp: new Date().toISOString(),
      audioGenerated: true,
      state: 'OPEN'
    };

    const session: CallSession = {
      id: callId,
      customerId: customer.id,
      customerName: customer.name,
      state: 'OPEN',
      startedAt: new Date().toISOString(),
      durationSeconds: 0,
      identityVerification: {
        nameConfirmed: false,
        factorChecked: null,
        factorVerified: false,
        failedAttempts: 0
      },
      messages: [initialMessage],
      toolLogs: [],
      guardrailHits: []
    };

    Store.recordCallSession(session);
    Store.logAudit({
      callId,
      customerId: customer.id,
      eventType: 'call_started',
      details: { language: customer.language, initialAiDisclosure: true, callAttemptNumber: customer.call_attempts_count }
    });

    return { session, initialMessage };
  }

  /**
   * Process incoming customer speech / text and determine Ava's next conversational turn + tool execution.
   */
  public static async processCustomerTurn(
    session: CallSession,
    customer: Customer,
    userText: string
  ): Promise<{ session: CallSession; replyMessage: CallMessage }> {
    const userClean = userText.trim().toLowerCase();

    // 1. Check for incoming credit card digits spoken by customer (Guardrail)
    const cardCheck = GuardrailsService.checkCustomerInput(userText);
    if (cardCheck.containsSensitiveCardData) {
      session.guardrailHits.push('Customer attempted to speak card numbers aloud');
    }

    // Append customer message
    const customerMsg: CallMessage = {
      id: 'msg_' + Math.random().toString(36).substring(2, 9),
      sender: 'customer',
      text: cardCheck.sanitizedText,
      timestamp: new Date().toISOString()
    };
    session.messages.push(customerMsg);

    const toolsExecuted: ToolCallLog[] = [];
    let nextState: CallState = session.state;
    let replyText = '';
    const isHindi = customer.language === 'hi' || /hindi|हिंदी/.test(userClean);

    // If customer requests Hindi mid-call
    if (/hindi|हिंदी/.test(userClean) && customer.language !== 'hi') {
      customer.language = 'hi';
    }

    // --- GLOBAL BRANCH 1: DO NOT CALL (DNC) & REFUSAL ---
    if (
      userClean.includes('stop calling') ||
      userClean.includes('do not call') ||
      userClean.includes('remove my number') ||
      userClean.includes("don't call") ||
      userClean.includes('leave me alone') ||
      userClean.includes('call mat karna') ||
      userClean.includes('नंबर हटाओ')
    ) {
      Store.markCustomerDNC(customer.id);
      nextState = 'DNC_TERMINATED';

      const dncToolLog: ToolCallLog = {
        id: 'tool_' + Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toISOString(),
        tool: 'mark_do_not_call',
        args: { customerId: customer.id, reason: 'Customer voice opt-out request' },
        result: { status: 'dnc_applied', phone: customer.phone },
        status: 'success'
      };
      toolsExecuted.push(dncToolLog);

      replyText = isHindi
        ? 'मैंने आपका नंबर तुरंत हमारी Do-Not-Call लिस्ट में जोड़ दिया है। आपको आगे से कोई ऑटोमेटेड कॉल नहीं आएगी। आपका दिन शुभ हो।'
        : 'I have immediately added your phone number to our Do Not Call list. You will not receive any further automated calls from us. Have a good day.';

      return this.finalizeTurn(session, replyText, toolsExecuted, nextState);
    }

    // Explicit payment refusal without DNC
    if (userClean.includes('refuse to pay') || userClean.includes('will not pay') || userClean.includes("won't pay")) {
      nextState = 'ESCALATED';
      const esc = Store.recordEscalation(customer.id, 'Customer payment refusal', userClean, 'Senior Account Relations');
      toolsExecuted.push({
        id: 'tool_' + Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toISOString(),
        tool: 'escalate_to_human',
        args: { customerId: customer.id, reason: 'payment_refusal' },
        result: { escalationId: esc.id, department: 'Senior Account Relations' },
        status: 'success'
      });

      replyText = isHindi
        ? 'मैं आपकी बात समझती हूँ। मैंने आपके रिकॉर्ड में यह नोट कर दिया है और आगे की समीक्षा के लिए हमारे वरिष्ठ प्रतिनिधि को सूचित कर दिया है। धन्यवाद।'
        : 'I understand you are declining to make a payment at this time. I have noted this on your account and escalated your file for manual account review. Thank you for your time.';

      return this.finalizeTurn(session, replyText, toolsExecuted, nextState);
    }

    // --- GLOBAL BRANCH 2: INQUIRY: "WHO IS CALLING?" ---
    if (
      (session.state === 'OPEN' || session.state === 'VERIFY_IDENTITY') &&
      (userClean.includes('who is calling') || userClean.includes('who are you') || userClean.includes('kaun bol raha'))
    ) {
      replyText = isHindi
        ? `मैं Ava हूँ, NimbusFlow की ऑटोमेटेड असिस्टेंट, आपके अकाउंट के एक ज़रूरी प्रशासनिक अपडेट के बारे में। क्या मेरी बात ${customer.name} जी से हो रही है?`
        : `This is Ava, an automated assistant calling from NimbusFlow on a recorded line regarding an administrative update on your account. For your security, am I speaking with ${customer.name}?`;
      return this.finalizeTurn(session, replyText, toolsExecuted, session.state);
    }

    // --- GLOBAL BRANCH 3: WRONG PERSON / NOT AVAILABLE ---
    if (
      (session.state === 'OPEN' || session.state === 'VERIFY_IDENTITY') &&
      (userClean.includes('wrong number') ||
        userClean.includes('not him') ||
        userClean.includes('not her') ||
        userClean.includes('not ' + customer.name.split(' ')[0].toLowerCase()) ||
        userClean.includes('wrong person') ||
        userClean.includes('speaking with someone else') ||
        userClean.includes('galat number') ||
        userClean.includes('yahan nahi hai') ||
        userClean.includes('not available'))
    ) {
      nextState = 'WRONG_PERSON_TERMINATED';

      const wrongPersonToolLog: ToolCallLog = {
        id: 'tool_' + Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toISOString(),
        tool: 'log_outcome',
        args: { outcome: 'wrong_person', zeroDataDisclosed: true },
        result: { flagged: true, reason: 'Wrong person answered phone' },
        status: 'success'
      };
      toolsExecuted.push(wrongPersonToolLog);

      replyText = isHindi
        ? 'असुविधा के लिए क्षमा चाहती हूँ। मैं अपने रिकॉर्ड्स अपडेट कर देती हूँ। आपका समय देने के लिए धन्यवाद, अलविदा।'
        : 'I sincerely apologize for the disturbance. I have updated our records accordingly. Thank you for your time, goodbye.';

      return this.finalizeTurn(session, replyText, toolsExecuted, nextState);
    }

    // --- STATE MACHINE ---
    const policy = PolicyEngine.getPolicyForCustomer(customer);

    switch (session.state) {
      case 'OPEN': {
        const isAffirmative =
          userClean.includes('yes') ||
          userClean.includes('speaking') ||
          userClean.includes('this is') ||
          userClean.includes('haan') ||
          userClean.includes('हाँ') ||
          userClean.includes('जी हाँ') ||
          userClean.includes('bol raha') ||
          userClean.includes('bol rahi') ||
          userClean.includes('बोल रही') ||
          userClean.includes('बोल रहा') ||
          userClean.includes(customer.name.split(' ')[0].toLowerCase()) ||
          userClean.includes('yeah') ||
          userClean.includes('yep');

        if (isAffirmative || userClean.includes('what is this regarding') || userClean.includes('kya baat hai')) {
          IdentityService.confirmName(session.id, true);
          session.identityVerification.nameConfirmed = true;
          nextState = 'VERIFY_IDENTITY';

          // FIX: Never leak the security answer in the question!
          replyText = isHindi
            ? `धन्यवाद ${customer.name.split(' ')[0]} जी। आपके अकाउंट की सुरक्षा और प्राइवेसी के लिए, क्या आप अपने कार्ड के आखिरी 4 अंक या रजिस्टर्ड पिनकोड बता सकते हैं?`
            : `Thank you, ${customer.name.split(' ')[0]}. For your security and account privacy, could you please confirm the last 4 digits of your payment card on file, or your registered billing postal code?`;
        } else {
          replyText = isHindi
            ? `क्या मेरी बात ${customer.name} जी से हो रही है?`
            : `Could you please confirm if I am speaking with ${customer.name}?`;
        }
        break;
      }

      case 'VERIFY_IDENTITY': {
        const devanagariDigits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
        let normalizedText = userClean;
        devanagariDigits.forEach((d, idx) => {
          normalizedText = normalizedText.split(d).join(idx.toString());
        });
        const digits = normalizedText.replace(/\D/g, '');
        let factorType: 'last4' | 'zip' = 'last4';
        let factorValue = digits;

        if (userClean.includes(customer.zip_code) || (digits.length === 6 && digits === customer.zip_code)) {
          factorType = 'zip';
          factorValue = customer.zip_code;
        }

        const verifyResult = IdentityService.verifyFactor(session.id, customer, factorType, factorValue);

        const verifyToolLog: ToolCallLog = {
          id: 'tool_' + Math.random().toString(36).substring(2, 9),
          timestamp: new Date().toISOString(),
          tool: 'verify_identity',
          args: { factorType, factorValue: factorValue.slice(-4) },
          result: { verified: verifyResult.verified, attemptsRemaining: verifyResult.attemptsRemaining },
          status: verifyResult.verified ? 'success' : 'error'
        };
        toolsExecuted.push(verifyToolLog);

        if (verifyResult.verified) {
          session.identityVerification.factorVerified = true;
          session.identityVerification.factorChecked = factorType;
          nextState = 'DIAGNOSE';

          // Now and ONLY now can Ava reveal failure reason and balance!
          const explanation = isHindi ? policy.hindiExplanation : policy.initialExplanation;
          replyText = isHindi
            ? `सत्यापन के लिए धन्यवाद। ${explanation} आपका कुल बकाया ${customer.currency} ${customer.amount_due} है। क्या आप इसे अभी सुरक्षित SMS लिंक द्वारा हल करना चाहेंगे, या कोई अन्य व्यवस्था चाहते हैं?`
            : `Thank you for verifying your identity. ${explanation} The balance due is ${customer.currency} ${customer.amount_due} for your ${customer.plan}. Would you like me to send a secure link to pay now, or would you prefer a scheduled retry date?`;
        } else if (verifyResult.isLockedOut) {
          nextState = 'FAILED_VERIFICATION_TERMINATED';
          await SMSService.sendNeutralFollowUpSMS(customer.phone, customer.name);

          replyText = isHindi
            ? 'सुरक्षा कारणों से, मैं इस फोन लाइन पर अकाउंट की जानकारी साझा नहीं कर सकती। हमने आपके रजिस्टर्ड ईमेल पर विवरण भेज दिया है। धन्यवाद।'
            : 'For your security, I cannot discuss account specifics on this line. We have dispatched a secure follow-up to your registered email. Thank you for your time, goodbye.';
        } else {
          session.identityVerification.failedAttempts += 1;
          replyText = isHindi
            ? `माफ़ कीजियेगा, वो जानकारी मेल नहीं खा रही है। आपके पास 1 प्रयास बाकी है। कृपया अपने कार्ड के अंतिम 4 अंक बताएँ।`
            : `I apologize, that didn't match our records. For security you have 1 attempt remaining. Could you please confirm the last 4 digits of your card on file?`;
        }
        break;
      }

      case 'DIAGNOSE':
      case 'OFFER': {
        // 1. Billing Dispute -> Place real hold in store!
        if (
          userClean.includes('dispute') ||
          userClean.includes('wrong bill') ||
          userClean.includes('deactivated') ||
          userClean.includes('cancel')
        ) {
          nextState = 'ESCALATED';
          Store.setBillingHold(customer.id, 7); // Real 7-day hold implemented!
          const esc = Store.recordEscalation(customer.id, 'Customer billing dispute', userClean, 'Billing Dispute Team');
          toolsExecuted.push({
            id: 'tool_' + Math.random().toString(36).substring(2, 9),
            timestamp: new Date().toISOString(),
            tool: 'escalate_to_human',
            args: { customerId: customer.id, reason: 'dispute' },
            result: { escalationId: esc.id, department: 'Billing Dispute Team', holdPlaced: true, holdDays: 7 },
            status: 'success'
          });
          replyText = isHindi
            ? 'मैं आपकी बात पूरी तरह समझ सकती हूँ। मैंने आपके बिल पर 7 दिनों का वास्तविक होल्ड लगा दिया है और हमारे बिलिंग विशेषज्ञ को आपका केस ट्रांसफर कर दिया है। वे आपसे जल्द संपर्क करेंगे।'
            : 'I completely understand your concern. I have placed an official 7-day hold on your billing account so no retries occur, and escalated this directly to our billing specialists to review and resolve with you.';
          break;
        }

        // 1b. Human Specialist / Enterprise Account Manager request (e.g. VIP closed account)
        if (
          userClean.includes('manager') ||
          userClean.includes('human') ||
          userClean.includes('representative') ||
          userClean.includes('talk to') ||
          userClean.includes('speak with') ||
          userClean.includes('person') ||
          userClean.includes('agent') ||
          userClean.includes('executive')
        ) {
          nextState = 'ESCALATED';
          const esc = Store.recordEscalation(customer.id, 'Customer requested human account specialist', userClean, 'Enterprise Account Manager');
          toolsExecuted.push({
            id: 'tool_' + Math.random().toString(36).substring(2, 9),
            timestamp: new Date().toISOString(),
            tool: 'escalate_to_human',
            args: { customerId: customer.id, reason: 'human_requested' },
            result: { escalationId: esc.id, department: 'Enterprise Account Manager' },
            status: 'success'
          });
          replyText = isHindi
            ? 'मैं तुरंत हमारे सीनियर एंटरप्राइज अकाउंट मैनेजर को आपकी कॉल ट्रांसफर कर रही हूँ। कृपया एक क्षण प्रतीक्षा करें।'
            : 'I completely understand. I am transferring your call directly to your dedicated Enterprise Account Manager with the full context of your account right now. Please hold for just a moment.';
          break;
        }

        // 2. Hostile / Angry
        if (
          userClean.includes('angry') ||
          userClean.includes('terrible') ||
          userClean.includes('stupid') ||
          userClean.includes('ridiculous')
        ) {
          nextState = 'ESCALATED';
          const esc = Store.recordEscalation(customer.id, 'Customer escalation - de-escalation needed', userClean, 'Customer Relations Supervisor');
          toolsExecuted.push({
            id: 'tool_' + Math.random().toString(36).substring(2, 9),
            timestamp: new Date().toISOString(),
            tool: 'escalate_to_human',
            args: { customerId: customer.id, reason: 'frustrated_customer' },
            result: { escalationId: esc.id, department: 'Customer Relations' },
            status: 'success'
          });
          replyText = isHindi
            ? 'मैं आपकी परेशानी समझती हूँ। मैं आपको हमारे सीनियर सुपरवाइज़र से कनेक्ट कर देती हूँ ताकि आपकी समस्या का सही समाधान हो सके।'
            : 'I hear your frustration, and I apologize for the inconvenience. Let me connect you directly to our Senior Customer Relations supervisor right now so they can assist you personally.';
          break;
        }

        // 3. Hardship / Installment Plan
        if (
          userClean.includes('hardship') ||
          userClean.includes('medical') ||
          userClean.includes('cannot afford') ||
          userClean.includes('installments') ||
          userClean.includes('split') ||
          userClean.includes('part payment') ||
          customer.hardship_flag
        ) {
          nextState = 'CONFIRM';
          const plan = Store.recordPaymentPlan(customer.id, customer.amount_due, 3);
          toolsExecuted.push({
            id: 'tool_' + Math.random().toString(36).substring(2, 9),
            timestamp: new Date().toISOString(),
            tool: 'set_payment_plan',
            args: { customerId: customer.id, totalAmount: customer.amount_due, installments: 3 },
            result: { planId: plan.id, monthlyAmount: plan.monthlyAmount, installments: 3 },
            status: 'success'
          });
          replyText = isHindi
            ? `हम आपकी सहायता करना चाहते हैं। मैंने आपका ₹${customer.amount_due} का बकाया 3 आसान मासिक किश्तों में (₹${plan.monthlyAmount} प्रति माह) विभाजित कर दिया है। पहली किश्त 14 दिनों बाद देय होगी। क्या यह आपके लिए ठीक रहेगा?`
            : `We want to support you through this. I have arranged our Relief Plan: splitting your balance of ${customer.currency} ${customer.amount_due} into 3 monthly installments of ${customer.currency} ${plan.monthlyAmount}, with the first payment due in 14 days. Does that work for you?`;
          break;
        }

        // 4. Promise to Pay / Date extraction
        if (
          userClean.includes('tomorrow') ||
          userClean.includes('friday') ||
          userClean.includes('monday') ||
          userClean.includes('next week') ||
          userClean.includes('salary') ||
          userClean.includes('pay on') ||
          userClean.includes('promise') ||
          userClean.includes('days') ||
          userClean.includes('din')
        ) {
          nextState = 'CONFIRM';
          const promisedDate = this.parsePromiseDate(userClean);
          const promise = Store.recordPromise(customer.id, promisedDate, customer.amount_due, customer.currency);
          toolsExecuted.push({
            id: 'tool_' + Math.random().toString(36).substring(2, 9),
            timestamp: new Date().toISOString(),
            tool: 'schedule_promise_to_pay',
            args: { customerId: customer.id, promisedDate, amount: customer.amount_due },
            result: { promiseId: promise.id, status: 'scheduled', promisedDate },
            status: 'success'
          });
          replyText = isHindi
            ? `बिल्कुल! मैंने ${promisedDate} के लिए आपका पेमेंट वादा दर्ज कर लिया है। उस दिन तक आपका खाता बिना किसी रुकावट के चालू रहेगा। समय निकालने के लिए बहुत-बहुत धन्यवाद!`
            : `Wonderful! I have scheduled a Promise-to-Pay for ${promisedDate} for ${customer.currency} ${customer.amount_due}. Your service will remain uninterrupted. Thank you for setting that up!`;
          break;
        }

        // 5. Pay Now via SMS Link (Explicit agreement to pay or receive link)
        if (
          userClean.includes('link') ||
          userClean.includes('pay') ||
          userClean.includes('send') ||
          userClean.includes('text') ||
          userClean.includes('card') ||
          userClean.includes('upi') ||
          userClean.includes('yes') ||
          userClean.includes('sure') ||
          userClean.includes('bhejo') ||
          userClean.includes('karna hai') ||
          userClean.includes('please') ||
          userClean.includes('लिंक') ||
          userClean.includes('भेज') ||
          userClean.includes('पेमेंट') ||
          userClean.includes('भुगतान') ||
          userClean.includes('हाँ') ||
          userClean.includes('हां') ||
          userClean.includes('दीजिए') ||
          userClean.includes('कर दो') ||
          userClean.includes('यूपीआई') ||
          userClean.includes('कार्ड')
        ) {
          nextState = 'RESOLVE';
          const link = PaymentLinkService.createPaymentLink(customer);
          session.activePaymentLink = link;

          toolsExecuted.push({
            id: 'tool_' + Math.random().toString(36).substring(2, 9),
            timestamp: new Date().toISOString(),
            tool: 'create_payment_link',
            args: { customerId: customer.id, amount: customer.amount_due },
            result: { linkId: link.id, url: link.url },
            status: 'success'
          });

          await SMSService.sendPaymentLinkSMS(
            customer.phone,
            customer.name,
            customer.amount_due,
            customer.currency,
            link.url,
            link.id
          );
          PaymentLinkService.markAsSent(link.id);

          toolsExecuted.push({
            id: 'tool_' + Math.random().toString(36).substring(2, 9),
            timestamp: new Date().toISOString(),
            tool: 'send_sms',
            args: { to: customer.phone, linkUrl: link.url },
            result: { status: 'delivered', provider: 'Twilio' },
            status: 'success'
          });

          replyText = isHindi
            ? `मैंने आपके मोबाइल नंबर पर ₹${customer.amount_due} का सुरक्षित पेमेंट लिंक भेज दिया है। आप लिंक खोलकर UPI या कार्ड से भुगतान कर सकते हैं। जब तक आप यह पूरा करते हैं, मैं लाइन पर हूँ।`
            : `I have just sent a secure one-click payment link to your mobile phone for ${customer.currency} ${customer.amount_due}. You can tap it to complete the payment via card, NetBanking, or UPI. I will stay on the line with you while you do that.`;
          break;
        }

        // 6. Ambiguous reply in OFFER - Do NOT blindly send payment link!
        replyText = isHindi
          ? `मैं आपके मोबाइल पर सुरक्षित पेमेंट लिंक भेज सकती हूँ, या हम आपकी सुविधानुसार कोई भविष्य की तारीख शेड्यूल कर सकते हैं। आप क्या चुनना चाहेंगे?`
          : `I can send a secure one-click payment link to your phone now, or we can schedule an automatic retry on a future date that works best for you. Which would you prefer?`;
        break;
      }

      case 'RESOLVE': {
        if (
          userClean.includes('paid') ||
          userClean.includes('completed') ||
          userClean.includes('done') ||
          userClean.includes('kar diya') ||
          userClean.includes('कर दिया') ||
          userClean.includes('हो गया') ||
          userClean.includes('पेमेंट हो गई') ||
          userClean.includes('भुगतान कर दिया')
        ) {
          replyText = isHindi
            ? 'मैं गेटवे से पुष्टि की प्रतीक्षा कर रही हूँ। जैसे ही यह प्रोसेस होगा, मैं आपको बता दूंगी।'
            : "I am monitoring the gateway right now. As soon as the transaction confirms, I'll let you know aloud.";
        } else {
          replyText = isHindi
            ? 'कोई परेशानी तो नहीं हो रही है? आप लिंक पर क्लिक करके पेमेंट पूरा कर सकते हैं।'
            : 'Take your time. You can tap the secure link received on your phone to complete the transaction.';
        }
        break;
      }

      case 'CONFIRM': {
        nextState = 'CLOSE';
        replyText = isHindi
          ? `सभी विवरण रिकॉर्ड कर लिए गए हैं। NimbusFlow को चुनने के लिए आपका धन्यवाद! आपका दिन शुभ हो, नमस्ते।`
          : `Everything has been recorded and confirmed. Thank you for being a valued NimbusFlow customer! Have a fantastic day, goodbye.`;
        break;
      }

      default:
        replyText = isHindi
          ? 'क्या मैं आपकी किसी और चीज़ में सहायता कर सकती हूँ?'
          : 'Is there anything else I can assist you with today?';
        break;
    }

    return this.finalizeTurn(session, replyText, toolsExecuted, nextState);
  }

  /**
   * Called when mock payment gateway fires the "paid" webhook
   */
  public static handlePaymentReceivedLive(session: CallSession, customer: Customer, paidAmount: number): CallMessage {
    session.state = 'CLOSE';
    customer.amount_due = 0; // Mark invoice resolved
    Store.updateCustomer(customer.id, { amount_due: 0 });

    const isHindi = customer.language === 'hi';
    const text = isHindi
      ? `शानदार! मुझे लाइव कन्फर्मेशन मिल गया है कि आपका ₹${paidAmount} का भुगतान सफलतापूर्वक प्राप्त हो गया है। आपका खाता पूरी तरह अप-टू-डेट है। बहुत-बहुत धन्यवाद!`
      : `Great news! I can see that payment of ${customer.currency} ${paidAmount} just went through successfully! Your NimbusFlow account is completely up to date. Thank you so much for taking care of that!`;

    const msg: CallMessage = {
      id: 'msg_' + Math.random().toString(36).substring(2, 9),
      sender: 'ava',
      text,
      timestamp: new Date().toISOString(),
      audioGenerated: true,
      state: 'CLOSE',
      toolCalls: [
        {
          id: 'tool_' + Math.random().toString(36).substring(2, 9),
          timestamp: new Date().toISOString(),
          tool: 'check_payment_status',
          args: { customerId: customer.id },
          result: { status: 'paid', amount: paidAmount, gateway: 'MockGateway' },
          status: 'success'
        }
      ]
    };

    session.messages.push(msg);
    Store.recordCallSession(session);
    Store.logAudit({
      callId: session.id,
      customerId: customer.id,
      eventType: 'payment_received',
      details: { amount: paidAmount, liveReactionSpoken: true }
    });

    return msg;
  }

  private static finalizeTurn(
    session: CallSession,
    replyText: string,
    toolLogs: ToolCallLog[],
    nextState: CallState
  ): { session: CallSession; replyMessage: CallMessage } {
    session.state = nextState;
    if (toolLogs.length > 0) {
      session.toolLogs.push(...toolLogs);
    }

    const replyMsg: CallMessage = {
      id: 'msg_' + Math.random().toString(36).substring(2, 9),
      sender: 'ava',
      text: replyText,
      timestamp: new Date().toISOString(),
      audioGenerated: true,
      toolCalls: toolLogs.length > 0 ? toolLogs : undefined,
      state: nextState
    };

    session.messages.push(replyMsg);
    Store.recordCallSession(session);

    return { session, replyMessage: replyMsg };
  }
}
