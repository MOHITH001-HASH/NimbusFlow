export interface SMSMessage {
  id: string;
  to: string;
  body: string;
  timestamp: string;
  status: 'delivered' | 'failed' | 'simulated';
  provider: 'Twilio' | 'MockProvider';
  paymentLinkId?: string;
  sid?: string;
}

export class SMSService {
  private static outbox: SMSMessage[] = [];
  private static listeners: ((msg: SMSMessage) => void)[] = [];

  public static async sendPaymentLinkSMS(
    phone: string,
    customerName: string,
    amount: number,
    currency: string,
    paymentUrl: string,
    linkId: string
  ): Promise<SMSMessage> {
    const origin = typeof window !== 'undefined' && window.location ? window.location.origin : (process.env.APP_URL || 'http://localhost:3000');
    const body = `NimbusFlow Security: Hi ${customerName.split(' ')[0]}, complete your autopay payment of ${currency} ${amount} securely here: ${origin}${paymentUrl} . Valid for 24h.`;

    return this.dispatchSMS(phone, body, linkId);
  }

  public static async sendNeutralFollowUpSMS(phone: string, customerName: string): Promise<SMSMessage> {
    const body = `NimbusFlow Notice: We attempted to reach ${customerName.split(' ')[0]} regarding an administrative update on your account. Please log in to your account dashboard or reply to this message.`;
    return this.dispatchSMS(phone, body);
  }

  private static async dispatchSMS(phone: string, body: string, linkId?: string): Promise<SMSMessage> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;

    let provider: 'Twilio' | 'MockProvider' = 'MockProvider';
    let sid: string | undefined;
    let status: 'delivered' | 'failed' | 'simulated' = 'simulated';

    // If real Twilio credentials are provided, call Twilio Messages API
    if (accountSid && authToken && fromNumber && phone.startsWith('+')) {
      try {
        const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
        const formData = new URLSearchParams();
        formData.append('To', phone);
        formData.append('From', fromNumber);
        formData.append('Body', body);

        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: formData.toString()
        });

        if (res.ok) {
          const twilioData = await res.json();
          provider = 'Twilio';
          sid = twilioData.sid;
          status = 'delivered';
        } else {
          console.warn('Twilio dispatch failed, fallback to mock:', await res.text());
        }
      } catch (err) {
        console.warn('Twilio dispatch exception:', err);
      }
    } else {
      status = 'delivered'; // Delivered in simulator
    }

    const sms: SMSMessage = {
      id: sid || 'sms_' + Math.random().toString(36).substring(2, 9),
      to: phone,
      body,
      timestamp: new Date().toISOString(),
      status,
      provider,
      paymentLinkId: linkId,
      sid
    };

    this.outbox.unshift(sms);
    this.listeners.forEach((cb) => cb(sms));
    return sms;
  }

  public static getOutbox(): SMSMessage[] {
    return this.outbox;
  }

  public static getOutboxForPhone(phone: string): SMSMessage[] {
    return this.outbox.filter((m) => m.to === phone || phone.endsWith(m.to.slice(-4)));
  }

  public static subscribe(callback: (msg: SMSMessage) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }
}
