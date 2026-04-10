'use client';

/**
 * Create Appointment Form
 *
 * Full appointment creation form with:
 * - Event type selector
 * - Customer name, phone, email, address
 * - Date picker (mini calendar)
 * - Time picker with available slots
 * - Assigned rep dropdown
 * - Duration, priority, notes
 * - Shows Google Calendar link prominently on success
 */

import { useState, useEffect } from 'react';
import {
  Calendar, Clock, User, MapPin, Phone, Mail, Briefcase,
  CheckCircle2, ChevronLeft, ChevronRight, Loader2, Search,
  AlertCircle, X, ExternalLink, Plus, FileText,
} from 'lucide-react';

interface TeamMemberOption {
  id: string;
  name: string;
  slug: string;
  role: string;
}

interface CreateAppointmentFormProps {
  teamMembers: TeamMemberOption[];
  onClose: () => void;
  onCreated?: (appointment: CreatedAppointment) => void;
  defaultDate?: Date;
  defaultRep?: string;
  // Pre-fill customer fields (e.g., from lead or customer search)
  defaultCustomer?: {
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
    customerId?: string;
  };
}

interface CreatedAppointment {
  appointmentId: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  googleCalendarLink: string;
  customerGoogleCalendarLink: string;
}

const APPOINTMENT_TYPES = [
  { value: 'inspection', label: 'Roof Inspection', icon: '🔍', duration: 60 },
  { value: 'estimate', label: 'Estimate', icon: '📋', duration: 60 },
  { value: 'followup', label: 'Follow-up', icon: '📞', duration: 30 },
  { value: 'installation', label: 'Installation', icon: '🏗️', duration: 480 },
  { value: 'repair', label: 'Repair', icon: '🔧', duration: 240 },
  { value: 'meeting', label: 'Meeting', icon: '👥', duration: 60 },
  { value: 'other', label: 'Other', icon: '📅', duration: 60 },
];

const PRIORITY_OPTIONS = [
  { value: 'normal', label: 'Normal', color: 'text-zinc-400' },
  { value: 'rush', label: 'Rush', color: 'text-yellow-400' },
  { value: 'urgent', label: 'Urgent', color: 'text-red-400' },
];

