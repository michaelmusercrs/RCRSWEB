'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  Loader2, Calendar, FileText, MessageSquare, Phone, Mail,
  MapPin, Cloud, CloudRain, Sun, CloudSun, CloudSnow, CloudLightning,
  CloudDrizzle, AlertTriangle, CheckCircle, Clock, Send, ChevronRight,
  Home, User, Wrench, Shield, ExternalLink, CloudFog, Upload, X, Image as ImageIcon
} from 'lucide-react';

interface CustomerData {
  customer: {
    accessToken: string;
    customerId: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    customerAddress: string;
    salesRepId: string;
    salesRepName: string;
    salesRepSlug: string;
    jobId?: string;
    createdAt: string;
    isActive: boolean;
  };
  salesRep: {
    name: string;
    slug: string;
    phone: string;
    email: string;
    photo: string;
    position: string;
  };
  appointments: Array<{
    appointmentId: string;
    type: string;
    title: string;
    description?: string;
    scheduledDate: string;
    scheduledTime: string;
    duration: number;
    status: string;
    assignedTo: string;
  }>;
  documents: Array<{
    documentId: string;
    type: string;
    title: string;
    description?: string;
    fileUrl: string;
    fileType: string;
    fileSize: number;
    uploadedAt: string;
  }>;
  messages: Array<{
    messageId: string;
    direction: string;
    subject?: string;
    content: string;
    sentAt: string;
    sentBy?: string;
  }>;
  jobStatus?: {
    phase: string;
    progress: number;
    nextMilestone: string;
    estimatedCompletion?: string;
  };
  weather?: Array<{
    date: string;
    dayOfWeek: string;
    high: number;
    low: number;
    condition: string;
    icon: string;
    precipChance: number;
    windSpeed: number;
  }>;
  hailReports?: Array<{
    reportId: string;
    date: string;
    location: string;
    distance: number;
    hailSize: string;
    severity: string;
  }>;
}

const getWeatherIcon = (icon: string) => {
  switch (icon) {
    case 'sun': return <Sun className="text-yellow-400" size={32} />;
    case 'cloud-sun': return <CloudSun className="text-yellow-300" size={32} />;
    case 'cloud': return <Cloud className="text-gray-400" size={32} />;
    case 'cloud-drizzle': return <CloudDrizzle className="text-blue-300" size={32} />;
    case 'cloud-rain': return <CloudRain className="text-blue-400" size={32} />;
    case 'cloud-snow': return <CloudSnow className="text-blue-100" size={32} />;
    case 'cloud-lightning': return <CloudLightning className="text-yellow-500" size={32} />;
    default: return <CloudFog className="text-gray-400" size={32} />;
  }
};

const getDocumentIcon = (type: string) => {
  switch (type) {
    case 'estimate': return '📋';
    case 'contract': return '📝';
    case 'invoice': return '💰';
    case 'warranty': return '🛡️';
    case 'permit': return '📜';
    case 'inspection_report': return '🔍';
    case 'photo': return '📷';
    default: return '📄';
  }
};

