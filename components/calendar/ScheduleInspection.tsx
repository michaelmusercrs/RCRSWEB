'use client';

/**
 * Schedule Inspection Component
 *
 * Allows customers to book inspection appointments through the portal.
 * Displays available time slots and handles booking submission.
 */

import { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  User,
  MapPin,
  Phone,
  Mail,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
} from 'lucide-react';

interface TimeSlot {
  startTime: string;
  endTime: string;
  displayTime: string;
  displayRange: string;
}

interface GroupedSlots {
  morning: TimeSlot[];
  afternoon: TimeSlot[];
}

interface ScheduleInspectionProps {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  customerId?: string;
  customerAddress?: string;
  onScheduled?: (event: ScheduledEvent) => void;
  onCancel?: () => void;
  className?: string;
}

interface ScheduledEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location: string;
  googleCalendarLink?: string;
}

export default function ScheduleInspection({
  customerName,
  customerPhone,
  customerEmail,
  customerId,
  customerAddress,
  onScheduled,
  onCancel,
  className = '',
}: ScheduleInspectionProps) {
  const [step, setStep] = useState<'date' | 'time' | 'confirm' | 'success'>('date');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [address, setAddress] = useState(customerAddress || '');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [slots, setSlots] = useState<GroupedSlots>({ morning: [], afternoon: [] });
  const [error, setError] = useState('');
  const [scheduledEvent, setScheduledEvent] = useState<ScheduledEvent | null>(null);

  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Generate calendar days
  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days: Date[] = [];
    const current = new Date(startDate);

    while (current <= lastDay || days.length % 7 !== 0) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return days;
  };

  const calendarDays = generateCalendarDays();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Fetch available slots when date is selected
  useEffect(() => {
    if (selectedDate) {
      fetchAvailableSlots(selectedDate);
    }
  }, [selectedDate]);

  const fetchAvailableSlots = async (date: Date) => {
    setIsLoadingSlots(true);
    setError('');

    try {
      const dateStr = date.toISOString().split('T')[0];
      const response = await fetch(
        `/api/calendar/slots?date=${dateStr}&eventType=inspection&duration=60`
      );
      const data = await response.json();

      if (data.success) {
        setSlots(data.grouped);
        setStep('time');
      } else {
        setError(data.error || 'Failed to load available times');
      }
    } catch {
      setError('Failed to load available times. Please try again.');
    } finally {
      setIsLoadingSlots(false);
    }
  };

  const handleSchedule = async () => {
    if (!selectedDate || !selectedSlot || !address) {
      setError('Please complete all required fields');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/calendar/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'inspection',
          startTime: selectedSlot.startTime,
          duration: 60,
          location: address,
          customerName,
          customerPhone,
          customerEmail,
          customerId,
          notes,
        }),
      });

      const data = await response.json();

      if (data.success) {
        const event = {
          ...data.event,
          googleCalendarLink: data.googleCalendarLink || data.event?.googleCalendarLink,
        };
        setScheduledEvent(event);
        setStep('success');
        onScheduled?.(event);
      } else {
        setError(data.error || 'Failed to schedule inspection');
      }
    } catch {
      setError('Failed to schedule inspection. Please try again or call us.');
    } finally {
      setIsLoading(false);
    }
  };

  const isDateDisabled = (date: Date) => {
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    // Disable past dates, weekends
    return checkDate < today || date.getDay() === 0 || date.getDay() === 6;
  };

  const formatDateDisplay = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className={`bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-neutral-800 bg-brand-green/10">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-brand-green/20 rounded-xl flex items-center justify-center">
            <Calendar className="w-6 h-6 text-brand-green" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Schedule Your Inspection</h2>
            <p className="text-gray-400 text-sm">Free roof inspection by our certified team</p>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="px-6 py-4 border-b border-neutral-800">
        <div className="flex items-center justify-between">
          {['Select Date', 'Select Time', 'Confirm'].map((label, index) => {
            const stepNum = index + 1;
            const isActive = (step === 'date' && stepNum === 1) ||
                            (step === 'time' && stepNum === 2) ||
                            ((step === 'confirm' || step === 'success') && stepNum === 3);
            const isComplete = (step === 'time' && stepNum === 1) ||
                              ((step === 'confirm' || step === 'success') && stepNum <= 2) ||
                              (step === 'success' && stepNum === 3);

            return (
              <div key={label} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  isComplete ? 'bg-brand-green text-black' :
                  isActive ? 'bg-brand-green/50 text-white' :
                  'bg-neutral-700 text-gray-400'
                }`}>
                  {isComplete ? <CheckCircle2 className="w-5 h-5" /> : stepNum}
                </div>
                <span className={`ml-2 text-sm ${isActive || isComplete ? 'text-white' : 'text-gray-500'}`}>
                  {label}
                </span>
                {index < 2 && (
                  <div className={`w-12 h-0.5 mx-3 ${
                    isComplete ? 'bg-brand-green' : 'bg-neutral-700'
                  }`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Step Content */}
      <div className="p-6">
        {/* Date Selection */}
        {step === 'date' && (
          <div>
            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)))}
                className="p-2 rounded-lg text-gray-400 hover:bg-neutral-800 hover:text-white transition-colors"
                disabled={currentMonth.getMonth() === today.getMonth() && currentMonth.getFullYear() === today.getFullYear()}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h3 className="text-lg font-semibold text-white">
                {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h3>
              <button
                onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)))}
                className="p-2 rounded-lg text-gray-400 hover:bg-neutral-800 hover:text-white transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                  {day}
                </div>
              ))}
              {calendarDays.map((date, index) => {
                const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
                const isDisabled = isDateDisabled(date);
                const isSelected = selectedDate?.toDateString() === date.toDateString();
                const isToday = date.toDateString() === today.toDateString();

                return (
                  <button
                    key={index}
                    onClick={() => !isDisabled && isCurrentMonth && setSelectedDate(date)}
                    disabled={isDisabled || !isCurrentMonth}
                    className={`
                      aspect-square rounded-lg text-sm font-medium transition-all
                      ${!isCurrentMonth ? 'text-gray-700' : ''}
                      ${isDisabled && isCurrentMonth ? 'text-gray-600 cursor-not-allowed' : ''}
                      ${isSelected ? 'bg-brand-green text-black' : ''}
                      ${!isDisabled && isCurrentMonth && !isSelected ? 'text-white hover:bg-neutral-800' : ''}
                      ${isToday && !isSelected ? 'ring-1 ring-brand-green' : ''}
                    `}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>

            {isLoadingSlots && (
              <div className="mt-6 flex items-center justify-center text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Loading available times...
              </div>
            )}
          </div>
        )}

        {/* Time Selection */}
        {step === 'time' && selectedDate && (
          <div>
            <button
              onClick={() => setStep('date')}
              className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Change Date
            </button>

            <div className="mb-6 p-4 bg-neutral-800/50 rounded-lg">
              <p className="text-white font-medium">{formatDateDisplay(selectedDate)}</p>
            </div>

            {slots.morning.length === 0 && slots.afternoon.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No available times for this date.</p>
                <button
                  onClick={() => setStep('date')}
                  className="mt-4 text-brand-green hover:underline"
                >
                  Select a different date
                </button>
              </div>
            ) : (
              <>
                {slots.morning.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-gray-400 mb-3">Morning</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {slots.morning.map((slot) => (
                        <button
                          key={slot.startTime}
                          onClick={() => {
                            setSelectedSlot(slot);
                            setStep('confirm');
                          }}
                          className={`
                            p-3 rounded-lg text-sm font-medium transition-all
                            ${selectedSlot?.startTime === slot.startTime
                              ? 'bg-brand-green text-black'
                              : 'bg-neutral-800 text-white hover:bg-neutral-700'}
                          `}
                        >
                          {slot.displayTime}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {slots.afternoon.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-400 mb-3">Afternoon</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {slots.afternoon.map((slot) => (
                        <button
                          key={slot.startTime}
                          onClick={() => {
                            setSelectedSlot(slot);
                            setStep('confirm');
                          }}
                          className={`
                            p-3 rounded-lg text-sm font-medium transition-all
                            ${selectedSlot?.startTime === slot.startTime
                              ? 'bg-brand-green text-black'
                              : 'bg-neutral-800 text-white hover:bg-neutral-700'}
                          `}
                        >
                          {slot.displayTime}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Confirmation */}
        {step === 'confirm' && selectedDate && selectedSlot && (
          <div>
            <button
              onClick={() => setStep('time')}
              className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Change Time
            </button>

            <div className="space-y-4">
              {/* Appointment Summary */}
              <div className="p-4 bg-brand-green/10 border border-brand-green/30 rounded-lg">
                <h4 className="text-sm font-medium text-brand-green mb-3">Appointment Details</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-white">
                    <Calendar className="w-4 h-4 text-brand-green" />
                    {formatDateDisplay(selectedDate)}
                  </div>
                  <div className="flex items-center gap-2 text-white">
                    <Clock className="w-4 h-4 text-brand-green" />
                    {selectedSlot.displayRange}
                  </div>
                </div>
              </div>

              {/* Customer Info */}
              <div className="p-4 bg-neutral-800/50 rounded-lg space-y-2 text-sm">
                <div className="flex items-center gap-2 text-white">
                  <User className="w-4 h-4 text-gray-400" />
                  {customerName}
                </div>
                <div className="flex items-center gap-2 text-white">
                  <Phone className="w-4 h-4 text-gray-400" />
                  {customerPhone}
                </div>
                {customerEmail && (
                  <div className="flex items-center gap-2 text-white">
                    <Mail className="w-4 h-4 text-gray-400" />
                    {customerEmail}
                  </div>
                )}
              </div>

              {/* Address Input */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <MapPin className="w-4 h-4 inline mr-1" />
                  Property Address *
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Enter the address for inspection"
                  className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-gray-500 focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all"
                  required
                />
              </div>

              {/* Notes Input */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Additional Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any specific concerns or details about your roof..."
                  rows={3}
                  className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-gray-500 focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                {onCancel && (
                  <button
                    onClick={onCancel}
                    className="flex-1 py-3 bg-neutral-800 text-gray-300 rounded-lg hover:bg-neutral-700 transition-colors"
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={handleSchedule}
                  disabled={isLoading || !address}
                  className="flex-1 py-3 bg-brand-green text-black font-bold rounded-lg hover:bg-brand-green/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Scheduling...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      Confirm Inspection
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Success */}
        {step === 'success' && scheduledEvent && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-brand-green/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-brand-green" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Inspection Scheduled!</h3>
            <p className="text-gray-400 mb-6">
              We&apos;ll see you on {selectedDate && formatDateDisplay(selectedDate)} at {selectedSlot?.displayTime}
            </p>

            <div className="p-4 bg-neutral-800/50 rounded-lg text-left mb-6">
              <h4 className="text-sm font-medium text-gray-400 mb-3">Appointment Summary</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-white">
                  <Calendar className="w-4 h-4 text-brand-green" />
                  {selectedDate && formatDateDisplay(selectedDate)}
                </div>
                <div className="flex items-center gap-2 text-white">
                  <Clock className="w-4 h-4 text-brand-green" />
                  {selectedSlot?.displayRange}
                </div>
                <div className="flex items-center gap-2 text-white">
                  <MapPin className="w-4 h-4 text-brand-green" />
                  {address}
                </div>
              </div>
            </div>

            {scheduledEvent.googleCalendarLink && (
              <a
                href={scheduledEvent.googleCalendarLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-brand-green text-black font-bold rounded-lg hover:bg-brand-green/90 transition-all mb-4"
              >
                <Calendar className="w-5 h-5" />
                Add to Google Calendar
              </a>
            )}

            <p className="text-gray-500 text-sm">
              You will receive a confirmation call or text before your appointment.
              <br />
              Questions? Call us at{' '}
              <a href="tel:256-274-8530" className="text-brand-green hover:underline">
                256-274-8530
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
