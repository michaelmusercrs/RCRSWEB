'use client';

import { useState, useEffect } from 'react';
import {
  Users,
  Briefcase,
  FileText,
  RefreshCw,
  Search,
  ChevronRight,
  Phone,
  Mail,
  MapPin,
  Calendar,
  DollarSign,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

interface Contact {
  jnid: string;
  display_name: string;
  email: string;
  phone: string;
  address: string;
  status: string;
  created_at: string;
}

interface Job {
  jnid: string;
  name: string;
  status: string;
  address: string;
  contact_name: string;
  created_at: string;
}

interface Stats {
  totalContacts: number;
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
}

export default function JobNimbusPage() {
  const [activeTab, setActiveTab] = useState<'contacts' | 'jobs' | 'sync'>('contacts');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/jobnimbus');
      const data = await response.json();

      if (data.success) {
        setContacts(data.contacts || []);
        setJobs(data.jobs || []);
        setStats(data.stats || null);
        setLastSync(data.lastSync || null);
      } else {
        setError(data.error || 'Failed to load data');
      }
    } catch (err) {
      setError('Connection error. Please check your API configuration.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/admin/jobnimbus/sync', { method: 'POST' });
      const data = await response.json();

      if (data.success) {
        setLastSync(new Date().toISOString());
        await loadData();
      } else {
        setError(data.error || 'Sync failed');
      }
    } catch (err) {
      setError('Sync failed. Please try again.');
      console.error(err);
    } finally {
      setIsSyncing(false);
    }
  };

  const filteredContacts = contacts.filter(
    (c) =>
      c.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone?.includes(searchTerm)
  );

  const filteredJobs = jobs.filter(
    (j) =>
      j.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      j.contact_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      j.address?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">JobNimbus Integration</h1>
          <p className="text-gray-500 mt-1">Manage contacts, jobs, and sync data</p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="https://app.jobnimbus.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Open JobNimbus
          </a>
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-2 px-4 py-2 bg-brand-green text-black font-medium rounded-lg hover:bg-brand-green/90 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Contacts</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalContacts}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Briefcase className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Jobs</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalJobs}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <RefreshCw className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Active Jobs</p>
                <p className="text-2xl font-bold text-gray-900">{stats.activeJobs}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-gray-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Completed</p>
                <p className="text-2xl font-bold text-gray-900">{stats.completedJobs}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Last Sync Info */}
      {lastSync && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-600" />
          <span className="text-sm text-blue-700">
            Last synced: {new Date(lastSync).toLocaleString()}
          </span>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <div>
            <p className="text-red-800 font-medium">Error</p>
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-4">
          {[
            { id: 'contacts', label: 'Contacts', icon: Users },
            { id: 'jobs', label: 'Jobs', icon: Briefcase },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'border-brand-green text-black'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={`Search ${activeTab}...`}
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent"
        />
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 text-brand-green animate-spin" />
        </div>
      ) : (
        <>
          {/* Contacts Tab */}
          {activeTab === 'contacts' && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Contact
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Phone
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Address
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredContacts.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                          No contacts found
                        </td>
                      </tr>
                    ) : (
                      filteredContacts.map((contact) => (
                        <tr key={contact.jnid} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-brand-green/20 rounded-full flex items-center justify-center">
                                <span className="text-brand-green font-medium">
                                  {contact.display_name?.charAt(0) || '?'}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{contact.display_name}</p>
                                <p className="text-sm text-gray-500">{contact.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 text-gray-600">
                              <Phone className="w-4 h-4" />
                              {contact.phone || '-'}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 text-gray-600 max-w-xs truncate">
                              <MapPin className="w-4 h-4 flex-shrink-0" />
                              {contact.address || '-'}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                              {contact.status || 'Active'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button className="text-gray-400 hover:text-gray-600">
                              <ChevronRight className="w-5 h-5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Jobs Tab */}
          {activeTab === 'jobs' && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Job
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Customer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Address
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredJobs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                          No jobs found
                        </td>
                      </tr>
                    ) : (
                      filteredJobs.map((job) => (
                        <tr key={job.jnid} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                                <Briefcase className="w-5 h-5 text-purple-600" />
                              </div>
                              <p className="font-medium text-gray-900">{job.name || 'Untitled Job'}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-gray-600">{job.contact_name || '-'}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 text-gray-600 max-w-xs truncate">
                              <MapPin className="w-4 h-4 flex-shrink-0" />
                              {job.address || '-'}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded-full ${
                                job.status?.toLowerCase().includes('complete')
                                  ? 'bg-green-100 text-green-700'
                                  : job.status?.toLowerCase().includes('progress')
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-blue-100 text-blue-700'
                              }`}
                            >
                              {job.status || 'New'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button className="text-gray-400 hover:text-gray-600">
                              <ChevronRight className="w-5 h-5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