export default function CustomerPortal() {
  const params = useParams();
  const token = params.token as string;

  const [data, setData] = useState<CustomerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'appointments' | 'documents' | 'messages' | 'weather'>('overview');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [messageSent, setMessageSent] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  useEffect(() => {
    fetchPortalData();
  }, [token]);

  const fetchPortalData = async () => {
    try {
      const response = await fetch(`/api/customer/${token}`);
      if (!response.ok) {
        if (response.status === 404) {
          setError('This portal link is invalid or has expired.');
        } else {
          setError('Unable to load your portal. Please try again later.');
        }
        return;
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError('Unable to connect. Please check your internet connection.');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!message.trim()) return;

    setSending(true);
    try {
      const response = await fetch(`/api/customer/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim() }),
      });

      if (response.ok) {
        setMessageSent(true);
        setMessage('');
        setTimeout(() => setMessageSent(false), 3000);
        fetchPortalData(); // Refresh messages
      }
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async () => {
    if (!uploadFile) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('description', uploadDescription);
      formData.append('type', uploadFile.type.startsWith('image/') ? 'photo' : 'other');

      const response = await fetch(`/api/customer/${token}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        setUploadSuccess(true);
        setUploadFile(null);
        setUploadDescription('');
        setTimeout(() => {
          setShowUploadModal(false);
          setUploadSuccess(false);
        }, 2000);
        fetchPortalData(); // Refresh documents
      }
    } catch (err) {
      console.error('Error uploading file:', err);
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin text-green-600 mx-auto mb-4" size={48} />
          <p className="text-neutral-600">Loading your portal...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="text-red-500" size={40} />
          </div>
          <h1 className="text-2xl font-bold text-neutral-800 mb-3">Access Error</h1>
          <p className="text-neutral-600 mb-6">{error}</p>
          <p className="text-sm text-neutral-500">
            If you believe this is a mistake, please contact your sales representative.
          </p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { customer, salesRep, appointments, documents, messages, jobStatus, weather, hailReports } = data;
  const upcomingAppointments = appointments.filter(a => new Date(a.scheduledDate) >= new Date() && a.status !== 'cancelled');

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                <Home className="text-white" size={22} />
              </div>
              <div>
                <h1 className="font-bold text-neutral-800 text-lg leading-tight">River City Roofing</h1>
                <p className="text-xs text-neutral-500">Customer Portal</p>
              </div>
            </div>
            <Link
              href={`/team/${salesRep.slug}`}
              className="flex items-center gap-2 text-sm text-green-600 hover:text-green-700"
            >
              <span className="hidden sm:inline">View Rep Profile</span>
              <ExternalLink size={16} />
            </Link>
          </div>
        </div>
      </header>

      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <h2 className="text-2xl font-bold mb-2">Welcome, {customer.customerName.split(' ')[0]}!</h2>
          <p className="text-green-100 flex items-center gap-2">
            <MapPin size={16} />
            {customer.customerAddress}
          </p>
        </div>
      </div>

      {/* Job Progress */}
      {jobStatus && (
        <div className="max-w-4xl mx-auto px-4 -mt-4">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Wrench className="text-green-600" size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-neutral-800">Project Status</h3>
                  <p className="text-sm text-green-600">{jobStatus.phase}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold text-green-600">{jobStatus.progress}%</span>
              </div>
            </div>
            <div className="w-full bg-neutral-200 rounded-full h-3 mb-3">
              <div
                className="bg-gradient-to-r from-green-500 to-emerald-500 h-3 rounded-full transition-all duration-500"
                style={{ width: `${jobStatus.progress}%` }}
              />
            </div>
            <p className="text-sm text-neutral-600">
              Next: <span className="font-medium">{jobStatus.nextMilestone}</span>
            </p>
          </div>
        </div>
      )}

      {/* Sales Rep Card */}
      <div className="max-w-4xl mx-auto px-4 mt-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="font-semibold text-neutral-800 mb-4">Your Roofing Specialist</h3>
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-neutral-200 rounded-xl overflow-hidden flex-shrink-0">
              {salesRep.photo ? (
                <Image
                  src={salesRep.photo}
                  alt={salesRep.name}
                  width={64}
                  height={64}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-green-100">
                  <User className="text-green-600" size={28} />
                </div>
              )}
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-neutral-800">{salesRep.name}</h4>
              <p className="text-sm text-neutral-500 mb-3">{salesRep.position}</p>
              <div className="flex flex-wrap gap-2">
                {salesRep.phone && (
                  <a
                    href={`tel:${salesRep.phone}`}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                  >
                    <Phone size={16} />
                    Call
                  </a>
                )}
                {salesRep.email && (
                  <a
                    href={`mailto:${salesRep.email}`}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg text-sm font-medium hover:bg-neutral-200 transition-colors"
                  >
                    <Mail size={16} />
                    Email
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-4xl mx-auto px-4 mt-6">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[
            { id: 'overview', label: 'Overview', icon: Home },
            { id: 'appointments', label: 'Appointments', icon: Calendar, count: upcomingAppointments.length },
            { id: 'documents', label: 'Documents', icon: FileText, count: documents.length },
            { id: 'messages', label: 'Messages', icon: MessageSquare, count: messages.length },
            { id: 'weather', label: 'Weather', icon: Cloud },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-green-600 text-white'
                  : 'bg-white text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                  activeTab === tab.id ? 'bg-white/20' : 'bg-green-100 text-green-600'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <Calendar className="text-blue-500 mb-2" size={24} />
                <p className="text-2xl font-bold text-neutral-800">{upcomingAppointments.length}</p>
                <p className="text-sm text-neutral-500">Upcoming</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <FileText className="text-purple-500 mb-2" size={24} />
                <p className="text-2xl font-bold text-neutral-800">{documents.length}</p>
                <p className="text-sm text-neutral-500">Documents</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <MessageSquare className="text-green-500 mb-2" size={24} />
                <p className="text-2xl font-bold text-neutral-800">{messages.length}</p>
                <p className="text-sm text-neutral-500">Messages</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <Shield className="text-orange-500 mb-2" size={24} />
                <p className="text-2xl font-bold text-neutral-800">{hailReports?.length || 0}</p>
                <p className="text-sm text-neutral-500">Hail Reports</p>
              </div>
            </div>

            {/* Next Appointment */}
            {upcomingAppointments.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="font-semibold text-neutral-800 mb-4 flex items-center gap-2">
                  <Calendar className="text-blue-500" size={20} />
                  Next Appointment
                </h3>
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium text-neutral-800">{upcomingAppointments[0].title}</h4>
                    <p className="text-sm text-neutral-500 mt-1">
                      {new Date(upcomingAppointments[0].scheduledDate).toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                      })} at {upcomingAppointments[0].scheduledTime}
                    </p>
                    {upcomingAppointments[0].description && (
                      <p className="text-sm text-neutral-600 mt-2">{upcomingAppointments[0].description}</p>
                    )}
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    upcomingAppointments[0].status === 'confirmed'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {upcomingAppointments[0].status}
                  </span>
                </div>
              </div>
            )}

            {/* Weather Preview */}
            {weather && weather.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="font-semibold text-neutral-800 mb-4 flex items-center gap-2">
                  <Cloud className="text-blue-500" size={20} />
                  Weather Forecast
                </h3>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
                  {weather.slice(0, 5).map((day, i) => (
                    <div key={i} className="text-center">
                      <p className="text-sm font-medium text-neutral-600 mb-2">
                        {i === 0 ? 'Today' : day.dayOfWeek.slice(0, 3)}
                      </p>
                      <div className="flex justify-center mb-2">
                        {getWeatherIcon(day.icon)}
                      </div>
                      <p className="text-lg font-bold text-neutral-800">{day.high}°</p>
                      <p className="text-sm text-neutral-500">{day.low}°</p>
                      {day.precipChance > 20 && (
                        <p className="text-xs text-blue-500 mt-1">{day.precipChance}%</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Hail Reports */}
            {hailReports && hailReports.length > 0 && (
              <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-xl p-6 border border-orange-200">
                <h3 className="font-semibold text-orange-800 mb-4 flex items-center gap-2">
                  <AlertTriangle className="text-orange-500" size={20} />
                  Recent Hail Activity in Your Area
                </h3>
                <div className="space-y-3">
                  {hailReports.slice(0, 3).map((report) => (
                    <div key={report.reportId} className="flex items-center justify-between bg-white/60 rounded-lg p-3">
                      <div>
                        <p className="font-medium text-neutral-800">{report.location}</p>
                        <p className="text-sm text-neutral-500">
                          {new Date(report.date).toLocaleDateString()} · {report.hailSize} hail
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        report.severity === 'severe'
                          ? 'bg-red-100 text-red-700'
                          : report.severity === 'moderate'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {report.distance} mi away
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-orange-700 mt-4">
                  Hail damage can be hard to spot. Contact us for a free inspection!
                </p>
              </div>
            )}
          </div>
        )}

        {/* Appointments Tab */}
        {activeTab === 'appointments' && (
          <div className="space-y-4">
            {appointments.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-8 text-center">
                <Calendar className="text-neutral-300 mx-auto mb-4" size={48} />
                <h3 className="font-semibold text-neutral-800 mb-2">No Appointments Yet</h3>
                <p className="text-neutral-500">Your scheduled appointments will appear here.</p>
              </div>
            ) : (
              appointments.map((apt) => (
                <div key={apt.appointmentId} className="bg-white rounded-xl shadow-sm p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        apt.status === 'completed' ? 'bg-green-100' :
                        apt.status === 'cancelled' ? 'bg-red-100' :
                        'bg-blue-100'
                      }`}>
                        {apt.status === 'completed' ? (
                          <CheckCircle className="text-green-600" size={24} />
                        ) : apt.status === 'cancelled' ? (
                          <AlertTriangle className="text-red-600" size={24} />
                        ) : (
                          <Clock className="text-blue-600" size={24} />
                        )}
                      </div>
                      <div>
                        <h4 className="font-semibold text-neutral-800">{apt.title}</h4>
                        <p className="text-sm text-neutral-600 mt-1">
                          {new Date(apt.scheduledDate).toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                        <p className="text-sm text-neutral-500">{apt.scheduledTime} · {apt.duration} min</p>
                        {apt.description && (
                          <p className="text-sm text-neutral-600 mt-2">{apt.description}</p>
                        )}
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      apt.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                      apt.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                      apt.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {apt.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Documents Tab */}
        {activeTab === 'documents' && (
          <div className="space-y-4">
            {/* Upload Button */}
            <button
              onClick={() => setShowUploadModal(true)}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl p-4 font-medium hover:from-green-700 hover:to-emerald-700 transition-all flex items-center justify-center gap-2 shadow-lg"
            >
              <Upload size={20} />
              Upload Photos or Documents
            </button>

            {documents.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-8 text-center">
                <FileText className="text-neutral-300 mx-auto mb-4" size={48} />
                <h3 className="font-semibold text-neutral-800 mb-2">No Documents Yet</h3>
                <p className="text-neutral-500">Estimates, contracts, and warranties will appear here.</p>
              </div>
            ) : (
              documents.map((doc) => (
                <a
                  key={doc.documentId}
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow"
                >
                  <div className="text-3xl">{getDocumentIcon(doc.type)}</div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-neutral-800">{doc.title}</h4>
                    {doc.description && (
                      <p className="text-sm text-neutral-600 mt-1">{doc.description}</p>
                    )}
                    <p className="text-xs text-neutral-400 mt-2">
                      {new Date(doc.uploadedAt).toLocaleDateString()} · {doc.fileType.toUpperCase()}
                      {doc.fileSize > 0 && ` · ${(doc.fileSize / 1024 / 1024).toFixed(1)} MB`}
                    </p>
                  </div>
                  <ChevronRight className="text-neutral-400" size={20} />
                </a>
              ))
            )}
          </div>
        )}

        {/* Messages Tab */}
        {activeTab === 'messages' && (
          <div className="space-y-6">
            {/* Message Input */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="font-semibold text-neutral-800 mb-3">Send a Message</h3>
              <div className="flex gap-3">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type your message here..."
                  rows={3}
                  className="flex-1 border border-neutral-200 rounded-xl px-4 py-3 text-neutral-800 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                />
                <button
                  onClick={sendMessage}
                  disabled={!message.trim() || sending}
                  className="self-end px-5 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 disabled:bg-neutral-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {sending ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <Send size={18} />
                  )}
                </button>
              </div>
              {messageSent && (
                <p className="text-sm text-green-600 mt-2 flex items-center gap-2">
                  <CheckCircle size={16} />
                  Message sent successfully!
                </p>
              )}
            </div>

            {/* Message History */}
            <div className="space-y-4">
              {messages.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm p-8 text-center">
                  <MessageSquare className="text-neutral-300 mx-auto mb-4" size={48} />
                  <h3 className="font-semibold text-neutral-800 mb-2">No Messages Yet</h3>
                  <p className="text-neutral-500">Your conversation history will appear here.</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.messageId}
                    className={`rounded-xl p-4 ${
                      msg.direction === 'outbound'
                        ? 'bg-green-50 border border-green-100 ml-8'
                        : 'bg-white shadow-sm mr-8'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-neutral-800">
                        {msg.direction === 'outbound' ? 'River City Roofing' : 'You'}
                      </span>
                      <span className="text-xs text-neutral-400">
                        {new Date(msg.sentAt).toLocaleDateString()} at{' '}
                        {new Date(msg.sentAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      </span>
                    </div>
                    {msg.subject && (
                      <p className="text-sm font-medium text-neutral-700 mb-1">{msg.subject}</p>
                    )}
                    <p className="text-neutral-600">{msg.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Weather Tab */}
        {activeTab === 'weather' && (
          <div className="space-y-6">
            {/* 5-Day Forecast */}
            {weather && weather.length > 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="font-semibold text-neutral-800 mb-4">5-Day Forecast</h3>
                <div className="space-y-4">
                  {weather.map((day, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 bg-neutral-50 rounded-xl">
                      <div className="w-16 text-center">
                        <p className="font-medium text-neutral-800">
                          {i === 0 ? 'Today' : day.dayOfWeek.slice(0, 3)}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                      <div className="flex-shrink-0">
                        {getWeatherIcon(day.icon)}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-neutral-800">{day.condition}</p>
                        <p className="text-sm text-neutral-500">
                          Wind: {day.windSpeed} mph
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-neutral-800">{day.high}°</p>
                        <p className="text-sm text-neutral-500">{day.low}°</p>
                      </div>
                      {day.precipChance > 0 && (
                        <div className="text-right w-16">
                          <p className="text-sm text-blue-500 font-medium">{day.precipChance}%</p>
                          <p className="text-xs text-neutral-400">rain</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm p-8 text-center">
                <Cloud className="text-neutral-300 mx-auto mb-4" size={48} />
                <h3 className="font-semibold text-neutral-800 mb-2">Weather Unavailable</h3>
                <p className="text-neutral-500">Weather forecast data is not currently available.</p>
              </div>
            )}

            {/* Hail Reports */}
            {hailReports && hailReports.length > 0 && (
              <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-xl p-6 border border-orange-200">
                <h3 className="font-semibold text-orange-800 mb-4 flex items-center gap-2">
                  <AlertTriangle className="text-orange-500" size={20} />
                  Hail Reports Within 50 Miles
                </h3>
                <div className="space-y-3">
                  {hailReports.map((report) => (
                    <div key={report.reportId} className="bg-white/60 rounded-xl p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium text-neutral-800">{report.location}</h4>
                          <p className="text-sm text-neutral-500 mt-1">
                            {new Date(report.date).toLocaleDateString('en-US', {
                              weekday: 'long',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            report.severity === 'severe'
                              ? 'bg-red-100 text-red-700'
                              : report.severity === 'moderate'
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {report.severity}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-4 mt-3 text-sm">
                        <span className="text-neutral-600">
                          <strong>{report.hailSize}</strong> hail
                        </span>
                        <span className="text-neutral-600">
                          <strong>{report.distance}</strong> miles away
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 p-4 bg-white/80 rounded-xl">
                  <p className="text-sm text-neutral-700 mb-3">
                    <strong>Did you know?</strong> Hail damage often goes unnoticed until it causes bigger problems like leaks. Even small hail can damage shingles.
                  </p>
                  <a
                    href={`tel:${salesRep.phone}`}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
                  >
                    <Phone size={16} />
                    Request Free Hail Inspection
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-neutral-200 mt-auto">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                <Home className="text-white" size={16} />
              </div>
              <span className="text-sm text-neutral-600">River City Roofing Solutions</span>
            </div>
            <div className="flex items-center gap-4 text-sm text-neutral-500">
              <a href="tel:+12565551234" className="hover:text-green-600 flex items-center gap-1">
                <Phone size={14} />
                (256) 555-1234
              </a>
              <span>•</span>
              <span>Huntsville, AL</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-neutral-800">Upload File</h3>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadFile(null);
                  setUploadDescription('');
                }}
                className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
              >
                <X className="text-neutral-500" size={20} />
              </button>
            </div>

            {uploadSuccess ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="text-green-600" size={32} />
                </div>
                <h4 className="font-semibold text-neutral-800 mb-2">Upload Successful!</h4>
                <p className="text-neutral-500">Your file has been uploaded and shared with your rep.</p>
              </div>
            ) : (
              <>
                {/* File Drop Zone */}
                <label className={`block border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  uploadFile ? 'border-green-400 bg-green-50' : 'border-neutral-300 hover:border-green-400 hover:bg-green-50/50'
                }`}>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*,.pdf,.doc,.docx"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  />
                  {uploadFile ? (
                    <div>
                      <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                        {uploadFile.type.startsWith('image/') ? (
                          <ImageIcon className="text-green-600" size={24} />
                        ) : (
                          <FileText className="text-green-600" size={24} />
                        )}
                      </div>
                      <p className="font-medium text-neutral-800">{uploadFile.name}</p>
                      <p className="text-sm text-neutral-500 mt-1">
                        {(uploadFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          setUploadFile(null);
                        }}
                        className="text-sm text-red-500 hover:text-red-600 mt-2"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div>
                      <Upload className="text-neutral-400 mx-auto mb-3" size={32} />
                      <p className="font-medium text-neutral-700">Click to upload or drag and drop</p>
                      <p className="text-sm text-neutral-500 mt-1">
                        Images (JPG, PNG) or Documents (PDF, DOC)
                      </p>
                      <p className="text-xs text-neutral-400 mt-2">Max file size: 10MB</p>
                    </div>
                  )}
                </label>

                {/* Description */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Description (optional)
                  </label>
                  <input
                    type="text"
                    value={uploadDescription}
                    onChange={(e) => setUploadDescription(e.target.value)}
                    placeholder="e.g., Photo of roof damage, insurance paperwork..."
                    className="w-full border border-neutral-200 rounded-xl px-4 py-3 text-neutral-800 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                {/* Upload Button */}
                <button
                  onClick={handleFileUpload}
                  disabled={!uploadFile || uploading}
                  className="w-full mt-6 bg-green-600 text-white py-3 rounded-xl font-medium hover:bg-green-700 disabled:bg-neutral-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload size={18} />
                      Upload File
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
