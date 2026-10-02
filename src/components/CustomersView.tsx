import React, { useState } from 'react';
import {
  Users, UserPlus, Edit2, Trash2, Phone, Search, Filter, ShieldCheck,
  AlertTriangle, CheckCircle2, Lock, X, Save, Loader2, ArrowRight,
  Eye, History, Clock, ChevronDown, ChevronUp, MessageSquare, Wrench,
  Calendar, Sparkles, Check, AlertCircle
} from 'lucide-react';
import { Customer, CallSession } from '../types';

interface CustomersViewProps {
  customers: Customer[];
  onRefreshCustomers: () => Promise<void>;
  onSelectCustomerForCall: (customer: Customer) => void;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  customers,
  onRefreshCustomers,
  onSelectCustomerForCall
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'unpaid' | 'paid' | 'dnc' | 'hardship'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<{ field: string; message: string }[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Customer Detail View State
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);
  const [customerCalls, setCustomerCalls] = useState<CallSession[]>([]);
  const [isLoadingCalls, setIsLoadingCalls] = useState(false);
  const [expandedCallId, setExpandedCallId] = useState<string | null>(null);

  // Form State
  const defaultFormState = {
    name: '',
    phone: '+15550100099',
    email: '',
    language: 'en' as 'en' | 'hi',
    timezone: 'Asia/Kolkata',
    plan: 'NimbusFlow Growth Cloud',
    amount_due: 2499,
    currency: 'INR',
    due_date: new Date().toISOString().split('T')[0],
    last4: '4242',
    zip_code: '560001',
    failure_code: 'card_expired',
    failure_reason: 'Card expired at end of month',
    segment: 'SMB',
    consent_status: false,
    dnc_flag: false,
    hardship_flag: false,
    billing_hold: false,
    notes: 'Standard customer account.',
    persona_scenario: 'expired_card_cooperative'
  };

  const [formData, setFormData] = useState(defaultFormState);

  const openCustomerDetail = async (customer: Customer) => {
    setViewingCustomer(customer);
    setExpandedCallId(null);
    setIsLoadingCalls(true);
    try {
      const res = await fetch(`/api/customers/${customer.id}/calls`);
      if (res.ok) {
        const calls: CallSession[] = await res.json();
        setCustomerCalls(calls);
      } else {
        setCustomerCalls(customer.callSessions || []);
      }
    } catch {
      setCustomerCalls(customer.callSessions || []);
    } finally {
      setIsLoadingCalls(false);
    }
  };

  const openAddModal = () => {
    setModalMode('add');
    setSelectedCustomerId(null);
    setFormData(defaultFormState);
    setFormErrors([]);
    setIsModalOpen(true);
  };

  const openEditModal = (customer: Customer) => {
    setModalMode('edit');
    setSelectedCustomerId(customer.id);
    setFormData({
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      language: customer.language,
      timezone: customer.timezone,
      plan: customer.plan,
      amount_due: customer.amount_due,
      currency: customer.currency,
      due_date: customer.due_date,
      last4: (customer as any).last4 || '4242',
      zip_code: (customer as any).zip_code || '560001',
      failure_code: customer.failure_code,
      failure_reason: customer.failure_reason,
      segment: customer.segment,
      consent_status: customer.consent_status,
      dnc_flag: customer.dnc_flag,
      hardship_flag: customer.hardship_flag,
      billing_hold: customer.billing_hold,
      notes: customer.notes,
      persona_scenario: customer.persona_scenario
    });
    setFormErrors([]);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFormErrors([]);

    try {
      const url = modalMode === 'add' ? '/api/customers' : `/api/customers/${selectedCustomerId}`;
      const method = modalMode === 'add' ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.errors) {
          setFormErrors(data.errors);
        } else {
          setFormErrors([{ field: 'general', message: data.error || 'Failed to save customer' }]);
        }
        return;
      }

