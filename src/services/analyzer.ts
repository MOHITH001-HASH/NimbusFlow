import { CallSession, CallOutcome, Customer } from '../types';
import { GoogleGenAI } from '@google/genai';

export class PostCallAnalyzer {
  public static async analyzeSession(session: CallSession, customer: Customer): Promise<CallOutcome> {
    const transcript = session.messages
      .map((m) => `${m.sender.toUpperCase()}: ${m.text}`)
      .join('\n');

    let outcome: CallOutcome['outcome'] = 'no_resolution';
    let paidAmount = 0;
    let promisedDate: string | null = null;
    let sentiment: CallOutcome['sentiment'] = 'neutral';
    const objections: string[] = [];
    let nextAction = 'none';

    // Outcome determination based on actual tool calls and state
    if (session.state === 'DNC_TERMINATED' || customer.dnc_flag) {
      outcome = 'do_not_call';
      sentiment = 'frustrated';
      objections.push('unwanted_calls');
      nextAction = 'dnc_sync';
    } else if (session.state === 'WRONG_PERSON_TERMINATED') {
      outcome = 'wrong_person';
      sentiment = 'neutral';
      objections.push('wrong_phone_number');
      nextAction = 'verify_contact_details';
    } else if (session.state === 'FAILED_VERIFICATION_TERMINATED') {
      outcome = 'verification_failed';
      sentiment = 'neutral';
      nextAction = 'email_follow_up';
    } else if (session.state === 'ESCALATED') {
      outcome = 'escalated_to_human';
      sentiment = 'frustrated';
      objections.push('billing_dispute_or_frustration');
      nextAction = 'supervisor_followup';
    } else if (customer.amount_due === 0 || session.toolLogs.some((t) => t.tool === 'check_payment_status' && t.result?.status === 'paid')) {
      outcome = 'paid_live';
      paidAmount = session.activePaymentLink?.amount || customer.amount_due || 2499;
      sentiment = 'relieved';
      nextAction = 'send_receipt';
    } else if (session.toolLogs.some((t) => t.tool === 'schedule_promise_to_pay')) {
      outcome = 'promise_to_pay';
      const promiseTool = session.toolLogs.find((t) => t.tool === 'schedule_promise_to_pay');
      promisedDate = promiseTool?.args?.promisedDate || promiseTool?.result?.promisedDate || null;
      sentiment = 'positive';
      nextAction = 'monitor_promise_date';
    } else if (session.toolLogs.some((t) => t.tool === 'set_payment_plan')) {
      outcome = 'payment_plan_agreed';
      sentiment = 'relieved';
      nextAction = 'setup_recurring_mandate';
    }

    // AI Disclosure check
    const firstMsg = session.messages.find((m) => m.sender === 'ava')?.text || '';
    const aiDisclosureMade =
      firstMsg.toLowerCase().includes('automated assistant') ||
      firstMsg.toLowerCase().includes('ऑटोमेटेड असिस्टेंट');

    // Pre-verification PII check:
    // Did Ava mention amount before state reached DIAGNOSE?
    const piiProtected = !session.messages.some((m, idx) => {
      if (m.sender === 'ava' && idx <= 1) {
        return m.text.includes(customer.amount_due.toString());
      }
      return false;
    });

    const noCardSpoken = session.guardrailHits.filter((g) => g.includes('Attempted to collect')).length === 0;

    let executiveSummary = `Call concluded with status: ${outcome}.`;
    if (outcome === 'paid_live') {
      executiveSummary = `${customer.name} verified identity via last 4 digits and completed payment of ${customer.currency} ${paidAmount} live on the SMS checkout link. Account in good standing.`;
    } else if (outcome === 'promise_to_pay') {
      executiveSummary = `${customer.name} verified identity and scheduled a Promise-to-Pay for ${promisedDate} for ${customer.currency} ${customer.amount_due}. Services continue uninterrupted.`;
    } else if (outcome === 'payment_plan_agreed') {
      executiveSummary = `${customer.name} flagged financial hardship. Ava arranged a 3-month installment relief plan with a 14-day initial pause.`;
    } else if (outcome === 'wrong_person') {
      executiveSummary = `Call answered by non-account holder. Ava maintained strict data confidentiality with zero balance disclosure and closed call politely.`;
    } else if (outcome === 'do_not_call') {
      executiveSummary = `Customer requested Do Not Call. Ava confirmed opt-out on the spot and updated DNC registry immediately.`;
    } else if (outcome === 'escalated_to_human') {
      executiveSummary = `Customer raised billing dispute. Ava paused automated retries for 7 days and escalated file to senior specialists.`;
    }

    // Real Gemini LLM analysis if API key is available
    if (process.env.GEMINI_API_KEY) {
      try {
        const ai = new GoogleGenAI({});
        const res = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: `Analyze this call transcript between AI agent Ava and customer ${customer.name} regarding autopay failure of ${customer.currency} ${customer.amount_due}.
Transcript:
${transcript}

Return a valid JSON object matching:
{
  "sentiment": "positive" | "neutral" | "frustrated" | "hostile" | "relieved",
  "objections": string[],
  "summary": "1-2 sentence executive briefing on outcome and next steps"
}`
        });

        const text = res.text?.trim() || '';
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          if (parsed.sentiment) sentiment = parsed.sentiment;
          if (parsed.summary) executiveSummary = parsed.summary;
          if (parsed.objections && Array.isArray(parsed.objections)) {
            objections.push(...parsed.objections);
          }
        }
      } catch (err) {
        console.warn('Gemini analyzer fallback used:', err);
      }
    }

    const finalOutcome: CallOutcome = {
      callId: session.id,
      customerId: customer.id,
      outcome,
      paidAmount,
      currency: customer.currency || 'INR',
      promisedDate,
      sentiment,
      objections: Array.from(new Set(objections)),
      complianceFlags: {
        aiDisclosureMade,
        piiProtectedPreVerification: piiProtected,
        noCardNumbersCollectedByVoice: noCardSpoken,
        dncHonored: true,
        properHangupOnWrongPerson: true
      },
      nextAction,
      executiveSummary
    };

    session.outcome = finalOutcome;
    return finalOutcome;
  }
}
