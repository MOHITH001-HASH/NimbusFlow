import React from 'react';
import { PhoneCall, ShieldCheck, Activity, RotateCcw, CheckCircle2, Users, Calendar, LogOut, User } from 'lucide-react';

interface NavbarProps {
  activeTab: 'studio' | 'customers' | 'calendar' | 'dashboard' | 'evals' | 'audit';
  setActiveTab: (tab: 'studio' | 'customers' | 'calendar' | 'dashboard' | 'evals' | 'audit') => void;
  onResetData: () => void;
  isCalling: boolean;
  onLogout?: () => void;
  currentUser?: string;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, onResetData, isCalling, onLogout, currentUser = 'ops' }) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-md shadow-cyan-500/20">
              <PhoneCall className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight text-white">NimbusFlow</span>
                <span className="px-2 py-0.5 text-xs font-semibold rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  Ava Voice Recovery
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">Outbound Autopay Recovery Voice Agent</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex space-x-1">
            <button
              onClick={() => setActiveTab('studio')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-1.5 ${
                activeTab === 'studio'
                  ? 'bg-slate-800 text-cyan-400 shadow-inner'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <PhoneCall className="w-4 h-4" />
              <span>Voice Studio</span>
              {isCalling && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-1" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('customers')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-1.5 ${
                activeTab === 'customers'
                  ? 'bg-slate-800 text-cyan-400 shadow-inner'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Customers</span>
            </button>

            <button
              onClick={() => setActiveTab('calendar')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-1.5 ${
                activeTab === 'calendar'
                  ? 'bg-slate-800 text-cyan-400 shadow-inner'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Call Calendar</span>
            </button>

            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-1.5 ${
                activeTab === 'dashboard'
                  ? 'bg-slate-800 text-cyan-400 shadow-inner'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Recovery Dashboard</span>
            </button>

            <button
              onClick={() => setActiveTab('evals')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-1.5 ${
                activeTab === 'evals'
                  ? 'bg-slate-800 text-cyan-400 shadow-inner'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>10 Persona Evals</span>
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-1.5 ${
                activeTab === 'audit'
                  ? 'bg-slate-800 text-cyan-400 shadow-inner'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Compliance & Audit</span>
            </button>
          </nav>

          {/* Right Action: Status & Reset */}
          <div className="flex items-center space-x-3">
            <div className="hidden lg:flex items-center space-x-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>AVA CORE READY</span>
            </div>

            <button
              onClick={onResetData}
              title="Reset customer data to initial seed state"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors flex items-center space-x-1 text-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset Seeds</span>
            </button>

            {/* Operator Badge & Logout Button */}
            <div className="flex items-center pl-2 border-l border-slate-800 space-x-2">
              <div className="hidden sm:flex items-center space-x-1.5 px-2 py-1 rounded bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300">
                <User className="w-3 h-3 text-cyan-400" />
                <span className="font-mono text-cyan-300">{currentUser}</span>
              </div>
              {onLogout && (
                <button
                  onClick={onLogout}
                  title="Sign out of operator console"
                  className="p-2 rounded-lg bg-slate-800/60 hover:bg-rose-500/15 text-slate-400 hover:text-rose-400 border border-slate-700/50 hover:border-rose-500/30 transition-colors flex items-center space-x-1 text-xs"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Sign Out</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Navigation Row */}
        <div className="flex md:hidden overflow-x-auto py-2 space-x-1 border-t border-slate-800">
          <button
            onClick={() => setActiveTab('studio')}
            className={`px-2.5 py-1.5 rounded-md text-xs whitespace-nowrap ${activeTab === 'studio' ? 'bg-slate-800 text-cyan-400' : 'text-slate-400'}`}
          >
            Voice Studio
          </button>
          <button
            onClick={() => setActiveTab('customers')}
            className={`px-2.5 py-1.5 rounded-md text-xs whitespace-nowrap ${activeTab === 'customers' ? 'bg-slate-800 text-cyan-400' : 'text-slate-400'}`}
          >
            Customers
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`px-2.5 py-1.5 rounded-md text-xs whitespace-nowrap ${activeTab === 'calendar' ? 'bg-slate-800 text-cyan-400' : 'text-slate-400'}`}
          >
            Calendar
          </button>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-2.5 py-1.5 rounded-md text-xs whitespace-nowrap ${activeTab === 'dashboard' ? 'bg-slate-800 text-cyan-400' : 'text-slate-400'}`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('evals')}
            className={`px-2.5 py-1.5 rounded-md text-xs whitespace-nowrap ${activeTab === 'evals' ? 'bg-slate-800 text-cyan-400' : 'text-slate-400'}`}
          >
            10 Evals
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-2.5 py-1.5 rounded-md text-xs whitespace-nowrap ${activeTab === 'audit' ? 'bg-slate-800 text-cyan-400' : 'text-slate-400'}`}
          >
            Audit Log
          </button>
        </div>
      </div>
    </header>
  );
};
