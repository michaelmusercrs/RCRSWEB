'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  MapPin,
  Clock,
  User,
  Truck,
  ClipboardCheck,
  LogIn,
  LogOut,
  Coffee,
  Navigation,
  Filter,
  Search,
  ChevronDown,
  Calendar,
  Route,
  Activity,
  RefreshCw,
} from 'lucide-react';

interface LocationLog {
  logId: string;
  userId: string;
  userName: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  address?: string;
  city?: string;
  state?: string;
  activity: 'login' | 'delivery_start' | 'delivery_arrive' | 'delivery_complete' | 'inspection' | 'check_in' | 'check_out' | 'break' | 'manual';
  relatedJobNumber?: string;
  relatedTaskId?: string;
  notes?: string;
  deviceInfo?: string;
}

interface ActiveUser {
  userId: string;
  userName: string;
  lastLocation: LocationLog;
}

const activityIcons: Record<string, React.ReactNode> = {
  login: <LogIn className="w-4 h-4" />,
  delivery_start: <Truck className="w-4 h-4" />,
  delivery_arrive: <MapPin className="w-4 h-4" />,
  delivery_complete: <ClipboardCheck className="w-4 h-4" />,
  inspection: <ClipboardCheck className="w-4 h-4" />,
  check_in: <LogIn className="w-4 h-4" />,
  check_out: <LogOut className="w-4 h-4" />,
  break: <Coffee className="w-4 h-4" />,
  manual: <Navigation className="w-4 h-4" />
};

const activityColors: Record<string, string> = {
  login: 'bg-green-500/20 text-green-400',
  delivery_start: 'bg-blue-500/20 text-blue-400',
  delivery_arrive: 'bg-purple-500/20 text-purple-400',
  delivery_complete: 'bg-teal-500/20 text-teal-400',
  inspection: 'bg-orange-500/20 text-orange-400',
  check_in: 'bg-green-500/20 text-green-400',
  check_out: 'bg-red-500/20 text-red-400',
  break: 'bg-yellow-500/20 text-yellow-400',
  manual: 'bg-zinc-500/20 text-zinc-400'
};

const activityLabels: Record<string, string> = {
  login: 'Login',
  delivery_start: 'Delivery Start',
  delivery_arrive: 'Arrived',
  delivery_complete: 'Delivery Complete',
  inspection: 'Inspection',
  check_in: 'Check In',
  check_out: 'Check Out',
  break: 'Break',
  manual: 'Manual Entry'
};

