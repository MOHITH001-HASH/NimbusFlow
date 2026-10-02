import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, PhoneCall, ShieldAlert, CheckCircle2, Clock, Calendar, Users } from 'lucide-react';
import { Customer } from '../types';

interface DashboardMetricsProps {
  customers: Customer[];
  onSelectCustomer: (c: Customer) => void;
  onOpenCallStudio: () => void;
}

export const DashboardMetrics: React.FC<DashboardMetricsProps> = ({ customers, onSelectCustomer, onOpenCallStudio }) => {
  const [stats, setStats] = useState<any>({
    totalCustomers: 10,
    dncCount: 1,
    paidCount: 0,
    totalAmount: 66696,
    recoveredAmount: 0,
    recoveryRate: 0,
    callsHandled: 0,
    promisesCount: 0,
    plansCount: 0,
    escalationsCount: 0
  });

  useEffect(() => {
    fetch('/api/stats')
      .then((res) => res.json())
      .then((data) => setStats(data))
      .catch((e) => console.warn('Stats fetch:', e));
  }, [customers]);

  const totalBalance = customers.reduce((acc, c) => acc + c.amount_due, 0);

  return (
    <div className="space-y-6 text-white">
      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Recovered */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Total Recovered</span>
              <h3 className="text-2xl font-bold text-emerald-400 mt-1">₹{stats.recoveredAmount.toLocaleString()}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-3 flex items-center space-x-1">
            <span className="text-emerald-400 font-semibold">{stats.recoveryRate}% Recovery Rate</span>
            <span>of ₹{stats.totalAmount.toLocaleString()} delinquent</span>
          </p>
        </div>

        {/* Calls Handled */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Calls Conducted</span>
              <h3 className="text-2xl font-bold text-cyan-400 mt-1">{stats.callsHandled} Calls</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <PhoneCall className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-3">Avg Handle Time: <strong className="text-white">1m 45s</strong></p>
        </div>

        {/* Promises & Plans */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Arranged Resolutions</span>
              <h3 className="text-2xl font-bold text-indigo-400 mt-1">{stats.promisesCount + stats.plansCount} Agreements</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-indigo-400" />
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-3">
            {stats.promisesCount} Promises to Pay • {stats.plansCount} Relief Plans
          </p>
        </div>

        {/* DNC & Compliance */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">DNC Opt-Outs</span>
              <h3 className="text-2xl font-bold text-amber-400 mt-1">{stats.dncCount} Customer</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
            </div>
          </div>
          <p className="text-xs text-emerald-400 mt-3 font-medium">100% Registry Honoring Rate</p>
        </div>
      </div>

      {/* Customer Recovery Roster Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-2">
          <div>
            <h3 className="text-base font-bold text-white">Delinquent Autopay Portfolio (10 Accounts)</h3>
            <p className="text-xs text-slate-400">Click any row to load into Ava Voice Studio</p>
          </div>
          <button
            onClick={onOpenCallStudio}
            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-semibold text-white transition-colors"
          >
            Launch Voice Studio
          </button>
        </div>

        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                <th className="pb-3 px-3">Customer</th>
                <th className="pb-3 px-3">Plan / Tier</th>
                <th className="pb-3 px-3">Balance</th>
                <th className="pb-3 px-3">Failure Reason</th>
                <th className="pb-3 px-3">Card / Post</th>
                <th className="pb-3 px-3">Status</th>
                <th className="pb-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-3 font-semibold text-white">
                    <div>{c.name}</div>
                    <span className="text-[10px] text-slate-400 font-mono">{c.phone}</span>
                  </td>
                  <td className="py-3 px-3 text-slate-300">
                    <div>{c.plan}</div>
                    <span className="text-[10px] text-slate-500">{c.segment} Tier</span>
                  </td>
                  <td className="py-3 px-3 font-mono font-semibold">
                    {c.amount_due === 0 ? (
                      <span className="text-emerald-400">PAID (₹0)</span>
                    ) : (
                      <span className="text-white">₹{c.amount_due.toLocaleString()}</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-amber-300 max-w-[200px] truncate" title={c.failure_reason}>
                    {c.failure_reason}
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-400">
                    •••• {c.last4} ({c.zip_code})
                  </td>
                  <td className="py-3 px-3">
                    {c.dnc_flag ? (
                      <span className="px-2 py-0.5 rounded text-[10px] bg-red-500/20 text-red-400 border border-red-500/30">
                        DNC Requested
                      </span>
                    ) : c.amount_due === 0 ? (
                      <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        Recovered
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                        Pending Call
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button
                      onClick={() => {
                        onSelectCustomer(c);
                        onOpenCallStudio();
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-medium border border-slate-700"
                    >
                      Call Ava
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