export default function CreateAppointmentForm({
  teamMembers,
  onClose,
  onCreated,
  defaultDate,
  defaultRep,
  defaultCustomer,
}: CreateAppointmentFormProps) {
  // Form state
  const [step, setStep] = useState<'type' | 'details' | 'schedule' | 'review' | 'success'>('type');
  const [appointmentType, setAppointmentType] = useState('');
  const [customerName, setCustomerName] = useState(defaultCustomer?.name || '');
  const [customerPhone, setCustomerPhone] = useState(defaultCustomer?.phone || '');
  const [customerEmail, setCustomerEmail] = useState(defaultCustomer?.email || '');
  const [customerId, setCustomerId] = useState(defaultCustomer?.customerId || '');
  const [address, setAddress] = useState(defaultCustomer?.address || '');
  const [city, setCity] = useState('');
  const [stateVal, setStateVal] = useState('AL');
  const [zip, setZip] = useState('');
  const [assignedTo, setAssignedTo] = useState(defaultRep || '');
  const [selectedDate, setSelectedDate] = useState<Date | null>(defaultDate || null);
  const [selectedTime, setSelectedTime] = useState('');
  const [duration, setDuration] = useState(60);
  const [priority, setPriority] = useState('normal');
  const [notes, setNotes] = useState('');
  const [jobName, setJobName] = useState('');
  const [customerReminderPref, setCustomerReminderPref] = useState('both');

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentMonth, setCurrentMonth] = useState(defaultDate || new Date());
  const [createdAppointment, setCreatedAppointment] = useState<CreatedAppointment | null>(null);

  // R-number auto-populate for appointments
  const [jobNumber, setJobNumber] = useState('');
  const [jobLooking, setJobLooking] = useState(false);
  const [jobLookupMsg, setJobLookupMsg] = useState<string | null>(null);

  const lookupByJobNumber = async (num: string) => {
    const trimmed = num.trim();
    if (!trimmed || trimmed.length < 2) return;
    if (customerName && customerPhone) return; // already populated
    setJobLooking(true);
    setJobLookupMsg(null);
    try {
      const res = await fetch(
        `/api/portal/delivery/work-orders?action=lookup&jobNumber=${encodeURIComponent(trimmed)}`
      );
      if (!res.ok) { setJobLookupMsg('Lookup failed'); return; }
      const data = await res.json();
      if (data.success && data.customerName) {
        setCustomerName(data.customerName || '');
        setCustomerPhone(data.phone || '');
        setCustomerEmail(data.email || '');
        setCustomerId(data.jnJobId || '');
        setJobName(data.jobName || '');
        setAddress(data.addressParts?.street || data.address || '');
        setCity(data.addressParts?.city || '');
        setStateVal(data.addressParts?.state || 'AL');
        setZip(data.addressParts?.zip || '');
        setJobLookupMsg(`Imported: ${data.customerName}`);
      } else {
        setJobLookupMsg(data.error || 'No match — fill in manually');
      }
    } catch {
      setJobLookupMsg('Lookup error');
    } finally {
      setJobLooking(false);
    }
  };

  // Time slots generation (business hours 7 AM - 6 PM, 30-min increments)
  const timeSlots: string[] = [];
  for (let h = 7; h <= 17; h++) {
    for (const m of [0, 30]) {
      if (h === 17 && m === 30) continue;
      const hh = String(h).padStart(2, '0');
      const mm = String(m).padStart(2, '0');
      timeSlots.push(`${hh}:${mm}`);
    }
  }

  const formatTimeDisplay = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  // Update duration when type changes
  useEffect(() => {
    const typeConfig = APPOINTMENT_TYPES.find(t => t.value === appointmentType);
    if (typeConfig) {
      setDuration(typeConfig.duration);
    }
  }, [appointmentType]);

  // Calendar helpers
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: Date[] = [];

    // Padding from previous month
    for (let i = firstDay.getDay() - 1; i >= 0; i--) {
      days.push(new Date(year, month, -i));
    }
    // Days in current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }
    // Fill to 42
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push(new Date(year, month + 1, i));
    }
    return days;
  };

  const isDateDisabled = (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d < today || date.getDay() === 0; // No Sundays, no past dates
  };

  // Get assigned rep name
  const getRepName = () => {
    const member = teamMembers.find(m => m.slug === assignedTo || m.id === assignedTo);
    return member?.name || assignedTo;
  };

  // Format date for display
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Submit appointment
  const handleSubmit = async () => {
    if (!selectedDate || !selectedTime || !customerName || !address || !appointmentType) {
      setError('Please fill in all required fields');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      const repMember = teamMembers.find(m => m.slug === assignedTo || m.id === assignedTo);

      const response = await fetch('/api/calendar/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: appointmentType,
          date: dateStr,
          startTime: selectedTime,
          duration,
          address,
          city,
          state: stateVal,
          zip,
          customerName,
          customerPhone,
          customerEmail,
          customerId,
          assignedTo: repMember?.slug || assignedTo,
          assignedToName: repMember?.name || assignedTo,
          jobName,
          priority,
          customerReminderPref,
          notes,
          source: 'portal',
        }),
      });

      const data = await response.json();

      if (data.success) {
        const created: CreatedAppointment = {
          appointmentId: data.appointment.appointmentId,
          title: data.appointment.title,
          date: data.appointment.date,
          startTime: data.appointment.startTime,
          endTime: data.appointment.endTime,
          googleCalendarLink: data.appointment.googleCalendarLink,
          customerGoogleCalendarLink: data.appointment.customerGoogleCalendarLink,
        };
        setCreatedAppointment(created);
        setStep('success');
        onCreated?.(created);
      } else {
        setError(data.error || 'Failed to create appointment');
      }
    } catch {
      setError('Failed to create appointment. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate end time for display
  const getEndTimeDisplay = () => {
    if (!selectedTime) return '';
    const [h, m] = selectedTime.split(':').map(Number);
    const endMin = h * 60 + m + duration;
    const endH = Math.floor(endMin / 60);
    const endM = endMin % 60;
    return formatTimeDisplay(`${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-lime-500/20 flex items-center justify-center">
              <Plus className="w-5 h-5 text-lime-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">New Appointment</h2>
              <p className="text-sm text-zinc-400">
                {step === 'type' && 'Select appointment type'}
                {step === 'details' && 'Customer & assignment details'}
                {step === 'schedule' && 'Pick date and time'}
                {step === 'review' && 'Review and confirm'}
                {step === 'success' && 'Appointment created'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Progress Bar */}
        {step !== 'success' && (
          <div className="px-6 pt-4">
            <div className="flex items-center gap-1">
              {['type', 'details', 'schedule', 'review'].map((s, i) => (
                <div
                  key={s}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    ['type', 'details', 'schedule', 'review'].indexOf(step) >= i
                      ? 'bg-lime-500'
                      : 'bg-zinc-700'
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Content */}
        <div className="p-6">
          {/* ============ STEP 1: TYPE SELECTION ============ */}
          {step === 'type' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {APPOINTMENT_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => {
                    setAppointmentType(type.value);
                    setStep('details');
                  }}
                  className={`p-4 rounded-xl border transition-all text-left hover:border-lime-500/50 hover:bg-zinc-800/50 ${
                    appointmentType === type.value
                      ? 'border-lime-500 bg-lime-500/10'
                      : 'border-zinc-700 bg-zinc-800/30'
                  }`}
                >
                  <span className="text-2xl">{type.icon}</span>
                  <p className="text-sm font-medium text-white mt-2">{type.label}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{type.duration} min</p>
                </button>
              ))}
            </div>
          )}

          {/* ============ STEP 2: DETAILS ============ */}
          {step === 'details' && (
            <div className="space-y-4">
              <button
                onClick={() => setStep('type')}
                className="flex items-center gap-1 text-sm text-zinc-400 hover:text-white transition-colors"
              >
                <ChevronLeft size={16} /> Back to type
              </button>

              {/* Job Number auto-populate */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
                  <Search size={16} className="text-lime-400" /> Quick Lookup
                </h3>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    Job Number <span className="text-zinc-600">(enter R-number to auto-fill everything)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={jobNumber}
                      onChange={(e) => setJobNumber(e.target.value)}
                      onBlur={(e) => lookupByJobNumber(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); lookupByJobNumber(jobNumber); } }}
                      placeholder="R-12345"
                      className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:border-lime-500 focus:ring-1 focus:ring-lime-500 text-sm"
                    />
                    {jobLooking && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Loader2 size={16} className="animate-spin text-lime-400" />
                      </div>
                    )}
                  </div>
                  {jobLookupMsg && (
                    <p className={`mt-1 text-xs ${jobLookupMsg.startsWith('Imported') ? 'text-lime-400' : 'text-zinc-500'}`}>
                      {jobLookupMsg}
                    </p>
                  )}
                </div>
              </div>

              {/* Customer Info */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
                  <User size={16} className="text-lime-400" /> Customer Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Customer Name *</label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="John Smith"
                      className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:border-lime-500 focus:ring-1 focus:ring-lime-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="256-555-0123"
                      className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:border-lime-500 focus:ring-1 focus:ring-lime-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Email</label>
                    <input
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="john@example.com"
                      className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:border-lime-500 focus:ring-1 focus:ring-lime-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Job / Reference Name</label>
                    <input
                      type="text"
                      value={jobName}
                      onChange={(e) => setJobName(e.target.value)}
                      placeholder="Smith Roof Replacement"
                      className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:border-lime-500 focus:ring-1 focus:ring-lime-500 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Address */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
                  <MapPin size={16} className="text-lime-400" /> Location *
                </h3>
                <div>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="123 Main Street"
                    className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:border-lime-500 focus:ring-1 focus:ring-lime-500 text-sm"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="City"
                    className="px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:border-lime-500 focus:ring-1 focus:ring-lime-500 text-sm"
                  />
                  <select
                    value={stateVal}
                    onChange={(e) => setStateVal(e.target.value)}
                    className="px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:border-lime-500 focus:ring-1 focus:ring-lime-500 text-sm"
                  >
                    <option value="AL">AL</option>
                    <option value="TN">TN</option>
                    <option value="GA">GA</option>
                    <option value="MS">MS</option>
                    <option value="FL">FL</option>
                  </select>
                  <input
                    type="text"
                    value={zip}
                    onChange={(e) => setZip(e.target.value)}
                    placeholder="ZIP"
                    className="px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:border-lime-500 focus:ring-1 focus:ring-lime-500 text-sm"
                  />
                </div>
              </div>

              {/* Assignment & Priority */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
                  <Briefcase size={16} className="text-lime-400" /> Assignment
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Assigned Rep</label>
                    <select
                      value={assignedTo}
                      onChange={(e) => setAssignedTo(e.target.value)}
                      className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:border-lime-500 focus:ring-1 focus:ring-lime-500 text-sm"
                    >
                      <option value="">Unassigned</option>
                      {teamMembers.map(m => (
                        <option key={m.id} value={m.slug}>{m.name} ({m.role})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Priority</label>
                    <div className="flex gap-2">
                      {PRIORITY_OPTIONS.map(p => (
                        <button
                          key={p.value}
                          onClick={() => setPriority(p.value)}
                          className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-medium transition-all border ${
                            priority === p.value
                              ? 'border-lime-500 bg-lime-500/10 text-lime-400'
                              : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Customer Reminders */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Customer Reminders</label>
                <select
                  value={customerReminderPref}
                  onChange={(e) => setCustomerReminderPref(e.target.value)}
                  className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:border-lime-500 focus:ring-1 focus:ring-lime-500 text-sm"
                >
                  <option value="both">Day before + 1 hour before</option>
                  <option value="day_before">Day before only</option>
                  <option value="hour_before">1 hour before only</option>
                  <option value="none">No customer reminders</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any special instructions or details..."
                  rows={2}
                  className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:border-lime-500 focus:ring-1 focus:ring-lime-500 text-sm resize-none"
                />
              </div>

              <button
                onClick={() => {
                  if (!customerName || !address) {
                    setError('Customer name and address are required');
                    return;
                  }
                  setError('');
                  setStep('schedule');
                }}
                className="w-full py-3 bg-lime-500 text-zinc-900 font-bold rounded-lg hover:bg-lime-400 transition-colors"
              >
                Next: Pick Date & Time
              </button>
            </div>
          )}

          {/* ============ STEP 3: SCHEDULE ============ */}
          {step === 'schedule' && (
            <div className="space-y-4">
              <button
                onClick={() => setStep('details')}
                className="flex items-center gap-1 text-sm text-zinc-400 hover:text-white transition-colors"
              >
                <ChevronLeft size={16} /> Back to details
              </button>

              {/* Mini Calendar */}
              <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700">
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={() => {
                      const d = new Date(currentMonth);
                      d.setMonth(d.getMonth() - 1);
                      setCurrentMonth(d);
                    }}
                    className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-700 transition-colors"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <h3 className="text-sm font-semibold text-white">
                    {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </h3>
                  <button
                    onClick={() => {
                      const d = new Date(currentMonth);
                      d.setMonth(d.getMonth() + 1);
                      setCurrentMonth(d);
                    }}
                    className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-700 transition-colors"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                    <div key={d} className="text-center text-[11px] font-medium text-zinc-500 py-1">{d}</div>
                  ))}
                  {generateCalendarDays().map((date, i) => {
                    const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
                    const disabled = isDateDisabled(date);
                    const isSelected = selectedDate?.toDateString() === date.toDateString();
                    const isToday = date.toDateString() === today.toDateString();

                    return (
                      <button
                        key={i}
                        onClick={() => !disabled && isCurrentMonth && setSelectedDate(date)}
                        disabled={disabled || !isCurrentMonth}
                        className={`aspect-square rounded-lg text-sm font-medium transition-all ${
                          !isCurrentMonth ? 'text-zinc-700' :
                          disabled ? 'text-zinc-600 cursor-not-allowed' :
                          isSelected ? 'bg-lime-500 text-zinc-900' :
                          isToday ? 'ring-1 ring-lime-500 text-white hover:bg-zinc-700' :
                          'text-zinc-300 hover:bg-zinc-700'
                        }`}
                      >
                        {date.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time Selection */}
              {selectedDate && (
                <div>
                  <p className="text-sm text-zinc-400 mb-2">
                    <Calendar className="inline w-4 h-4 mr-1 text-lime-400" />
                    {formatDate(selectedDate)}
                  </p>

                  {/* Duration */}
                  <div className="mb-3">
                    <label className="block text-xs text-zinc-400 mb-1">Duration</label>
                    <select
                      value={duration}
                      onChange={(e) => setDuration(Number(e.target.value))}
                      className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:border-lime-500"
                    >
                      <option value={30}>30 minutes</option>
                      <option value={60}>1 hour</option>
                      <option value={90}>1.5 hours</option>
                      <option value={120}>2 hours</option>
                      <option value={180}>3 hours</option>
                      <option value={240}>4 hours</option>
                      <option value={480}>Full day (8 hrs)</option>
                    </select>
                  </div>

                  {/* Time grid */}
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-xs font-medium text-zinc-500 mb-2">Morning</h4>
                      <div className="grid grid-cols-4 gap-1.5">
                        {timeSlots.filter(t => parseInt(t) < 12).map(t => (
                          <button
                            key={t}
                            onClick={() => setSelectedTime(t)}
                            className={`px-2 py-2 rounded-lg text-xs font-medium transition-all ${
                              selectedTime === t
                                ? 'bg-lime-500 text-zinc-900'
                                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                            }`}
                          >
                            {formatTimeDisplay(t)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-medium text-zinc-500 mb-2">Afternoon</h4>
                      <div className="grid grid-cols-4 gap-1.5">
                        {timeSlots.filter(t => parseInt(t) >= 12).map(t => (
                          <button
                            key={t}
                            onClick={() => setSelectedTime(t)}
                            className={`px-2 py-2 rounded-lg text-xs font-medium transition-all ${
                              selectedTime === t
                                ? 'bg-lime-500 text-zinc-900'
                                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                            }`}
                          >
                            {formatTimeDisplay(t)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {selectedDate && selectedTime && (
                <button
                  onClick={() => {
                    setError('');
                    setStep('review');
                  }}
                  className="w-full py-3 bg-lime-500 text-zinc-900 font-bold rounded-lg hover:bg-lime-400 transition-colors"
                >
                  Next: Review
                </button>
              )}
            </div>
          )}

          {/* ============ STEP 4: REVIEW ============ */}
          {step === 'review' && selectedDate && (
            <div className="space-y-4">
              <button
                onClick={() => setStep('schedule')}
                className="flex items-center gap-1 text-sm text-zinc-400 hover:text-white transition-colors"
              >
                <ChevronLeft size={16} /> Back to schedule
              </button>

              {/* Summary Card */}
              <div className="bg-zinc-800/50 rounded-xl p-5 border border-zinc-700 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">
                    {APPOINTMENT_TYPES.find(t => t.value === appointmentType)?.icon || '📅'}
                  </span>
                  <div>
                    <h3 className="text-lg font-bold text-white">
                      {APPOINTMENT_TYPES.find(t => t.value === appointmentType)?.label} - {customerName}
                    </h3>
                    <p className="text-sm text-zinc-400 capitalize">{priority} priority</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-zinc-300">
                    <Calendar className="w-4 h-4 text-lime-400" />
                    {formatDate(selectedDate)}
                  </div>
                  <div className="flex items-center gap-2 text-zinc-300">
                    <Clock className="w-4 h-4 text-lime-400" />
                    {formatTimeDisplay(selectedTime)} - {getEndTimeDisplay()} ({duration} min)
                  </div>
                  <div className="flex items-center gap-2 text-zinc-300">
                    <MapPin className="w-4 h-4 text-lime-400" />
                    {[address, city, stateVal, zip].filter(Boolean).join(', ')}
                  </div>
                  {assignedTo && (
                    <div className="flex items-center gap-2 text-zinc-300">
                      <User className="w-4 h-4 text-lime-400" />
                      {getRepName()}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-zinc-300">
                    <Phone className="w-4 h-4 text-lime-400" />
                    {customerPhone || 'Not provided'}
                  </div>
                  {customerEmail && (
                    <div className="flex items-center gap-2 text-zinc-300">
                      <Mail className="w-4 h-4 text-lime-400" />
                      {customerEmail}
                    </div>
                  )}
                </div>

                {notes && (
                  <div className="pt-3 border-t border-zinc-700">
                    <p className="text-xs text-zinc-400">Notes</p>
                    <p className="text-sm text-zinc-300 mt-1">{notes}</p>
                  </div>
                )}
              </div>

              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="w-full py-3 bg-lime-500 text-zinc-900 font-bold rounded-lg hover:bg-lime-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creating Appointment...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    Create Appointment
                  </>
                )}
              </button>
            </div>
          )}

          {/* ============ STEP 5: SUCCESS ============ */}
          {step === 'success' && createdAppointment && (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 bg-lime-500/20 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-lime-400" />
              </div>

              <div>
                <h3 className="text-xl font-bold text-white">Appointment Scheduled</h3>
                <p className="text-zinc-400 mt-1">{createdAppointment.title}</p>
                <p className="text-zinc-400 text-sm">
                  {selectedDate && formatDate(selectedDate)} at {formatTimeDisplay(createdAppointment.startTime)}
                </p>
              </div>

              {/* Google Calendar Link - PROMINENT */}
              <div className="space-y-3">
                <a
                  href={createdAppointment.googleCalendarLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-3 w-full py-3.5 bg-lime-500 text-zinc-900 font-bold rounded-lg hover:bg-lime-400 transition-colors text-base"
                >
                  <ExternalLink className="w-5 h-5" />
                  Add to Google Calendar
                </a>

                {customerEmail && (
                  <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700">
                    <p className="text-xs text-zinc-400 mb-2">Customer Calendar Link (share with customer):</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={createdAppointment.customerGoogleCalendarLink}
                        className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-xs text-zinc-300 truncate"
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(createdAppointment.customerGoogleCalendarLink);
                        }}
                        className="px-3 py-2 bg-zinc-700 text-zinc-300 rounded text-xs hover:bg-zinc-600 transition-colors shrink-0"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    // Reset form for another appointment
                    setStep('type');
                    setAppointmentType('');
                    setCustomerName('');
                    setCustomerPhone('');
                    setCustomerEmail('');
                    setAddress('');
                    setSelectedDate(null);
                    setSelectedTime('');
                    setNotes('');
                    setCreatedAppointment(null);
                  }}
                  className="flex-1 py-2.5 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors text-sm"
                >
                  Create Another
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors text-sm"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
