'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Phone,
  LogOut,
  Home,
  Calendar,
  Cloud,
  MessageSquare,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Sun,
  CloudRain,
  Wind,
  Send,
  ChevronRight,
  RefreshCw,
  MapPin
} from 'lucide-react';

interface CustomerData {
  jnid: string;
  name: string;
  email: string;
  phone: string;
  address: string;
}

interface JobData {
  jnid: string;
  name: string;
  status: string;
  phase: string;
  progress: number;
  address: string;
  startDate?: string;
  estimatedCompletion?: string;
}

interface AppointmentData {
  id: string;
  title: string;
  date: string;
  time: string;
  type: 'inspection' | 'installation' | 'followup';
  status: 'scheduled' | 'confirmed' | 'completed';
}

interface WeatherData {
  current: {
    temp: number;
    condition: string;
    icon: string;
  };
  forecast: Array<{
    day: string;
    high: number;
    low: number;
    condition: string;
    workable: boolean;
  }>;
}

interface Message {
  id: string;
  from: string;
  content: string;
  timestamp: string;
  isCustomer: boolean;
}

const JOB_PHASES = [
  { id: 'lead', label: 'Initial Contact', icon: Phone },
  { id: 'inspection', label: 'Inspection', icon: Home },
  { id: 'estimate', label: 'Estimate', icon: FileText },
  { id: 'contract', label: 'Contract Signed', icon: CheckCircle2 },
  { id: 'permit', label: 'Permits', icon: FileText },
  { id: 'materials', label: 'Materials Ordered', icon: Building2 },
  { id: 'scheduled', label: 'Scheduled', icon: Calendar },
  { id: 'in_progress', label: 'In Progress', icon: Clock },
  { id: 'complete', label: 'Complete', icon: CheckCircle2 },
];