      await onRefreshCustomers();
      setIsModalOpen(false);
    } catch (err: any) {
      setFormErrors([{ field: 'general', message: err.message || 'Network error occurred' }]);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await onRefreshCustomers();
        if (viewingCustomer?.id === id) {
          setViewingCustomer(null);
        }
        setToastMessage(`Customer ${name} permanently removed.`);
        setTimeout(() => setToastMessage(null), 4000);
      } else {
        const data = await res.json().catch(() => ({}));
        setToastMessage(data.error || 'Failed to delete customer');
        setTimeout(() => setToastMessage(null), 4000);
      }
    } catch (err: any) {
      setToastMessage(err.message || 'Network error while deleting customer');
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  // Filter customers
  const filteredCustomers = customers.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.plan.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterStatus === 'unpaid') return c.amount_due > 0;
    if (filterStatus === 'paid') return c.amount_due === 0;
    if (filterStatus === 'dnc') return c.dnc_flag;
    if (filterStatus === 'hardship') return c.hardship_flag;

    return true;
  });

  return (
    <div className="space-y-6 text-white font-sans">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="p-4 rounded-2xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-200 text-sm flex items-center justify-between shadow-lg">
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-cyan-400 hover:text-white text-xs px-2 py-1 rounded bg-cyan-900/50 hover:bg-cyan-800 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 1. Top Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <h2 className="text-xl font-bold text-white flex items-center space-x-2">
              <Users className="w-6 h-6 text-cyan-400" />
              <span>Customer Portfolio Management</span>
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              {customers.length} Accounts
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time debtor ledger with compliance locks, payment verification factors, and chronological call history.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-semibold text-xs flex items-center space-x-2 shadow-lg shadow-cyan-500/20 transition-all hover:scale-105 self-start md:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add New Customer</span>
        </button>
      </div>

      {/* 2. Search & Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Quick Filters */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'all', label: `All (${customers.length})` },
              { id: 'unpaid', label: `Unpaid (${customers.filter((c) => c.amount_due > 0).length})` },
              { id: 'paid', label: `Paid (${customers.filter((c) => c.amount_due === 0).length})` },
              { id: 'dnc', label: `DNC Blocked (${customers.filter((c) => c.dnc_flag).length})` },
              { id: 'hardship', label: `Hardship Relief (${customers.filter((c) => c.hardship_flag).length})` }
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterStatus(f.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  filterStatus === f.id
                    ? 'bg-cyan-500 text-slate-950 shadow-sm'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, phone, email, plan..."
              className="w-full pl-9 pr-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* Customer Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-800">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">Customer Details</th>
                <th className="py-3.5 px-4">Plan & Segment</th>
                <th className="py-3.5 px-4">Balance Due</th>
                <th className="py-3.5 px-4">Autopay Failure Issue</th>
                <th className="py-3.5 px-4">Call Activity</th>
                <th className="py-3.5 px-4">Security Factors</th>
                <th className="py-3.5 px-4">Status Flags</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 bg-slate-900/60">
              {filteredCustomers.map((c) => {
                const callCount = c.callSessions?.length || (c.id === 'cust_001' ? 1 : c.id === 'cust_002' ? 1 : c.id === 'cust_007' ? 1 : 0);
                return (
                  <tr
                    key={c.id}
                    onClick={() => openCustomerDetail(c)}
                    className="hover:bg-slate-800/50 cursor-pointer transition-colors group"
                  >
                    {/* Customer Info */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-white block text-sm group-hover:text-cyan-300 transition-colors">
                          {c.name}
                        </span>
                        <Eye className="w-3.5 h-3.5 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <span className="text-slate-400 font-mono text-[11px] block">{c.phone}</span>
                      <span className="text-slate-500 text-[11px] block">{c.email}</span>
                    </td>

                    {/* Plan & Segment */}
                    <td className="py-3.5 px-4 text-slate-300">
                      <span className="font-semibold text-slate-200 block">{c.plan}</span>
                      <span className="text-xs text-cyan-400">{c.segment} Tier • {c.timezone.split('/')[1] || c.timezone}</span>
                    </td>

                    {/* Balance Due */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {c.amount_due === 0 ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          PAID (₹0)
                        </span>
                      ) : (
                        <span className="font-mono font-bold text-sm text-white block">
                          {c.currency} {c.amount_due.toLocaleString()}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-500 font-mono block mt-0.5">Due: {c.due_date}</span>
                    </td>

                    {/* Failure Issue */}
                    <td className="py-3.5 px-4 max-w-xs">
                      <span className="text-amber-300 font-medium block truncate" title={c.failure_reason}>
                        {c.failure_reason}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono block">Code: {c.failure_code}</span>
                    </td>

                    {/* Call Activity Badge */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border inline-flex items-center space-x-1 ${
                        callCount > 0
                          ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}>
                        <History className="w-3 h-3" />
                        <span>{callCount} {callCount === 1 ? 'Past Call' : 'Past Calls'}</span>
                      </span>
                    </td>

                    {/* Security Factors */}
                    <td className="py-3.5 px-4 whitespace-nowrap font-mono text-[11px] text-slate-300">
                      <div>Card: <span className="text-cyan-400 font-semibold">{(c as any).last4_masked || '•••• ' + ((c as any).last4 || '4242')}</span></div>
                      <div>ZIP: <span className="text-slate-400">{(c as any).zip_code || '••••'}</span></div>
                    </td>

                    {/* Status Flags */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1 items-start">
                        {c.dnc_flag && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                            DNC ENFORCED
                          </span>
                        )}
                        {c.hardship_flag && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                            RELIEF HARDSHIP
                          </span>
                        )}
                        {c.billing_hold && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            HOLD (7 DAYS)
                          </span>
                        )}
                        {!c.dnc_flag && !c.hardship_flag && !c.billing_hold && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            CLEARED
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => openCustomerDetail(c)}
                          title="View Customer Profile & Call History"
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-cyan-950 text-slate-300 hover:text-cyan-400 border border-slate-700 transition-colors"
                        >
                          <History className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => onSelectCustomerForCall(c)}
                          title="Open in Ava Voice Studio"
                          className="p-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 transition-colors"
                        >
                          <Phone className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => openEditModal(c)}
                          title="Edit Customer Details"
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-white border border-slate-700 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleDelete(c.id, c.name)}
                          title="Delete Customer"
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-900/60 text-slate-400 hover:text-red-400 border border-slate-700 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. CUSTOMER DETAIL & CHRONOLOGICAL CALL SESSIONS DRAWER / MODAL */}
      {viewingCustomer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl relative text-white my-6 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 p-6 border-b border-slate-800 flex items-start justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center font-bold text-lg text-white shadow-lg shadow-cyan-500/20">
                  {viewingCustomer.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center space-x-2.5">
                    <h3 className="text-lg font-bold text-white">{viewingCustomer.name}</h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-cyan-400 border border-slate-700">
                      {viewingCustomer.id}
                    </span>
                    {viewingCustomer.dnc_flag ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                        DNC BLOCKED
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        CONSENT VERIFIED
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1 font-mono">
                    <span>{viewingCustomer.phone}</span>
                    <span>•</span>
                    <span>{viewingCustomer.email}</span>
                    <span>•</span>
                    <span>{viewingCustomer.timezone}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    const c = viewingCustomer;
                    setViewingCustomer(null);
                    onSelectCustomerForCall(c);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center space-x-1.5 shadow-md shadow-emerald-600/20 transition-all"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call With Ava Now</span>
                </button>
                <button
                  onClick={() => setViewingCustomer(null)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="p-6 space-y-6 overflow-y-auto">
              {/* Account Quick Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl">
                  <span className="text-slate-400 block text-[11px]">Subscription Plan</span>
                  <span className="font-semibold text-white mt-0.5 block truncate">{viewingCustomer.plan}</span>
                  <span className="text-[10px] text-cyan-400 font-mono mt-0.5 block">{viewingCustomer.segment} Tier</span>
                </div>

                <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl">
                  <span className="text-slate-400 block text-[11px]">Outstanding Balance</span>
                  <span className="font-bold text-white text-sm mt-0.5 block font-mono">
                    {viewingCustomer.amount_due === 0 ? (
                      <span className="text-emerald-400">PAID (₹0)</span>
                    ) : (
                      `${viewingCustomer.currency} ${viewingCustomer.amount_due.toLocaleString()}`
                    )}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">Due Date: {viewingCustomer.due_date}</span>
                </div>

                <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl">
                  <span className="text-slate-400 block text-[11px]">Autopay Failure</span>
                  <span className="font-semibold text-amber-300 mt-0.5 block truncate" title={viewingCustomer.failure_reason}>
                    {viewingCustomer.failure_reason}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">Code: {viewingCustomer.failure_code}</span>
                </div>

                <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl">
                  <span className="text-slate-400 block text-[11px]">Verification Factors</span>
                  <span className="font-mono text-cyan-300 mt-0.5 block font-semibold">
                    Card: {(viewingCustomer as any).last4_masked || '•••• ' + ((viewingCustomer as any).last4 || '4242')}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                    ZIP: {(viewingCustomer as any).zip_code || '••••'}
                  </span>
                </div>
              </div>

              {/* CHRONOLOGICAL CALL SESSIONS TIMELINE */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center space-x-2">
                    <History className="w-5 h-5 text-cyan-400" />
                    <h4 className="text-sm font-bold text-white">Chronological Call Session History</h4>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                      {customerCalls.length} Recorded
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">Ordered by date (most recent first)</span>
                </div>

                {isLoadingCalls ? (
                  <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
                    <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                    <span className="text-xs">Loading call sessions...</span>
                  </div>
                ) : customerCalls.length === 0 ? (
                  <div className="py-10 px-4 bg-slate-950/50 border border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center space-y-2.5">
                    <Clock className="w-8 h-8 text-slate-600" />
                    <p className="text-xs text-slate-300 font-medium">No previous call sessions recorded for this customer.</p>
                    <p className="text-[11px] text-slate-400 max-w-md">
                      When Ava completes an autonomous recovery call or when tests are executed, full transcripts, duration, verification status, and outcomes will appear here chronologically.
                    </p>
                    <button
                      onClick={() => {
                        const c = viewingCustomer;
                        setViewingCustomer(null);
                        onSelectCustomerForCall(c);
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs flex items-center space-x-1.5 transition-all shadow-md shadow-cyan-600/20 mt-1"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Start Voice Call Now</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {customerCalls.map((session, index) => {
                      const isExpanded = expandedCallId === session.id;
                      const hasOutcome = Boolean(session.outcome);
                      const outcomeType = session.outcome?.outcome || session.state.toLowerCase();

                      return (
                        <div
                          key={session.id}
                          className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-sm transition-all hover:border-slate-700"
                        >
                          {/* Call Summary Bar */}
                          <div
                            onClick={() => setExpandedCallId(isExpanded ? null : session.id)}
                            className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer bg-slate-900/60 hover:bg-slate-900 transition-colors"
                          >
                            <div className="flex items-start sm:items-center space-x-3">
                              <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5 sm:mt-0">
                                <Phone className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="flex items-center space-x-2">
                                  <span className="font-bold text-xs text-white">
                                    Call Session #{customerCalls.length - index}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono">({session.id})</span>
                                  {session.outcome?.sentiment && (
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                      session.outcome.sentiment === 'positive'
                                        ? 'bg-emerald-500/20 text-emerald-300'
                                        : session.outcome.sentiment === 'relieved'
                                        ? 'bg-cyan-500/20 text-cyan-300'
                                        : session.outcome.sentiment === 'frustrated'
                                        ? 'bg-amber-500/20 text-amber-300'
                                        : 'bg-slate-800 text-slate-300'
                                    }`}>
                                      {session.outcome.sentiment}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-0.5 font-mono">
                                  <span>{new Date(session.startedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                  <span>•</span>
                                  <span>{new Date(session.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                  <span>•</span>
                                  <span className="text-cyan-400">{session.durationSeconds}s duration</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center space-x-2.5 self-end sm:self-auto">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                                outcomeType === 'paid_live'
                                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                  : outcomeType === 'promise_to_pay' || outcomeType === 'payment_plan_agreed'
                                  ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                                  : outcomeType === 'wrong_person' || outcomeType === 'do_not_call'
                                  ? 'bg-red-500/15 text-red-300 border-red-500/30'
                                  : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                              }`}>
                                {outcomeType.replace(/_/g, ' ').toUpperCase()}
                              </span>

                              <div className="p-1 rounded-lg bg-slate-800 text-slate-400">
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </div>
                            </div>
                          </div>

                          {/* Expanded Details: Verification, Executive Summary & Transcript */}
                          {isExpanded && (
                            <div className="p-4 border-t border-slate-800 space-y-4 text-xs bg-slate-950/70">
                              {/* 1. Verification & Outcome Audit */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 space-y-1.5">
                                  <span className="font-semibold text-slate-300 block text-[11px]">Identity Verification Audit</span>
                                  <div className="flex items-center justify-between text-slate-400">
                                    <span>Name Confirmed:</span>
                                    <span className="font-semibold text-white">
                                      {session.identityVerification?.nameConfirmed ? 'Yes ✓' : 'No ✗'}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between text-slate-400">
                                    <span>Factor Tested:</span>
                                    <span className="font-mono text-cyan-400">
                                      {session.identityVerification?.factorChecked ? session.identityVerification.factorChecked.toUpperCase() : 'None'}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between text-slate-400">
                                    <span>Factor Result:</span>
                                    <span className={`font-semibold ${session.identityVerification?.factorVerified ? 'text-emerald-400' : 'text-amber-400'}`}>
                                      {session.identityVerification?.factorVerified ? 'Passed ✓' : 'Failed / Incomplete ✗'}
                                    </span>
                                  </div>
                                </div>

                                <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 space-y-1.5">
                                  <span className="font-semibold text-slate-300 block text-[11px]">Outcome & Action</span>
                                  <div className="text-slate-300">
                                    <span className="text-slate-400 block text-[10px]">Executive Summary:</span>
                                    <p className="mt-0.5 leading-relaxed">
                                      {session.outcome?.executiveSummary || `Call completed with final state ${session.state}.`}
                                    </p>
                                  </div>
                                  {session.outcome?.nextAction && (
                                    <div className="pt-1 border-t border-slate-800/60 text-[11px]">
                                      <span className="text-slate-400">Next Action: </span>
                                      <span className="text-cyan-300 font-semibold">{session.outcome.nextAction}</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* 2. Tool Calls during session */}
                              {session.toolLogs && session.toolLogs.length > 0 && (
                                <div className="space-y-1.5">
                                  <span className="text-[11px] font-semibold text-slate-400 flex items-center space-x-1">
                                    <Wrench className="w-3.5 h-3.5 text-cyan-400" />
                                    <span>Tools Executed During Call ({session.toolLogs.length}):</span>
                                  </span>
                                  <div className="space-y-1">
                                    {session.toolLogs.map((tool) => (
                                      <div key={tool.id} className="p-2 bg-slate-900 rounded-lg border border-slate-800 flex items-center justify-between text-[11px] font-mono">
                                        <span className="text-cyan-400 font-semibold">{tool.tool}()</span>
                                        <span className={`px-2 py-0.5 rounded text-[10px] ${
                                          tool.status === 'success' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
                                        }`}>
                                          {tool.status}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* 3. Transcript */}
                              <div className="space-y-2">
                                <span className="text-[11px] font-semibold text-slate-400 flex items-center space-x-1">
                                  <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
                                  <span>Full Call Transcript ({session.messages?.length || 0} Turns):</span>
                                </span>
                                <div className="space-y-2 max-h-60 overflow-y-auto p-3 bg-slate-900/90 rounded-xl border border-slate-800">
                                  {session.messages && session.messages.length > 0 ? (
                                    session.messages.map((m) => {
                                      const isAva = m.sender === 'ava';
                                      return (
                                        <div key={m.id} className={`flex flex-col ${isAva ? 'items-start' : 'items-end'}`}>
                                          <div className="flex items-center space-x-1.5 text-[10px] text-slate-400 mb-0.5">
                                            <span className="font-bold text-slate-300">{isAva ? 'Ava' : viewingCustomer.name}</span>
                                            {m.state && (
                                              <span className="px-1.5 py-0.2 rounded bg-slate-800 text-cyan-400 font-mono">
                                                {m.state}
                                              </span>
                                            )}
                                          </div>
                                          <div
                                            className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                                              isAva
                                                ? 'bg-slate-800 text-slate-200 border border-slate-700'
                                                : 'bg-cyan-900/40 text-cyan-100 border border-cyan-700/40'
                                            }`}
                                          >
                                            {m.text}
                                          </div>
                                        </div>
                                      );
                                    })
                                  ) : (
                                    <p className="text-slate-500 italic text-center py-2">No transcript turns logged.</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Modal Dialog for Add / Edit Customer */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl relative text-white my-6">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
                  {modalMode === 'add' ? (
                    <UserPlus className="w-5 h-5 text-cyan-400" />
                  ) : (
                    <Edit2 className="w-5 h-5 text-cyan-400" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {modalMode === 'add' ? 'Add New Customer Account' : 'Edit Customer Account'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {modalMode === 'add' ? 'Register a debtor account with verification credentials' : 'Update contact, billing, and regulatory status'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {formErrors.length > 0 && (
                <div className="p-3 bg-red-500/20 border border-red-500/40 rounded-xl text-xs text-red-200 space-y-1">
                  <div className="font-bold flex items-center space-x-1">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <span>Please correct the following errors:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5">
                    {formErrors.map((err, i) => (
                      <li key={i}>{err.message}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Personal Info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Phone Number (E.164) *</label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+919876543210"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="name@example.com"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Billing Info */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Subscription Plan *</label>
                  <input
                    type="text"
                    required
                    value={formData.plan}
                    onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
                    placeholder="NimbusFlow Growth Cloud"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Amount Due (INR) *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.amount_due}
                    onChange={(e) => setFormData({ ...formData, amount_due: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Due Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Security Factors */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center space-x-2 text-xs font-bold text-cyan-400">
                  <Lock className="w-4 h-4" />
                  <span>Outbound Voice Verification Credentials (Stored Securely)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Last 4 Card Digits *</label>
                    <input
                      type="text"
                      maxLength={4}
                      pattern="[0-9]{4}"
                      required
                      value={formData.last4}
                      onChange={(e) => setFormData({ ...formData, last4: e.target.value })}
                      placeholder="4242"
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Billing ZIP / PIN Code *</label>
                    <input
                      type="text"
                      required
                      value={formData.zip_code}
                      onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                      placeholder="560001"
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Customer Timezone *</label>
                    <select
                      value={formData.timezone}
                      onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
                    >
                      <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                      <option value="America/New_York">America/New_York (EDT)</option>
                      <option value="America/Chicago">America/Chicago (CDT)</option>
                      <option value="America/Los_Angeles">America/Los_Angeles (PDT)</option>
                      <option value="Europe/London">Europe/London (BST)</option>
                      <option value="Europe/Berlin">Europe/Berlin (CET)</option>
                      <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Failure Context */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Failure Code</label>
                  <select
                    value={formData.failure_code}
                    onChange={(e) => setFormData({ ...formData, failure_code: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
                  >
                    <option value="card_expired">card_expired (Card expired)</option>
                    <option value="insufficient_funds">insufficient_funds (Insufficient balance)</option>
                    <option value="bank_fraud_block">bank_fraud_block (Bank automated fraud filter)</option>
                    <option value="generic_decline">generic_decline (Issuer decline)</option>
                    <option value="disputed_charge">disputed_charge (Customer disputes charge)</option>
                    <option value="account_closed">account_closed (Bank account closed)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Failure Reason Summary</label>
                  <input
                    type="text"
                    value={formData.failure_reason}
                    onChange={(e) => setFormData({ ...formData, failure_reason: e.target.value })}
                    placeholder="Card expired at end of month"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Status Toggles */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.consent_status}
                      onChange={(e) => setFormData({ ...formData, consent_status: e.target.checked })}
                      className="rounded bg-slate-800 border-slate-700 text-cyan-500"
                    />
                    <span className="text-xs text-slate-300 font-semibold">Consent Active</span>
                  </label>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.dnc_flag}
                      onChange={(e) => setFormData({ ...formData, dnc_flag: e.target.checked })}
                      className="rounded bg-slate-800 border-slate-700 text-red-500"
                    />
                    <span className="text-xs text-red-400 font-semibold">Do Not Call (DNC)</span>
                  </label>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.hardship_flag}
                      onChange={(e) => setFormData({ ...formData, hardship_flag: e.target.checked })}
                      className="rounded bg-slate-800 border-slate-700 text-indigo-500"
                    />
                    <span className="text-xs text-indigo-400 font-semibold">Hardship Relief</span>
                  </label>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.billing_hold}
                      onChange={(e) => setFormData({ ...formData, billing_hold: e.target.checked })}
                      className="rounded bg-slate-800 border-slate-700 text-amber-500"
                    />
                    <span className="text-xs text-amber-400 font-semibold">Billing Hold</span>
                  </label>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Notes & Persona Brief</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Context for agent Ava..."
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-semibold text-xs flex items-center space-x-2 shadow-lg shadow-cyan-500/20 disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>{modalMode === 'add' ? 'Create Customer' : 'Update Customer'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
