import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, Plus,
  Phone, AlertTriangle, CheckCircle2, ShieldCheck, User, X, Filter,
  Play, RefreshCw, AlertCircle, Sparkles, MapPin, Tag
} from 'lucide-react';
import { Customer, ScheduledCall } from '../types';

interface CalendarViewProps {
  customers: Customer[];
  onSelectCustomerForCall: (customer: Customer) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  customers,
  onSelectCustomerForCall
}) => {
  const [scheduledCalls, setScheduledCalls] = useState<ScheduledCall[]>([]);
  const [currentDate, setCurrentDate] = useState<Date>(new Date(2026, 9, 1)); // Oct 2026
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCallDetails, setSelectedCallDetails] = useState<ScheduledCall | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [filterCampaign, setFilterCampaign] = useState<string>('all');

  // Form state for scheduling
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customers[0]?.id || 'cust_001');
  const [scheduleDate, setScheduleDate] = useState<string>('2026-10-03');
  const [scheduleTime, setScheduleTime] = useState<string>('11:00');
  const [campaignType, setCampaignType] = useState<ScheduledCall['campaignType']>('staged_dunning');
  const [priority, setPriority] = useState<ScheduledCall['priority']>('normal');
  const [reason, setReason] = useState<string>('Routine 48h autopay failure follow-up');

  const fetchScheduledCalls = () => {
    fetch('/api/scheduled-calls')
      .then((res) => res.json())
      .then((data) => setScheduledCalls(data))
      .catch((e) => console.warn('Fetch scheduled calls error:', e));
  };

  useEffect(() => {
    fetchScheduledCalls();
  }, []);

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) || customers[0];

  // Calculate live customer local time for selected schedule date & time
  const getCustomerLocalTimeCalculation = () => {
    if (!selectedCustomer) return { localTime: '10:00 AM', isCompliant: true, hour: 10 };
    try {
      const combined = new Date(`${scheduleDate}T${scheduleTime}:00`);
      if (isNaN(combined.getTime())) return { localTime: 'Invalid', isCompliant: false, hour: 0 };

      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: selectedCustomer.timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZoneName: 'short'
      });
      const hourFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: selectedCustomer.timezone,
        hour: 'numeric',
        hour12: false
      });
      const localTimeStr = formatter.format(combined);
      const hour = parseInt(hourFormatter.format(combined), 10);
      const isCompliant = hour >= 9 && hour < 20;

      return {
        localTime: localTimeStr,
        isCompliant,
        hour
      };
    } catch {
      return { localTime: '02:30 PM IST', isCompliant: true, hour: 14 };
    }
  };

  const localTimeCalc = getCustomerLocalTimeCalculation();

  // Create scheduled call
  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const scheduledDateTime = new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString();
      const res = await fetch('/api/scheduled-calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          scheduledDateTime,
          campaignType,
          priority,
          reason
        })
      });
      if (res.ok) {
        await fetchScheduledCalls();
        setIsModalOpen(false);
      }
    } catch (e) {
      console.error('Scheduling error:', e);
    } finally {
      setIsSaving(false);
    }
  };

  // Quick preset scheduler
  const applyQuickPreset = (daysFromNow: number, hour: number, minute: number, presetCampaign: ScheduledCall['campaignType'], presetReason: string) => {
    const target = new Date(Date.now() + daysFromNow * 86400000);
    const dateStr = target.toISOString().split('T')[0];
    const hourStr = hour.toString().padStart(2, '0');
    const minStr = minute.toString().padStart(2, '0');
    setScheduleDate(dateStr);
    setScheduleTime(`${hourStr}:${minStr}`);
    setCampaignType(presetCampaign);
    setReason(presetReason);
  };

  // Delete / Cancel call
  const handleCancelCall = async (id: string) => {
    if (!window.confirm('Cancel this scheduled recovery call?')) return;
    try {
      const res = await fetch(`/api/scheduled-calls/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchScheduledCalls();
        setSelectedCallDetails(null);
      }
    } catch (e) {
      console.error('Cancel call error:', e);
    }
  };

  // Immediate dial from scheduled call
  const handleTriggerNow = (call: ScheduledCall) => {
    const cust = customers.find((c) => c.id === call.customerId);
    if (cust) {
      onSelectCustomerForCall(cust);
    }
  };

  // Calendar calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const prevMonthDays = Array.from({ length: firstDayIndex }, (_, i) => daysInPrevMonth - firstDayIndex + i + 1);
  const currentMonthDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const totalSlots = Math.ceil((firstDayIndex + daysInMonth) / 7) * 7;
  const nextMonthDays = Array.from({ length: totalSlots - (firstDayIndex + daysInMonth) }, (_, i) => i + 1);

  const getCallsForDay = (day: number) => {
    const datePattern = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return scheduledCalls.filter((c) => c.scheduledDateTime.startsWith(datePattern) && (filterCampaign === 'all' || c.campaignType === filterCampaign));
  };

  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const jumpToday = () => setCurrentDate(new Date(2026, 9, 1));

  return (
    <div className="space-y-6 text-white font-sans">
      {/* 1. Top Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <h2 className="text-xl font-bold text-white flex items-center space-x-2">
              <CalendarIcon className="w-6 h-6 text-cyan-400" />
              <span>Outbound Recovery Call Scheduler & Calendar</span>
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              {scheduledCalls.length} Calls Queued
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Schedule future autonomous recovery calls with real-time TCPA calling hour validation and automated retry ladders.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                viewMode === 'calendar' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Month View
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                viewMode === 'list' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Queue Ledger
            </button>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-semibold text-xs flex items-center space-x-2 shadow-lg shadow-cyan-500/20 transition-all hover:scale-105"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule Call</span>
          </button>
        </div>
      </div>

      {/* 2. Calendar Month Navigation & Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <h3 className="text-lg font-bold text-white flex items-center space-x-2">
              <span>{monthNames[month]} {year}</span>
            </h3>
            <button
              onClick={jumpToday}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 border border-slate-700"
            >
              Current
            </button>
            <div className="flex items-center space-x-1">
              <button
                onClick={prevMonth}
                aria-label="Previous month"
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={nextMonth}
                aria-label="Next month"
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Campaign Filter */}
          <div className="flex items-center space-x-2 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterCampaign}
              onChange={(e) => setFilterCampaign(e.target.value)}
              className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none"
            >
              <option value="all">All Campaigns ({scheduledCalls.length})</option>
              <option value="staged_dunning">Staged Dunning Retries</option>
              <option value="promise_followup">Promise-to-Pay Check</option>
              <option value="custom_outreach">Custom Outreach</option>
              <option value="vip_followup">VIP Executive Review</option>
            </select>
          </div>
        </div>

        {/* 3A. View 1: Month Calendar Grid */}
        {viewMode === 'calendar' && (
          <div className="overflow-x-auto">
            <div className="min-w-[700px]">
              {/* Day of Week Header */}
              <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-semibold uppercase text-slate-400">
                <span className="py-1 text-slate-500">Sun</span>
                <span className="py-1">Mon</span>
                <span className="py-1">Tue</span>
                <span className="py-1">Wed</span>
                <span className="py-1">Thu</span>
                <span className="py-1">Fri</span>
                <span className="py-1 text-slate-500">Sat</span>
              </div>

              {/* Day Cells Grid */}
              <div className="grid grid-cols-7 gap-2">
                {/* Previous month filler */}
                {prevMonthDays.map((d) => (
                  <div
                    key={`prev-${d}`}
                    className="h-28 p-2 rounded-2xl bg-slate-950/30 border border-slate-900 text-slate-600 text-xs opacity-40 select-none"
                  >
                    <span>{d}</span>
                  </div>
                ))}

                {/* Current month days */}
                {currentMonthDays.map((d) => {
                  const dayCalls = getCallsForDay(d);
                  const isToday = d === 1 && month === 9; // Oct 1, 2026

                  return (
                    <div
                      key={`day-${d}`}
                      onClick={() => {
                        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                        setScheduleDate(dateStr);
                        setIsModalOpen(true);
                      }}
                      className={`h-28 p-2 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                        isToday
                          ? 'bg-slate-950 border-cyan-500/80 shadow-md ring-1 ring-cyan-500/30'
                          : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold ${isToday ? 'text-cyan-400' : 'text-slate-300'}`}>
                          {d}
                        </span>
                        {isToday && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-500/20 text-cyan-400">
                            Today
                          </span>
                        )}
                        {dayCalls.length > 0 && (
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        )}
                      </div>

                      {/* Call Events List on Day */}
                      <div className="space-y-1 overflow-y-auto max-h-20">
                        {dayCalls.map((call) => (
                          <div
                            key={call.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCallDetails(call);
                            }}
                            className={`p-1 px-1.5 rounded-lg text-[10px] truncate font-medium border flex items-center justify-between ${
                              call.isCompliantWindow
                                ? 'bg-cyan-500/10 text-cyan-200 border-cyan-500/30 hover:bg-cyan-500/20'
                                : 'bg-amber-500/10 text-amber-200 border-amber-500/30 hover:bg-amber-500/20'
                            }`}
                            title={`${call.customerName} - ${call.reason}`}
                          >
                            <span className="truncate">{call.customerName.split(' ')[0]}</span>
                            <span className="text-[9px] opacity-75 font-mono ml-1">
                              {new Date(call.scheduledDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {/* Next month filler */}
                {nextMonthDays.map((d) => (
                  <div
                    key={`next-${d}`}
                    className="h-28 p-2 rounded-2xl bg-slate-950/30 border border-slate-900 text-slate-600 text-xs opacity-40 select-none"
                  >
                    <span>{d}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 3B. View 2: Queue Ledger Table */}
        {viewMode === 'list' && (
          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Scheduled Date & Time</th>
                  <th className="py-3.5 px-4">Customer Entity</th>
                  <th className="py-3.5 px-4">Campaign & Reason</th>
                  <th className="py-3.5 px-4">Customer Local Time</th>
                  <th className="py-3.5 px-4">TCPA Status</th>
                  <th className="py-3.5 px-4">State</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 bg-slate-900/60">
                {scheduledCalls.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      No calls currently scheduled. Click &quot;Schedule Call&quot; to queue an outreach.
                    </td>
                  </tr>
                ) : (
                  scheduledCalls.map((call) => (
                    <tr key={call.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-[11px] text-slate-200">
                        {new Date(call.scheduledDateTime).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}{' '}
                        <span className="text-cyan-400 font-semibold">
                          {new Date(call.scheduledDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-semibold text-white block">{call.customerName}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{call.customerPhone}</span>
                      </td>

                      <td className="py-3.5 px-4 max-w-xs">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-200 border border-slate-700 inline-block mb-1">
                          {call.campaignType.replace(/_/g, ' ')}
                        </span>
                        <p className="text-slate-300 truncate" title={call.reason}>{call.reason}</p>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-slate-300 text-[11px]">
                        <div>{call.customerLocalTimeFormatted}</div>
                        <span className="text-[10px] text-slate-500">{call.customerTimezone.split('/')[1] || call.customerTimezone}</span>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {call.isCompliantWindow ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center space-x-1 w-max">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>TCPA APPROVED</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center space-x-1 w-max">
                            <AlertTriangle className="w-3 h-3" />
                            <span>OFF-HOURS WARNING</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-cyan-300 uppercase">
                          {call.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => handleTriggerNow(call)}
                            title="Dial now in Ava Voice Studio"
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center space-x-1 shadow-sm transition-all"
                          >
                            <Phone className="w-3 h-3" />
                            <span>Dial Now</span>
                          </button>
                          <button
                            onClick={() => handleCancelCall(call.id)}
                            title="Cancel scheduled call"
                            className="p-1 rounded-lg bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-400 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Scheduling Modal Dialog */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl relative text-white my-6">
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
                  <CalendarIcon className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Schedule Future Recovery Call</h3>
                  <p className="text-xs text-slate-400">Automated Ava dunning with legal calling window verification.</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleScheduleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Quick Presets */}
              <div>
                <span className="text-xs font-semibold text-slate-400 block mb-1.5">Quick Interval Presets:</span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => applyQuickPreset(1, 10, 30, 'staged_dunning', '24-hour staged dunning retry')}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-cyan-300 border border-slate-700"
                  >
                    Tomorrow 10:30 AM
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickPreset(3, 14, 0, 'promise_followup', 'Follow-up on Promise to Pay window')}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-cyan-300 border border-slate-700"
                  >
                    In 3 Days (2:00 PM)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickPreset(7, 11, 0, 'vip_followup', 'Weekly corporate account check')}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-cyan-300 border border-slate-700"
                  >
                    In 7 Days (11:00 AM)
                  </button>
                </div>
              </div>

              {/* Customer Selector */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Target Customer Account *</label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.plan} ({c.currency} {c.amount_due}) — TZ: {c.timezone}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date & Time Picker */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Scheduled Date *</label>
                  <input
                    type="date"
                    required
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Time (UTC / Local) *</label>
                  <input
                    type="time"
                    required
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Live TCPA Compliance Calling Window Banner */}
              <div className={`p-3.5 rounded-2xl border text-xs space-y-1.5 ${
                localTimeCalc.isCompliant
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                  : 'bg-amber-500/15 border-amber-500/40 text-amber-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 font-semibold">
                    {localTimeCalc.isCompliant ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                    )}
                    <span>Customer Local Time: {localTimeCalc.localTime}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    localTimeCalc.isCompliant
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-amber-500/30 text-amber-300'
                  }`}>
                    {localTimeCalc.isCompliant ? 'TCPA LEGAL (09:00 - 20:00)' : 'RESTRICTED WINDOW'}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed opacity-90">
                  {localTimeCalc.isCompliant
                    ? `Complies with TCPA & TRAI calling restrictions for ${selectedCustomer?.timezone}.`
                    : `Warning: ${localTimeCalc.localTime} is outside legal 09:00–20:00 calling hours for ${selectedCustomer?.timezone}. The compliance engine will block this call unless override is permitted.`}
                </p>
              </div>

              {/* Campaign Type & Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Campaign Strategy</label>
                  <select
                    value={campaignType}
                    onChange={(e) => setCampaignType(e.target.value as any)}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
                  >
                    <option value="staged_dunning">Staged Dunning (+24h/+3d)</option>
                    <option value="promise_followup">Promise-to-Pay Followup</option>
                    <option value="custom_outreach">Custom Outreach</option>
                    <option value="vip_followup">VIP Executive Review</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Queue Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
                  >
                    <option value="normal">Normal</option>
                    <option value="high">High Priority</option>
                    <option value="urgent">Urgent Escalation</option>
                  </select>
                </div>
              </div>

              {/* Call Objective / Notes */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Call Reason / Brief</label>
                <textarea
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason for scheduled outreach..."
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Modal Buttons */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end space-x-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-semibold text-xs flex items-center space-x-2 shadow-lg shadow-cyan-500/20 disabled:opacity-50"
                >
                  <span>{isSaving ? 'Scheduling Call...' : 'Confirm & Queue Call'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Call Details Drawer Modal */}
      {selectedCallDetails && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative text-white p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">{selectedCallDetails.customerName}</h4>
                  <span className="text-[10px] text-slate-400 font-mono">{selectedCallDetails.id}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedCallDetails(null)}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Scheduled Time:</span>
                <span className="font-semibold text-white font-mono">
                  {new Date(selectedCallDetails.scheduledDateTime).toLocaleString()}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Customer Local Time:</span>
                <span className="font-semibold text-cyan-400 font-mono">
                  {selectedCallDetails.customerLocalTimeFormatted}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Target Timezone:</span>
                <span className="text-slate-300 font-mono">{selectedCallDetails.customerTimezone}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Campaign Type:</span>
                <span className="text-slate-200 capitalize">{selectedCallDetails.campaignType.replace(/_/g, ' ')}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Amount Due:</span>
                <span className="font-bold text-emerald-400 font-mono">
                  {selectedCallDetails.currency} {selectedCallDetails.amountDue.toLocaleString()}
                </span>
              </div>

              <div className="pt-2">
                <span className="text-slate-400 block mb-1">Objective / Notes:</span>
                <p className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-slate-300">
                  {selectedCallDetails.reason}
                </p>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between gap-2">
              <button
                onClick={() => handleCancelCall(selectedCallDetails.id)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-red-950 text-slate-300 hover:text-red-400 text-xs font-semibold transition-colors"
              >
                Cancel Call
              </button>

              <button
                onClick={() => handleTriggerNow(selectedCallDetails)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-emerald-600/20"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Dial Now in Studio</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