export default function CustomerDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'status' | 'appointments' | 'weather' | 'messages'>('status');
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [jobs, setJobs] = useState<JobData[]>([]);
  const [appointments, setAppointments] = useState<AppointmentData[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const session = sessionStorage.getItem('customerSession');
    if (!session) {
      router.push('/customer');
      return;
    }

    const customerData = JSON.parse(session);
    setCustomer(customerData);
    loadDashboardData(customerData.jnid);
  }, [router]);

  const loadDashboardData = async (customerId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/customer/dashboard?customerId=${customerId}`);
      const data = await response.json();

      if (data.success) {
        setJobs(data.jobs || []);
        setAppointments(data.appointments || []);
        setWeather(data.weather || null);
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('customerSession');
    router.push('/customer');
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !customer) return;

    const tempMessage: Message = {
      id: Date.now().toString(),
      from: customer.name,
      content: newMessage,
      timestamp: new Date().toISOString(),
      isCustomer: true,
    };

    setMessages([...messages, tempMessage]);
    setNewMessage('');

    try {
      await fetch('/api/customer/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customer.jnid,
          content: newMessage,
        }),
      });
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const getPhaseIndex = (phase: string) => {
    return JOB_PHASES.findIndex(p => p.id === phase);
  };

  const getWeatherIcon = (condition: string) => {
    const lower = condition.toLowerCase();
    if (lower.includes('rain') || lower.includes('storm')) return CloudRain;
    if (lower.includes('cloud')) return Cloud;
    if (lower.includes('wind')) return Wind;
    return Sun;
  };

  if (!customer) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-brand-green animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="bg-neutral-900 border-b border-brand-green/20 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Building2 className="w-8 h-8 text-brand-green" />
              <div>
                <h1 className="text-lg font-bold text-white">River City Roofing</h1>
                <p className="text-xs text-gray-400">Customer Portal</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="tel:256-274-8530"
                className="hidden sm:flex items-center gap-2 text-brand-green hover:text-white transition-colors"
              >
                <Phone className="w-4 h-4" />
                256-274-8530
              </a>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2 bg-neutral-800 rounded-lg text-gray-400 hover:text-white transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-brand-green/20 to-transparent border-b border-brand-green/20 py-6">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-white">Welcome, {customer.name.split(' ')[0]}!</h2>
          <p className="text-gray-400 mt-1 flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            {customer.address || 'Hartselle, AL'}
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-neutral-900/50 border-b border-neutral-800 sticky top-[72px] z-40">
        <div className="container mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto py-2">
            {[
              { id: 'status', label: 'Job Status', icon: Home },
              { id: 'appointments', label: 'Appointments', icon: Calendar },
              { id: 'weather', label: 'Weather', icon: Cloud },
              { id: 'messages', label: 'Messages', icon: MessageSquare },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                    activeTab === tab.id
                      ? 'bg-brand-green text-black'
                      : 'text-gray-400 hover:text-white hover:bg-neutral-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 text-brand-green animate-spin" />
          </div>
        ) : (
          <>
            {/* Job Status Tab */}
            {activeTab === 'status' && (
              <div className="space-y-6">
                {jobs.length === 0 ? (
                  <div className="bg-neutral-900 rounded-xl p-8 text-center border border-neutral-800">
                    <Home className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">No Active Projects</h3>
                    <p className="text-gray-400 mb-4">
                      Ready to start your roofing project? Contact us today!
                    </p>
                    <a
                      href="tel:256-274-8530"
                      className="inline-flex items-center gap-2 px-6 py-3 bg-brand-green text-black font-bold rounded-lg hover:bg-brand-green/90 transition-all"
                    >
                      <Phone className="w-5 h-5" />
                      Call 256-274-8530
                    </a>
                  </div>
                ) : (
                  jobs.map((job) => (
                    <div key={job.jnid} className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden">
                      <div className="p-6 border-b border-neutral-800">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="text-xl font-bold text-white">{job.name || 'Roofing Project'}</h3>
                            <p className="text-gray-400 flex items-center gap-2 mt-1">
                              <MapPin className="w-4 h-4" />
                              {job.address}
                            </p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                            job.status === 'complete' ? 'bg-green-500/20 text-green-400' :
                            job.status === 'in_progress' ? 'bg-brand-green/20 text-brand-green' :
                            'bg-blue-500/20 text-blue-400'
                          }`}>
                            {job.status?.replace('_', ' ').toUpperCase() || 'ACTIVE'}
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="mb-2">
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-400">Progress</span>
                            <span className="text-brand-green font-medium">{job.progress || 0}%</span>
                          </div>
                          <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-brand-green transition-all duration-500"
                              style={{ width: `${job.progress || 0}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Phase Timeline */}
                      <div className="p-6 bg-neutral-950/50">
                        <h4 className="text-sm font-medium text-gray-400 mb-4">Project Timeline</h4>
                        <div className="relative">
                          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-neutral-700" />
                          <div className="space-y-4">
                            {JOB_PHASES.map((phase, index) => {
                              const currentIndex = getPhaseIndex(job.phase || 'lead');
                              const isComplete = index < currentIndex;
                              const isCurrent = index === currentIndex;
                              const Icon = phase.icon;

                              return (
                                <div key={phase.id} className="flex items-center gap-4 relative">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center z-10 ${
                                    isComplete ? 'bg-brand-green' :
                                    isCurrent ? 'bg-brand-green/50 ring-2 ring-brand-green' :
                                    'bg-neutral-700'
                                  }`}>
                                    {isComplete ? (
                                      <CheckCircle2 className="w-4 h-4 text-black" />
                                    ) : (
                                      <Icon className={`w-4 h-4 ${isCurrent ? 'text-brand-green' : 'text-gray-500'}`} />
                                    )}
                                  </div>
                                  <span className={`text-sm ${
                                    isComplete || isCurrent ? 'text-white font-medium' : 'text-gray-500'
                                  }`}>
                                    {phase.label}
                                  </span>
                                  {isCurrent && (
                                    <span className="ml-auto text-xs text-brand-green bg-brand-green/10 px-2 py-1 rounded">
                                      Current
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Dates */}
                      {(job.startDate || job.estimatedCompletion) && (
                        <div className="p-6 border-t border-neutral-800 grid grid-cols-2 gap-4">
                          {job.startDate && (
                            <div>
                              <p className="text-xs text-gray-500 uppercase">Start Date</p>
                              <p className="text-white font-medium">{job.startDate}</p>
                            </div>
                          )}
                          {job.estimatedCompletion && (
                            <div>
                              <p className="text-xs text-gray-500 uppercase">Est. Completion</p>
                              <p className="text-brand-green font-medium">{job.estimatedCompletion}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Appointments Tab */}
            {activeTab === 'appointments' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-white">Your Appointments</h3>
                  <a
                    href="tel:256-274-8530"
                    className="text-brand-green hover:underline text-sm"
                  >
                    Need to reschedule? Call us
                  </a>
                </div>

                {appointments.length === 0 ? (
                  <div className="bg-neutral-900 rounded-xl p-8 text-center border border-neutral-800">
                    <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">No Scheduled Appointments</h3>
                    <p className="text-gray-400">
                      When appointments are scheduled, they&apos;ll appear here.
                    </p>
                  </div>
                ) : (
                  appointments.map((apt) => (
                    <div
                      key={apt.id}
                      className="bg-neutral-900 rounded-xl p-6 border border-neutral-800 flex items-center gap-4"
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        apt.type === 'inspection' ? 'bg-blue-500/20' :
                        apt.type === 'installation' ? 'bg-brand-green/20' :
                        'bg-purple-500/20'
                      }`}>
                        <Calendar className={`w-6 h-6 ${
                          apt.type === 'inspection' ? 'text-blue-400' :
                          apt.type === 'installation' ? 'text-brand-green' :
                          'text-purple-400'
                        }`} />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-white">{apt.title}</h4>
                        <p className="text-gray-400 text-sm">{apt.date} at {apt.time}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        apt.status === 'confirmed' ? 'bg-green-500/20 text-green-400' :
                        apt.status === 'completed' ? 'bg-gray-500/20 text-gray-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {apt.status.toUpperCase()}
                      </span>
                      <ChevronRight className="w-5 h-5 text-gray-600" />
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Weather Tab */}
            {activeTab === 'weather' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-white">Weather Conditions</h3>
                  <span className="text-gray-400 text-sm">Hartselle, AL</span>
                </div>

                {/* Current Weather */}
                <div className="bg-gradient-to-br from-brand-green/20 to-transparent rounded-xl p-6 border border-brand-green/30">
                  <div className="flex items-center gap-6">
                    <div className="w-20 h-20 bg-brand-green/20 rounded-2xl flex items-center justify-center">
                      {weather?.current ? (
                        (() => {
                          const WeatherIcon = getWeatherIcon(weather.current.condition);
                          return <WeatherIcon className="w-10 h-10 text-brand-green" />;
                        })()
                      ) : (
                        <Sun className="w-10 h-10 text-brand-green" />
                      )}
                    </div>
                    <div>
                      <p className="text-5xl font-bold text-white">
                        {weather?.current?.temp || 72}°F
                      </p>
                      <p className="text-gray-400 mt-1">
                        {weather?.current?.condition || 'Partly Cloudy'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Forecast */}
                <div className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden">
                  <div className="p-4 border-b border-neutral-800">
                    <h4 className="font-bold text-white">5-Day Forecast</h4>
                    <p className="text-gray-500 text-sm">Work condition predictions for your project</p>
                  </div>
                  <div className="divide-y divide-neutral-800">
                    {(weather?.forecast || [
                      { day: 'Today', high: 72, low: 58, condition: 'Sunny', workable: true },
                      { day: 'Tomorrow', high: 68, low: 55, condition: 'Partly Cloudy', workable: true },
                      { day: 'Wednesday', high: 65, low: 52, condition: 'Cloudy', workable: true },
                      { day: 'Thursday', high: 60, low: 48, condition: 'Rain', workable: false },
                      { day: 'Friday', high: 70, low: 54, condition: 'Sunny', workable: true },
                    ]).map((day, index) => {
                      const WeatherIcon = getWeatherIcon(day.condition);
                      return (
                        <div key={index} className="p-4 flex items-center gap-4">
                          <div className="w-24 text-gray-400">{day.day}</div>
                          <WeatherIcon className={`w-6 h-6 ${day.workable ? 'text-brand-green' : 'text-yellow-400'}`} />
                          <div className="flex-1 text-gray-400">{day.condition}</div>
                          <div className="text-white font-medium">{day.high}° / {day.low}°</div>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            day.workable
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {day.workable ? 'Good to Work' : 'Weather Hold'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-neutral-900/50 rounded-lg p-4 border border-neutral-800">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-brand-green flex-shrink-0 mt-0.5" />
                    <p className="text-gray-400 text-sm">
                      Weather conditions can affect roofing work schedules. We monitor conditions closely
                      and will contact you if any delays are expected due to weather.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Messages Tab */}
            {activeTab === 'messages' && (
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-white">Messages</h3>

                <div className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden">
                  {/* Messages List */}
                  <div className="h-96 overflow-y-auto p-4 space-y-4">
                    {messages.length === 0 ? (
                      <div className="text-center py-12">
                        <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-400">No messages yet. Send us a message below!</p>
                      </div>
                    ) : (
                      messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.isCustomer ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                            msg.isCustomer
                              ? 'bg-brand-green text-black rounded-br-sm'
                              : 'bg-neutral-800 text-white rounded-bl-sm'
                          }`}>
                            <p className="text-sm">{msg.content}</p>
                            <p className={`text-xs mt-1 ${
                              msg.isCustomer ? 'text-black/60' : 'text-gray-500'
                            }`}>
                              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Message Input */}
                  <div className="p-4 border-t border-neutral-800 bg-neutral-950">
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder="Type your message..."
                        className="flex-1 px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-gray-500 focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all"
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={!newMessage.trim()}
                        className="px-4 py-3 bg-brand-green text-black rounded-lg hover:bg-brand-green/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Send className="w-5 h-5" />
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      For urgent matters, please call{' '}
                      <a href="tel:256-274-8530" className="text-brand-green">256-274-8530</a>
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Bottom Navigation (Mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-neutral-900 border-t border-neutral-800 safe-area-pb">
        <div className="flex justify-around py-2">
          {[
            { id: 'status', icon: Home },
            { id: 'appointments', icon: Calendar },
            { id: 'weather', icon: Cloud },
            { id: 'messages', icon: MessageSquare },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`p-3 rounded-lg transition-all ${
                  activeTab === tab.id
                    ? 'text-brand-green bg-brand-green/10'
                    : 'text-gray-400'
                }`}
              >
                <Icon className="w-6 h-6" />
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
