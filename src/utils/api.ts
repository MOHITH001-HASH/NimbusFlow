import { Customer, AuditLogEntry } from '../types';

export const apiClient = {
  async getCustomers(): Promise<Customer[]> {
    const res = await fetch('/api/customers');
    if (!res.ok) throw new Error('Failed to fetch customers');
    return res.json();
  },

  async createCustomer(data: Partial<Customer>): Promise<Customer> {
    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to create customer');
    return result.customer;
  },

  async updateCustomer(id: string, updates: Partial<Customer>): Promise<Customer> {
    const res = await fetch(`/api/customers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to update customer');
    return result.customer;
  },

  async deleteCustomer(id: string): Promise<boolean> {
    const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete customer');
    return true;
  },

  async getAuditLogs(): Promise<AuditLogEntry[]> {
    const res = await fetch('/api/audit-log');
    if (!res.ok) throw new Error('Failed to fetch audit logs');
    return res.json();
  },

  async getStats(): Promise<any> {
    const res = await fetch('/api/stats');
    if (!res.ok) throw new Error('Failed to fetch stats');
    return res.json();
  },

  async resetData(): Promise<void> {
    const res = await fetch('/api/reset', { method: 'POST' });
    if (!res.ok) throw new Error('Failed to reset data');
  }
};
