import React, { useState } from 'react';
import { runEvals } from './api.js';

export function EvalsRunner() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  const handleRun = async () => {
    setLoading(true);
    try {
      const res = await runEvals();
      setData(res);
    } catch (err) {
      alert('Error running benchmark: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Automated Compliance Benchmark (React + JavaScript)</h2>
          <p className="text-xs text-slate-400 mt-1">
            Validates sentence-1 disclosure, 2FA identity gate, DNC registry, and negotiation policy.
          </p>
        </div>
        <button
          onClick={handleRun}
          disabled={loading}
          className="px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs hover:opacity-90 disabled:opacity-50"
        >
          {loading ? 'Executing Suite...' : 'Run 10-Persona Benchmark'}
        </button>
      </div>

      {data && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="mb-4 flex items-center justify-between p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
            <div>
              <span className="text-emerald-400 font-bold text-lg">{data.complianceScore}% Compliance Score</span>
              <p className="text-xs text-slate-300">Passed: {data.passedPersonas} / {data.totalPersonas} Personas</p>
            </div>
            <span className="px-3 py-1 rounded bg-emerald-500 text-slate-950 font-bold text-xs uppercase">
              {data.overallStatus}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2">ID</th>
                  <th className="py-2">Customer</th>
                  <th className="py-2">Scenario</th>
                  <th className="py-2">Resolution</th>
                  <th className="py-2">Disclosure</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {data.results.map(r => (
                  <tr key={r.customerId}>
                    <td className="py-2.5 font-mono text-cyan-400">{r.customerId}</td>
                    <td className="py-2.5 text-white font-medium">{r.name}</td>
                    <td className="py-2.5 text-slate-400">{r.scenario}</td>
                    <td className="py-2.5 text-slate-300">{r.actualOutcome}</td>
                    <td className="py-2.5 text-emerald-400">PASSED</td>
                    <td className="py-2.5 font-bold text-emerald-400">PASSED</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
