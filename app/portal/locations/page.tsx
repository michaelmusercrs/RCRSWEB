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
  Activity
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
  login: 'bg-green-100 text-green-600',
  delivery_start: 'bg-blue-100 text-blue-600',
  delivery_arrive: 'bg-purple-100 text-purple-600',
  delivery_complete: 'bg-teal-100 text-teal-600',
  inspection: 'bg-orange-100 text-orange-600',
  check_in: 'bg-green-100 text-green-600',
  check_out: 'bg-red-100 text-red-600',
  break: 'bg-yellow-100 text-yellow-600',
  manual: 'bg-gray-100 text-gray-600'
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

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading location logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/portal/dashboard" className="text-gray-500 hover:text-gray-700">
                <ArrowLeft className="w-6 h-6" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Location Logs</h1>
                <p className="text-sm text-gray-500">Track team member locations and activities</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setViewMode('logs')}
                className={`px-4 py-2 rounded-lg ${
                  viewMode === 'logs'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Activity className="w-5 h-5 inline-block mr-1" />
                Logs
              </button>
              <button
                onClick={() => setViewMode('users')}
                className={`px-4 py-2 rounded-lg ${
                  viewMode === 'users'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <User className="w-5 h-5 inline-block mr-1" />
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
              <div key={user.userId} className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{user.userName}</h3>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${activityColors[user.lastLocation.activity]}`}>
                        {activityIcons[user.lastLocation.activity]}
                        <span className="ml-1">{activityLabels[user.lastLocation.activity]}</span>
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 mt-2">
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
                      <div className="text-sm text-blue-600 mt-2">
                        Job: {user.lastLocation.relatedJobNumber}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Logs View */
          <>
            {/* Search and Filters */}
            <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search by user, address, job number..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <Filter className="w-5 h-5" />
                  <span>Filters</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {showFilters && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Activity Type</label>
                    <select
                      value={activityFilter}
                      onChange={(e) => setActivityFilter(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">User</label>
                    <select
                      value={userFilter}
                      onChange={(e) => setUserFilter(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    >
                      <option value="all">All Users</option>
                      {uniqueUsers.map(user => (
                        <option key={user} value={user}>{user}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <input
                      type="date"
                      value={dateFilter}
                      onChange={(e) => setDateFilter(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="text-2xl font-bold text-gray-900">{logs.length}</div>
                <div className="text-sm text-gray-500">Total Logs</div>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="text-2xl font-bold text-green-600">{activeUsers.length}</div>
                <div className="text-sm text-gray-500">Active Users</div>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="text-2xl font-bold text-blue-600">
                  {logs.filter(l => l.activity.includes('delivery')).length}
                </div>
                <div className="text-sm text-gray-500">Deliveries</div>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="text-2xl font-bold text-purple-600">
                  {logs.filter(l => l.activity === 'inspection').length}
                </div>
                <div className="text-sm text-gray-500">Inspections</div>
              </div>
            </div>

            {/* Logs Timeline */}
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold text-gray-900">Activity Timeline</h2>
                <p className="text-sm text-gray-500">{filteredLogs.length} entries</p>
              </div>
              <div className="divide-y">
                {filteredLogs.length === 0 ? (
                  <div className="p-8 text-center">
                    <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900">No logs found</h3>
                    <p className="text-gray-500">Try adjusting your filters or search term</p>
                  </div>
                ) : (
                  filteredLogs.map((log) => (
                    <div key={log.logId} className="p-4 hover:bg-gray-50">
                      <div className="flex items-start space-x-4">
                        <div className={`p-2 rounded-lg ${activityColors[log.activity]}`}>
                          {activityIcons[log.activity]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span className="font-medium text-gray-900">{log.userName}</span>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${activityColors[log.activity]}`}>
                                {activityLabels[log.activity]}
                              </span>
                            </div>
                            <div className="text-sm text-gray-500 flex items-center">
                              <Clock className="w-4 h-4 mr-1" />
                              {formatDateTime(log.timestamp)}
                            </div>
                          </div>
                          <div className="mt-1 text-sm text-gray-600">
                            <div className="flex items-center">
                              <MapPin className="w-4 h-4 mr-1 text-gray-400" />
                              {log.address ? (
                                <span>{log.address}, {log.city}, {log.state}</span>
                              ) : (
                                <span>{log.city}, {log.state}</span>
                              )}
                            </div>
                            {log.relatedJobNumber && (
                              <div className="flex items-center mt-1">
                                <Route className="w-4 h-4 mr-1 text-gray-400" />
                                <span className="text-blue-600">Job: {log.relatedJobNumber}</span>
                              </div>
                            )}
                            {log.notes && (
                              <div className="mt-1 text-gray-500 italic">
                                {log.notes}
                              </div>
                            )}
                          </div>
                          <div className="mt-2 text-xs text-gray-400">
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
