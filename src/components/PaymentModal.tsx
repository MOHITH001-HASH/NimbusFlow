import React, { useState, useEffect, useRef } from 'react';
import { Shield, Lock, CheckCircle2, CreditCard, Smartphone, Building, X, ArrowRight, Loader2 } from 'lucide-react';
import { PaymentLink } from '../types';

interface PaymentModalProps {
  link: PaymentLink | null;
  onClose: () => void;
  onPaymentSuccess: (amount: number) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ link, onClose, onPaymentSuccess }) => {
  const [selectedMethod, setSelectedMethod] = useState<'upi' | 'card' | 'netbanking'>('upi');
  const [upiId, setUpiId] = useState('rajesh@okhdfcbank');
  const [cardNumber, setCardNumber] = useState('4242 •••• •••• 4242');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaid, setIsPaid] = useState(link?.status === 'paid');
  const modalRef = useRef<HTMLDivElement>(null);

  // Accessibility: Handle Escape key to close dialog
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Focus trap / auto-focus modal on mount
  useEffect(() => {
    modalRef.current?.focus();
  }, []);

  if (!link) return null;

  const handlePay = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch('/api/payments/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          linkId: link.id,
          paymentMethod: selectedMethod.toUpperCase()
        })
      });

      const data = await res.json();
      if (data.success) {
        setIsPaid(true);
        onPaymentSuccess(link.amount);
      }
    } catch (e) {
      console.error('Payment error:', e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-modal-title"
      aria-describedby="payment-modal-desc"
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative text-white focus:outline-none"
      >
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
              <Lock className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <span id="payment-modal-title" className="text-xs uppercase tracking-wider text-cyan-400 font-semibold block">
                NimbusFlow Pay
              </span>
              <p id="payment-modal-desc" className="text-xs text-slate-300">
                Secure Autopay Recovery Checkout
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close payment dialog"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isPaid ? (
          /* Payment Success State */
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto animate-bounce">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Payment Received!</h3>
              <p className="text-sm text-emerald-400 font-medium mt-1">Webhook & SSE broadcasted to active voice call</p>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                Your payment of {link.currency} {link.amount.toLocaleString()} for {link.plan} has been verified and settled. Ava is updating the live call right now.
              </p>
            </div>

            <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/60 text-left text-xs space-y-2">
              <div className="flex justify-between text-slate-300">
                <span>Transaction Ref:</span>
                <span className="font-mono text-cyan-300 font-semibold">TXN_NB_{link.id.toUpperCase()}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Account Status:</span>
                <span className="text-emerald-400 font-semibold flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5 inline" />
                  <span>Active & In Good Standing</span>
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-slate-200 hover:text-white transition-colors"
            >
              Close Window
            </button>
          </div>
        ) : (
          /* Checkout Payment Form */
          <div className="p-6 space-y-5">
            {/* Invoice Breakdown */}
            <div className="bg-slate-800/70 border border-slate-700/60 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400">Bill To: {link.customerName}</p>
                <p className="text-sm font-semibold text-white mt-0.5">{link.plan}</p>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400">Amount Due</span>
                <p className="text-xl font-bold text-cyan-400">
                  {link.currency} {link.amount.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">Select Payment Method</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedMethod('upi')}
                  className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center space-y-1.5 transition-all ${
                    selectedMethod === 'upi'
                      ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400'
                      : 'bg-slate-800/40 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <Smartphone className="w-5 h-5" />
                  <span>UPI / QR</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedMethod('card')}
                  className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center space-y-1.5 transition-all ${
                    selectedMethod === 'card'
                      ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400'
                      : 'bg-slate-800/40 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <CreditCard className="w-5 h-5" />
                  <span>Card</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedMethod('netbanking')}
                  className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center space-y-1.5 transition-all ${
                    selectedMethod === 'netbanking'
                      ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400'
                      : 'bg-slate-800/40 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <Building className="w-5 h-5" />
                  <span>NetBanking</span>
                </button>
              </div>
            </div>

            {/* Payment Form Fields */}
            {selectedMethod === 'upi' && (
              <div className="space-y-2">
                <label className="text-xs text-slate-300 font-medium">Virtual Payment Address (VPA / UPI ID)</label>
                <input
                  type="text"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                  placeholder="name@bank"
                />
                <div className="flex space-x-2 pt-1">
                  <span className="px-2.5 py-1 rounded bg-slate-800 text-xs text-slate-300">Google Pay</span>
                  <span className="px-2.5 py-1 rounded bg-slate-800 text-xs text-slate-300">PhonePe</span>
                  <span className="px-2.5 py-1 rounded bg-slate-800 text-xs text-slate-300">Paytm</span>
                </div>
              </div>
            )}

            {selectedMethod === 'card' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-300 font-medium">Card Number (Encrypted Web Checkout)</label>
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-400">Expires</label>
                    <input
                      type="text"
                      defaultValue="09/29"
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">CVV</label>
                    <input
                      type="password"
                      defaultValue="•••"
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {selectedMethod === 'netbanking' && (
              <div className="space-y-2">
                <label className="text-xs text-slate-300 font-medium">Choose Bank</label>
                <select className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white">
                  <option>HDFC Bank</option>
                  <option>ICICI Bank</option>
                  <option>State Bank of India (SBI)</option>
                  <option>Axis Bank</option>
                  <option>Kotak Mahindra Bank</option>
                </select>
              </div>
            )}

            {/* Security Guarantee */}
            <div className="flex items-center space-x-2.5 text-xs text-slate-300 bg-slate-950/70 p-3 rounded-xl border border-slate-800">
              <Shield className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <span>PCI-DSS Level 1 Encrypted. Card numbers are never collected by voice over the phone.</span>
            </div>

            {/* Submit Action */}
            <button
              onClick={handlePay}
              disabled={isProcessing}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 via-indigo-600 to-cyan-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-semibold text-sm flex items-center justify-center space-x-2 shadow-lg shadow-cyan-500/20 transition-all hover:scale-[1.01] disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing & Broadcasting SSE Webhook...</span>
                </>
              ) : (
                <>
                  <span>Authorize & Pay {link.currency} {link.amount.toLocaleString()}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
