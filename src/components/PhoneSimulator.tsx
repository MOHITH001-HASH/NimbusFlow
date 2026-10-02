import React, { useState, useEffect } from 'react';
import { Phone, PhoneOff, MessageSquare, ExternalLink, Shield, CheckCircle2, Bell, Lock } from 'lucide-react';
import { Customer, CallSession } from '../types';
import { SMSMessage, SMSService } from '../services/sms';

interface PhoneSimulatorProps {
  customer: Customer;
  activeSession: CallSession | null;
  onAnswerCall: () => void;
  onDeclineCall: () => void;
  onOpenPaymentLink: (linkId: string) => void;
}

export const PhoneSimulator: React.FC<PhoneSimulatorProps> = ({
  customer,
  activeSession,
  onAnswerCall,
  onDeclineCall,
  onOpenPaymentLink
}) => {
  const [activeScreen, setActiveScreen] = useState<'call' | 'sms'>('call');
  const [smsList, setSmsList] = useState<SMSMessage[]>([]);
  const [latestNotification, setLatestNotification] = useState<SMSMessage | null>(null);

  // Sync SMS list
  useEffect(() => {
    const update = () => {
      setSmsList(SMSService.getOutboxForPhone(customer.phone));
    };
    update();

    const unsub = SMSService.subscribe((newSms) => {
      if (newSms.to === customer.phone || customer.phone.endsWith(newSms.to.slice(-4))) {
        setSmsList((prev) => [newSms, ...prev]);
        setLatestNotification(newSms);
        setActiveScreen('sms');
        setTimeout(() => setLatestNotification(null), 6000);
      }
    });

    return unsub;
  }, [customer.phone]);

  const isCallActive = activeSession && activeSession.state !== 'COMPLETED';

  return (
    <div className="w-full max-w-[360px] mx-auto bg-slate-950 rounded-[44px] p-3 shadow-2xl border-4 border-slate-800 relative select-none">
      {/* Phone Speaker & Camera Notch */}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 w-32 h-5 bg-slate-900 rounded-full z-30 flex items-center justify-center space-x-2">
        <div className="w-3 h-3 rounded-full bg-slate-950 border border-slate-800" />
        <div className="w-12 h-1 bg-slate-800 rounded-full" />
      </div>

      {/* Screen Container */}
      <div className="w-full h-[620px] bg-slate-900 rounded-[36px] overflow-hidden flex flex-col relative text-white">
        {/* Status Bar */}
        <div className="pt-2.5 px-6 pb-2 flex justify-between items-center text-xs text-slate-400 font-medium z-20">
          <span>02:30 PM</span>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-cyan-400">5G</span>
            <div className="w-5 h-2.5 rounded-sm border border-slate-400 p-0.5 flex items-center">
              <div className="w-3 h-full bg-emerald-400 rounded-xs" />
            </div>
          </div>
        </div>

        {/* Incoming SMS Push Notification Banner */}
        {latestNotification && (
          <div
            className="absolute top-12 left-3 right-3 z-40 bg-slate-800/95 backdrop-blur-md border border-cyan-500/50 rounded-2xl p-3.5 shadow-2xl animate-bounce cursor-pointer"
            onClick={() => {
              setActiveScreen('sms');
              setLatestNotification(null);
            }}
          >
            <div className="flex items-center space-x-2 text-cyan-400 text-xs font-bold mb-1">
              <Bell className="w-4 h-4" />
              <span>NimbusFlow Security</span>
              <span className="text-xs text-slate-400 ml-auto font-normal">Now</span>
            </div>
            <p className="text-xs text-slate-100 line-clamp-2 leading-relaxed">{latestNotification.body}</p>
          </div>
        )}

        {/* SCREEN 1: Active Call Screen */}
        {activeScreen === 'call' && (
          <div className="flex-1 flex flex-col justify-between p-6 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900">
            {/* Caller Info */}
            <div className="text-center pt-8">
              <div className="w-22 h-22 mx-auto rounded-full bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center shadow-xl shadow-cyan-500/20 mb-4 border border-cyan-400/40">
                <Shield className="w-12 h-12 text-white" />
              </div>
              <h4 className="text-xl font-bold text-white tracking-wide">NimbusFlow</h4>
              <p className="text-sm text-cyan-400 font-medium mt-0.5">Ava Voice Recovery Agent</p>
              <p className="text-xs text-slate-400 mt-1 font-mono">{customer.phone}</p>

              {isCallActive ? (
                <div className="mt-4 inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-semibold border border-emerald-500/30">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>Call Active ({activeSession.state})</span>
                </div>
              ) : (
                <p className="text-xs text-slate-400 mt-4 font-medium">Standby • Ready for Outbound Call</p>
              )}
            </div>

            {/* Call Controls */}
            <div className="pb-6">
              {isCallActive ? (
                <div className="flex justify-center space-x-6">
                  <button
                    onClick={onDeclineCall}
                    aria-label="Hang up call"
                    className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center shadow-xl shadow-red-600/30 transition-all hover:scale-105"
                    title="End Call"
                  >
                    <PhoneOff className="w-8 h-8 text-white" />
                  </button>
                </div>
              ) : (
                <div className="flex justify-center space-x-6">
                  <button
                    onClick={onAnswerCall}
                    aria-label="Answer or simulate call"
                    className="w-16 h-16 rounded-full bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center shadow-xl shadow-emerald-600/30 transition-all hover:scale-105"
                    title="Answer Call"
                  >
                    <Phone className="w-8 h-8 text-white" />
                  </button>
                </div>
              )}

              {/* Bottom toggle to view SMS app */}
              <button
                onClick={() => setActiveScreen('sms')}
                className="mt-6 w-full py-2.5 px-4 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-xs font-semibold text-slate-200 hover:text-white flex items-center justify-center space-x-2 transition-colors border border-slate-700/80"
              >
                <MessageSquare className="w-4 h-4 text-cyan-400" />
                <span>Open SMS Messages ({smsList.length})</span>
              </button>
            </div>
          </div>
        )}

        {/* SCREEN 2: SMS Messages App */}
        {activeScreen === 'sms' && (
          <div className="flex-1 flex flex-col bg-slate-950">
            {/* SMS Header */}
            <div className="p-3.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
              <button
                onClick={() => setActiveScreen('call')}
                className="text-xs font-medium text-cyan-400 hover:text-cyan-300 flex items-center space-x-1"
              >
                <span>‹ Phone Call</span>
              </button>
              <div className="text-center">
                <span className="text-xs font-bold text-white block">NimbusFlow Security</span>
                <span className="text-[11px] text-emerald-400 flex items-center justify-center space-x-1">
                  <Shield className="w-3 h-3" />
                  <span>Verified Sender</span>
                </span>
              </div>
              <div className="w-10" />
            </div>

            {/* Messages Thread */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {smsList.length === 0 ? (
                <div className="text-center py-20 text-slate-500 text-xs">
                  <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="font-semibold text-slate-400">No text messages yet.</p>
                  <p className="text-slate-500 mt-1 leading-relaxed">
                    When Ava sends an encrypted payment link, the SMS arrives here in real-time.
                  </p>
                </div>
              ) : (
                smsList.map((msg) => (
                  <div key={msg.id} className="space-y-1.5">
                    <div className="bg-slate-800/95 border border-slate-700 rounded-2xl rounded-tl-sm p-4 text-xs text-slate-100 shadow-md">
                      <p className="leading-relaxed text-slate-200">{msg.body}</p>

                      {/* Interactive Payment Link Button */}
                      {msg.paymentLinkId && (
                        <div className="mt-3.5 pt-3 border-t border-slate-700 flex flex-col space-y-2">
                          <button
                            onClick={() => onOpenPaymentLink(msg.paymentLinkId!)}
                            className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-semibold text-xs flex items-center justify-center space-x-2 shadow-md transition-all"
                          >
                            <Lock className="w-3.5 h-3.5" />
                            <span>Complete Autopay Payment</span>
                            <ExternalLink className="w-3.5 h-3.5 ml-1" />
                          </button>
                          <span className="text-xs text-slate-400 text-center flex items-center justify-center space-x-1">
                            <Shield className="w-3.5 h-3.5 text-cyan-400" />
                            <span>256-bit Encrypted Checkout</span>
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 px-2">
                      <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="font-semibold text-emerald-400">
                        {msg.provider === 'Twilio' ? 'Twilio Live SMS ✓' : 'Delivered (Simulator) ✓'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Bottom Nav to return to Call */}
            <div className="p-3 bg-slate-900 border-t border-slate-800">
              <button
                onClick={() => setActiveScreen('call')}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center justify-center space-x-2"
              >
                <Phone className="w-4 h-4 text-emerald-400" />
                <span>Return to Phone Screen</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Phone Bottom Home Bar */}
      <div className="w-36 h-1.5 bg-slate-700 rounded-full mx-auto mt-3" />
    </div>
  );
};
