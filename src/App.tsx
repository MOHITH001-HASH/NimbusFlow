/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { LiveCallStudio } from './components/LiveCallStudio';
import { PhoneSimulator } from './components/PhoneSimulator';
import { PaymentModal } from './components/PaymentModal';
import { DashboardMetrics } from './components/DashboardMetrics';
import { CustomersView } from './components/CustomersView';
import { CalendarView } from './components/CalendarView';
import { EvalsView } from './components/EvalsView';
import { AuditLogView } from './components/AuditLogView';
import { Login } from './components/Login';
import { Customer, CallSession, ComplianceCheckResult, PaymentLink, CallOutcome } from './types';
import customerData from '../data/customers.json';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [currentUser, setCurrentUser] = useState<string>('ops');
  const [activeTab, setActiveTab] = useState<'studio' | 'customers' | 'calendar' | 'dashboard' | 'evals' | 'audit'>('studio');
  const [customers, setCustomers] = useState<Customer[]>(JSON.parse(JSON.stringify(customerData)));
  const [selectedCustomer, setSelectedCustomer] = useState<Customer>(customers[0]);
  const [activeSession, setActiveSession] = useState<CallSession | null>(null);
  const [complianceResult, setComplianceResult] = useState<ComplianceCheckResult | null>(null);
  const [activePaymentModalLink, setActivePaymentModalLink] = useState<PaymentLink | null>(null);
  const [latestOutcome, setLatestOutcome] = useState<CallOutcome | null>(null);
  const [isCalling, setIsCalling] = useState(false);
  const [livePaidBanner, setLivePaidBanner] = useState<{ amount: number; transactionId: string } | null>(null);
  const isEndingRef = useRef(false);

  // Check operator authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated) {
            setIsAuthenticated(true);
            if (data.user) setCurrentUser(data.user);
            return;
          }
        }

        // Stored basic auth token fallback
        const storedAuth = localStorage.getItem('nimbus_ops_auth') || sessionStorage.getItem('nimbus_ops_auth');
        if (storedAuth) {
          const testRes = await fetch('/api/auth/me', {
            headers: { 'Authorization': `Basic ${storedAuth}` }
          });
          if (testRes.ok) {
            const testData = await testRes.json();
            if (testData.authenticated) {
              setIsAuthenticated(true);
              const u = localStorage.getItem('nimbus_ops_user') || sessionStorage.getItem('nimbus_ops_user') || 'ops';
              setCurrentUser(u);
              return;
            }
          }
        }

        setIsAuthenticated(false);
      } catch {
        setIsAuthenticated(false);
      }
    };

    checkAuth();
  }, []);

  // Fetch customer list from API when authenticated
  const refreshCustomers = async () => {
    try {
      const res = await fetch('/api/customers');
      if (res.ok) {
        const data = await res.json();
        setCustomers(data);
        const currentSelected = data.find((c: Customer) => c.id === selectedCustomer.id);
        if (currentSelected) {
          setSelectedCustomer(currentSelected);
        }
      }
    } catch (e) {
      console.warn('Customer fetch fallback to seeds:', e);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      refreshCustomers();
    }
  }, [isAuthenticated]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.warn('Logout error:', e);
    }
    localStorage.removeItem('nimbus_ops_user');
    localStorage.removeItem('nimbus_ops_auth');
    sessionStorage.removeItem('nimbus_ops_user');
    sessionStorage.removeItem('nimbus_ops_auth');
    setIsAuthenticated(false);
  };

  // Server-Sent Events (SSE) setup for live payment updates
  useEffect(() => {
    if (!isAuthenticated) return;
    const eventSource = new EventSource('/api/calls/events/stream');

    eventSource.addEventListener('payment_received', (event) => {
      try {
        const data = JSON.parse(event.data);
        setLivePaidBanner({ amount: data.amount, transactionId: data.transactionId });
        refreshCustomers();

        // If the call is active for this customer, Ava speaks aloud confirmation live!
        if (activeSession && activeSession.customerId === data.customerId && activeSession.state !== 'COMPLETED') {
          setActiveSession((prev) => {
            if (!prev) return null;
            const updated = { ...prev, state: 'CLOSE' as const };
            return updated;
          });
        }
      } catch (err) {
        console.warn('SSE parse error:', err);
      }
    });

    return () => {
      eventSource.close();
    };
  }, [isAuthenticated, activeSession]);

  // Pre-call compliance evaluation whenever selected customer changes
  useEffect(() => {
    if (!isAuthenticated) return;
    fetch('/api/compliance/pre-dial-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId: selectedCustomer.id })
    })
      .then((res) => res.json())
      .then((data) => setComplianceResult(data))
      .catch((err) => console.warn('Compliance check error:', err));
  }, [isAuthenticated, selectedCustomer]);

  // Start Call Handler
  const handleStartCall = async (overrideCompliance: boolean = false, realCall: boolean = false) => {
    try {
      isEndingRef.current = false;
      const res = await fetch('/api/calls/dial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          overrideCompliance,
          realCall
        })
      });

      if (!res.ok) {
        const err = await res.json();
        return;
      }

      const data = await res.json();
      setActiveSession(data.session);
      setIsCalling(true);
      setLatestOutcome(null);
      setLivePaidBanner(null);
    } catch (e) {
      console.error('Call dial error:', e);
    }
  };

  // End Call Handler (Idempotent)
  const handleEndCall = async () => {
    if (!activeSession || isEndingRef.current) return;
    isEndingRef.current = true;

    try {
      const res = await fetch('/api/calls/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callId: activeSession.id })
      });

      if (res.ok) {
        const data = await res.json();
        setActiveSession(data.session);
        setLatestOutcome(data.outcome);
      }
    } catch (e) {
      console.error('End call error:', e);
    } finally {
      setIsCalling(false);
      refreshCustomers();
    }
  };

  // Customer Turn / User Speech Handler
  const handleSendMessage = async (text: string) => {
    if (!activeSession) return;
    try {
      const res = await fetch('/api/calls/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callId: activeSession.id,
          text
        })
      });

      if (res.ok) {
        const data = await res.json();
        setActiveSession(data.session);

        // Check if session reached a terminal state
        if (
          data.session.state === 'DNC_TERMINATED' ||
          data.session.state === 'WRONG_PERSON_TERMINATED' ||
          data.session.state === 'FAILED_VERIFICATION_TERMINATED' ||
          data.session.state === 'CLOSE'
        ) {
          setTimeout(() => {
            handleEndCall();
          }, 3500);
        }
      }
    } catch (e) {
      console.error('Turn error:', e);
    }
  };

  // Open Payment Link Modal
  const handleOpenPaymentLink = (linkId: string) => {
    fetch(`/api/payments/link/${linkId}`)
      .then((res) => res.json())
      .then((link) => setActivePaymentModalLink(link))
      .catch((e) => console.error('Link fetch error:', e));
  };

  // Payment completed
  const handlePaymentSuccess = (amount: number) => {
    refreshCustomers();
  };

  // Reset Data to initial seeds
  const handleResetData = async () => {
    await fetch('/api/reset', { method: 'POST' });
    setActiveSession(null);
    setIsCalling(false);
    setLatestOutcome(null);
    setLivePaidBanner(null);
    await refreshCustomers();
  };

  // Initial checking state
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mb-3" />
        <span className="text-xs font-mono tracking-wider text-slate-500 uppercase">Verifying Operator Session...</span>
      </div>
    );
  }

  // Render clean Login view before main application if not authenticated
  if (!isAuthenticated) {
    return (
      <Login
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setIsAuthenticated(true);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onResetData={handleResetData}
        isCalling={isCalling}
        onLogout={handleLogout}
        currentUser={currentUser}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* TAB 1: Voice Studio & Telephony Arena */}
        {activeTab === 'studio' && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Left 2 Cols: Main Voice Agent Workbench */}
            <div className="xl:col-span-2">
              <LiveCallStudio
                customers={customers}
                selectedCustomer={selectedCustomer}
                onSelectCustomer={(c) => {
                  setSelectedCustomer(c);
                  setActiveSession(null);
                  setIsCalling(false);
                  setLatestOutcome(null);
                  setLivePaidBanner(null);
                }}
                activeSession={activeSession}
                complianceResult={complianceResult}
                onStartCall={handleStartCall}
                onEndCall={handleEndCall}
                onSendMessage={handleSendMessage}
                onOpenPaymentLink={handleOpenPaymentLink}
                isCalling={isCalling}
                latestOutcome={latestOutcome}
                livePaidBanner={livePaidBanner}
              />
            </div>

            {/* Right Col: Customer Smartphone Simulation */}
            <div className="xl:col-span-1 flex flex-col items-center justify-start">
              <div className="w-full flex items-center justify-between mb-3 px-2">
                <span className="text-xs uppercase tracking-wider text-slate-400 font-bold">
                  Customer Device Simulation
                </span>
                <span className="text-xs text-cyan-400 font-mono font-semibold">
                  {selectedCustomer.name.split(' ')[0]}&apos;s Smartphone
                </span>
              </div>
              <PhoneSimulator
                customer={selectedCustomer}
                activeSession={activeSession}
                onAnswerCall={() => handleStartCall(false, false)}
                onDeclineCall={handleEndCall}
                onOpenPaymentLink={handleOpenPaymentLink}
              />
            </div>
          </div>
        )}

        {/* TAB 2: Customer Portfolio Management (Add, Edit, Filter, Call) */}
        {activeTab === 'customers' && (
          <CustomersView
            customers={customers}
            onRefreshCustomers={refreshCustomers}
            onSelectCustomerForCall={(c) => {
              setSelectedCustomer(c);
              setActiveSession(null);
              setIsCalling(false);
              setLatestOutcome(null);
              setLivePaidBanner(null);
              setActiveTab('studio');
            }}
          />
        )}

        {/* TAB 3: Outbound Recovery Call Scheduler & Calendar */}
        {activeTab === 'calendar' && (
          <CalendarView
            customers={customers}
            onSelectCustomerForCall={(c) => {
              setSelectedCustomer(c);
              setActiveSession(null);
              setIsCalling(false);
              setLatestOutcome(null);
              setLivePaidBanner(null);
              setActiveTab('studio');
            }}
          />
        )}

        {/* TAB 4: Executive Recovery Dashboard */}
        {activeTab === 'dashboard' && (
          <DashboardMetrics
            customers={customers}
            onSelectCustomer={(c) => {
              setSelectedCustomer(c);
              setActiveTab('studio');
            }}
            onOpenCallStudio={() => setActiveTab('studio')}
          />
        )}

        {/* TAB 3: 10 Persona Evals Suite */}
        {activeTab === 'evals' && <EvalsView />}

        {/* TAB 4: Compliance & Immutable Audit Log */}
        {activeTab === 'audit' && <AuditLogView />}
      </main>

      {/* Hosted Payment Gateway Modal (Checkout page triggered by SMS link) */}
      {activePaymentModalLink && (
        <PaymentModal
          link={activePaymentModalLink}
          onClose={() => setActivePaymentModalLink(null)}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}
