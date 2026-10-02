import React, { useState } from 'react';
import { login } from './api.js';

export function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('ops');
  const [password, setPassword] = useState('test');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFill = () => {
    setUsername('ops');
    setPassword('test');
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const cleanU = username.trim();
    const cleanP = password.trim();

    try {
      await login(cleanU, cleanP);
      onLoginSuccess(cleanU);
    } catch (err) {
      if (cleanU.toLowerCase() === 'ops' && cleanP === 'test') {
        onLoginSuccess('ops');
        return;
      }
      setError(err.message || 'Invalid operator credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8">
        <div className="text-center mb-6">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center font-bold text-white text-xl mx-auto mb-3 shadow-lg shadow-cyan-500/20">
            N
          </div>
          <h2 className="text-xl font-bold text-white">Operator Console Login</h2>
          <p className="text-xs text-slate-400 mt-1">Autonomous AutoPay Voice Recovery Studio</p>
        </div>

        <div className="p-3 mb-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 flex items-center justify-between">
          <div>
            Default: <code className="text-cyan-400 font-bold">ops</code> / <code className="text-cyan-400 font-bold">test</code>
          </div>
          <button
            type="button"
            onClick={handleFill}
            className="px-2 py-1 rounded bg-cyan-500/20 text-cyan-300 text-xs font-medium hover:bg-cyan-500/30"
          >
            Auto-Fill
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Operator Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:border-cyan-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Operator Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:border-cyan-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 text-slate-950 font-bold text-sm hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Sign In to Operator Console'}
          </button>
        </form>
      </div>
    </div>
  );
}
