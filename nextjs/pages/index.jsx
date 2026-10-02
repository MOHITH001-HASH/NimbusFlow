import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function NextDashboard() {
  const [customers, setCustomers] = useState([]);
  const [user, setUser] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(d => {
        if (d.authenticated) setUser(d.user);
      })
      .catch(() => {});

    fetch('/api/customers')
      .then(res => res.json())
      .then(data => setCustomers(data))
      .catch(() => {});
  }, []);

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.plan.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-800 bg-slate-900/90 h-16 flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center space-x-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center font-bold text-white shadow-lg">
            N
          </div>
          <div>
            <span className="font-bold text-lg text-white">NimbusFlow</span>
            <span className="ml-2 px-2 py-0.5 text-xs font-semibold rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              Next.js & React (Pure JS)
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-4 text-xs">
          {user ? (
            <span className="text-emerald-400 font-bold">{user} (Active)</span>
          ) : (
            <Link href="/login" className="text-cyan-400 hover:underline">
              Operator Sign In
            </Link>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
          <div>
            <h2 className="text-xl font-bold text-white">Delinquent Account Portfolio (Next.js)</h2>
            <p className="text-xs text-slate-400 mt-1">Autonomous AutoPay Voice Recovery Studio</p>
          </div>
          <input
            type="text"
            placeholder="Search accounts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs w-64 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => (
            <div key={c.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-bold text-white text-sm">{c.name}</h4>
                  <p className="text-xs text-slate-400">{c.plan}</p>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${c.amount_due > 0 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                  {c.amount_due > 0 ? `${c.currency} ${c.amount_due.toLocaleString()}` : 'PAID'}
                </span>
              </div>
              <div className="text-xs space-y-1 text-slate-300">
                <div className="flex justify-between"><span className="text-slate-500">Phone:</span> <span>{c.phone}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Card on File:</span> <span>•••• {c.last4}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Failure:</span> <span className="text-amber-300">{c.failure_reason}</span></div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
