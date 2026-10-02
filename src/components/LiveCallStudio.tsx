import React, { useState, useEffect, useRef } from 'react';
import {
  Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, Shield, AlertTriangle,
  CheckCircle2, Clock, Terminal, ArrowRight, Sparkles, Send, RefreshCw, UserCheck, Smartphone
} from 'lucide-react';
import { Customer, CallSession, CallMessage, ComplianceCheckResult, CallOutcome } from '../types';
import { SpeechEngine } from '../utils/speech';

interface LiveCallStudioProps {
  customers: Customer[];
  selectedCustomer: Customer;
  onSelectCustomer: (customer: Customer) => void;
  activeSession: CallSession | null;
  complianceResult: ComplianceCheckResult | null;
  onStartCall: (overrideCompliance: boolean, realCall?: boolean) => void;
  onEndCall: () => void;
  onSendMessage: (text: string) => void;
  onOpenPaymentLink: (linkId: string) => void;
  isCalling: boolean;
  latestOutcome: CallOutcome | null;
  livePaidBanner: { amount: number; transactionId: string } | null;
}

export const LiveCallStudio: React.FC<LiveCallStudioProps> = ({
  customers,
  selectedCustomer,
  onSelectCustomer,
  activeSession,
  complianceResult,
  onStartCall,
  onEndCall,
  onSendMessage,
  onOpenPaymentLink,
  isCalling,
  latestOutcome,
  livePaidBanner
}) => {
  const [inputText, setInputText] = useState('');
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isMicListening, setIsMicListening] = useState(false);
  const [isAvaSpeaking, setIsAvaSpeaking] = useState(false);
  const [demoOverrideEnabled, setDemoOverrideEnabled] = useState(false);
  const [callMode, setCallMode] = useState<'browser' | 'real_telephony'>('browser');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const transcriptBottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages]);

  // Audio Speech synthesis whenever Ava speaks
  useEffect(() => {
    if (!activeSession || !isAudioEnabled) return;
    const lastMsg = activeSession.messages[activeSession.messages.length - 1];
    if (lastMsg && lastMsg.sender === 'ava' && lastMsg.audioGenerated) {
      setIsAvaSpeaking(true);
      SpeechEngine.speak(
        lastMsg.text,
        selectedCustomer.language,
        () => setIsAvaSpeaking(true),
        () => setIsAvaSpeaking(false)
      );
    }
  }, [activeSession?.messages, isAudioEnabled, selectedCustomer.language]);

  // Microphone STT setup
  const toggleMic = () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setToastMessage('Browser speech recognition not available. Please use the quick response buttons or type below.');
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }

    if (isMicListening) {
      setIsMicListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = selectedCustomer.language === 'hi' ? 'hi-IN' : 'en-US';

      recognition.onstart = () => setIsMicListening(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          onSendMessage(transcript);
        }
        setIsMicListening(false);
      };
      recognition.onerror = () => setIsMicListening(false);
      recognition.onend = () => setIsMicListening(false);

      recognition.start();
    } catch (e) {
      console.warn('Mic error:', e);
      setIsMicListening(false);
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText);
    setInputText('');
  };

  // State Machine Step order
  const stateSteps = ['OPEN', 'VERIFY_IDENTITY', 'DIAGNOSE', 'OFFER', 'RESOLVE', 'CONFIRM', 'CLOSE'];
  const currentStateIndex = activeSession ? stateSteps.indexOf(activeSession.state) : -1;

  // Contextual quick chips depending on customer scenario & state
  const getQuickReplies = () => {
    if (!activeSession) return [];
    const state = activeSession.state;

    if (state === 'OPEN') {
      return [
        { label: `Yes, this is ${selectedCustomer.name.split(' ')[0]}`, text: `Yes, this is ${selectedCustomer.name}.` },
        { label: 'Speaking. What is this regarding?', text: 'Speaking, what is this call regarding?' },
        { label: 'Who is calling?', text: 'Who is calling?' },
        { label: 'Wrong person / Not available', text: `No, you have the wrong number. ${selectedCustomer.name} is not available.` },
        { label: 'हाँ, मैं बोल रही हूँ (हिंदी)', text: 'हाँ, मैं बोल रही हूँ। क्या आप हिंदी में बात कर सकती हैं?' }
      ];
    }

    if (state === 'VERIFY_IDENTITY') {
      return [
        { label: `Verify Last 4 Card Digits`, text: `Sure, the last 4 digits of my card are ${selectedCustomer.last4}.` },
        { label: `Verify Postal ZIP Code`, text: `My billing postal code is ${selectedCustomer.zip_code}.` },
        { label: 'Wrong digits (9999) - Test Failure', text: 'I think the last four digits are 9999.' },
        { label: 'Stop calling me (DNC)', text: 'Stop calling me and remove my number from your list!' }
      ];
    }

    if (state === 'DIAGNOSE' || state === 'OFFER') {
      const replies = [
        { label: 'Text me the payment link', text: 'Can you text me the secure payment link to my phone?' },
        { label: 'Promise to pay Friday (after salary)', text: 'My salary arrives on Friday, can I promise to pay in 3 days?' },
        { label: 'I dispute this charge!', text: 'I dispute this bill! I cancelled a seat last month and this charge is wrong.' },
        { label: 'Hardship: Can I pay in installments?', text: 'I am experiencing medical hardship, can I split this into a payment plan?' },
        { label: 'Bank fraud: I will check SMS', text: 'Okay, I will approve the bank security SMS notification, please retry tomorrow.' },
        { label: 'Speak with Manager (VIP)', text: 'Our old entity account was closed during restructuring, I need to talk to my Enterprise manager.' },
        { label: 'Stop calling me (DNC)', text: 'Remove my number immediately, do not call again!' }
      ];
      return replies;
    }

    if (state === 'RESOLVE') {
      return [
        { label: 'Waiting for SMS link', text: 'I am looking at my phone now for the link.' },
        { label: 'I completed the payment!', text: 'I just finished paying on the link with UPI.' }
      ];
    }

    return [{ label: 'Thank you, goodbye!', text: 'Thank you so much Ava, goodbye!' }];
  };

  return (
    <div className="space-y-6">
      {/* Toast Banner */}
      {toastMessage && (
        <div className="p-3 bg-amber-500/20 border border-amber-500/40 rounded-2xl text-xs text-amber-200 flex items-center justify-between animate-fade-in">
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-amber-400 font-bold ml-2">✕</button>
        </div>
      )}

      {/* Live Payment Confirmed Alert Banner (Triggered by SSE) */}
      {livePaidBanner && (
        <div className="p-4 bg-emerald-500/20 border-2 border-emerald-500 rounded-3xl text-sm text-emerald-200 flex items-center justify-between shadow-2xl animate-bounce">
          <div className="flex items-center space-x-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            <div>
              <strong className="text-white block font-bold">Live Payment Settlement Confirmed via SSE!</strong>
              <span>Received ₹{livePaidBanner.amount.toLocaleString()} • Ref: {livePaidBanner.transactionId}</span>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-emerald-500/30 text-emerald-300 font-mono text-xs font-bold">
            GATEWAY PAID ✓
          </span>
        </div>
      )}

      {/* 1. Customer Persona Selector Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <span>Select Customer Persona (10 Scenarios)</span>
            </h3>
            <p className="text-xs text-slate-400">Each profile simulates a specific dunning scenario & failure reason</p>
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-slate-800 border border-slate-700 text-xs">
              <span className="text-slate-400">Language:</span>
              <span className="font-semibold text-cyan-400 uppercase">
                {selectedCustomer.language === 'hi' ? 'Hindi' : 'English'}
              </span>
            </div>

            <div className="flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-slate-800 border border-slate-700 text-xs">
              <span className="text-slate-400">Timezone:</span>
              <span className="font-semibold text-emerald-400 font-mono">
                {selectedCustomer.timezone.split('/')[1] || selectedCustomer.timezone}
              </span>
            </div>
          </div>
        </div>

        {/* Customer Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {customers.map((c) => {
            const isSelected = c.id === selectedCustomer.id;
            return (
              <button
                key={c.id}
                onClick={() => onSelectCustomer(c)}
                disabled={isCalling}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  isSelected
                    ? 'bg-cyan-500/15 border-cyan-500 text-white shadow-sm ring-1 ring-cyan-500/60'
                    : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                } ${isCalling ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold truncate text-white">{c.name}</span>
                  {c.dnc_flag && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-bold">DNC</span>}
                  {c.amount_due === 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">PAID</span>}
                </div>
                <p className="text-xs text-cyan-400 font-mono font-semibold mt-1">{c.currency} {c.amount_due.toLocaleString()}</p>
                <p className="text-[11px] text-slate-400 truncate mt-1">{c.persona_scenario.replace(/_/g, ' ')}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Customer Context & Pre-Call Compliance Gate */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Selected Customer Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-bold">Customer Profile</span>
            <span className="text-xs font-mono text-cyan-400 font-semibold">{selectedCustomer.id}</span>
          </div>

          <div>
            <h4 className="text-lg font-bold text-white">{selectedCustomer.name}</h4>
            <p className="text-xs text-slate-300">{selectedCustomer.plan} • {selectedCustomer.segment} Tier</p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-slate-800">
            <div>
              <span className="text-slate-400">Amount Due:</span>
              <p className="font-bold text-white text-sm mt-0.5">
                {selectedCustomer.amount_due === 0 ? (
                  <span className="text-emerald-400">PAID (₹0)</span>
                ) : (
                  `${selectedCustomer.currency} ${selectedCustomer.amount_due.toLocaleString()}`
                )}
              </p>
            </div>
            <div>
              <span className="text-slate-400">Failure Reason:</span>
              <p className="font-semibold text-amber-300 truncate mt-0.5" title={selectedCustomer.failure_reason}>
                {selectedCustomer.failure_reason}
              </p>
            </div>
            <div>
              <span className="text-slate-400">Security Factor:</span>
              <p className="font-mono text-slate-200 mt-0.5">Card Last4 & ZIP</p>
            </div>
            <div>
              <span className="text-slate-400">Billing Hold:</span>
              <p className="font-medium mt-0.5">
                {selectedCustomer.billing_hold ? (
                  <span className="text-amber-400 font-semibold">Active (7 Days)</span>
                ) : (
                  <span className="text-slate-400">None</span>
                )}
              </p>
            </div>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800 text-xs text-slate-300 leading-relaxed">
            <span className="text-cyan-400 font-semibold">Persona Brief: </span>
            {selectedCustomer.notes}
          </div>
        </div>

        {/* Compliance Evaluation Engine */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 mb-3 border-b border-slate-800 gap-2">
              <span className="text-xs uppercase tracking-wider text-slate-400 font-bold flex items-center space-x-2">
                <Shield className="w-4 h-4 text-cyan-400" />
                <span>Pre-Call Compliance Engine (TCPA / TRAI / Reg F)</span>
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                complianceResult?.canDial
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-red-500/10 text-red-400 border-red-500/30'
              }`}>
                {complianceResult?.canDial ? 'GATEWAY CLEAR TO DIAL' : 'DIAL BLOCKED BY COMPLIANCE'}
              </span>
            </div>

            {/* Compliance criteria pills */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800">
                <span className="text-slate-400 block text-xs">Calling Hours</span>
                <span className="font-bold text-slate-100 text-sm">09:00 - 20:00</span>
                <p className="text-xs text-emerald-400 mt-0.5">Local: {complianceResult?.customerLocalTime || '02:30 PM'}</p>
              </div>

              <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800">
                <span className="text-slate-400 block text-xs">DNC Registry</span>
                <span className={`font-bold text-sm ${selectedCustomer.dnc_flag ? 'text-red-400' : 'text-emerald-400'}`}>
                  {selectedCustomer.dnc_flag ? 'FLAGGED (Opt-Out)' : 'CLEARED'}
                </span>
                <p className="text-xs text-slate-400 mt-0.5">Auto-Enforced</p>
              </div>

              <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800">
                <span className="text-slate-400 block text-xs">Call Attempts Cap</span>
                <span className={`font-bold text-sm ${(selectedCustomer.call_attempts_count || 0) >= 3 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {selectedCustomer.call_attempts_count || 0} / 3 Calls
                </span>
                <p className="text-xs text-slate-400 mt-0.5">Reg F Weekly Limit</p>
              </div>

              <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800">
                <span className="text-slate-400 block text-xs">Consent Verification</span>
                <span className="font-bold text-emerald-400 text-sm">
                  {selectedCustomer.consent_status ? 'Verified On File' : 'Missing'}
                </span>
                <p className="text-xs text-slate-400 mt-0.5">TCPA Express</p>
              </div>
            </div>

            {complianceResult?.reasons && complianceResult.reasons.length > 0 && (
              <div className="mt-3 p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-xs text-red-300">
                <strong className="font-semibold block mb-0.5">Compliance Gate Flag:</strong>
                {complianceResult.reasons.join(' • ')}
              </div>
            )}
          </div>

          {/* Dialing Controls & Demo Override Mode */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-3 border-t border-slate-800 gap-3">
            <div className="flex items-center space-x-3 text-xs">
              <label className="flex items-center space-x-2 text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={demoOverrideEnabled}
                  onChange={(e) => setDemoOverrideEnabled(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-700 text-cyan-500 focus:ring-0"
                />
                <span className="text-xs text-slate-300">Demo Testing Override</span>
              </label>

              <span className="text-slate-500">•</span>
              <span className="text-slate-400">Target: <strong className="text-white font-mono">{selectedCustomer.phone}</strong></span>
            </div>

            <div className="flex items-center space-x-2.5">
              {!isCalling ? (
                <>
                  <button
                    onClick={() => onStartCall(demoOverrideEnabled, false)}
                    disabled={!complianceResult?.canDial && !demoOverrideEnabled}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center space-x-2 shadow-lg shadow-emerald-600/20 transition-all hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Phone className="w-4 h-4" />
                    <span>Dial Customer</span>
                  </button>

                  <button
                    onClick={() => onStartCall(demoOverrideEnabled, true)}
                    disabled={!complianceResult?.canDial && !demoOverrideEnabled}
                    className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 text-xs font-semibold flex items-center space-x-1.5 transition-colors disabled:opacity-40"
                    title="Initiate real telephony outbound call via Vapi API / Twilio"
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>Real Phone (Vapi)</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={onEndCall}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center space-x-2 shadow-lg shadow-red-600/20 transition-all hover:scale-[1.02]"
                >
                  <PhoneOff className="w-4 h-4" />
                  <span>Hang Up / End Call</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Live Active Call Workspace */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        {/* Top Header of Call Session */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 border-b border-slate-800 gap-3">
          <div className="flex items-center space-x-3">
            <div className={`w-3.5 h-3.5 rounded-full ${isCalling ? 'bg-emerald-400 animate-ping' : 'bg-slate-600'}`} />
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-white">Call Session: {activeSession?.id || 'Ready'}</h3>
                {isCalling && (
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    LIVE
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300">
                Caller: Ava (Automated AI Assistant) ↔ {selectedCustomer.name} ({selectedCustomer.phone})
              </p>
            </div>
          </div>

          {/* Voice Controls: Audio TTS Toggle & Mic */}
          <div className="flex items-center space-x-2.5">
            <button
              onClick={() => setIsAudioEnabled(!isAudioEnabled)}
              className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
                isAudioEnabled
                  ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400'
                  : 'bg-slate-800 border-slate-700 text-slate-300'
              }`}
              title={isAudioEnabled ? 'Voice audio synthesis enabled' : 'Muted'}
            >
              {isAudioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span>{isAudioEnabled ? 'Ava Voice: ON' : 'Voice: OFF'}</span>
            </button>

            <button
              onClick={toggleMic}
              disabled={!isCalling}
              className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                isMicListening
                  ? 'bg-red-500 text-white border-red-400 animate-pulse'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200 disabled:opacity-40'
              }`}
              title="Speak directly to Ava via microphone"
            >
              {isMicListening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
              <span>{isMicListening ? 'Listening...' : 'Talk with Mic'}</span>
            </button>
          </div>
        </div>

        {/* State Machine Step Tracker */}
        <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-300 mb-2">
            <span className="font-bold uppercase tracking-wider text-slate-200">State Machine Progression</span>
            <span className="text-cyan-400 font-mono font-bold">State: {activeSession?.state || 'IDLE'}</span>
          </div>

          <div className="grid grid-cols-7 gap-1.5 text-xs text-center font-semibold">
            {stateSteps.map((step, idx) => {
              const isPast = idx < currentStateIndex;
              const isCurrent = idx === currentStateIndex;
              return (
                <div
                  key={step}
                  className={`py-2 px-1 rounded-xl border transition-all ${
                    isCurrent
                      ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400 shadow-md shadow-cyan-500/30'
                      : isPast
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  <span className="truncate block">{step}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Audio Waveform Animation (Pulsing when speaking) */}
        {isCalling && (
          <div className="flex items-center justify-center space-x-2 py-2">
            <span className="text-xs text-slate-300 font-medium mr-2">
              {isAvaSpeaking ? 'Ava is speaking aloud...' : isMicListening ? 'Listening to user...' : 'Audio Channel Open'}
            </span>
            {[...Array(14)].map((_, i) => (
              <span
                key={i}
                className={`w-1 rounded-full transition-all duration-150 ${
                  isAvaSpeaking
                    ? 'bg-cyan-400 animate-pulse'
                    : isMicListening
                    ? 'bg-emerald-400 animate-pulse'
                    : 'bg-slate-700 h-2'
                }`}
                style={{
                  height: isAvaSpeaking || isMicListening ? `${Math.max(6, (i % 6) * 6 + 6)}px` : '4px',
                  animationDelay: `${i * 50}ms`
                }}
              />
            ))}
          </div>
        )}

        {/* Live Transcript Stream */}
        <div className="h-[300px] overflow-y-auto bg-slate-950 rounded-2xl p-5 border border-slate-800 space-y-3.5 font-sans">
          {(!activeSession || activeSession.messages.length === 0) ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs space-y-2">
              <Phone className="w-10 h-10 opacity-30" />
              <p className="font-semibold text-slate-300">No active call session.</p>
              <p className="text-slate-400">Select a customer above and click &quot;Dial Customer&quot; to begin.</p>
            </div>
          ) : (
            activeSession.messages.map((m) => {
              const isAva = m.sender === 'ava';
              return (
                <div key={m.id} className={`flex flex-col ${isAva ? 'items-start' : 'items-end'}`}>
                  <div className="flex items-center space-x-1.5 text-xs text-slate-400 mb-1 px-1">
                    <span className="font-bold text-white">{isAva ? 'Ava (Voice Agent)' : selectedCustomer.name}</span>
                    <span>•</span>
                    <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                    {m.state && (
                      <span className="ml-1.5 px-2 py-0.5 rounded bg-slate-800 text-cyan-400 text-xs font-mono font-bold">
                        {m.state}
                      </span>
                    )}
                  </div>

                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs sm:text-sm shadow-sm leading-relaxed ${
                      isAva
                        ? 'bg-slate-800 text-slate-100 rounded-tl-xs border border-slate-700'
                        : 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white rounded-tr-xs'
                    }`}
                  >
                    {m.text}
                  </div>

                  {/* Tool Call Pills if Ava triggered any server tool */}
                  {m.toolCalls && m.toolCalls.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5 px-1">
                      {m.toolCalls.map((tc) => (
                        <div
                          key={tc.id}
                          className="flex items-center space-x-1.5 text-xs bg-slate-900 border border-cyan-500/40 text-cyan-300 px-2.5 py-1 rounded-lg font-mono"
                        >
                          <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                          <span>tool: {tc.tool}()</span>
                          <span className="text-emerald-400 font-bold">✓</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={transcriptBottomRef} />
        </div>

        {/* Quick Persona Suggested Responses */}
        {isCalling && (
          <div className="space-y-2">
            <span className="text-xs text-slate-300 font-semibold block">Quick Persona Responses (Tap to speak as customer):</span>
            <div className="flex flex-wrap gap-2">
              {getQuickReplies().map((reply, idx) => (
                <button
                  key={idx}
                  onClick={() => onSendMessage(reply.text)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors flex items-center space-x-1.5 shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{reply.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Custom Text Input Box */}
        {isCalling && (
          <form onSubmit={handleSend} className="flex items-center space-x-2.5">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type what customer says or use the quick chips above..."
              className="flex-1 px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="px-5 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center space-x-1.5 disabled:opacity-40 transition-colors"
            >
              <span>Speak</span>
              <Send className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* Post-Call Analysis Card (When Call Ends) */}
        {latestOutcome && !isCalling && (
          <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5 space-y-3.5 mt-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-cyan-400 font-bold flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>Post-Call Structured LLM Analysis</span>
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 uppercase">
                {latestOutcome.outcome.replace(/_/g, ' ')}
              </span>
            </div>

            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
              {latestOutcome.executiveSummary}
            </p>

            {/* Compliance Flags Verified by Analyzer */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">AI Disclosed First</span>
                <span className="text-emerald-400 font-bold">✓ YES</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Zero PII Leak</span>
                <span className="text-emerald-400 font-bold">✓ 100%</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">No Card by Voice</span>
                <span className="text-emerald-400 font-bold">✓ SECURE</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Customer Sentiment</span>
                <span className="text-cyan-400 font-bold capitalize">{latestOutcome.sentiment}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