export default function LocationLogsPage() {
  const [logs, setLogs] = useState<LocationLog[]>([]);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activityFilter, setActivityFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'logs' | 'users'>('logs');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await fetch('/api/portal/locations');
      const data = await response.json();
      setLogs(data.logs || []);
      setActiveUsers(data.activeUsers || []);
    } catch (error) {
      console.error('Error fetching location data:', error);
    } finally {
      setLoading(false);
    }
  };

  const uniqueUsers = [...new Set(logs.map(l => l.userName))];

  const filteredLogs = logs.filter(log => {
    const matchesSearch =
      log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.relatedJobNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.notes?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesActivity = activityFilter === 'all' || log.activity === activityFilter;
    const matchesDate = !dateFilter || log.timestamp.startsWith(dateFilter);
    const matchesUser = userFilter === 'all' || log.userName === userFilter;

    return matchesSearch && matchesActivity && matchesDate && matchesUser;
  });

  const formatDateTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getTimeSince = (timestamp: string) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMins > 0) return `${diffMins}m ago`;
    return 'Just now';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-10 h-10 animate-spin text-[#39FF14] mx-auto mb-4" />
          <p className="text-zinc-400">Loading location logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/portal/dashboard" className="text-zinc-400 hover:text-white transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-white">Location Logs</h1>
                <p className="text-sm text-zinc-400">Track team member locations and activities</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={fetchData}
                className="p-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors"
              >
                <RefreshCw className="w-5 h-5 text-zinc-400" />
              </button>
              <button
                onClick={() => setViewMode('logs')}
                className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 ${
                  viewMode === 'logs'
                    ? 'bg-[#39FF14] text-black'
                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                <Activity className="w-4 h-4" />
                Logs
              </button>
              <button
                onClick={() => setViewMode('users')}
                className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 ${
                  viewMode === 'users'
                    ? 'bg-[#39FF14] text-black'
                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                <User className="w-4 h-4" />
                Active Users
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {viewMode === 'users' ? (
          /* Active Users View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeUsers.map((user) => (
              <div key={user.userId} className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                    <User className="w-6 h-6 text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-white">{user.userName}</h3>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${activityColors[user.lastLocation.activity]}`}>
                        {activityIcons[user.lastLocation.activity]}
                        <span className="ml-1">{activityLabels[user.lastLocation.activity]}</span>
                      </span>
                    </div>
                    <div className="text-sm text-zinc-500 mt-2">
                      <div className="flex items-center">
                        <MapPin className="w-4 h-4 mr-1" />
                        {user.lastLocation.address || `${user.lastLocation.city}, ${user.lastLocation.state}`}
                      </div>
                      <div className="flex items-center mt-1">
                        <Clock className="w-4 h-4 mr-1" />
                        {getTimeSince(user.lastLocation.timestamp)}
                      </div>
                    </div>
                    {user.lastLocation.relatedJobNumber && (
                      <div className="text-sm text-[#39FF14] mt-2">
                        Job: {user.lastLocation.relatedJobNumber}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {activeUsers.length === 0 && (
              <div className="col-span-full bg-zinc-900 rounded-xl border border-zinc-800 p-8 text-center">
                <User className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                <p className="text-zinc-400">No active users at this time</p>
              </div>
            )}
          </div>
        ) : (
          /* Logs View */
          <>
            {/* Search and Filters */}
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 mb-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-500 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search by user, address, job number..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-[#39FF14]/30 focus:border-[#39FF14]/50 bg-zinc-800 text-white placeholder-zinc-500"
                  />
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center space-x-2 px-4 py-2 border border-zinc-700 rounded-lg hover:bg-zinc-800 text-zinc-300 transition-colors"
                >
                  <Filter className="w-5 h-5" />
                  <span>Filters</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {showFilters && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-zinc-800">
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-1">Activity Type</label>
                    <select
                      value={activityFilter}
                      onChange={(e) => setActivityFilter(e.target.value)}
                      className="w-full border border-zinc-700 rounded-lg px-3 py-2 bg-zinc-800 text-white"
                    >
                      <option value="all">All Activities</option>
                      <option value="login">Login</option>
                      <option value="delivery_start">Delivery Start</option>
                      <option value="delivery_arrive">Delivery Arrive</option>
                      <option value="delivery_complete">Delivery Complete</option>
                      <option value="inspection">Inspection</option>
                      <option value="check_in">Check In</option>
                      <option value="check_out">Check Out</option>
                      <option value="break">Break</option>
                      <option value="manual">Manual</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-1">User</label>
                    <select
                      value={userFilter}
                      onChange={(e) => setUserFilter(e.target.value)}
                      className="w-full border border-zinc-700 rounded-lg px-3 py-2 bg-zinc-800 text-white"
                    >
                      <option value="all">All Users</option>
                      {uniqueUsers.map(user => (
                        <option key={user} value={user}>{user}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-1">Date</label>
                    <input
                      type="date"
                      value={dateFilter}
                      onChange={(e) => setDateFilter(e.target.value)}
                      className="w-full border border-zinc-700 rounded-lg px-3 py-2 bg-zinc-800 text-white"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Total Logs', value: logs.length, color: 'text-white' },
                { label: 'Active Users', value: activeUsers.length, color: 'text-green-400' },
                { label: 'Deliveries', value: logs.filter(l => l.activity.includes('delivery')).length, color: 'text-blue-400' },
                { label: 'Inspections', value: logs.filter(l => l.activity === 'inspection').length, color: 'text-purple-400' },
              ].map((stat) => (
                <div key={stat.label} className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
                  <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                  <div className="text-sm text-zinc-500">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Logs Timeline */}
            <div className="bg-zinc-900 rounded-xl border border-zinc-800">
              <div className="p-4 border-b border-zinc-800">
                <h2 className="text-lg font-semibold text-white">Activity Timeline</h2>
                <p className="text-sm text-zinc-500">{filteredLogs.length} entries</p>
              </div>
              <div className="divide-y divide-zinc-800">
                {filteredLogs.length === 0 ? (
                  <div className="p-8 text-center">
                    <MapPin className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-white">No logs found</h3>
                    <p className="text-zinc-500">Try adjusting your filters or search term</p>
                  </div>
                ) : (
                  filteredLogs.map((log) => (
                    <div key={log.logId} className="p-4 hover:bg-zinc-800/50 transition-colors">
                      <div className="flex items-start space-x-4">
                        <div className={`p-2 rounded-lg ${activityColors[log.activity]}`}>
                          {activityIcons[log.activity]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span className="font-medium text-white">{log.userName}</span>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${activityColors[log.activity]}`}>
                                {activityLabels[log.activity]}
                              </span>
                            </div>
                            <div className="text-sm text-zinc-500 flex items-center">
                              <Clock className="w-4 h-4 mr-1" />
                              {formatDateTime(log.timestamp)}
                            </div>
                          </div>
                          <div className="mt-1 text-sm text-zinc-400">
                            <div className="flex items-center">
                              <MapPin className="w-4 h-4 mr-1 text-zinc-500" />
                              {log.address ? (
                                <span>{log.address}, {log.city}, {log.state}</span>
                              ) : (
                                <span>{log.city}, {log.state}</span>
                              )}
                            </div>
                            {log.relatedJobNumber && (
                              <div className="flex items-center mt-1">
                                <Route className="w-4 h-4 mr-1 text-zinc-500" />
                                <span className="text-[#39FF14]">Job: {log.relatedJobNumber}</span>
                              </div>
                            )}
                            {log.notes && (
                              <div className="mt-1 text-zinc-500 italic">
                                {log.notes}
                              </div>
                            )}
                          </div>
                          <div className="mt-2 text-xs text-zinc-600">
                            Accuracy: {log.accuracy}m
                            {log.deviceInfo && ` • ${log.deviceInfo}`}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
