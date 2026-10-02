import React, { useState, useEffect } from 'react';
import { getCustomers, dialCall } from './api.js';

export function CustomerList({ onSelectForDial }) {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getCustomers();
      setCustomers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.plan.toLowerCase().includes(search.toLowerCase()) ||
    c.persona_scenario.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div>
          <h2 className="text-xl font-bold text-white">Delinquent Account Portfolio</h2>
          <p className="text-xs text-slate-400 mt-1">
            Pre-call TCPA gate, affirmative consent check, and live Ava outbound recovery dialer.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="text"
            placeholder="Search account, plan, persona..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs w-64 focus:border-cyan-500 focus:outline-none"
          />
          <button
            onClick={loadData}
            className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs hover:text-white"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500 text-xs">Loading customer portfolio...</div>
      ) : (
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
                <div className="flex justify-between"><span className="text-slate-500">Card on File:</span> <span>{c.last4_masked || '•••• ' + c.last4}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Failure:</span> <span className="text-amber-300">{c.failure_reason}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">DNC Registry:</span> <span className={c.dnc_flag ? 'text-rose-400 font-bold' : 'text-slate-400'}>{c.dnc_flag ? 'BLOCKED' : 'Permitted'}</span></div>
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[10px] text-cyan-400 font-mono">{c.persona_scenario}</span>
                <button
                  onClick={() => onSelectForDial(c)}
                  className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-xs font-medium border border-cyan-500/30"
                >
                  Dial (Ava)
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
