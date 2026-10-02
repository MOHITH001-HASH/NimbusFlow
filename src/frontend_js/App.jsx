import React, { useState, useEffect } from 'react';
import { Login } from './Login.jsx';
import { CustomerList } from './CustomerList.jsx';
import { VoiceSimulator } from './VoiceSimulator.jsx';
import { EvalsRunner } from './EvalsRunner.jsx';
import { checkSession, logout, getAuditLogs } from './api.js';

export function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('customers');
  const [selectedCustForDial, setSelectedCustForDial] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);

  useEffect(() => {
    checkSession().then(data => {
      if (data.authenticated) {
        setCurrentUser(data.user);
      }
    }).catch(() => {});
  }, []);

  const handleDialCustomer = (cust) => {
    setSelectedCustForDial(cust);
    setActiveTab('simulator');
  };

  const handleLogout = async () => {
    await logout();
    setCurrentUser(null);
  };

  const loadAudit = async () => {
    const logs = await getAuditLogs();
    setAuditLogs(logs);
  };

  if (!currentUser) {
    return <Login onLoginSuccess={(u) => setCurrentUser(u)} />;
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 font-sans">
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-cyan-500/20">
              N
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg text-white">NimbusFlow</span>
                <span className="px-2 py-0.5 text-xs font-semibold rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  React + JavaScript
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Autonomous AutoPay Voice Recovery Studio</p>
            </div>
          </div>

          <nav className="hidden md:flex space-x-1 bg-slate-800/60 p-1 rounded-xl border border-slate-700/50">
            <button
              onClick={() => setActiveTab('customers')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeTab === 'customers' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'}`}
            >
              Customers
            </button>
            <button
              onClick={() => setActiveTab('simulator')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeTab === 'simulator' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'}`}
            >
              Ava Voice Simulator
            </button>
            <button
              onClick={() => setActiveTab('evals')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeTab === 'evals' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'}`}
            >
              Compliance Evals
            </button>
            <button
              onClick={() => { setActiveTab('audit'); loadAudit(); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeTab === 'audit' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'}`}
            >
              Audit Trail
            </button>
          </nav>

          <div className="flex items-center space-x-3 text-xs">
            <span className="text-emerald-400 font-bold">{currentUser}</span>
            <button
              onClick={handleLogout}
              className="text-slate-500 hover:text-white underline"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8">
        {activeTab === 'customers' && <CustomerList onSelectForDial={handleDialCustomer} />}
        {activeTab === 'simulator' && <VoiceSimulator selectedCustomer={selectedCustForDial} />}
        {activeTab === 'evals' && <EvalsRunner />}
        {activeTab === 'audit' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h2 className="text-xl font-bold text-white">Immutable Regulatory Audit Trail</h2>
              <p className="text-xs text-slate-400 mt-1">Every verification attempt, payment link dispatch, and dial outcome.</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3 text-xs">
              {auditLogs.map((l, i) => (
                <div key={i} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-cyan-400 font-mono">{l.event_type}</span>
                    <pre className="text-[11px] text-slate-400 mt-1">{JSON.stringify(l.details)}</pre>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">{l.timestamp}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
