'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Phone, MessageSquare, Mail, MapPin, Clock, User,
  Loader2, Home, Search, Plus, Users, X, ArrowLeft,
  ExternalLink, Copy, Send, CheckCircle,
  BarChart3, Building, Filter, RefreshCw, Briefcase,
  DollarSign
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

// =============================================================================
// Types
// =============================================================================

interface JNContact {
  jnid: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  status: string;
  source: string;
  salesRep: string;
  lastActivity: string;
  notesPreview: string;
  jobCount: number;
  totalJobValue: number;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// Status Configuration
// =============================================================================

const statusColors: Record<string, string> = {
  Lead: 'bg-blue-500/20 text-blue-400 ring-blue-500/30',
  New: 'bg-blue-500/20 text-blue-400 ring-blue-500/30',
  Contacted: 'bg-purple-500/20 text-purple-400 ring-purple-500/30',
  'Appointment Set': 'bg-cyan-500/20 text-cyan-400 ring-cyan-500/30',
  Inspected: 'bg-orange-500/20 text-orange-400 ring-orange-500/30',
  'Estimate Sent': 'bg-yellow-500/20 text-yellow-400 ring-yellow-500/30',
  'Contract Signed': 'bg-green-500/20 text-green-400 ring-green-500/30',
  'Material Ordered': 'bg-indigo-500/20 text-indigo-400 ring-indigo-500/30',
  'Work In Progress': 'bg-amber-500/20 text-amber-400 ring-amber-500/30',
  Complete: 'bg-emerald-500/20 text-emerald-400 ring-emerald-500/30',
  Completed: 'bg-emerald-500/20 text-emerald-400 ring-emerald-500/30',
  Lost: 'bg-red-500/20 text-red-400 ring-red-500/30',
  Cancelled: 'bg-red-500/20 text-red-400 ring-red-500/30',
};

function StatusBadge({ status }: { status: string }) {
  const color = statusColors[status] || 'bg-neutral-500/20 text-neutral-400 ring-neutral-500/30';
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ring-1 ${color}`}>
      {status || 'Unknown'}
    </span>
  );
}

// =============================================================================
// Customers Page - Real JN Data
// =============================================================================

export default function CustomersPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const [contacts, setContacts] = useState<JNContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [repName, setRepName] = useState('');

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/portal');
    }
  }, [user, isLoading, router]);

  // Fetch contacts from JN
  const fetchContacts = async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/portal/jobnimbus/my-contacts');
      if (!response.ok) {
        throw new Error('Failed to load contacts from JobNimbus');
      }
      const data = await response.json();
      if (data.success) {
        setContacts(data.contacts || []);
        setRepName(data.repName || '');
      } else {
        throw new Error(data.error || 'Failed to load contacts');
      }
    } catch (err) {
      console.error('Error fetching contacts:', err);
      setError(err instanceof Error ? err.message : 'Unable to load contacts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, [user]);

  // Filter and search
  const filteredContacts = useMemo(() => {
    let result = [...contacts];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(term) ||
        c.address.toLowerCase().includes(term) ||
        c.city.toLowerCase().includes(term) ||
        c.email.toLowerCase().includes(term) ||
        c.phone.includes(term) ||
        c.status.toLowerCase().includes(term)
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter(c => c.status === statusFilter);
    }

    return result;
  }, [contacts, searchTerm, statusFilter]);

  // Get unique statuses for filter
  const uniqueStatuses = useMemo(() => {
    const statuses = new Set(contacts.map(c => c.status).filter(Boolean));
    return Array.from(statuses).sort();
  }, [contacts]);

  // Action handlers
  const handleCall = (contact: JNContact) => {
    window.location.href = `tel:${contact.phone}`;
  };

  const handleText = (contact: JNContact) => {
    window.location.href = `sms:${contact.phone}?body=${encodeURIComponent(
      `Hi ${contact.name.split(' ')[0]}, this is your rep from River City Roofing Solutions.`
    )}`;
  };

  const handleEmail = (contact: JNContact) => {
    window.location.href = `mailto:${contact.email}`;
  };

  const handleDirections = (contact: JNContact) => {
    const address = `${contact.address}, ${contact.city}, ${contact.state} ${contact.zip}`;
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`, '_blank');
  };

  const handleCopyPhone = async (contact: JNContact) => {
    try {
      await navigator.clipboard.writeText(contact.phone);
      setCopiedId(contact.jnid);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback
    }
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-brand-green" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      {/* Background Pattern */}
      <div className="fixed inset-0 opacity-30 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 25px 25px, rgba(255,255,255,0.03) 2px, transparent 0)`,
          backgroundSize: '50px 50px'
        }} />
      </div>

      <div className="relative z-10 pb-24">
        {/* Header */}
        <header className="border-b border-white/5 backdrop-blur-xl bg-black/20 sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Link
                  href="/portal/sales"
                  className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                  <ArrowLeft size={20} className="text-neutral-400" />
                </Link>
                <div>
                  <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">My Customers</h1>
                  <p className="text-xs text-neutral-400">
                    {loading ? 'Loading from JobNimbus...' : (
                      <>
                        {filteredContacts.length} customer{filteredContacts.length !== 1 ? 's' : ''}
                        {repName && <span className="text-neutral-500"> | {repName}</span>}
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchContacts}
                  disabled={loading}
                  className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                  title="Refresh from JobNimbus"
                >
                  <RefreshCw size={18} className={`text-neutral-400 ${loading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                    showFilters ? 'bg-brand-green/20 text-brand-green' : 'bg-white/5 text-neutral-400 hover:bg-white/10'
                  }`}
                >
                  <Filter size={18} />
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          {/* Search Bar */}
          <div className="mb-4">
            <div className="relative">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                type="text"
                placeholder="Search by name, address, phone, status..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white/[0.02] border border-white/5 rounded-xl pl-12 pr-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50 focus:ring-1 focus:ring-brand-green/30"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 mb-4">
              <label className="text-xs text-neutral-400 mb-2 block">Filter by Status</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    statusFilter === 'all'
                      ? 'bg-brand-green/20 text-brand-green ring-1 ring-brand-green/30'
                      : 'bg-white/5 text-neutral-400 hover:bg-white/10'
                  }`}
                >
                  All
                </button>
                {uniqueStatuses.map(status => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      statusFilter === status
                        ? (statusColors[status] || 'bg-neutral-500/20 text-neutral-400')
                        : 'bg-white/5 text-neutral-400 hover:bg-white/10'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 mb-4 text-center">
              <p className="text-sm text-red-400 mb-2">{error}</p>
              <button
                onClick={fetchContacts}
                className="text-sm text-brand-green hover:text-brand-green/80 font-medium"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="animate-spin text-brand-green mb-4" size={40} />
              <p className="text-sm text-neutral-400">Loading contacts from JobNimbus...</p>
            </div>
          )}

          {/* Contacts List */}
          {!loading && !error && filteredContacts.length > 0 && (
            <div className="space-y-3">
              {filteredContacts.map((contact) => (
                <div
                  key={contact.jnid}
                  className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 hover:bg-white/[0.04] transition-colors"
                >
                  {/* Contact Info */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4 className="font-semibold text-white">{contact.name}</h4>
                        <StatusBadge status={contact.status} />
                      </div>
                      {(contact.address || contact.city) && (
                        <div className="flex items-center gap-2 text-sm text-neutral-400">
                          <MapPin size={14} />
                          <span>
                            {[contact.address, contact.city, contact.state].filter(Boolean).join(', ')}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-neutral-500">
                        {contact.phone && <span>{contact.phone}</span>}
                        {contact.email && <span>{contact.email}</span>}
                      </div>
                      {contact.lastActivity && (
                        <div className="flex items-center gap-1.5 mt-1.5 text-xs text-neutral-500">
                          <Clock size={12} />
                          <span>Updated: {new Date(contact.lastActivity).toLocaleDateString()}</span>
                        </div>
                      )}
                      {contact.source && (
                        <div className="mt-1 text-xs text-neutral-500">
                          Source: {contact.source}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-5 gap-2">
                    <button
                      onClick={() => handleCall(contact)}
                      disabled={!contact.phone}
                      className="flex flex-col items-center justify-center p-2.5 bg-green-500/20 hover:bg-green-500/30 rounded-xl transition-colors active:scale-95 disabled:opacity-30"
                    >
                      <Phone size={18} className="text-green-400" />
                      <span className="text-[10px] text-green-400 mt-0.5">Call</span>
                    </button>
                    <button
                      onClick={() => handleText(contact)}
                      disabled={!contact.phone}
                      className="flex flex-col items-center justify-center p-2.5 bg-brand-green/20 hover:bg-brand-green/30 rounded-xl transition-colors active:scale-95 disabled:opacity-30"
                    >
                      <MessageSquare size={18} className="text-blue-400" />
                      <span className="text-[10px] text-blue-400 mt-0.5">Text</span>
                    </button>
                    <button
                      onClick={() => handleEmail(contact)}
                      disabled={!contact.email}
                      className="flex flex-col items-center justify-center p-2.5 bg-purple-500/20 hover:bg-purple-500/30 rounded-xl transition-colors active:scale-95 disabled:opacity-30"
                    >
                      <Mail size={18} className="text-purple-400" />
                      <span className="text-[10px] text-purple-400 mt-0.5">Email</span>
                    </button>
                    <button
                      onClick={() => handleDirections(contact)}
                      disabled={!contact.address}
                      className="flex flex-col items-center justify-center p-2.5 bg-orange-500/20 hover:bg-orange-500/30 rounded-xl transition-colors active:scale-95 disabled:opacity-30"
                    >
                      <MapPin size={18} className="text-orange-400" />
                      <span className="text-[10px] text-orange-400 mt-0.5">Map</span>
                    </button>
                    <Link
                      href={`/portal/sales/customers/${contact.jnid}`}
                      className="flex flex-col items-center justify-center p-2.5 bg-brand-green/20 hover:bg-brand-green/30 rounded-xl transition-colors active:scale-95"
                    >
                      <ExternalLink size={18} className="text-brand-green" />
                      <span className="text-[10px] text-brand-green mt-0.5">Details</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && filteredContacts.length === 0 && (
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-12 text-center">
              <Users size={48} className="text-neutral-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">
                {contacts.length === 0 ? 'No customers found in JobNimbus' : 'No matching customers'}
              </h3>
              <p className="text-sm text-neutral-500 mb-4">
                {contacts.length === 0
                  ? `No contacts are assigned to you (${repName}) in JobNimbus yet.`
                  : 'Try adjusting your search or filters.'}
              </p>
              {contacts.length > 0 && (
                <button
                  onClick={() => { setSearchTerm(''); setStatusFilter('all'); }}
                  className="text-sm text-brand-green hover:text-brand-green/80"
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </main>

        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-xl border-t border-white/5 px-4 py-2 z-30 sm:hidden">
          <div className="flex items-center justify-around">
            <Link href="/portal/sales" className="flex flex-col items-center p-2 text-neutral-400 hover:text-white">
              <Home size={20} />
              <span className="text-xs mt-1">Home</span>
            </Link>
            <Link href="/portal/sales/leads" className="flex flex-col items-center p-2 text-neutral-400 hover:text-white">
              <Users size={20} />
              <span className="text-xs mt-1">Leads</span>
            </Link>
            <button className="flex flex-col items-center p-3 -mt-4 bg-brand-green rounded-full text-black">
              <Plus size={24} />
            </button>
            <Link href="/portal/sales/customers" className="flex flex-col items-center p-2 text-brand-green">
              <User size={20} />
              <span className="text-xs mt-1">Customers</span>
            </Link>
            <Link href="/portal/dashboard" className="flex flex-col items-center p-2 text-neutral-400 hover:text-white">
              <Building size={20} />
              <span className="text-xs mt-1">Portal</span>
            </Link>
          </div>
        </nav>
      </div>
    </div>
  );
}
