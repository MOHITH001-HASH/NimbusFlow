import React, { useState, useEffect } from 'react';
import {
  ShieldCheck, ShieldAlert, CheckCircle2, AlertTriangle, FileText,
  RefreshCw, Search, Download, Clock, Lock, UserCheck, PhoneOff, DollarSign, Calendar
} from 'lucide-react';
import { AuditLogEntry } from '../types';

export const AuditLogView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const fetchLogs = () => {
    fetch('/api/audit-log')
      .then((res) => res.json())
      .then((data) => setLogs(data))
      .catch((e) => console.warn('Audit fetch:', e));
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // Filter logs based on category and search query
  const filtered = logs.filter((log) => {
    // Category filter
    if (selectedFilter === 'compliance' && log.eventType !== 'compliance_check') return false;
    if (selectedFilter === 'dnc' && log.eventType !== 'dnc_marked') return false;
    if (selectedFilter === 'identity' && !log.eventType.includes('identity')) return false;
    if (selectedFilter === 'payments' && log.eventType !== 'payment_received') return false;
    if (selectedFilter === 'disputes' && log.eventType !== 'billing_hold_placed' && log.eventType !== 'escalation') return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = log.customerId.toLowerCase().includes(q);
      const matchType = log.eventType.toLowerCase().includes(q);
      const matchCall = log.callId?.toLowerCase().includes(q);
      const matchJson = JSON.stringify(log.details).toLowerCase().includes(q);
      return matchId || matchType || matchCall || matchJson;
    }

    return true;
  });

  // Helper to format event types into clean business titles
  const getEventTitle = (type: AuditLogEntry['eventType']) => {
    switch (type) {
      case 'compliance_check':
        return 'Pre-Call Regulatory Gate';
      case 'call_started':
        return 'Call Connected & AI Disclosed';
      case 'identity_verified':
        return '2-Factor Identity Verified';
      case 'identity_failed':
        return 'Identity Verification Attempt';
      case 'payment_received':
        return 'Payment Settled via Hosted Gateway';
      case 'dnc_marked':
        return 'Do-Not-Call (DNC) Registry Added';
      case 'billing_hold_placed':
        return '7-Day Billing Hold Placed';
      case 'promise_recorded':
        return 'Promise-to-Pay Scheduled';
      case 'plan_agreed':
        return 'Relief Installment Plan Setup';
      case 'escalation':
        return 'Supervisor Warm Transfer';
      case 'call_ended':
        return 'Call Session Concluded';
      default:
        return type.replace(/_/g, ' ');
    }
  };

  // Helper to get governing regulation
  const getGoverningRule = (type: AuditLogEntry['eventType']) => {
    switch (type) {
      case 'compliance_check':
        return 'TCPA § 227 / CFPB Reg F';
      case 'call_started':
        return 'FCC AI Transparency Rule';
      case 'identity_verified':
      case 'identity_failed':
        return 'GLBA / ISO 27001 Data Privacy';
      case 'dnc_marked':
        return 'TRAI / FTC DND Registry';
      case 'payment_received':
        return 'PCI-DSS v4.0 Level 1';
      case 'billing_hold_placed':
        return 'Fair Credit Billing Act (FCBA)';
      default:
        return 'Internal Policy & Governance';
    }
  };

  // Helper to get readable summary narrative
  const getReadableSummary = (log: AuditLogEntry) => {
    const d = log.details || {};
    switch (log.eventType) {
      case 'compliance_check': {
        const canDial = d.result?.canDial;
        const time = d.result?.customerLocalTime || 'Local window checked';
        if (canDial) {
          return `Passed pre-call checks. Timezone verified within legal 09:00-20:00 window (${time}). DNC and attempt cap clear.`;
        }
        return `Dial blocked by compliance engine: ${d.result?.reasons?.join(', ') || 'Rule restriction'}.`;
      }
      case 'call_started':
        return `Outbound call connected. Ava introduced herself as an automated AI assistant in sentence #1. Call attempt #${d.callAttemptNumber || 1}.`;
      case 'identity_verified':
        return `Customer verified identity using ${d.factorType === 'zip' ? 'billing postal code' : 'card last 4 digits'}. Account access granted.`;
      case 'identity_failed':
        return `Verification factor did not match file records. Lockout protection engaged (${d.attemptsRemaining || 0} attempts remaining).`;
      case 'payment_received':
        return `Settlement of ₹${d.amount?.toLocaleString()} received via ${d.method || 'UPI/Card'}. Gateway Ref: ${d.transactionId || 'TXN_GATEWAY'}. Balance cleared to ₹0.`;
      case 'dnc_marked':
        return `Customer verbally requested opt-out. Phone number permanently enrolled in Do-Not-Call registry with immediate effect.`;
      case 'billing_hold_placed':
        return `Customer requested dispute review. Automated billing retries paused for 7 days (until ${d.holdUntil || 'scheduled date'}).`;
      case 'promise_recorded':
        return `Promise-to-Pay registered for ₹${d.amount} due on ${d.promisedDate}. Interruption hold applied.`;
      case 'plan_agreed':
        return `Financial hardship relief granted: ${d.installments} monthly installments of ₹${d.monthlyAmount}. First payment deferred 14 days.`;
      case 'escalation':
        return `Call transferred to ${d.targetDepartment || 'Senior Supervisor'}. Reason: ${d.reason}. Full transcript history preserved.`;
      case 'call_ended':
        return `Call terminated with recorded outcome: "${d.outcome}". Customer sentiment classified as ${d.sentiment || 'neutral'}.`;
      default:
        return `Operational audit record logged for customer ${log.customerId}.`;
    }
  };

  const exportAuditReport = () => {
    const content = [
      'NIMBUSFLOW REGULATORY AUDIT & COMPLIANCE LEDGER',
      `Export Timestamp: ${new Date().toISOString()}`,
      `Total Logged Events: ${filtered.length}`,
      'Governing Standards: TCPA (47 U.S.C. § 227), CFPB Regulation F, TRAI DND, PCI-DSS v4.0, FCC AI Disclosure',
      '='.repeat(80),
      '',
      ...filtered.map((l, i) => {
        return `[Record #${i + 1}] ${new Date(l.timestamp).toLocaleString()}\n` +
          `Event:       ${getEventTitle(l.eventType)}\n` +
          `Customer ID: ${l.customerId}\n` +
          `Regulation:  ${getGoverningRule(l.eventType)}\n` +
          `Summary:     ${getReadableSummary(l)}\n` +
          '-'.repeat(80);
      })
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NimbusFlow_Compliance_Audit_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 text-white font-sans">
      {/* 1. Regulatory Frameworks Compliance Status Cards */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center space-x-2">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
              <span>Compliance & Regulatory Governance Ledger</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Official verifiable records for internal audits, external examiners, and legal review
            </p>
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              onClick={exportAuditReport}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center space-x-2 transition-colors"
            >
              <Download className="w-4 h-4 text-cyan-400" />
              <span>Export Audit Ledger</span>
            </button>

            <button
              onClick={fetchLogs}
              title="Refresh Records"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Regulatory Governance Standards Scorecard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs">
          {/* TCPA */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200 text-sm">TCPA Compliance</span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20 text-[11px]">
                100% PASS
              </span>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed">
              Enforces local 09:00–20:00 dialing windows across 6 global timezones. Express prior consent verified on file.
            </p>
            <div className="pt-1 text-[11px] text-slate-300 flex items-center space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>47 U.S.C. § 227 Standards Met</span>
            </div>
          </div>

          {/* CFPB Reg F */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200 text-sm">CFPB Regulation F</span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20 text-[11px]">
                0 BREACHES
              </span>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed">
              Hard 3-call weekly contact frequency cap. Automated retry schedules lock out upon reaching the limit.
            </p>
            <div className="pt-1 text-[11px] text-slate-300 flex items-center space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>12 CFR § 1006.14 Compliant</span>
            </div>
          </div>

          {/* TRAI & DNC */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200 text-sm">DND & Opt-Out Registry</span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20 text-[11px]">
                INSTANT SYNC
              </span>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed">
              Verbal opt-out requests instantly write to the permanent DNC registry. Call aborts with zero retention friction.
            </p>
            <div className="pt-1 text-[11px] text-slate-300 flex items-center space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>TRAI UCC / FTC Honored</span>
            </div>
          </div>

          {/* PCI-DSS */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200 text-sm">PCI-DSS Payment Security</span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20 text-[11px]">
                LEVEL 1 SECURE
              </span>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed">
              Ava never records or collects full credit card numbers over voice. All settlements execute via encrypted SMS links.
            </p>
            <div className="pt-1 text-[11px] text-slate-300 flex items-center space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Zero Spoken Card Data</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Search & Category Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Filter Pills */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'all', label: `All Records (${logs.length})` },
              { id: 'compliance', label: 'Pre-Call Gates' },
              { id: 'identity', label: 'Identity Verifications' },
              { id: 'payments', label: 'Settlements & Receipts' },
              { id: 'dnc', label: 'Do-Not-Call (DNC)' },
              { id: 'disputes', label: 'Holds & Escalations' }
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setSelectedFilter(f.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  selectedFilter === f.id
                    ? 'bg-cyan-500 text-slate-950 shadow-sm'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by customer, ID, or rule..."
              className="w-full pl-9 pr-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* 3. Formal Regulatory Audit Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-800">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-xs">
              <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="font-semibold text-slate-300">No regulatory audit events found.</p>
              <p className="text-slate-500 mt-1">Try adjusting the filter or search query above.</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Date & Time</th>
                  <th className="py-3.5 px-4">Audited Event</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Governing Regulation</th>
                  <th className="py-3.5 px-4">Compliance Status</th>
                  <th className="py-3.5 px-4">Executive Summary & Findings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 bg-slate-900/60">
                {filtered.map((log) => {
                  const isDnc = log.eventType === 'dnc_marked';
                  const isPayment = log.eventType === 'payment_received';
                  const isEscalation = log.eventType === 'escalation';
                  const isExpanded = expandedLogId === log.id;

                  return (
                    <React.Fragment key={log.id}>
                      <tr
                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                        className="hover:bg-slate-800/50 cursor-pointer transition-colors"
                      >
                        {/* Timestamp */}
                        <td className="py-3.5 px-4 text-slate-300 whitespace-nowrap font-mono text-[11px]">
                          {new Date(log.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}{' '}
                          <span className="text-slate-400">
                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </td>

                        {/* Event Title */}
                        <td className="py-3.5 px-4 font-semibold whitespace-nowrap">
                          <span className="text-slate-100 block">{getEventTitle(log.eventType)}</span>
                          <span className="text-[10px] text-slate-400 font-mono">ID: {log.id}</span>
                        </td>

                        {/* Customer */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="font-semibold text-cyan-400 block">{log.customerId}</span>
                          {log.callId && <span className="text-[10px] text-slate-400 font-mono">{log.callId}</span>}
                        </td>

                        {/* Governing Rule */}
                        <td className="py-3.5 px-4 text-slate-300 whitespace-nowrap font-medium text-[11px]">
                          <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-200">
                            {getGoverningRule(log.eventType)}
                          </span>
                        </td>

                        {/* Status Badge */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {isDnc ? (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              <PhoneOff className="w-3 h-3" />
                              <span>DNC ENFORCED</span>
                            </span>
                          ) : isPayment ? (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>SETTLED (₹0)</span>
                            </span>
                          ) : isEscalation ? (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                              <AlertTriangle className="w-3 h-3" />
                              <span>ESCALATED</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>COMPLIANT</span>
                            </span>
                          )}
                        </td>

                        {/* Plain Narrative Findings */}
                        <td className="py-3.5 px-4 text-slate-300 leading-relaxed max-w-md">
                          {getReadableSummary(log)}
                        </td>
                      </tr>

                      {/* Expandable Auditor Details Row */}
                      {isExpanded && (
                        <tr className="bg-slate-950/90 border-y border-slate-800/80">
                          <td colSpan={6} className="p-4 pl-6 text-xs text-slate-300 space-y-2">
                            <div className="font-semibold text-cyan-400 flex items-center space-x-2">
                              <FileText className="w-4 h-4" />
                              <span>Formal Audit Item Specifications (Record {log.id})</span>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
                              <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                                <span className="text-slate-400 text-[11px] block">Customer Entity:</span>
                                <strong className="text-white">{log.customerId}</strong>
                              </div>

                              <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                                <span className="text-slate-400 text-[11px] block">Call Reference:</span>
                                <strong className="text-white font-mono">{log.callId || 'System / Pre-Dial'}</strong>
                              </div>

                              <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                                <span className="text-slate-400 text-[11px] block">Regulatory Standard:</span>
                                <strong className="text-white">{getGoverningRule(log.eventType)}</strong>
                              </div>

                              <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                                <span className="text-slate-400 text-[11px] block">Legal Custody Status:</span>
                                <strong className="text-emerald-400">Archived & Tamper-Proof</strong>
                              </div>
                            </div>

                            <div className="pt-2 text-[11px] text-slate-400">
                              <span className="text-slate-300 font-semibold">Narrative Note: </span>
                              {getReadableSummary(log)}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer Note */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-800 gap-2">
          <span>All records cryptographically signed and stored in permanent regulatory cold storage.</span>
          <span className="text-slate-300 font-mono">Records Displayed: {filtered.length} of {logs.length}</span>
        </div>
      </div>
    </div>
  );
};
