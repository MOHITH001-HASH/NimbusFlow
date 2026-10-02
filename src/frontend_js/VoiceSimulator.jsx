import React, { useState } from 'react';
import { dialCall, sendChatTurn } from './api.js';

export function VoiceSimulator({ selectedCustomer, customers = [] }) {
  const [target, setTarget] = useState(selectedCustomer || customers[0] || null);
  const [callSession, setCallSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isCalling, setIsCalling] = useState(false);

  const handleStartCall = async () => {
    if (!target) return;
    setIsCalling(true);
    setMessages([]);
    try {
      const res = await dialCall(target.id);
      setCallSession(res);
      setMessages([
        { sender: 'Ava (AI Voice Agent)', text: res.initialGreeting, type: 'ava' }
      ]);
    } catch (err) {
      alert('Could not dial customer: ' + err.message);
    } finally {
      setIsCalling(false);
    }
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!inputText.trim() || !callSession) return;
    const userText = inputText.trim();
    setInputText('');
    setMessages(prev => [...prev, { sender: target.name, text: userText, type: 'user' }]);

    try {
      const replyData = await sendChatTurn(callSession.callId, target.id, userText);
      setMessages(prev => [...prev, { sender: 'Ava (AI Voice Agent)', text: replyData.reply, type: 'ava' }]);
    } catch (err) {
      setMessages(prev => [...prev, { sender: 'Ava (AI Voice Agent)', text: 'I apologize, could you repeat that?', type: 'ava' }]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-xl font-bold text-white">Interactive Ava Voice Simulator (React + JavaScript)</h2>
        <p className="text-xs text-slate-400 mt-1">
          Simulate Ava outbound calls with mandatory AI disclosure, 2FA challenge, and payment link generation.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Target Account</h3>
          {target && (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2">
              <div className="font-bold text-white">{target.name} ({target.phone})</div>
              <div>Balance: <span className="text-amber-400 font-bold">{target.currency} {target.amount_due}</span></div>
              <div>Card Last 4: <code className="text-cyan-400 font-mono">{target.last4 || '4242'}</code></div>
              <div>ZIP: <code className="text-cyan-400 font-mono">{target.zip_code || '560001'}</code></div>
              <div>Reason: <span className="text-slate-300">{target.failure_reason}</span></div>
            </div>
          )}

          <button
            onClick={handleStartCall}
            disabled={isCalling}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 text-slate-950 font-bold text-sm hover:opacity-90 disabled:opacity-50"
          >
            {isCalling ? 'Connecting Dial...' : 'Dial Outbound Call (Ava)'}
          </button>
        </div>

        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col h-[520px]">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
            <span className={`text-xs font-semibold ${callSession ? 'text-emerald-400' : 'text-slate-400'}`}>
              {callSession ? 'Call Connected - Active' : 'Idle - Ready to Dial'}
            </span>
            <span className="text-xs text-slate-500">
              {target?.phone}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-2 text-xs">
            {!messages.length ? (
              <div className="p-4 rounded-xl bg-slate-950 text-slate-500 text-center italic">
                Click "Dial Outbound Call" to connect to Ava.
              </div>
            ) : (
              messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-xl max-w-[85%] ${m.type === 'ava' ? 'bg-cyan-950/60 border border-cyan-500/30 text-cyan-100 mr-auto' : 'bg-indigo-950/60 border border-indigo-500/30 text-indigo-100 ml-auto'}`}
                >
                  <div className={`text-[10px] font-bold ${m.type === 'ava' ? 'text-cyan-400' : 'text-indigo-400'} mb-1`}>{m.sender}</div>
                  <div>{m.text}</div>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleSend} className="pt-3 border-t border-slate-800 flex items-center space-x-2">
            <input
              type="text"
              placeholder="Type your response to Ava..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={!callSession}
              className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!callSession || !inputText.trim()}
              className="px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs hover:opacity-90 disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
