import { Customer } from '../types';

export class VapiService {
  /**
   * Generates the complete Vapi Assistant configuration JSON with tool schemas.
   * Can be imported into Vapi dashboard or deployed directly via Vapi API.
   */
  public static getAssistantConfig(customer: Customer, serverUrl: string) {
    const isHindi = customer.language === 'hi';
    const systemPrompt = isHindi
      ? `आप Ava हैं, NimbusFlow की ऑटोमेटेड वॉइस रिकवरी असिस्टेंट। पहले वाक्य में AI डिस्क्लोज़र दें। पहचान सत्यापन (नाम + कार्ड के अंतिम 4 अंक या पिनकोड) से पहले कोई राशि या बिल की जानकारी न दें। फोन पर कार्ड नंबर कभी न लें, केवल SMS लिंक भेजें।`
      : `You are Ava, the autonomous autopay recovery voice agent for NimbusFlow on a recorded line.
In your first sentence you MUST state you are an automated assistant.
Never disclose invoice balance or delinquency reason until identity is verified via full name and card last 4 digits or ZIP.
Never take credit card numbers by voice. Send the secure payment link via SMS using the create_payment_link tool.`;

    const vapiModel = process.env.VAPI_LLM_MODEL || 'gpt-4o-mini';
    const vapiProvider = process.env.VAPI_LLM_PROVIDER || (vapiModel.startsWith('claude') ? 'anthropic' : 'openai');

    return {
      name: `NimbusFlow-Ava-${customer.language.toUpperCase()}`,
      transcriber: {
        provider: 'deepgram',
        model: 'nova-2',
        language: isHindi ? 'hi' : 'en-US'
      },
      model: {
        provider: vapiProvider as any,
        model: vapiModel,
        messages: [
          {
            role: 'system',
            content: `${systemPrompt}\n\nTOOL CONTEXT: the customerId for every tool call is "${customer.id}". Always pass exactly this value.`
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'verify_identity',
              description: 'Verifies the customer identity using full name and secondary factor (last 4 card digits or ZIP code). Max 2 attempts.',
              parameters: {
                type: 'object',
                properties: {
                  customerId: { type: 'string' },
                  factorType: { type: 'string', enum: ['last4', 'zip'] },
                  factorValue: { type: 'string', description: 'The 4 digits of the card or postal code spoken by user' }
                },
                required: ['customerId', 'factorType', 'factorValue']
              }
            }
          },
          {
            type: 'function',
            function: {
              name: 'create_payment_link',
              description: 'Creates a secure encrypted SMS checkout link for the customer. Server-side identity verification must be completed first.',
              parameters: {
                type: 'object',
                properties: {
                  customerId: { type: 'string' }
                },
                required: ['customerId']
              }
            }
          },
          {
            type: 'function',
            function: {
              name: 'check_payment_status',
              description: 'Checks if the customer has completed payment on the hosted checkout gateway.',
              parameters: {
                type: 'object',
                properties: {
                  customerId: { type: 'string' }
                },
                required: ['customerId']
              }
            }
          },
          {
            type: 'function',
            function: {
              name: 'schedule_promise_to_pay',
              description: 'Records a customer promise to pay on a specific date.',
              parameters: {
                type: 'object',
                properties: {
                  customerId: { type: 'string' },
                  promisedDate: { type: 'string', description: 'YYYY-MM-DD or spoken date e.g. Friday' }
                },
                required: ['customerId', 'promisedDate']
              }
            }
          },
          {
            type: 'function',
            function: {
              name: 'set_payment_plan',
              description: 'Configures a financial hardship relief plan splitting the balance into monthly installments.',
              parameters: {
                type: 'object',
                properties: {
                  customerId: { type: 'string' },
                  installments: { type: 'number', default: 3 }
                },
                required: ['customerId']
              }
            }
          },
          {
            type: 'function',
            function: {
              name: 'escalate_to_human',
              description: 'Transfers the customer to a live human billing specialist or customer relations supervisor.',
              parameters: {
                type: 'object',
                properties: {
                  customerId: { type: 'string' },
                  reason: { type: 'string', enum: ['dispute', 'hostile_caller', 'complex_account', 'repeated_failure'] }
                },
                required: ['customerId', 'reason']
              }
            }
          },
          {
            type: 'function',
            function: {
              name: 'mark_do_not_call',
              description: 'Immediately adds the customer number to the Do-Not-Call (DNC) registry and halts calls.',
              parameters: {
                type: 'object',
                properties: {
                  customerId: { type: 'string' }
                },
                required: ['customerId']
              }
            }
          }
        ]
      },
      voice: {
        provider: '11labs',
        voiceId: isHindi ? '21m00Tcm4TlvDq8ikWAM' : '21m00Tcm4TlvDq8ikWAM'
      },
      firstMessage: isHindi
        ? `नमस्ते ${customer.name.split(' ')[0]} जी, मैं Ava बात कर रही हूँ, NimbusFlow की ऑटोमेटेड असिस्टेंट, एक रिकॉर्डेड लाइन पर। क्या मेरी बात ${customer.name} जी से हो रही है?`
        : `Hello ${customer.name.split(' ')[0]}, this is Ava, an automated assistant calling on behalf of NimbusFlow on a recorded line. Am I speaking with ${customer.name}?`,
      serverUrl: `${serverUrl}/api/vapi/webhook`,
      serverUrlSecret: process.env.SHARED_TOOL_SECRET || ''
    };
  }

  /**
   * Initiates a real outbound call via Vapi API if VAPI_API_KEY is configured
   */
  public static async makeOutboundCall(
    phoneNumber: string,
    customer: Customer,
    serverUrl: string
  ): Promise<{ success: boolean; callId?: string; error?: string }> {
    const apiKey = process.env.VAPI_API_KEY;
    const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;

    if (!apiKey) {
      return {
        success: false,
        error: 'VAPI_API_KEY not set in environment. Running in high-fidelity browser/server simulation mode.'
      };
    }

    try {
      const assistant = this.getAssistantConfig(customer, serverUrl);
      const res = await fetch('https://api.vapi.ai/call/phone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          phoneNumberId: phoneNumberId || undefined,
          customer: {
            number: phoneNumber,
            name: customer.name
          },
          assistant
        })
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.message || 'Vapi API error' };
      }

      return { success: true, callId: data.id };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}
