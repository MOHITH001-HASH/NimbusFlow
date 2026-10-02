import { Customer, PaymentLink } from '../types';

export class PaymentLinkService {
  private static links = new Map<string, PaymentLink>();
  private static paymentSubscribers = new Map<string, ((link: PaymentLink) => void)[]>();

  public static createPaymentLink(customer: Customer, amount?: number): PaymentLink {
    const id = 'pl_' + Math.random().toString(36).substring(2, 9);
    const link: PaymentLink = {
      id,
      customerId: customer.id,
      customerName: customer.name,
      amount: amount || customer.amount_due,
      currency: customer.currency || 'INR',
      plan: customer.plan,
      url: `/pay/${id}`,
      status: 'created',
      createdAt: new Date().toISOString()
    };

    this.links.set(id, link);
    return link;
  }

  public static getLink(id: string): PaymentLink | undefined {
    return this.links.get(id);
  }

  public static getLinkForCustomer(customerId: string): PaymentLink | undefined {
    return Array.from(this.links.values())
      .reverse()
      .find((link) => link.customerId === customerId);
  }

  public static markAsSent(linkId: string): void {
    const link = this.links.get(linkId);
    if (link && link.status === 'created') {
      link.status = 'sent_sms';
    }
  }

  public static completePayment(linkId: string, paymentMethod: string = 'UPI'): { success: boolean; link?: PaymentLink } {
    const link = this.links.get(linkId);
    if (!link) {
      return { success: false };
    }

    link.status = 'paid';
    link.paidAt = new Date().toISOString();
    link.paymentMethod = paymentMethod;
    link.transactionId = 'txn_' + Math.random().toString(36).substring(2, 10).toUpperCase();

    // Notify any active listeners (e.g. active call session)
    const subs = this.paymentSubscribers.get(link.customerId) || [];
    subs.forEach((cb) => cb(link));

    return { success: true, link };
  }

  public static subscribeToCustomerPayment(customerId: string, callback: (link: PaymentLink) => void): () => void {
    const current = this.paymentSubscribers.get(customerId) || [];
    current.push(callback);
    this.paymentSubscribers.set(customerId, current);

    return () => {
      const updated = (this.paymentSubscribers.get(customerId) || []).filter((cb) => cb !== callback);
      this.paymentSubscribers.set(customerId, updated);
    };
  }

  public static getAllLinks(): PaymentLink[] {
    return Array.from(this.links.values());
  }
}
